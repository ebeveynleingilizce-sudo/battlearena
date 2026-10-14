import { SKILLS, SKILL_BALANCE, teamStats } from './skills.js';

export function xpThreshold(level, config) {
  if(level<=1)return 0;
  const table=config.xpThresholds;
  if(level<=table.length)return table[level-1];
  const extra=level-table.length;
  const last=table.at(-1), gap=last-table.at(-2);
  return last + extra*gap + config.xpThresholdGrowth*extra*(extra+1)/2;
}

export class ProgressionSystem {
  constructor(config, matchID) {
    this.config=config;
    this.matchID=matchID;
    this.maxRank=Math.min(SKILL_BALANCE.maxRank,config.skillBalance?.maxRank ?? SKILL_BALANCE.maxRank);
    this.teams=[0,1].map(team=>{
      const skills=Object.fromEntries(SKILLS.map(skill=>[skill.id,0]));
      return {team,xp:0,level:1,skills,pending:[],awardedChoices:0,
        autoRandomState:((config.seed)^Math.imul(team+1,0x85ebca6b))>>>0||1,
        autoSelections:0,
        randomState:((config.skillSeed ?? config.seed) ^ Math.imul(team+1,0x9e3779b9))>>>0 || 1,
        spawnProgress:0,stats:teamStats(config,skills)};
    });
  }

  random(team) {
    let x=team.randomState;
    x^=x<<13;x^=x>>>17;x^=x<<5;
    team.randomState=x>>>0;
    return team.randomState/4294967296;
  }

  activate(team,tick=0) {
    const right=team.pending[0];
    if(!right || right.options)return;
    const eligible=SKILLS.filter(skill=>team.skills[skill.id]<this.maxRank).map(skill=>skill.id);
    // Unique choices. At the very end of the finite pool, show its 1–2 remaining skills.
    const options=[];
    while(options.length<3 && eligible.length){
      const index=Math.floor(this.random(team)*eligible.length);
      options.push(eligible.splice(index,1)[0]);
    }
    right.options=options;
    right.activatedTick=tick;
    right.deadline=this.config.skillChoiceSeconds>0?tick+Math.round(this.config.skillChoiceSeconds*this.config.tickRate):null;
  }

  award(teamID, amount, events,tick=0) {
    const team=this.teams[teamID];
    if(!team || amount<=0)return;
    team.xp+=amount;
    events.push({type:'xp',team:teamID,amount});
    while(team.xp>=xpThreshold(team.level+1,this.config)){
      team.level++;
      const canAward=team.awardedChoices<SKILLS.length*this.maxRank && SKILLS.some(skill=>team.skills[skill.id]<this.maxRank);
      if(canAward){
        team.pending.push({id:`${this.matchID}:${teamID}:${team.level}`,level:team.level,options:null});
        team.awardedChoices++;
      }
      events.push({type:'level-up',team:teamID,level:team.level,hasChoice:canAward});
    }
    this.activate(team,tick);
  }

  validate(command, actorTeam) {
    if(command?.type!=='selectSkill')return 'unknown-command';
    if(command.team!==0 && command.team!==1)return 'invalid-team';
    if(actorTeam!==command.team)return 'team-mismatch';
    if(command.matchID!==this.matchID)return 'stale-match';
    const team=this.teams[command.team],right=team.pending[0];
    if(!right || command.choiceID!==right.id)return 'choice-not-pending';
    if(!right.options.includes(command.skillID))return 'skill-not-offered';
    if(team.skills[command.skillID]>=this.maxRank)return 'skill-maxed';
    return null;
  }

  select(command, actorTeam, events,tick=0) {
    const reason=this.validate(command,actorTeam);
    if(reason)return {accepted:false,reason};
    const team=this.teams[command.team];
    const previousStats=team.stats;
    team.skills[command.skillID]++;
    team.pending.shift();
    team.stats=teamStats(this.config,team.skills);
    this.activate(team,tick);
    events.push({type:'skill-selected',team:command.team,skillID:command.skillID,
      rank:team.skills[command.skillID],choiceID:command.choiceID,automatic:!!command.automatic});
    return {accepted:true,previousStats};
  }

  automaticCommand(team,tick){
    const right=team.pending[0];
    if(!right||right.deadline===null||tick<right.deadline)return null;
    let x=team.autoRandomState;x^=x<<13;x^=x>>>17;x^=x<<5;team.autoRandomState=x>>>0;
    const skillID=right.options[Math.floor(team.autoRandomState/4294967296*right.options.length)];
    team.autoSelections++;
    return {type:'selectSkill',team:team.team,matchID:this.matchID,choiceID:right.id,skillID,actorTeam:team.team,automatic:true};
  }
}
