import * as THREE from 'three';
import { BattleEffects } from './effects.js';

const WEAPONS = new Set(['AK','GrenadeLauncher','Knife_1','Knife_2','Pistol','Revolver',
  'Revolver_Small','RocketLauncher','ShortCannon','Shotgun','Shovel','SMG','Sniper','Sniper_2']);
const CLIPS = { Idle: 'Idle', Run: 'Run', Shoot: 'Idle_Shoot', HitReact: 'HitReact', Death: 'Death' };
const SKILL_COLORS={'rapid-fire':0xffe7a0,'heavy-bullets':0xffba83,'iron-army':0x86c4ff,'double-shot':0xc1a7ff,'fire-bullets':0xffa167,'life-steal':0xa7e8ba,'chain-lightning':0x86e9ef};

export class BattleView {
  static async create(scene, assets, arena, config, panel) {
    const names = ['Character_Soldier', 'Character_Hazmat', 'Character_Enemy'];
    const models = await Promise.all(names.map(name => assets.load('Characters', name)));
    for (let i = 0; i < models.length; i++) {
      for (const clip of Object.values(CLIPS)) {
        if (!models[i].animations.some(a => a.name === clip)) throw new Error(`${names[i]}: ${clip} animasyonu bulunamadı`);
      }
    }
    const view=new BattleView(scene, assets, arena, config, panel, models);
    await view.effects.loadTextures();
    return view;
  }

  constructor(scene, assets, arena, config, panel, models) {
    Object.assign(this, { scene, assets, arena, config, panel, models });
    this.actors = new Map();
    this.pool = [];
    this.effects = new BattleEffects(scene, config);
    this.ringGeometry = new THREE.RingGeometry(0.42, 0.48, 24);
    this.ringMaterials = [0x55baff,0xff7668].map(color => new THREE.MeshBasicMaterial({ color }));
    this.barGeometry = new THREE.PlaneGeometry(0.85, 0.065);
    this.barMaterials = [new THREE.MeshBasicMaterial({color:0x233b40}), new THREE.MeshBasicMaterial({color:0xa8edbe})];
    this.temp = new THREE.Vector3();
    this.muzzle = new THREE.Vector3();
    this.forward = new THREE.Vector3();
    this.inverseRotation = new THREE.Quaternion();
    this.lab = { enabled: false, mode: 'Auto', time: 0 };
    this.shots = [];
    this.decisions=[];
    this.motionPreference=matchMedia('(prefers-reduced-motion: reduce)');
    for(const base of arena.bases){
      base.hitMaterials=[];
      base.tower.traverse(node=>{if(!node.isMesh)return;node.material=node.material.clone();if(node.material.emissive)base.hitMaterials.push(node.material);});
    }
  }

  acquire(unit) {
    let actor = this.pool.find(item => item.unitID === null && item.variant === unit.variant);
    if (!actor) {
      const gltf = this.models[unit.variant];
      const { root, model } = this.assets.instance(gltf, 1.65);
      model.traverse(node => { if (WEAPONS.has(node.name)) node.visible = node.name === 'SMG'; });
      const mixer = new THREE.AnimationMixer(model);
      const actions = {};
      for (const [state, name] of Object.entries(CLIPS)) {
        const clip = gltf.animations.find(a => a.name === name);
        actions[state] = mixer.clipAction(clip);
        if (state === 'Death' || state === 'HitReact') {
          actions[state].setLoop(THREE.LoopOnce, 1);
          actions[state].clampWhenFinished = true;
        }
      }
      const ring = new THREE.Mesh(this.ringGeometry, this.ringMaterials[unit.team]);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.015;
      root.add(ring);
      const bar = new THREE.Group();
      const background = new THREE.Mesh(this.barGeometry, this.barMaterials[0]);
      const fill = new THREE.Mesh(this.barGeometry, this.barMaterials[1]);
      fill.position.z = 0.001;
      bar.add(background,fill);
      bar.position.y = 2;
      root.add(bar);
      const burnSprite=new THREE.Sprite(this.effects.fireMaterial);
      burnSprite.scale.set(2.4,3,1);burnSprite.position.y=1.1;burnSprite.visible=false;
      root.add(burnSprite);
      this.scene.add(root);
      actor = { root, model, mixer, actions, ring, bar, fill,burnSprite,variant: unit.variant,
        unitID: null, current: null, gun: model.getObjectByName('SMG'), lastHit: -1 };
      actor.gun?.geometry?.computeBoundingBox();
      this.pool.push(actor);
    }
    actor.unitID = unit.id;
    actor.root.visible = true;
    actor.ring.material = this.ringMaterials[unit.team];
    actor.bar.visible = true;
    actor.burnSprite.visible=false;
    actor.current = null;
    actor.lastHit = -1;
    this.actors.set(unit.id, actor);
    this.setAnimation(actor, 'Idle', true);
    return actor;
  }

  setAnimation(actor, state, restart = false) {
    if (actor.current === state && !restart) return;
    const previous = actor.actions[actor.current];
    const next = actor.actions[state];
    previous?.fadeOut(state === 'Death' ? 0.1 : 0.16);
    next.reset().fadeIn(state === 'Death' ? 0.1 : 0.16).play();
    actor.current = state;
    if (state === 'HitReact') next.setEffectiveTimeScale(next.getClip().duration / this.config.hitReactSeconds);
  }

  release(id) {
    const actor = this.actors.get(id);
    if (!actor) return;
    actor.mixer.stopAllAction();
    actor.root.visible = false;
    actor.burnSprite.visible=false;
    actor.unitID = null;
    actor.current = null;
    this.actors.delete(id);
  }

  consume(events) {
    for (const event of events) {
      if (event.type === 'remove') this.release(event.unitID);
      if (event.type === 'hit') {
        this.effects.impact(event);
        if (event.base) this.arena.bases[Number(event.targetID.slice(-1))].flash = 0.3;
      }
      if (event.type === 'shot') this.shots.push(event);
      if(event.type==='lightning')this.effects.chain(event);
      if(event.type==='heal')this.effects.heal(event);
      if(event.type==='level-up')this.effects.levelUp(this.arena.bases[event.team]);
      if(['skill-selected','question-bonus','spawn'].includes(event.type))this.decisions.push(event);
    }
  }

  update(simulation, alpha, dt, camera) {
    this.effects.reducedMotion=this.motionPreference.matches;
    this.lab.time += dt;
    for (const unit of simulation.units) {
      const actor = this.actors.get(unit.id) ?? this.acquire(unit);
      actor.root.position.set(unit.previousX + (unit.x - unit.previousX) * alpha, 0.14,
        unit.previousZ + (unit.z - unit.previousZ) * alpha);
      actor.root.rotation.y = unit.facing;
      let state = unit.state;
      if (this.lab.enabled && unit.hp > 0) state = this.lab.mode === 'Auto' ? (Math.floor(this.lab.time / 6) % 2 ? 'Run' : 'Idle') : this.lab.mode;
      const restartHit = state === 'HitReact' && actor.lastHit !== unit.hitUntil;
      if (restartHit) actor.lastHit = unit.hitUntil;
      this.setAnimation(actor, state, restartHit);
      actor.mixer.update(dt);
      actor.bar.visible = unit.hp > 0;
      actor.bar.quaternion.copy(camera.quaternion);
      this.inverseRotation.copy(actor.root.quaternion).invert();
      actor.bar.quaternion.premultiply(this.inverseRotation);
      actor.burnSprite.visible=unit.hp>0 && Boolean(unit.burn) && simulation.status==='running';
      const ratio = unit.hp / unit.maxHP;
      actor.fill.scale.x = ratio;
      actor.fill.position.x = (ratio - 1) * 0.425;
      if (unit.hp <= 0) {
        const age = (simulation.tick - unit.deathTick) / this.config.tickRate;
        actor.root.position.y -= Math.max(0, age - this.config.corpseSeconds + 0.6) * 1.5;
      }
    }
    for(const event of this.decisions){
      const base=this.arena.bases[event.team];
      if(event.type==='skill-selected'){
        if(event.skillID==='quick-reinforcement')this.effects.pulse(base.x,0,0xe1eca2,1.7,.6);
        else for(const unit of simulation.units)if(unit.team===event.team&&unit.hp>0){
          if(['iron-army','life-steal'].includes(event.skillID))this.effects.pulse(unit.x,unit.z,SKILL_COLORS[event.skillID],event.skillID==='iron-army'?.85:.45,1);
          else {const actor=this.actors.get(unit.id);if(actor?.gun){actor.gun.getWorldPosition(this.temp);this.effects.pulse(this.temp.x,this.temp.z,SKILL_COLORS[event.skillID],.27,this.temp.y);}}
        }
      }
      if(event.type==='question-bonus'){
        if(event.kind==='repair'){this.effects.hpText(base.x,0,event.amount,3.8);this.effects.pulse(base.x,0,0x85ffab,1.7,1.8);}
        if(event.kind==='shield')this.effects.pulse(base.x,0,0x86c4ff,2.2,1.5);
        if(event.kind==='attack')for(const unit of simulation.units)if(unit.team===event.team&&unit.hp>0)this.effects.pulse(unit.x,unit.z,0xffdf86,.45,1);
      }
      if(event.type==='spawn'&&simulation.teams[event.team].skills['quick-reinforcement']>0){
        const unit=simulation.units.find(u=>u.id===event.unitID);if(unit&&unit.hp>0){
          this.effects.pulse(unit.x,unit.z,0xe1eca2,.6,.5);
          this.effects.flash(unit.x,.4,unit.z,.08,.3,-.5,0,this.effects.levelMaterial);
          this.effects.flash(unit.x,.7,unit.z,.08,.3,.5,0,this.effects.levelMaterial);
        }
      }
    }
    this.decisions.length=0;
    for (const event of this.shots) {
      const actor = this.actors.get(event.unitID);
      if (!actor || !actor.gun) continue;
      actor.root.updateMatrixWorld(true);
      const box = actor.gun.geometry?.boundingBox;
      if (box) {
        this.forward.set(Math.sin(actor.root.rotation.y), 0, Math.cos(actor.root.rotation.y));
        let best = -Infinity;
        // Furthest gun-bound corner along aim direction = visible barrel tip.
        for (const x of [box.min.x,box.max.x]) for (const y of [box.min.y,box.max.y]) for (const z of [box.min.z,box.max.z]) {
          this.temp.set(x,y,z).applyMatrix4(actor.gun.matrixWorld);
          const dot = this.temp.dot(this.forward);
          if (dot > best) { best = dot; this.muzzle.copy(this.temp); }
        }
      } else actor.gun.getWorldPosition(this.muzzle);
      const projectile=simulation.projectiles[event.projectileID];
      const material=projectile?.burnDamage>0?this.effects.fireBulletMaterial:projectile?.damage>simulation.config.damage?this.effects.heavyBulletMaterial:this.effects.flashMaterial;
      const boosted=simulation.teams[event.team].stats.fireRate>simulation.config.fireRate;
      this.effects.flash(this.muzzle.x,this.muzzle.y,this.muzzle.z,boosted?.21:.16,event.second?.13:.1,0,0,material);
    }
    this.shots.length = 0;
    this.effects.update(simulation, alpha, dt);
    for (const base of this.arena.bases) {
      base.flash = Math.max(0, base.flash - dt);
      base.platform.material.emissive.setHex(base.flash > 0 ? 0xffb46a : 0x000000);
      base.platform.material.emissiveIntensity = base.flash * 3;
      for(const material of base.hitMaterials){material.emissive.setHex(base.flash>0?0xffb46a:0);material.emissiveIntensity=base.flash*1.6;}
      base.tower.position.x = base.x + (base.flash > 0&&!this.effects.reducedMotion ? Math.sin(base.flash * 65) * 0.025 : 0);
    }
    this.panel.state.instances = 22 + this.actors.size;
    this.panel.state.animation = this.lab.enabled ? 'Test' : 'Otomatik savaş';
  }

  reset() {
    for (const id of [...this.actors.keys()]) this.release(id);
    this.effects.clear();
    this.shots.length = 0;
    this.decisions.length=0;
    this.decisions.length=0;
    this.lab.time = 0;
    for (const base of this.arena.bases) { base.flash = 0; base.tower.position.x = base.x; base.platform.material.emissive.setHex(0);for(const material of base.hitMaterials)material.emissive.setHex(0); }
  }

  dispose() {
    this.reset();
    for (const actor of this.pool) {
      actor.mixer.stopAllAction();
      actor.mixer.uncacheRoot(actor.model);
      actor.model.traverse(node => { if (node.isSkinnedMesh) node.skeleton.dispose(); });
      this.scene.remove(actor.root);
    }
    this.pool.length = 0;
    this.effects.dispose();
    this.ringGeometry.dispose();
    this.barGeometry.dispose();
    for (const material of [...this.ringMaterials, ...this.barMaterials]) material.dispose();
  }
}
