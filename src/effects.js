import * as THREE from 'three';

// Fixed size GPU object pools. Projectiles are driven by simulation positions;
// this layer never computes damage or chooses targets.
export class BattleEffects {
  constructor(scene, config) {
    this.scene = scene;
    this.damage=config.damage;this.baseDamage=config.baseDamage;
    this.geometries = [new THREE.CapsuleGeometry(0.035, 0.25, 2, 5), new THREE.OctahedronGeometry(1)];
    this.materials = [0x65cfff,0xff977a,0xb7efff,0xffe7a8].map(color => new THREE.MeshBasicMaterial({ color }));
    this.flashMaterial = new THREE.MeshBasicMaterial({ color: 0xffe5a0, transparent: true, opacity: 0.95 });
    this.healMaterial = new THREE.MeshBasicMaterial({ color: 0x85ffab });
    this.levelMaterial = new THREE.MeshBasicMaterial({ color: 0xe4ffc2 });
    this.lightningMaterial = new THREE.LineBasicMaterial({color:0x9bffff,transparent:true,opacity:0.9,depthWrite:false});
    this.fireMaterial = new THREE.SpriteMaterial({transparent:true,blending:THREE.AdditiveBlending,depthWrite:false});
    this.healSpriteMaterial = new THREE.SpriteMaterial({transparent:true,blending:THREE.AdditiveBlending,depthWrite:false});
    this.textures=[];
    this.lightning=Array.from({length:config.maxLightning},()=>{
      const geometry=new THREE.BufferGeometry();
      geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(15),3));
      const line=new THREE.Line(geometry,this.lightningMaterial);line.visible=false;line.frustumCulled=false;
      scene.add(line);return {line,time:0};
    });
    this.heals=Array.from({length:16},()=>{
      const sprite=new THREE.Sprite(this.healSpriteMaterial);sprite.visible=false;scene.add(sprite);
      return {sprite,time:0};
    });
    this.bullets = Array.from({ length: config.maxProjectiles }, () => {
      const mesh = new THREE.Mesh(this.geometries[0], this.materials[0]);
      mesh.visible = false;
      scene.add(mesh);
      return mesh;
    });
    this.flashes = Array.from({ length: config.maxEffects }, () => {
      const mesh = new THREE.Mesh(this.geometries[1], this.flashMaterial);
      mesh.visible = false;
      scene.add(mesh);
      return { mesh, time: 0, duration: 0, size: 0, dx: 0, dz: 0 };
    });
    this.up = new THREE.Vector3(0, 1, 0);
    this.direction = new THREE.Vector3();
    this.elapsed=0;
    this.fireBulletMaterial=new THREE.MeshBasicMaterial({color:0xffac52});
    this.heavyBulletMaterial=new THREE.MeshBasicMaterial({color:0xffdf86});
    this.pulseGeometry=new THREE.IcosahedronGeometry(1,1);
    this.pulses=Array.from({length:24},()=>{
      const mesh=new THREE.Mesh(this.pulseGeometry,new THREE.MeshBasicMaterial({color:0x8bd8ff,wireframe:true,transparent:true,opacity:0,depthWrite:false}));
      mesh.visible=false;scene.add(mesh);return {mesh,time:0,duration:0,size:1};
    });
    this.healTextTimes=new Map();
    this.labels=Array.from({length:16},()=>{
      const canvas=document.createElement('canvas');canvas.width=128;canvas.height=48;
      const texture=new THREE.CanvasTexture(canvas);
      const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true,depthWrite:false}));
      sprite.visible=false;scene.add(sprite);return {canvas,texture,sprite,time:0};
    });
  }

  async loadTextures(){
    const loader=new THREE.TextureLoader();
    this.textures=await Promise.all(['Torch-1.png','Torch-5.png','Torch-9.png','Torch-13.png','Heal-1.png']
      .map(name=>loader.loadAsync(`${import.meta.env?.BASE_URL ?? '/'}assets/vfx/${name}`)));
    this.textures.forEach(texture=>{texture.colorSpace=THREE.SRGBColorSpace});
    this.fireMaterial.map=this.textures[0];this.fireMaterial.needsUpdate=true;
    this.healSpriteMaterial.map=this.textures[4];this.healSpriteMaterial.needsUpdate=true;
  }

  flash(x, y, z, size, duration, dx = 0, dz = 0, material=this.flashMaterial) {
    if(this.reducedMotion){dx=dz=0;duration=Math.min(duration,.18);}
    const slot = this.flashes.find(item => !item.mesh.visible);
    if (!slot) return;
    Object.assign(slot, { time: duration, duration, size, dx, dz });
    slot.mesh.position.set(x, y, z);
    slot.mesh.visible = true;
    slot.mesh.material=material;
    slot.mesh.scale.setScalar(size);
  }

  chain(event){
    const slot=this.lightning.find(item=>!item.line.visible);if(!slot)return;
    const positions=slot.line.geometry.attributes.position;
    for(let i=0;i<5;i++){
      const t=i/4,offset=i===0 || i===4?0:(i%2?.14:-.14);
      positions.setXYZ(i,event.fromX+(event.toX-event.fromX)*t+offset,1.15+offset,event.fromZ+(event.toZ-event.fromZ)*t-offset);
    }
    positions.needsUpdate=true;slot.time=.18;slot.line.visible=true;
  }

  heal(event){
    if(this.elapsed-(this.healTextTimes.get(event.unitID)??-Infinity)>.6){
      this.healTextTimes.set(event.unitID,this.elapsed);
      this.hpText(event.x,event.z,event.amount);
      for(let i=0;i<3;i++){const a=i*Math.PI*2/3;this.flash(event.x,1,event.z,.07,.4,Math.cos(a)*.5,Math.sin(a)*.5,this.healMaterial);}
    }
    this.flash(event.x,1.8,event.z,.15,.32,0,0,this.healMaterial);
    const slot=this.heals.find(item=>!item.sprite.visible);if(!slot)return;
    slot.sprite.position.set(event.x,1,event.z);slot.sprite.scale.set(1.7,1.7,1);slot.sprite.visible=true;slot.time=.45;
  }

  hpText(x,z,amount,y=2.1){
    if(!(amount>0))return;
    const slot=this.labels.find(item=>!item.sprite.visible);if(!slot)return;
    const ctx=slot.canvas.getContext('2d');ctx.clearRect(0,0,128,48);
    ctx.font='bold 26px Segoe UI';ctx.textAlign='center';ctx.lineWidth=5;ctx.strokeStyle='#142f23';ctx.fillStyle='#b2ffb4';
    const value=amount<.1?'<0.1':Number(amount.toFixed(1));
    const text=`+${value} HP`;ctx.strokeText(text,64,33);ctx.fillText(text,64,33);
    slot.texture.needsUpdate=true;slot.sprite.position.set(x,y,z);slot.sprite.scale.set(1.6,.6,1);
    slot.sprite.material.opacity=1;slot.sprite.visible=true;slot.time=.8;
  }

  pulse(x,z,color,size=1,y=1){
    const slot=this.pulses.find(item=>!item.mesh.visible);if(!slot)return;
    const duration=this.reducedMotion?.2:.65;
    Object.assign(slot,{time:duration,duration,size});slot.mesh.material.color.setHex(color);
    slot.mesh.position.set(x,y,z);slot.mesh.scale.setScalar(size);slot.mesh.visible=true;
  }

  levelUp(base){
    this.flash(base.x,1.5,0,.75,.5,0,0,this.levelMaterial);
    if(this.reducedMotion)return;
    for(let i=0;i<4;i++){const angle=i*Math.PI/2;this.flash(base.x+Math.cos(angle),.5,Math.sin(angle),.2,.6,0,0,this.levelMaterial);}
  }

  impact(event) {
    const strength=Math.min(1.65,Math.max(.65,event.amount/(event.base?this.baseDamage:this.damage)));
    const material=event.kind==='burn'?this.fireBulletMaterial:strength>1?this.heavyBulletMaterial:this.flashMaterial;
    this.flash(event.x,event.base?1.5:1.1,event.z,(event.base?.3:.16)*strength,.16,0,0,material);
    const count=this.focusMode||this.reducedMotion?0:strength>1?3:2;
    for (let i = 0; i < count; i++) {
      const angle = i * Math.PI *2/count;
      this.flash(event.x, 1.1, event.z, 0.07, 0.28, Math.cos(angle) * 2, Math.sin(angle) * 2);
    }
  }

  update(simulation, alpha, dt) {
    this.elapsed+=dt;
    if(this.textures.length)this.fireMaterial.map=this.textures[Math.floor(this.elapsed*12)%4];
    for (const p of simulation.projectiles) {
      const mesh = this.bullets[p.id];
      mesh.visible = p.active;
      if (!p.active) continue;
      if(p.burnDamage>0&&!this.focusMode&&!this.reducedMotion&&this.elapsed>(mesh.userData.trailAfter??0)){
        mesh.userData.trailAfter=this.elapsed+.12;
        this.flash(p.previousX,1.15,p.previousZ,.045,.16,0,0,this.fireBulletMaterial);
      }
      mesh.material=p.burnDamage>0?this.fireBulletMaterial:p.damage>simulation.config.damage?this.heavyBulletMaterial:this.materials[p.team+(p.second?2:0)];
      mesh.scale.setScalar(Math.min(1.7,p.damage/simulation.config.damage)*(p.second?1.1:1));
      mesh.position.set(p.previousX + (p.x - p.previousX) * alpha, 1.15,
        p.previousZ + (p.z - p.previousZ) * alpha);
      this.direction.set(p.x - p.previousX, 0, p.z - p.previousZ);
      if (this.direction.lengthSq() > 0.00001) mesh.quaternion.setFromUnitVectors(this.up, this.direction.normalize());
    }
    for (const flash of this.flashes) {
      if (!flash.mesh.visible) continue;
      flash.time -= dt;
      if (flash.time <= 0) { flash.mesh.visible = false; continue; }
      flash.mesh.position.x += flash.dx * dt;
      flash.mesh.position.z += flash.dz * dt;
      flash.mesh.scale.setScalar(flash.size * (flash.time / flash.duration));
      if(!this.reducedMotion)flash.mesh.rotation.y += dt * 8;
    }
    for(const slot of this.lightning){slot.time-=dt;if(slot.time<=0)slot.line.visible=false;}
    for(const slot of this.heals){
      if(!slot.sprite.visible)continue;slot.time-=dt;
      if(!this.reducedMotion)slot.sprite.position.y+=dt*.6;slot.sprite.scale.setScalar(Math.max(0,slot.time/.45)*1.7);
      if(slot.time<=0)slot.sprite.visible=false;
    }
    for(const slot of this.pulses){
      if(!slot.mesh.visible)continue;slot.time-=dt;
      const ratio=Math.max(0,slot.time/slot.duration);slot.mesh.material.opacity=ratio*.45;
      slot.mesh.scale.setScalar(slot.size*(1+(this.reducedMotion?0:(1-ratio)*.2)));if(slot.time<=0)slot.mesh.visible=false;
    }
    for(const slot of this.labels){
      if(!slot.sprite.visible)continue;slot.time-=dt;if(!this.reducedMotion)slot.sprite.position.y+=dt*.6;
      slot.sprite.material.opacity=Math.min(1,Math.max(0,slot.time/.25));if(slot.time<=0)slot.sprite.visible=false;
    }
    for(const [id,time] of this.healTextTimes)if(this.elapsed-time>2)this.healTextTimes.delete(id);
  }

  clear() {
    for (const mesh of this.bullets) {mesh.visible=false;mesh.userData.trailAfter=0;}
    for (const slot of this.flashes) { slot.mesh.visible = false; slot.time = 0; }
    for(const slot of this.lightning){slot.line.visible=false;slot.time=0;}
    for(const slot of this.heals){slot.sprite.visible=false;slot.time=0;}
    this.elapsed=0;
    this.healTextTimes.clear();
    for(const slot of this.pulses)slot.mesh.visible=false;
    for(const slot of this.labels)slot.sprite.visible=false;
  }

  dispose() {
    for(const slot of this.pulses){this.scene.remove(slot.mesh);slot.mesh.material.dispose();}
    for(const slot of this.labels){this.scene.remove(slot.sprite);slot.sprite.material.dispose();slot.texture.dispose();}
    this.pulseGeometry.dispose();this.fireBulletMaterial.dispose();this.heavyBulletMaterial.dispose();
    for (const mesh of this.bullets) this.scene.remove(mesh);
    for (const slot of this.flashes) this.scene.remove(slot.mesh);
    for(const slot of this.lightning){this.scene.remove(slot.line);slot.line.geometry.dispose();}
    for(const slot of this.heals)this.scene.remove(slot.sprite);
    for (const geometry of this.geometries) geometry.dispose();
    for (const material of [...this.materials,this.flashMaterial,this.healMaterial,this.levelMaterial,
      this.lightningMaterial,this.fireMaterial,this.healSpriteMaterial]) material.dispose();
    for(const texture of this.textures)texture.dispose();
  }
}
