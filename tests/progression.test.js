import test from 'node:test';
import assert from 'node:assert/strict';
import { BattleSimulation } from '../src/simulation.js';
import { FixedStepClock } from '../src/fixed-loop.js';
import { SKILLS,teamStats,SKILL_BALANCE } from '../src/skills.js';
import { xpThreshold } from '../src/progression.js';
import {legacyCombat} from './legacy-fixture.js';

const run=(s,n)=>{for(let i=0;i<n;i++)s.step();return s};
const empty=(config={})=>new BattleSimulation({...legacyCombat,initialSoldiers:0,spawnSeconds:1000,...config});
const context=(team=0,sourceID=0,amount=100)=>({team,sourceID,amount,kind:'bullet',lifeSteal:0});
function kill(s,team){const victim=s.spawn(1-team);assert.ok(victim);s.damage(victim,context(team,0,victim.hp));return victim;}
function earn(s,team,xp){for(let i=0;i<xp/s.config.xpPerKill;i++)kill(s,team);}
function command(s,team,skillID=s.teams[team].pending[0]?.options[0]){
  return {type:'selectSkill',team,matchID:s.matchID,choiceID:s.teams[team].pending[0]?.id,skillID};
}
function select(s,team,id){assert.equal(s.enqueueCommand(command(s,team,id),team).accepted,true);s.step();}
function offered(id,config={}){
  for(let seed=1;seed<100;seed++){
    const s=empty({...config,skillSeed:seed});earn(s,0,40);
    if(s.teams[0].pending[0].options.includes(id))return s;
  }
  throw new Error('No seed offered '+id);
}
// Controlled effect fixtures isolate a single skill; command application is tested separately.
function equip(s,team,id,rank){
  s.teams[team].skills[id]=rank;s.teams[team].stats=teamStats(s.config,s.teams[team].skills);
  for(const unit of s.units)if(unit.team===team && unit.hp>0){unit.hp=unit.hp/unit.maxHP*s.teams[team].stats.maxHP;unit.maxHP=s.teams[team].stats.maxHP;}
}

test('Level 1 and zero XP; exactly 20 XP for a lethal enemy hit, once',()=>{
  const s=empty();assert.deepEqual(s.teams.map(t=>[t.level,t.xp]),[[1,0],[1,0]]);
  const victim=kill(s,0);assert.equal(s.teams[0].xp,20);assert.equal(s.teams[1].xp,0);
  s.damage(victim,context(0));s.hit(victim,{team:0,damage:100});assert.equal(s.teams[0].xp,20);
  assert.equal(s.stats.deaths,1);assert.equal(victim.xpAwarded,true);
});

test('base damage, non-lethal and friendly damage award no XP',()=>{
  const s=empty();const enemy=s.spawn(1);s.damage(enemy,context(0,0,10));
  const ally=s.spawn(0);assert.equal(s.damage(ally,context(0,0,100)),0);
  s.hit(s.bases[1],{team:0,damage:100,burnDamage:50,chainChance:1});
  assert.equal(s.teams[0].xp,0);assert.equal(s.bases[1].hp,900);assert.equal(s.bases[1].burn,undefined);
});

test('two simultaneous lethal projectiles cannot duplicate kill XP',()=>{
  const s=empty();const victim=s.spawn(1);victim.hp=5;
  for(let i=0;i<2;i++)Object.assign(s.projectiles[i],{active:true,team:0,targetID:victim.id,sourceID:0,x:victim.x,z:victim.z,age:0,damage:10});
  s.step();assert.equal(s.teams[0].xp,20);assert.equal(s.stats.deaths,1);
});

test('cumulative thresholds and configurable increasing formula',()=>{
  const s=empty();
  assert.deepEqual([2,3,4,5,6,7,8,9].map(l=>xpThreshold(l,s.config)),[40,100,180,280,400,540,700,880]);
  for(const [xp,level] of [[20,1],[40,2],[100,3],[180,4],[280,5],[400,6]]){
    const game=empty();earn(game,0,xp);assert.equal(game.teams[0].xp,xp);assert.equal(game.teams[0].level,level);
  }
  assert.equal(xpThreshold(8,{...s.config,xpThresholdGrowth:30}),730);
});

test('multi-level XP produces ordered rights with three unique, eligible choices',()=>{
  const s=empty();s.progression.award(0,180,s.events);
  assert.deepEqual(s.teams[0].pending.map(r=>r.level),[2,3,4]);
  while(s.teams[0].pending.length){
    const right=s.teams[0].pending[0];assert.equal(right.options.length,3);assert.equal(new Set(right.options).size,3);
    for(const id of right.options){assert.ok(SKILLS.some(skill=>skill.id===id));assert.ok(s.teams[0].skills[id]<3)}
    select(s,0);
  }
  assert.equal(Object.values(s.teams[0].skills).reduce((a,b)=>a+b,0),3);
});

test('team, match, choice ID, offered skill and command kind are validated',()=>{
  const s=empty();earn(s,0,40);const valid=command(s,0);
  for(const [change,actor,reason] of [
    [{team:2},2,'invalid-team'],[{},1,'team-mismatch'],[{matchID:0},0,'stale-match'],
    [{choiceID:'fake'},0,'choice-not-pending'],[{skillID:'fake'},0,'skill-not-offered'],[{type:'grantXP'},0,'unknown-command']
  ])assert.equal(s.enqueueCommand({...valid,...change},actor).reason,reason);
  assert.equal(s.commands.length,0);
});

test('duplicate queued choices apply once; later right cannot be used early',()=>{
  const s=empty();earn(s,0,100);const first=command(s,0);
  assert.equal(s.enqueueCommand({...first,choiceID:s.teams[0].pending[1].id},0).accepted,false);
  assert.equal(s.enqueueCommand(first,0).accepted,true);assert.equal(s.enqueueCommand(first,0).reason,'choice-already-queued');
  // Simulate a duplicated transport packet already in the authoritative input buffer.
  s.commands.push({...first,actorTeam:0});
  assert.equal(s.teams[0].skills[first.skillID],0);s.step();
  assert.equal(s.teams[0].skills[first.skillID],1);
  assert.deepEqual(s.commandResults.map(r=>r.accepted),[true,false]);
  assert.equal(s.enqueueCommand(first,0).accepted,false);
});

test('all eight skills max at rank 3; exhausted pool and pending queue stay bounded',()=>{
  const s=empty();s.progression.award(0,100000,s.events);
  assert.equal(s.teams[0].pending.length,24);
  while(s.teams[0].pending.length){
    const right=s.teams[0].pending[0];assert.ok(right.options.length>=1 && right.options.length<=3);
    for(const id of right.options)assert.ok(s.teams[0].skills[id]<3);
    select(s,0);
  }
  assert.ok(Object.values(s.teams[0].skills).every(rank=>rank===3));
  s.progression.award(0,100000,s.events);assert.equal(s.teams[0].pending.length,0);
});

test('same seed yields the same offers; one team selection does not consume other team RNG',()=>{
  const a=empty(),b=empty();earn(a,0,100);earn(b,0,100);earn(a,1,40);earn(b,1,40);
  assert.deepEqual(a.teams[0].pending,b.teams[0].pending);
  const other=structuredClone(a.teams[1]);select(a,0);const after=structuredClone(a.teams[1]);
  delete other.spawnProgress;delete after.spawnProgress;assert.deepEqual(after,other);
});

test('chosen skills change real combat stats and preserve current/max HP ratio',()=>{
  const rapid=offered('rapid-fire');const unit=rapid.spawn(0);unit.engaged=true;unit.nextShot=rapid.tick+30;
  select(rapid,0,'rapid-fire');assert.equal(rapid.teams[0].stats.fireRate,1.15);assert.ok(unit.nextShot<30);
  const heavy=offered('heavy-bullets');select(heavy,0,'heavy-bullets');assert.ok(Math.abs(heavy.teams[0].stats.damage-11.5)<1e-8);
  const iron=offered('iron-army');const alive=iron.spawn(0);alive.hp=50;
  select(iron,0,'iron-army');assert.ok(Math.abs(alive.hp-57.5)<1e-8);assert.ok(Math.abs(alive.maxHP-115)<1e-8);
  const fresh=iron.spawn(0);assert.ok(Math.abs(fresh.hp-115)<1e-8);assert.equal(fresh.hp,fresh.maxHP);
  assert.equal(iron.teams[1].stats.maxHP,100);
});

test('heavy bullets affect new shots; already-flying damage remains snapshotted',()=>{
  const s=empty();const source=s.spawn(0),victim=s.spawn(1);source.x=-2;victim.x=2;
  s.launchProjectile(source,victim);const old=s.projectiles.find(p=>p.active);assert.equal(old.damage,10);
  equip(s,0,'heavy-bullets',3);s.launchProjectile(source,victim);const fresh=s.projectiles.find(p=>p.active && p!==old);
  assert.equal(fresh.damage,14.5);s.hit(victim,old);assert.equal(victim.hp,90);s.hit(victim,fresh);assert.equal(victim.hp,75.5);
});

test('burn kills credit the originating team even after shooter removal',()=>{
  const s=empty();const source=s.spawn(0),victim=s.spawn(1);victim.hp=3;
  s.hit(victim,{team:0,sourceID:source.id,damage:1,burnDamage:2,burnSeconds:3,burnInterval:1});
  s.units.splice(s.units.indexOf(source),1);run(s,30);
  assert.equal(victim.hp,0);assert.equal(s.teams[0].xp,20);assert.equal(s.stats.burnHits,1);
  run(s,120);assert.equal(s.teams[0].xp,20);
});

test('burn refresh never stacks or indefinitely postpones damage pulses',()=>{
  const s=empty({soldierHP:10000});const victim=s.spawn(1);
  const p={team:0,sourceID:0,damage:1,burnDamage:6,burnSeconds:3,burnInterval:1};
  for(let i=0;i<9;i++){s.hit(victim,p);run(s,10)}
  assert.equal(s.stats.burnHits,3);assert.equal(victim.hp,10000-9-18);
  s.hit(victim,{...p,burnDamage:2});assert.equal(victim.burn.amount,6);
  run(s,120);assert.equal(victim.burn,null);
});

test('chain kills gain XP; one extra target only, no recursive fire/chain proc',()=>{
  const s=empty();const a=s.spawn(1),b=s.spawn(1),c=s.spawn(1);
  a.x=2;a.z=0;b.x=2;b.z=1;c.x=2;c.z=2;a.hp=5;b.hp=2;
  s.hit(a,{team:0,sourceID:0,damage:10,burnDamage:6,burnSeconds:3,burnInterval:1,chainChance:1,chainFraction:.25,chainRange:3});
  assert.equal(a.hp,0);assert.equal(b.hp,0);assert.equal(c.hp,100);assert.equal(c.burn,null);
  assert.equal(s.teams[0].xp,40);assert.equal(s.stats.chainHits,1);
  assert.equal(s.events.filter(e=>e.type==='lightning').length,1);
});

test('Life Steal uses actual overkill damage, caps at max HP and cannot heal dead shooter',()=>{
  const s=empty();const source=s.spawn(0),victim=s.spawn(1);source.hp=50;victim.hp=3;
  s.hit(victim,{team:0,sourceID:source.id,damage:100,lifeSteal:.15});assert.equal(source.hp,50.45);
  const another=s.spawn(1);source.hp=99.9;s.hit(another,{team:0,sourceID:source.id,damage:10,lifeSteal:.15});assert.equal(source.hp,100);
  source.hp=0;const prior=source.hp;s.hit(another,{team:0,sourceID:source.id,damage:10,lifeSteal:.15});assert.equal(source.hp,prior);
});

test('Double Shot emits an actual second projectile with independent hit/visual identity',()=>{
  const s=empty({skillBalance:{doubleShot:1}});const source=s.spawn(0),victim=s.spawn(1);source.x=-2;victim.x=2;
  equip(s,0,'double-shot',1);s.fire(source,victim);
  const shots=s.projectiles.filter(p=>p.active);assert.equal(shots.length,2);assert.equal(s.stats.doubleShots,1);
  assert.equal(shots[1].second,true);assert.notEqual(shots[0].z,shots[1].z);
  s.hit(victim,shots[0]);s.hit(victim,shots[1]);assert.equal(victim.hp,80);
});

test('Quick Reinforcement preserves production progress and ten-soldier hard cap',()=>{
  const s=offered('quick-reinforcement',{spawnSeconds:6,maxSoldiers:100});
  const team=s.teams[0];team.spawnProgress=.5;select(s,0,'quick-reinforcement');
  assert.ok(team.spawnProgress>.5);assert.ok(Math.abs(team.stats.spawnRate-1.1/6)<1e-10);
  run(s,6000);assert.ok(s.count(0)<=10);assert.equal(s.config.maxSoldiers,10);
});

test('pending rights do not pause combat, timer, damage or spawn processing',()=>{
  const s=new BattleSimulation({baseHP:100000,skillChoiceSeconds:0});earn(s,0,100);const before=s.tick;
  run(s,600);assert.equal(s.tick,before+600);assert.ok(s.stats.shots>0);assert.ok(s.stats.spawns>6);
  assert.ok(s.teams[0].pending.length>=2);assert.equal(s.teams[0].skills[s.teams[0].pending[0].options[0]],0);
});

test('restart clears progression, effects, queues and rejects previous-match choices',()=>{
  const s=empty();earn(s,0,100);const stale=command(s,0);select(s,0);s.enqueueCommand(command(s,0),0);
  s.reset();assert.deepEqual(s.teams.map(t=>[t.xp,t.level,t.pending.length]),[[0,1,0],[0,1,0]]);
  assert.ok(s.teams.every(t=>Object.values(t.skills).every(rank=>rank===0)));
  assert.equal(s.commands.length,0);assert.equal(s.commandResults.length,0);
  earn(s,0,40);assert.equal(s.enqueueCommand(stale,0).reason,'stale-match');
  s.finish('timeout');assert.equal(s.enqueueCommand(command(s,0),0).reason,'match-finished');
});

test('skill battles remain deterministic at 15/30/60/144 FPS with tick-scheduled commands',()=>{
  const snapshots=[];
  for(const fps of [15,30,60,144]){
    const s=new BattleSimulation({baseHP:100000});const clock=new FixedStepClock(30);
    for(let i=0;i<fps*90;i++)clock.advance(1/fps,()=>{
      if(s.tick%30===0)for(const team of s.teams)if(team.pending.length)s.enqueueCommand(command(s,team.team),team.team);
      s.step();
    },()=>true);
    assert.equal(s.tick,2700);snapshots.push(s.snapshot());
  }
  for(const snapshot of snapshots)assert.deepEqual(snapshot,snapshots[0]);
});

test('single skill rank-3 effects are bounded and configurable',()=>{
  const s=empty();const zero=s.teams[0].skills;
  for(const skill of SKILLS){
    const stats=teamStats(s.config,{...zero,[skill.id]:3});
    assert.ok(stats.fireRate<=1.45 && stats.damage<=14.5 && stats.maxHP<=145);
    assert.ok(stats.doubleChance<=.6000000000000001 && stats.lifeSteal<=.15000000000000002);
    assert.ok(stats.spawnRate<=1.3/1000);assert.ok(stats.burnDamage<=6);
    assert.ok(stats.chainChance*stats.chainFraction<=.1875);
  }
  assert.equal(teamStats({...s.config,skillBalance:{heavyBullets:.1}},{...zero,'heavy-bullets':2}).damage,12);
  assert.equal(SKILL_BALANCE.maxRank,3);
});

test('no single rank-3 skill can eliminate a full-health soldier in one attack cycle',()=>{
  for(const skill of SKILLS){
    const s=empty();const source=s.spawn(0),victim=s.spawn(1);
    source.x=-2;victim.x=2;source.z=victim.z=0;
    equip(s,0,skill.id,3);s.fire(source,victim);
    source.engaged=victim.engaged=true;source.nextShot=victim.nextShot=100000;
    run(s,120);assert.ok(victim.hp>=70,`${skill.name} burst damage too high: ${victim.hp}`);
    assert.equal(s.teams[0].xp,0);
  }
});

test('30-minute skill battle keeps bounded units, pending rights, projectiles and command history',()=>{
  const s=new BattleSimulation({baseHP:1000000,matchSeconds:1800});const pool=s.projectiles;
  for(let tick=0;tick<54000;tick++){
    if(tick%30===0)for(const team of s.teams)if(team.pending.length)s.enqueueCommand(command(s,team.team),team.team);
    s.step();assert.equal(s.projectiles,pool);assert.ok(s.units.length<=40);
    assert.ok(s.count(0)<=10 && s.count(1)<=10);assert.ok(s.commandResults.length<=16);
    for(const team of s.teams){assert.ok(team.pending.length<=24);assert.ok(Object.values(team.skills).every(r=>r<=3));}
  }
  assert.equal(s.status,'finished');assert.ok(s.stats.burnHits+s.stats.chainHits+s.stats.doubleShots>0);
  console.log('Stage 3 30-minute stress:',JSON.stringify(s.stats),'ranks:',s.teams.map(t=>t.skills));
});
