import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {BattleSimulation} from '../src/simulation.js';
import {validateBank} from '../src/questions.js';
import {FixedStepClock} from '../src/fixed-loop.js';
import {legacyCombat} from './legacy-fixture.js';
const bank=JSON.parse(readFileSync(new URL('../src/data/questions.json',import.meta.url),'utf8').replace(/^\uFEFF/,''));
const questions=validateBank(bank);
const make=extra=>new BattleSimulation({...legacyCombat,initialSoldiers:0,spawnSeconds:10000,baseHP:1000,questionFirstSeconds:12,...extra},questions);
const advance=(s,n)=>{for(let i=0;i<n;i++)s.step();};
const round=s=>advance(s,360-s.tick);
const command=(s,team=0,correct=true)=>{const a=s.questions.teams[team].active;return {type:'answerQuestion',team,matchID:s.matchID,questionID:a.id,option:correct?a.options.indexOf(a.question.answer):(a.options.indexOf(a.question.answer)+1)%4};};
const answer=(s,team=0,correct=true)=>{const c=command(s,team,correct);assert.equal(s.enqueueCommand(c,team).accepted,true);s.step();return c;};
test('30 JSON questions, unique keys, four distinct options, both directions and 10 per category',()=>{
 assert.equal(questions.length,30);assert.equal(new Set(questions.map(q=>q.id)).size,30);
 for(const category of ['Animals','Food','School Objects'])assert.equal(questions.filter(q=>q.category===category).length,10);
 assert.equal(new Set(questions.map(q=>q.direction)).size,2);
 assert.throws(()=>validateBank({...bank,questions:[{...questions[0],options:['a','a','b','c']}]}));
});
test('known translations and distractors match the reviewed vocabulary glossary',()=>{
 const glossary={cat:'kedi',dog:'köpek',bird:'kuş',fish:'balık',horse:'at',cow:'inek',sheep:'koyun',rabbit:'tavşan',lion:'aslan',elephant:'fil',apple:'elma',banana:'muz',bread:'ekmek',cheese:'peynir',milk:'süt',egg:'yumurta',rice:'pirinç',carrot:'havuç',potato:'patates',tomato:'domates',pencil:'kurşun kalem',pen:'tükenmez kalem',eraser:'silgi',ruler:'cetvel',book:'kitap',notebook:'defter',schoolbag:'okul çantası',desk:'sıra',chair:'sandalye',scissors:'makas'};
 for(const q of questions){const source=q.prompt.split("'")[1];assert.equal(q.answer,q.direction==='en-tr'?glossary[source]:Object.keys(glossary).find(k=>glossary[k]===source));}
});
test('seeded deck has no repetition before exhaustion; options shuffled independently',()=>{
 const s=make({matchSeconds:1000}),seen=[];for(let n=0;n<30;n++){advance(s,360);const a=s.questions.teams[0].active;seen.push(a.question.id);assert.deepEqual([...a.options].sort(),[...a.question.options].sort());}
 assert.equal(new Set(seen).size,30);const other=make();round(other);assert.equal(seen[0],other.questions.teams[0].active.question.id);
 assert.notEqual(seen[0],s.questions.teams[1].deck[0].id);
});
test('first round at 12s, deadline 22s, early answer waits for 24s',()=>{
 const s=make();advance(s,359);assert.equal(s.questions.teams[0].active,null);s.step();const id=s.questions.teams[0].active.id;answer(s);advance(s,358);assert.equal(s.questions.teams[0].active,null);s.step();assert.notEqual(s.questions.teams[0].active.id,id);
});
test('duplicate, foreign team, invalid option, old match and expired commands rejected',()=>{
 const s=make();round(s);const c=command(s);assert.equal(s.enqueueCommand(c,1).accepted,false);assert.equal(s.enqueueCommand({...c,option:4},0).accepted,false);assert.equal(s.enqueueCommand({...c,matchID:0},0).accepted,false);
 assert.equal(s.enqueueCommand(c,0).accepted,true);assert.equal(s.enqueueCommand(c,0).accepted,false);s.step();assert.equal(s.enqueueCommand(c,0).accepted,false);assert.equal(s.questions.teams[0].stats.bonuses,1);
 const expired=command(s,1);advance(s,299);assert.equal(s.enqueueCommand(expired,1).accepted,false);
});
test('wrong and unanswered give neither XP nor bonuses; team statistics isolated',()=>{
 const s=make();round(s);answer(s,0,false);advance(s,299);assert.equal(s.questions.teams[0].stats.wrong,1);assert.equal(s.questions.teams[1].stats.unanswered,1);
 for(const t of s.teams)assert.equal(t.xp,0);for(const t of s.questions.teams)assert.equal(t.stats.bonuses,0);
 assert.equal(s.questions.summary(0).accuracy,0);
});
test('bonus order cycles shield attack reinforcement repair per team',()=>{
 const s=make();s.bases[0].hp=900;for(let i=0;i<4;i++){advance(s,360-s.tick%360);answer(s);assert.equal(s.questions.teams[0].feedback.bonus,['shield','attack','reinforcement','repair'][i]);}
 assert.equal(s.questions.teams[1].stats.bonuses,0);assert.equal(s.questions.teams[0].stats.bonuses,4);assert.equal(s.teams[0].xp,0);
});
test('shield reduces actual base damage by 25%, refreshes without stacking, expires exactly',()=>{
 const s=make();s.applyQuestionBonus(0,'shield');assert.equal(s.damage(s.bases[0],{team:1,amount:100}),75);advance(s,120);s.applyQuestionBonus(0,'shield');assert.equal(s.damage(s.bases[0],{team:1,amount:100}),75);advance(s,239);assert.equal(s.damage(s.bases[0],{team:1,amount:100}),75);s.step();assert.equal(s.damage(s.bases[0],{team:1,amount:100}),100);
});
test('attack snapshots boosted skill damage, refreshes and expires; other team unaffected',()=>{
 const s=make();const u=s.spawn(0);s.teams[0].stats.damage=13;s.applyQuestionBonus(0,'attack');s.applyQuestionBonus(0,'attack');s.launchProjectile(u,s.bases[1]);assert.equal(s.projectiles[0].damage,13*1.15);advance(s,240);s.projectiles.forEach(p=>p.active=false);s.launchProjectile(u,s.bases[1]);assert.equal(s.projectiles[0].damage,13);assert.equal(s.questions.teams[1].bonuses.attackUntil,0);
});
test('repair caps max HP, reinforcement respects 10 cap and does not change production progress',()=>{
 const s=make();s.bases[0].hp=990;s.applyQuestionBonus(0,'repair');assert.equal(s.bases[0].hp,1000);s.bases[0].hp=900;s.applyQuestionBonus(0,'repair');assert.equal(s.bases[0].hp,930);
 s.teams[0].spawnProgress=.6;for(let i=0;i<20;i++)s.applyQuestionBonus(0,'reinforcement');assert.equal(s.count(0),10);assert.equal(s.teams[0].spawnProgress,.6);
});
test('skill collision preserves same active ID and remaining answer ticks while combat clock runs',()=>{
 const s=make();round(s);const original=s.questions.teams[0].active.id;
 const remaining=s.questions.teams[0].active.deadline-s.tick;
 s.progression.award(0,40,s.events);advance(s,600);
 assert.equal(s.enqueueCommand(command(s),0).accepted,false);
 assert.equal(s.questions.teams[0].active.id,original);assert.equal(s.questions.teams[0].active.deadline-s.tick,remaining);
 assert.equal(s.questions.teams[0].stats.unanswered,0);assert.equal(s.questions.teams[0].stats.shown,1);assert.equal(s.seconds,32);
 const right=s.teams[0].pending[0];s.enqueueCommand({type:'selectSkill',team:0,matchID:s.matchID,choiceID:right.id,skillID:right.options[0]},0);s.step();s.step();
 assert.equal(s.questions.teams[0].active.deadline-s.tick,remaining-1);answer(s);assert.equal(s.questions.teams[0].stats.correct,1);
});
test('default first question starts at exactly 3 seconds and future rounds at 15 seconds',()=>{
 const s=new BattleSimulation({initialSoldiers:0,spawnSeconds:10000},questions);advance(s,89);assert.equal(s.questions.teams[0].active,null);s.step();assert.ok(s.questions.teams[0].active);answer(s);advance(s,358);assert.equal(s.questions.teams[0].active,null);s.step();assert.ok(s.questions.teams[0].active);
});
test('opponent pending skills do not block answering, shooting, spawning or match timer',()=>{
 const s=make({initialSoldiers:3,baseHP:100000});round(s);s.progression.award(1,40,s.events);answer(s,0);const shots=s.stats.shots;advance(s,180);assert.ok(s.stats.shots>shots);assert.ok(s.teams[1].pending.length);assert.equal(s.questions.teams[0].stats.correct,1);assert.equal(s.questions.teams[1].active.deadline-s.tick,300);
});
test('combat advances while questions open, finish freezes flow, reset clears keys and bonuses',()=>{
 const s=make({initialSoldiers:3,baseHP:100000});round(s);const shots=s.stats.shots;answer(s);advance(s,120);assert.ok(s.stats.shots>shots);const old=command(s,1);s.finish('timeout');const before=s.snapshot();advance(s,300);assert.deepEqual(s.snapshot(),before);assert.equal(s.enqueueCommand(old,1).accepted,false);
 s.reset();assert.equal(s.questions.teams[0].stats.shown,0);assert.equal(s.questions.teams[0].bonuses.shieldUntil,0);assert.equal(s.questions.teams[0].active,null);assert.equal(s.enqueueCommand(old,1).accepted,false);
});
test('question timing and scheduled answers invariant at 15,30,60,144 FPS',()=>{
 const run=fps=>{const s=make(),clock=new FixedStepClock(30);for(let n=0;n<48*fps;n++)clock.advance(1/fps,()=>{s.step();if([361,721,1081].includes(s.tick))s.enqueueCommand(command(s),0);},()=>true);return s.snapshot();};const expected=run(30);for(const fps of [15,60,144])assert.deepEqual(run(fps),expected);
});
test('final statistics keep categories, shown questions and accuracy separate from combat XP',()=>{
 const s=make();round(s);const first=s.questions.teams[0].active.question.category;answer(s);advance(s,359);const second=s.questions.teams[0].active.question.category;answer(s,0,false);advance(s,359);s.finish('timeout');
 const result=s.questions.summary(0);assert.equal(result.shown,3);assert.equal(result.correct,1);assert.equal(result.wrong,1);assert.equal(result.unanswered,1);assert.equal(result.bonuses,1);assert.equal(result.accuracy,100/3);
 assert.equal(result.categories[first].correct,1);assert.equal(result.categories[second].wrong,1);assert.equal(s.teams[0].xp,0);
});
