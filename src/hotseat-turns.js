// Pure turn arbiter for one-device, two-player play.
// The battle simulation keeps running; this controller only decides whose
// interactive question/skill choice is presented.
export class HotseatTurns {
  constructor() { this.reset(); }
  reset() { this.team=0; this.lastCompleted=[null,null]; }
  hasDecision(sim,team) {
    return sim.teams[team].pending.length>0 || Boolean(sim.questions.teams[team].active);
  }
  currentDecision(sim) {
    const team=this.team;
    const skill=sim.teams[team].pending[0];
    if(skill)return {team,type:'skill',id:skill.id};
    const question=sim.questions.teams[team].active;
    return question?{team,type:'question',id:question.id}:null;
  }
  // Advance only after the previous active decision is resolved.
  // Prefer the other player whenever they have an available decision.
  update(sim) {
    if(sim.status!=='running')return this.team;
    const current=this.currentDecision(sim);
    const other=1-this.team;
    if(current){
      const key=current.type+':'+current.id;
      if(this.lastCompleted[this.team]!==key)return this.team;
    }
    if(this.hasDecision(sim,other))this.team=other;
    return this.team;
  }
  complete(team,type,id) {
    if(team!==this.team)return false;
    this.lastCompleted[team]=type+':'+id;
    this.team=1-team;
    return true;
  }
}
