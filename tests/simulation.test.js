import test from 'node:test';
import assert from 'node:assert/strict';
import { BattleSimulation } from '../src/simulation.js';
import { FixedStepClock } from '../src/fixed-loop.js';
import {legacyCombat} from './legacy-fixture.js';

function run(sim, ticks) { for (let i=0;i<ticks;i++) sim.step(); return sim; }
function empty(config={}) { return new BattleSimulation({...legacyCombat,initialSoldiers:0,spawnSeconds:1000,...config}); }
function duel() {
  const sim=empty(); const a=sim.spawn(0),b=sim.spawn(1);
  a.x=-2; b.x=2; a.z=b.z=0; a.engaged=b.engaged=true;
  return {sim,a,b};
}

test('nearest living enemy; dead target replaced; base fallback',()=>{
  const sim=empty(); const blue=sim.spawn(0),near=sim.spawn(1),far=sim.spawn(1);
  blue.x=0; near.x=2; far.x=5; blue.z=near.z=far.z=0;
  assert.equal(sim.chooseTarget(blue).id,near.id);
  near.hp=0; assert.equal(sim.chooseTarget(blue).id,far.id);
  far.hp=0; assert.equal(sim.chooseTarget(blue).id,'base-1');
  far.hp=100; far.x=20; assert.equal(sim.chooseTarget(blue).id,'base-1');
});

test('movement stops in range; shots exactly one per second; damage only on impact',()=>{
  const {sim,a,b}=duel(); const x=a.x;
  sim.step(); assert.equal(a.x,x); assert.equal(b.hp,100); assert.equal(sim.stats.shots,2);
  run(sim,10); assert.equal(b.hp,90); assert.equal(a.hp,90);
  run(sim,19); assert.equal(sim.stats.shots,2);
  sim.step(); assert.equal(sim.stats.shots,4);
});

test('soldiers spawn at own base at six-second intervals and respect ten-unit cap',()=>{
  const sim=empty({spawnSeconds:6,attackRange:0,moveSpeed:0});
  run(sim,179); assert.equal(sim.units.length,0);
  sim.step(); assert.equal(sim.count(0),1); assert.equal(sim.count(1),1);
  assert.ok(sim.units[0].x<0 && sim.units[1].x>0);
  run(sim,180*20); assert.equal(sim.count(0),10); assert.equal(sim.count(1),10);
});

test('separation handles exact overlaps and same-team clusters',()=>{
  const sim=empty({separationPasses:24});
  for(let i=0;i<8;i++){const u=sim.spawn(0);u.x=0;u.z=0;}
  for(let i=0;i<20;i++)sim.separate();
  for(let i=0;i<sim.units.length;i++)for(let j=i+1;j<sim.units.length;j++){
    const a=sim.units[i],b=sim.units[j]; assert.ok(Math.hypot(a.x-b.x,a.z-b.z)>=.799);
  }
});

test('lethal hit causes Death and corpse cleanup, no dead-unit targeting',()=>{
  const {sim,a,b}=duel(); b.hp=10; b.nextShot=10000;
  run(sim,10); assert.equal(b.hp,0); assert.equal(b.state,'Death');
  assert.equal(sim.count(1),0); assert.equal(sim.target(b.id),undefined);
  assert.equal(a.targetID,'base-1');
  run(sim,sim.ticks(sim.config.corpseSeconds)); assert.ok(!sim.units.includes(b));
});

test('bases take damage; destruction stops all operations',()=>{
  const sim=empty(); const a=sim.spawn(0); a.x=3; a.z=0; a.engaged=true;
  sim.bases[1].hp=10;
  run(sim,20); assert.equal(sim.bases[1].hp,0); assert.equal(sim.result.winner,0);
  assert.equal(sim.result.reason,'base'); assert.ok(sim.projectiles.every(p=>!p.active));
  const snapshot=sim.snapshot(); run(sim,1000); assert.deepEqual(sim.snapshot(),snapshot);
});

test('300-second timeout resolves higher HP and equal-HP draw',()=>{
  for(const [hp,winner] of [[1000,null],[900,0]]){
    const sim=empty();sim.bases[1].hp=hp;run(sim,8999);assert.equal(sim.status,'running');
    sim.step();assert.equal(sim.status,'finished');assert.equal(sim.seconds,300);
    assert.equal(sim.result.winner,winner);assert.equal(sim.result.reason,'timeout');
  }
});

test('simultaneous base destruction is a draw',()=>{
  const sim=empty();sim.bases.forEach(b=>b.hp=10);
  for(let team=0;team<2;team++)Object.assign(sim.projectiles[team],{active:true,team,sourceID:0,targetID:`base-${1-team}`,x:sim.bases[1-team].x,z:0,age:0});
  sim.step(); assert.equal(sim.result.winner,null);assert.deepEqual(sim.bases.map(b=>b.hp),[0,0]);
});

test('restart resets HP, timer, IDs, projectiles, statistics and seed',()=>{
  const sim=new BattleSimulation();const original=sim.snapshot();run(sim,1400);
  sim.reset();const reset=sim.snapshot();assert.equal(reset.matchID,original.matchID+1);
  reset.matchID=original.matchID;assert.deepEqual(reset,original);
});

test('same seed replays identical full matches; different seeds alter engagement',()=>{
  const a=new BattleSimulation(),b=new BattleSimulation();
  run(a,9000);run(b,9000);assert.deepEqual(a.snapshot(),b.snapshot());
  const c=new BattleSimulation({seed:123});run(c,9000);assert.notDeepEqual(a.snapshot(),c.snapshot());
});

test('15/30/60/144 FPS and irregular frames produce identical authoritative state',()=>{
  const snapshots=[];
  for(const fps of [15,30,60,144]){
    const sim=new BattleSimulation({baseHP:100000});const clock=new FixedStepClock(30);
    for(let i=0;i<fps*60;i++)clock.advance(1/fps,()=>sim.step(),()=>sim.status==='running');
    assert.equal(sim.tick,1800);snapshots.push(sim.snapshot());
  }
  const sim=new BattleSimulation({baseHP:100000});const clock=new FixedStepClock(30);
  for(let i=0;i<600;i++){clock.advance(.013,()=>sim.step(),()=>true);clock.advance(.087,()=>sim.step(),()=>true);}
  assert.equal(sim.tick,1800);snapshots.push(sim.snapshot());
  for(const value of snapshots)assert.deepEqual(value,snapshots[0]);
});

test('long frame backlog is retained and eventually processed',()=>{
  const sim=empty();const clock=new FixedStepClock(30,5);
  clock.advance(2,()=>sim.step(),()=>true);assert.equal(sim.tick,5);
  for(let i=0;i<11;i++)clock.advance(0,()=>sim.step(),()=>true);
  assert.equal(sim.tick,60);
});

test('long battles retain bounded soldier and projectile populations',()=>{
  const sim=new BattleSimulation({matchSeconds:1800,baseHP:1000000});const pool=sim.projectiles;
  let minimum=Infinity;
  for(let tick=0;tick<54000;tick++){
    sim.step();assert.ok(sim.count(0)<=10 && sim.count(1)<=10);
    assert.ok(sim.units.length<=40);assert.equal(sim.projectiles,pool);
    if(tick%30===0){const alive=sim.units.filter(u=>u.hp>0);
      for(let i=0;i<alive.length;i++)for(let j=i+1;j<alive.length;j++)minimum=Math.min(minimum,Math.hypot(alive[i].x-alive[j].x,alive[i].z-alive[j].z));
    }
  }
  assert.ok(minimum>=.795,`minimum separation ${minimum}`);
  assert.equal(sim.status,'finished');console.log('30-minute stress:',JSON.stringify(sim.stats),'minimum separation:',minimum);
});
