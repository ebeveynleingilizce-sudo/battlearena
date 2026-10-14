import * as THREE from 'three';
import { AssetLibrary } from '../src/assets.js';
import { createArena } from '../src/arena.js';
import { BattleSimulation } from '../src/simulation.js';
import { BattleView } from '../src/battle-view.js';
import { BATTLE_CONFIG } from '../src/config.js';

const report = document.getElementById('report');
const button = document.getElementById('run');
const panel = {state:{models:0,instances:0},refresh(){}};
const renderer = new THREE.WebGLRenderer({antialias:true});
renderer.setSize(800,500);
document.getElementById('qa-viewport').append(renderer.domElement);
const scene = new THREE.Scene();scene.background = new THREE.Color(0x29474b);
scene.add(new THREE.HemisphereLight(0xffffff,0x557755,3));
const camera = new THREE.OrthographicCamera(-19,19,12,-12,.1,100);
camera.position.set(25,27,25);camera.lookAt(0,0,0);
// Isolated stress fixture: extended base/soldier HP exposes every elemental effect.
const config = {...BATTLE_CONFIG,baseHP:1000000,soldierHP:400};
const assets = new AssetLibrary(panel);
const arena = await createArena(scene,assets,config);
const view = await BattleView.create(scene,assets,arena,config,panel);
const sim = new BattleSimulation(config);
const nextFrame = () => new Promise(resolve=>setTimeout(resolve,0));
const samples=[];
const require = (condition,message) => {if(!condition)throw new Error(message)};
button.disabled=false;
report.textContent='Hazır. Testi başlatın.';

button.addEventListener('click',async()=>{
  button.disabled=true;samples.length=0;
  try {
    for(let match=0;match<8;match++){
      sim.reset();view.reset();
      // Test-only progression fixture; production XP remains kill-only.
      for(const team of sim.teams)sim.progression.award(team.team,100000,sim.events);
      while(sim.teams.some(team=>team.pending.length)){
        for(const team of sim.teams){const right=team.pending[0];if(right)sim.enqueueCommand({type:'selectSkill',team:team.team,
          matchID:sim.matchID,choiceID:right.id,skillID:right.options[0]},team.team);}
        sim.step();view.consume(sim.events);view.update(sim,1,1/30,camera);
      }
      for(let tick=sim.tick;tick<9000;tick++){
        sim.step();view.consume(sim.events);view.update(sim,1,1/30,camera);
        if(tick%120===0){renderer.render(scene,camera);await nextFrame()}
        require(view.actors.size===sim.units.length,'Simulation / actor count mismatch');
        require(view.effects.flashes.length===config.maxEffects,'Effect pool changed size');
        require(view.effects.bullets.length===config.maxProjectiles,'Projectile pool changed size');
        require(view.effects.lightning.length===config.maxLightning,'Lightning pool changed size');
      }
      require(sim.seconds===300 && sim.status==='finished','300-second end failed');
      renderer.render(scene,camera);
      samples.push({match:match+1,actors:view.pool.length,geometries:renderer.info.memory.geometries,
        textures:renderer.info.memory.textures,programs:renderer.info.programs.length,deaths:sim.stats.deaths,baseHits:sim.stats.baseHits,
        doubleShots:sim.stats.doubleShots,burnHits:sim.stats.burnHits,chainHits:sim.stats.chainHits,healing:Math.round(sim.stats.healing)});
      require(sim.stats.doubleShots>0 && sim.stats.burnHits>0 && sim.stats.chainHits>0 && sim.stats.healing>0,'Skill effect paths not exercised');
      report.textContent=JSON.stringify(samples,null,2);
      await nextFrame();
    }
    const last=samples.at(-1),warm=samples[1];
    for(const key of ['actors','geometries','textures','programs'])require(last[key]===warm[key],`${key} grew after warmup`);
    sim.reset();view.reset();view.update(sim,1,0,camera);renderer.render(scene,camera);
    require(sim.units.length===6 && view.actors.size===6,'Restart actor state failed');
    require(sim.stats.shots===0 && sim.projectiles.every(p=>!p.active),'Restart battle state failed');
    report.textContent='PASS · Aşama 3 · 8 × 300 saniye / 72.000 tick\nSekiz skill / yanma / yıldırım / can çalma / çift atış test edildi.\nHavuzlar ve GPU kaynakları ısınmadan sonra sabit.\nYeniden başlatma doğrulandı.\n'+JSON.stringify(samples,null,2);
  } catch(error){report.textContent='FAIL · '+error.message;console.error(error)}
  button.disabled=false;
});
