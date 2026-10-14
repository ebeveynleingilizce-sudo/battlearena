// Offline audit, not shipped. Bots use exactly the public command interface.
import {readFileSync,writeFileSync} from 'node:fs';
import {BattleSimulation as Current} from '../src/simulation.js';
import {BattleSimulation as Previous} from '../artifacts/balance-baseline/simulation.js';
const bank=JSON.parse(readFileSync(new URL('../src/data/questions.json',import.meta.url),'utf8').replace(/^\uFEFF/,'' )).questions;
const attack=['rapid-fire','heavy-bullets','double-shot','fire-bullets','chain-lightning','iron-army','life-steal','quick-reinforcement'];
const defense=['fire-bullets','chain-lightning','iron-army','life-steal','quick-reinforcement','rapid-fire','double-shot','heavy-bullets'];
const balanced=['fire-bullets','iron-army','rapid-fire','heavy-bullets','double-shot','life-steal','chain-lightning','quick-reinforcement'];
export const scenarios={A:{accuracy:null},B:{accuracy:[1,1]},C:{accuracy:[.9,.2]},D:{accuracy:[.2,.9]},E:{accuracy:[.8,.8],strategies:[attack,defense]}};
export function runMatch(Sim,seed,scenario,overrides={}){
  const sim=new Sim({seed,...overrides},bank),observed=new Map(),submitted=new Set(),available=[new Set(),new Set()],traces=[];
  let firstKill=null,firstKillTick=null,lateTrailer=null;
  const answered=[0,0],qaTicks=sim.config.tickRate*2,skillTicks=sim.config.tickRate;
  while(sim.status==='running'){
    for(const t of sim.teams){
      const q=sim.questions.teams[t.team].active;
      if(q&&!q.blocked&&!t.pending.length){available[t.team].add(q.id);if(!observed.has(q.id))observed.set(q.id,sim.tick);}
      const r=t.pending[0];if(r&&!observed.has(r.id))observed.set(r.id,sim.tick);
      if(scenario.accuracy){
        if(r&&sim.tick-observed.get(r.id)>=skillTicks&&!submitted.has(r.id)){
          const priority=scenario.strategies?.[t.team]??balanced;
          const skillID=[...r.options].sort((a,b)=>priority.indexOf(a)-priority.indexOf(b))[0];
          if(sim.enqueueCommand({type:'selectSkill',team:t.team,matchID:sim.matchID,choiceID:r.id,skillID},t.team).accepted)submitted.add(r.id);
        }
        if(q&&!q.blocked&&!t.pending.length&&sim.tick-observed.get(q.id)>=qaTicks&&!submitted.has(q.id)){
          const correct=(answered[t.team]%10)<scenario.accuracy[t.team]*10,answer=q.options.indexOf(q.question.answer);
          if(sim.enqueueCommand({type:'answerQuestion',team:t.team,matchID:sim.matchID,questionID:q.id,option:correct?answer:(answer+1)%4},t.team).accepted){submitted.add(q.id);answered[t.team]++;}
        }
      }
    }
    sim.step();
    const deaths=sim.events.filter(e=>e.type==='death');
    if(deaths.length&&firstKillTick===null){firstKillTick=sim.tick;firstKill=new Set(deaths.map(e=>e.team)).size===1?deaths[0].team:null;}
    if(sim.tick===240*sim.config.tickRate){const d=sim.bases[0].hp-sim.bases[1].hp;lateTrailer=Math.abs(d)>.01?(d<0?0:1):null;}
    if(sim.tick%(15*sim.config.tickRate)===0)traces.push({seconds:sim.seconds,hp:sim.bases.map(b=>b.hp),units:[sim.count(0),sim.count(1)],xp:sim.teams.map(t=>t.xp),level:sim.teams.map(t=>t.level),shots:sim.stats.shots});
  }
  return {seed,seconds:sim.seconds,winner:sim.result.winner,reason:sim.result.reason,firstKill,firstKillTick,firstKillWon:firstKill!==null&&firstKill===sim.result.winner,
    lateTrailer,comeback:lateTrailer!==null&&lateTrailer===sim.result.winner,
    shown:sim.questions.teams.map(t=>t.stats.shown),available:available.map(s=>s.size),correct:sim.questions.teams.map(t=>t.stats.correct),wrong:sim.questions.teams.map(t=>t.stats.wrong),
    unanswered:sim.questions.teams.map(t=>t.stats.unanswered),levelups:sim.teams.map(t=>t.level-1),hp:sim.bases.map(b=>b.hp),stats:sim.stats,traces};
}
const mean=a=>a.reduce((x,y)=>x+y,0)/a.length;
export function summarize(rows){
  const times=rows.map(r=>r.seconds).sort((a,b)=>a-b),n=rows.length,first=rows.filter(r=>r.firstKill!==null),late=rows.filter(r=>r.lateTrailer!==null);
  return {n,mean:mean(times),median:(times[Math.floor((n-1)/2)]+times[Math.floor(n/2)])/2,min:times[0],max:times.at(-1),early60:rows.filter(r=>r.seconds<=60).length/n*100,
    inTarget:rows.filter(r=>r.seconds>=240).length/n*100,timeout:rows.filter(r=>r.reason==='timeout').length/n*100,
    wins:[0,1,null].map(w=>rows.filter(r=>r.winner===w).length/n*100),
    shown:[0,1].map(t=>mean(rows.map(r=>r.shown[t]))),available:[0,1].map(t=>mean(rows.map(r=>r.available[t]))),
    correct:[0,1].map(t=>mean(rows.map(r=>r.correct[t]))),wrong:[0,1].map(t=>mean(rows.map(r=>r.wrong[t]))),unanswered:[0,1].map(t=>mean(rows.map(r=>r.unanswered[t]))),
    levelups:[0,1].map(t=>mean(rows.map(r=>r.levelups[t]))),firstKillEligible:first.length,firstKillWin:first.length?first.filter(r=>r.firstKillWon).length/first.length*100:0,
    lateEligible:late.length,comebacks:late.filter(r=>r.comeback).length,comebackEligiblePct:late.length?late.filter(r=>r.comeback).length/late.length*100:0,comebackAllPct:rows.filter(r=>r.comeback).length/n*100};
}
if(process.argv[1]?.endsWith('balance-runner.js')){
  const version=process.argv[2]??'new',count=Number(process.argv[3]??100),output=process.argv[4]??`artifacts/balance-${version}.json`,overrides=JSON.parse(process.argv[5]?(process.argv[5].startsWith('{')?process.argv[5]:readFileSync(process.argv[5],'utf8').replace(/^\uFEFF/,'')):'{}');
  const Sim=version==='old'?Previous:Current,report={version,count,overrides,effectiveConfig:new Sim(overrides).config,policies:scenarios,scenarioDefinitions:'A passive; B 100/100; C 90/20; D 20/90; E 80/80 direct fire vs elemental. Manual skill delay1s; answer delay2s.',scenarios:{}};
  for(const [key,scenario] of Object.entries(scenarios).filter(([key])=>(process.argv[6]??'ABCDE').includes(key))){
    const rows=[];for(let i=0;i<count;i++)rows.push(runMatch(Sim,Math.imul(i+1,0x9e3779b9)>>>0,scenario,overrides));
    const summary=summarize(rows);report.scenarios[key]={summary,rows};console.log(key,JSON.stringify(summary));writeFileSync(output,JSON.stringify(report));
  }
}
