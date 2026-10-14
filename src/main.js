import * as THREE from 'three';
import './style.css';
import { createDevPanel } from './dev-panel.js';
import { AssetLibrary } from './assets.js';
import { createArena } from './arena.js';
import { BATTLE_CONFIG } from './config.js';
import { BattleSimulation } from './simulation.js';
import { FixedStepClock } from './fixed-loop.js';
import { BattleView } from './battle-view.js';
import { createBattleUI } from './battle-ui.js';
import { createSkillUI } from './skill-ui.js';
import { BattleAudio } from './audio.js';
import questionBank from './data/questions.json';
import { validateBank } from './questions.js';
import { createQuestionUI } from './question-ui.js';
import { createLocalPlayer } from './local-player.js';

const panel = createDevPanel();
const nextSeed=previous=>{
  if(import.meta.env.DEV){const fixed=new URLSearchParams(location.search).get('seed');if(fixed!==null&&/^\d+$/.test(fixed))return Number(fixed)>>>0||1;}
  const generated=crypto.getRandomValues(new Uint32Array(1))[0]||1;
  return generated===previous?(generated+1)>>>0||1:generated;
};

async function main() {
  const host = document.getElementById('viewport');
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;
  host.append(renderer.domElement);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x29474b);
  scene.add(new THREE.HemisphereLight(0xe4f4ff, 0x64724c, 2.4));
  const sun = new THREE.DirectionalLight(0xffe5bf, 3.2);
  sun.position.set(-9, 18, 10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -19, right: 19, top: 19, bottom: -19, near: 1, far: 55 });
  sun.shadow.normalBias = 0.04;
  scene.add(sun);
  const camera = new THREE.OrthographicCamera(-18, 18, 12, -12, 0.1, 100);
  camera.position.set(25, 27, 25);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  function resize() {
    const width = host.clientWidth, height = host.clientHeight;
    renderer.setSize(width, height);
    const aspect = width / height;
    const box = new THREE.Box3(new THREE.Vector3(-12.6, -1, -8.6), new THREE.Vector3(12.6, 4, 8.6));
    let maxX = 0, maxY = 0;
    for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
      const p = new THREE.Vector3(x, y, z).applyMatrix4(camera.matrixWorldInverse);
      maxX = Math.max(maxX, Math.abs(p.x));
      maxY = Math.max(maxY, Math.abs(p.y));
    }
    // Bring the battlefield closer on wide monitors; preserve the full arena on narrow screens.
    const zoom = aspect >= 1.5 ? 0.72 : 0.94;
    const half = Math.max(maxY, maxX / aspect) * zoom;
    camera.left = -half * aspect; camera.right = half * aspect;
    camera.top = half; camera.bottom = -half;
    camera.updateProjectionMatrix();
  }
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  resize();
  renderer.domElement.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    panel.report('WebGL bağlamı kayboldu. Sayfayı yeniden yükleyin.');
  });
  const assets = new AssetLibrary(panel);
  const arena = await createArena(scene, assets);
  const simulation = new BattleSimulation({...BATTLE_CONFIG,hotseat:true,seed:nextSeed()},validateBank(questionBank));
  const view = await BattleView.create(scene, assets, arena, BATTLE_CONFIG, panel);
  const clock = new FixedStepClock(BATTLE_CONFIG.tickRate);
  const ui = createBattleUI(simulation, view, restart);
  const audio = new BattleAudio();
  const player=createLocalPlayer(simulation);
  const skillUI = createSkillUI(simulation,audio,player);
  const questionUI=createQuestionUI(simulation,player);
  player.subscribe(()=>{skillUI.update();questionUI.update();});
  // Dev controls replay real combat ticks. They never grant XP or skill rights.
  if(import.meta.env.DEV){
    const controls=document.getElementById('qa-controls');controls.hidden=false;
    const replay=predicate=>{
      for(let i=0;i<simulation.config.tickRate*120&&simulation.status==='running';i++){
        simulation.step();player.refresh();view.consume(simulation.events);skillUI.consume(simulation.events);
        view.update(simulation,1,1/simulation.config.tickRate,camera);
        if(predicate())break;
      }
      clock.reset();previous=performance.now();
      ui.update(renderer);skillUI.update();questionUI.update();panel.refresh();
    };
    document.getElementById('qa-next-question').addEventListener('click',()=>{
      if(simulation.teams[player.team].pending.length)return;
      const previous=simulation.questions.teams[player.team].active?.id;
      replay(()=>simulation.questions.teams[player.team].active?.id&&simulation.questions.teams[player.team].active.id!==previous||simulation.teams[player.team].pending.length>0);
    });
    document.getElementById('qa-next-level').addEventListener('click',()=>{
      if(simulation.teams[player.team].pending.length)return;
      const level=simulation.teams[player.team].level;replay(()=>simulation.teams[player.team].level>level);
    });
    document.getElementById('qa-skill-timeout').addEventListener('click',()=>{
      const right=simulation.teams[player.team].pending[0];if(!right)return;
      replay(()=>simulation.teams[player.team].pending[0]?.id!==right.id);
    });
    document.getElementById('qa-30-seconds').addEventListener('click',()=>replay(()=>simulation.seconds>=30));
    document.getElementById('qa-before-protection-end').addEventListener('click',()=>replay(()=>simulation.tick>=simulation.ticks(simulation.config.baseProtectionSeconds-1)));
    document.getElementById('qa-finish').addEventListener('click',()=>{
      for(let i=0;i<3&&simulation.status==='running';i++)replay(()=>simulation.status==='finished');
    });
  }
  // Local UI test fixture: replay genuine kill-producing ticks, never grant XP.
  // Vite removes this branch from production builds.
  if(import.meta.env.DEV && (new URLSearchParams(location.search).has('qa-ui')||new URLSearchParams(location.search).has('qa-question'))){
    const seconds=new URLSearchParams(location.search).has('qa-question')?BATTLE_CONFIG.questionFirstSeconds:18;
    for(let i=0;i<seconds*BATTLE_CONFIG.tickRate && simulation.status==='running';i++){
      simulation.step();view.consume(simulation.events);skillUI.consume(simulation.events);
      view.update(simulation,1,1/BATTLE_CONFIG.tickRate,camera);
    }
  }
  let previous = performance.now(), frames = 0, fpsInterval = 0;
  function restart() {
    view.reset();
    simulation.reset(nextSeed(simulation.config.seed));
    clock.reset();
    previous = performance.now();
    ui.reset();
    skillUI.reset();
    questionUI.reset();
    audio.reset();
    player.refresh();
    view.update(simulation, 1, 0, camera);
    ui.update(renderer);
    skillUI.update();
    questionUI.update();
    panel.refresh();
  }
  view.update(simulation, 1, 0, camera);
  ui.update(renderer);
  skillUI.update();
  questionUI.update();
  panel.state.ready = true;
  panel.refresh();
  document.getElementById('loading').hidden = true;
  renderer.setAnimationLoop(now => {
    const dt = Math.max(0, (now - previous) / 1000);
    previous = now;
    const alpha = clock.advance(dt, () => { simulation.step(); player.refresh(); view.consume(simulation.events); skillUI.consume(simulation.events); },
      () => simulation.status === 'running' && !view.lab.enabled);
    const visualDt = Math.min(dt, 0.1);
    if (simulation.status === 'finished') view.effects.clear();
    view.update(simulation, simulation.status === 'finished' ? 1 : alpha, simulation.status === 'finished' ? 0 : visualDt, camera);
    renderer.render(scene, camera);
    ui.update(renderer);
    skillUI.update();
    questionUI.update();
    frames++;
    fpsInterval += dt;
    if (fpsInterval >= 0.75) {
      panel.state.fps = Math.round(frames / fpsInterval);
      panel.refresh();
      frames = 0; fpsInterval = 0;
    }
  });
  window.__arena = { panel: panel.state, scene, camera, renderer, simulation, view, clock,player };
  window.addEventListener('pagehide', () => {
    renderer.setAnimationLoop(null);
    observer.disconnect();
    view.dispose();
    audio.dispose();
    const geometries = new Set(), materials = new Set();
    scene.traverse(node => {
      if (node.geometry) geometries.add(node.geometry);
      if (node.material) (Array.isArray(node.material) ? node.material : [node.material]).forEach(m => materials.add(m));
    });
    for (const geometry of geometries) geometry.dispose();
    for (const material of materials) material.dispose();
    sun.shadow.dispose();
    renderer.dispose();
  }, { once: true });
}

main().catch(error => {
  console.error(error);
  document.getElementById('loading').textContent = 'Sahne yüklenemedi. Geliştirme panelini kontrol edin.';
});
