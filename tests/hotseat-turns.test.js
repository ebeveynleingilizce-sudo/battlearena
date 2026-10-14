import test from 'node:test';
import assert from 'node:assert/strict';
import { HotseatTurns } from '../src/hotseat-turns.js';

const fixture=()=>({
  status:'running',
  teams:[{pending:[]},{pending:[]}],
  questions:{teams:[{active:null},{active:null}]},
});
test('hotseat begins with blue and chooses waiting red when blue has no action',()=>{
  const turns=new HotseatTurns(),sim=fixture();
  sim.questions.teams[1].active={id:'red-1'};
  assert.equal(turns.update(sim),1);
});
test('hotseat skill has priority over question',()=>{
  const turns=new HotseatTurns(),sim=fixture();
  sim.questions.teams[0].active={id:'blue-question'};
  sim.teams[0].pending=[{id:'blue-skill'}];
  assert.deepEqual(turns.currentDecision(sim),{team:0,type:'skill',id:'blue-skill'});
});
test('completed decision yields to other player without affecting combat state',()=>{
  const turns=new HotseatTurns(),sim=fixture();
  sim.questions.teams[0].active={id:'b'};
  sim.questions.teams[1].active={id:'r'};
  assert.equal(turns.complete(0,'question','b'),true);
  assert.equal(turns.team,1);
  assert.equal(turns.complete(0,'question','b'),false);
  turns.reset();
  assert.equal(turns.team,0);
});
