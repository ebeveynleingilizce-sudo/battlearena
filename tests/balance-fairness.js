import {writeFileSync} from 'node:fs';
import {BattleSimulation} from '../src/simulation.js';
import {runMatch,summarize,scenarios} from './balance-runner.js';
const rows=[];
for(let i=0;i<100;i++)rows.push(runMatch(BattleSimulation,Math.imul(i+1,0x9e3779b9)>>>0,{...scenarios.E,strategies:[...scenarios.E.strategies].reverse()}));
const report={name:'E mirrored: blue elemental, red direct fire',summary:summarize(rows),rows};
writeFileSync('artifacts/balance-fairness.json',JSON.stringify(report));console.log(JSON.stringify(report.summary));
