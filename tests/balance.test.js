import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {BattleSimulation} from '../src/simulation.js';
import {FixedStepClock} from '../src/fixed-loop.js';
import {teamStats} from '../src/skills.js';
const bank=JSON.parse(readFileSync(new URL('../src/data/questions.json',import.meta.url),'utf8').replace(/^\uFEFF/,'')).questions;
const run=(s,n)=>{for(let i=0;i<n;i++)s.step();};
const empty=c=>new BattleSimulation({initialSoldiers:0,spawnSeconds:10000,...c},bank);
const kill=(s,team)=>{const u=s.spawn(1-team);u.x=0;u.z=0;s.damage(u,{team,amount:u.hp,kind:'bullet'});};
const level=s=>{kill(s,0);kill(s,0);};
const answer=(s,team=0)=>{const q=s.questions.teams[team].active;assert.ok(q);s.enqueueCommand({type:'answerQuestion',team,matchID:s.matchID,questionID:q.id,option:q.options.indexOf(q.question.answer)},team);s.step();};
test('base immune until tick899, takes damage at900; soldiers fight and award kill XP before30s',()=>{
 const s=empty();s.tick=899;assert.equal(s.damage(s.bases[1],{team:0,amount:10}),0);assert.equal(s.bases[1].hp,1000);s.step();assert.equal(s.damage(s.bases[1],{team:0,amount:10}),10);
 const actual=new BattleSimulation();run(actual,450);assert.ok(actual.stats.shots>0);assert.ok(actual.stats.deaths>0);assert.ok(actual.teams.some(t=>t.xp>0));assert.deepEqual(actual.bases.map(b=>b.hp),[1000,1000]);
});
test('soldier and base projectile damage separate; offensive siege DPS cap preserves troop skills',()=>{
 const s=empty();s.tick=900;const u=s.spawn(0);const ranks=Object.fromEntries(Object.keys(s.teams[0].skills).map(id=>[id,3]));s.teams[0].stats=teamStats(s.config,ranks);
 s.launchProjectile(u,s.bases[1]);const p=s.projectiles[0],stats=s.teams[0].stats;
 assert.equal(p.damage,14.5);assert.ok(Math.abs(p.baseDamage*stats.fireRate*(1+stats.doubleChance)-s.config.baseDamage*1.5)<1e-8);
 const before=s.bases[1].hp;s.hit(s.bases[1],p);assert.ok(Math.abs(before-s.bases[1].hp-p.baseDamage)<1e-8);assert.equal(s.teams[0].xp,0);
});
test('home cover identical for both teams, applies only nearby and fades with match time',()=>{
 for(const team of [0,1]){const s=empty(),u=s.spawn(team);assert.equal(s.damage(u,{team:1-team,amount:10}),4);u.hp=100;s.tick=9000;assert.equal(s.damage(u,{team:1-team,amount:10}),10);u.hp=100;u.x=0;s.tick=0;assert.equal(s.damage(u,{team:1-team,amount:10}),10);}
});
test('siege targeting limits focus fire while surplus soldiers keep attacking the base',()=>{
 const s=empty({moveSpeed:0});for(let i=0;i<8;i++){const u=s.spawn(0);u.x=0;u.z=(i-4)*.85;}
 const victim=s.spawn(1);victim.x=2;victim.z=0;s.step();const targeting=s.units.filter(u=>u.team===0&&u.targetID===victim.id);
 assert.ok(targeting.length<=s.config.maxFocusFire);assert.ok(s.units.some(u=>u.team===0&&u.targetID==='base-1'));assert.equal(s.bases[1].hp,1000);
});
test('six-second automatic choice uses real pending right, gives no XP, and chooses once',()=>{
 const s=empty();level(s);const right=s.teams[0].pending[0];run(s,179);assert.equal(s.teams[0].autoSelections,0);s.step();
 const event=s.events.find(e=>e.type==='skill-selected');assert.ok(event.automatic);assert.ok(right.options.includes(event.skillID));assert.equal(s.teams[0].autoSelections,1);assert.equal(s.teams[0].xp,40);assert.equal(s.teams[0].pending.length,0);run(s,300);assert.equal(s.teams[0].autoSelections,1);
});
test('manual choice at last eligible tick beats timeout; queued rights get full fresh deadline',()=>{
 const s=empty();level(s);for(let i=0;i<3;i++)kill(s,0);const right=s.teams[0].pending[0];run(s,179);
 s.enqueueCommand({type:'selectSkill',team:0,matchID:s.matchID,choiceID:right.id,skillID:right.options[0]},0);s.step();assert.equal(s.teams[0].autoSelections,0);assert.equal(s.teams[0].pending[0].deadline,360);run(s,179);assert.equal(s.teams[0].autoSelections,0);s.step();assert.equal(s.teams[0].autoSelections,1);
});
test('automatic choice preserves active question identity/budget and resumes answer validation immediately',()=>{
 const s=empty();run(s,90);const q=s.questions.teams[0].active,remaining=q.deadline-s.tick;level(s);run(s,180);
 assert.equal(s.questions.teams[0].active.id,q.id);assert.equal(q.deadline-s.tick,remaining);assert.equal(q.blocked,false);answer(s);assert.equal(s.questions.teams[0].stats.correct,1);
});
test('automatic choice RNG independent of offers/combat RNG; fixed seed replay matches',()=>{
 const a=empty({seed:81}),b=empty({seed:81});for(const s of [a,b]){level(s);const combat=s.randomState,offers=s.teams[0].randomState,other=s.teams[1].autoRandomState;run(s,180);assert.equal(s.randomState,combat);assert.equal(s.teams[0].randomState,offers);assert.equal(s.teams[1].autoRandomState,other);}
 assert.deepEqual(a.snapshot(),b.snapshot());
});
test('6/8/10s deadlines configurable; no question starvation in passive full match',()=>{
 for(const seconds of [6,8,10]){const s=empty({skillChoiceSeconds:seconds});level(s);run(s,seconds*30-1);assert.equal(s.teams[0].pending.length,1);s.step();assert.equal(s.teams[0].pending.length,0);}
 // Isolate starvation from legitimate early base destruction; production durations
 // and opportunity distributions are separately audited across 100 seeds/scenario.
 const s=new BattleSimulation({seed:2654435769,baseHP:1000000},bank);run(s,9000);assert.ok(s.questions.teams.every(t=>t.stats.available>=15));assert.equal(s.status,'finished');
});
test('reward substitution avoids full-HP repair/full-army reinforcement and protected shield, no XP',()=>{
 const s=empty();assert.equal(s.grantQuestionBonus(0,'shield').kind,'attack');s.tick=900;
 assert.equal(s.grantQuestionBonus(0,'repair').kind,'shield');for(let i=0;i<10;i++)s.spawn(0);
 assert.equal(s.grantQuestionBonus(0,'reinforcement').kind,'shield');assert.equal(s.count(0),10);assert.equal(s.teams[0].xp,0);
 s.config.bonusOrder=['repair','reinforcement'];assert.deepEqual(s.grantQuestionBonus(0,'repair'),{kind:'attack',preferred:'repair',fallback:true});
});
test('applicable repair/reinforcement actually change state; refresh remains non-stacking',()=>{
 const s=empty();s.bases[0].hp=990;s.tick=900;assert.equal(s.grantQuestionBonus(0,'repair').kind,'repair');assert.equal(s.bases[0].hp,1000);assert.equal(s.grantQuestionBonus(0,'reinforcement').kind,'reinforcement');assert.equal(s.count(0),1);
 s.grantQuestionBonus(0,'shield');run(s,30);s.grantQuestionBonus(0,'shield');assert.equal(s.questions.teams[0].bonuses.shieldUntil,s.tick+240);assert.equal(s.damage(s.bases[0],{team:1,amount:100}),75);
});
test('question statistics separate scheduled/shown/available/answered/timeouts and real kills only',()=>{
 const s=empty();run(s,90);s.step();answer(s);run(s,450-s.tick);s.step();run(s,300);
 const stat=s.questions.teams[0].stats;assert.equal(stat.scheduled,2);assert.equal(stat.shown,2);assert.equal(stat.available,2);assert.equal(stat.answered,1);assert.equal(stat.correct,1);assert.equal(stat.timedOut,1);assert.equal(s.teams[0].xp,0);
});
test('restart with explicit seed resets analytics, timers, bonuses and rejects old skill command',()=>{
 const s=empty();run(s,90);answer(s);level(s);const old=s.teams[0].pending[0];run(s,180);s.reset(123);
 assert.equal(s.config.seed,123);assert.equal(s.teams[0].autoSelections,0);assert.equal(s.questions.teams[0].stats.available,0);assert.equal(s.questions.teams[0].bonuses.attackUntil,0);assert.equal(s.questions.teams[0].waitingRound,null);assert.equal(s.enqueueCommand({type:'selectSkill',team:0,matchID:s.matchID-1,choiceID:old.id,skillID:old.options[0]},0).accepted,false);
});
test('timeout tie compares millihp deterministically; simultaneous destruction remains draw',()=>{
 const s=empty();s.bases[0].hp=900.00000000001;s.bases[1].hp=900;s.finish('timeout');assert.equal(s.result.winner,null);assert.deepEqual(s.result.scores,[900000,900000]);
});
test('new balance and automatic choices invariant across 15/30/60/144 render FPS',()=>{
 const runFPS=fps=>{const s=new BattleSimulation({seed:82},bank),clock=new FixedStepClock(30);for(let i=0;i<120*fps;i++)clock.advance(1/fps,()=>s.step(),()=>s.status==='running');return s.snapshot();};const expected=runFPS(30);for(const fps of [15,60,144])assert.deepEqual(runFPS(fps),expected);
});
test('rebalanced eight-skill pool keeps rank3, full-health soldiers survive one single-skill cycle',()=>{
 const s=empty(),ranks={...s.teams[0].skills};assert.equal(teamStats(s.config,{...ranks,'iron-army':3}).maxHP,160);
 for(const id of Object.keys(ranks)){const sim=empty(),u=sim.spawn(1);u.x=0;sim.teams[0].stats=teamStats(sim.config,{...ranks,[id]:3});const source=sim.spawn(0);sim.launchProjectile(source,u);sim.hit(u,sim.projectiles[0]);sim.projectiles[0].active=false;source.engaged=u.engaged=true;source.nextShot=u.nextShot=100000;run(sim,90);assert.ok(u.hp>0,`${id} single cycle killed full-health soldier`);}
});
test('100-seed-per-scenario audit reaches duration/opportunity goals and records natural endings/comebacks',()=>{
 const report=JSON.parse(readFileSync(new URL('../artifacts/balance-new.json',import.meta.url),'utf8'));
 assert.deepEqual(report.effectiveConfig,new BattleSimulation().config,'rerun balance audit after changing gameplay config');
 const rows=Object.values(report.scenarios).flatMap(s=>s.rows);
 assert.equal(rows.length,500);
 for(const s of Object.values(report.scenarios)){assert.equal(s.summary.n,100);assert.ok(s.summary.mean>=240&&s.summary.mean<=300);assert.equal(s.summary.early60,0);assert.ok(s.summary.inTarget>50);assert.ok(s.summary.available.every(n=>n>=15&&n<=25));}
 assert.ok(rows.some(r=>r.reason==='base'));assert.ok(rows.some(r=>r.comeback));
 assert.ok(report.scenarios.B.summary.wins[0]>=40&&report.scenarios.B.summary.wins[0]<=60);
 assert.ok(report.scenarios.C.summary.wins[0]>report.scenarios.D.summary.wins[0]);
});
