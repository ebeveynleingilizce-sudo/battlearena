import * as THREE from 'three';

// Fixed size GPU object pools. Projectiles are driven by simulation positions;
// this layer never computes damage or chooses targets.
export class BattleEffects {
  constructor(scene, config) {
    this.scene = scene;
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
    this.flash(event.x,1.8,event.z,.15,.32,0,0,this.healMaterial);
    const slot=this.heals.find(item=>!item.sprite.visible);if(!slot)return;
    slot.sprite.position.set(event.x,1,event.z);slot.sprite.scale.set(1.7,1.7,1);slot.sprite.visible=true;slot.time=.45;
  }

  levelUp(base){
    this.flash(base.x,1.5,0,.75,.5,0,0,this.levelMaterial);
    for(let i=0;i<4;i++){const angle=i*Math.PI/2;this.flash(base.x+Math.cos(angle),.5,Math.sin(angle),.2,.6,0,0,this.levelMaterial);}
  }

  impact(event) {
    this.flash(event.x, event.base ? 1.5 : 1.1, event.z, event.base ? 0.4 : 0.2, 0.22);
    for (let i = 0; i < 4; i++) {
      const angle = i * Math.PI / 2;
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
      mesh.material = this.materials[p.team+(p.second?2:0)];
      mesh.scale.setScalar(p.second?1.15:1);
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
      flash.mesh.rotation.y += dt * 8;
    }
    for(const slot of this.lightning){slot.time-=dt;if(slot.time<=0)slot.line.visible=false;}
    for(const slot of this.heals){
      if(!slot.sprite.visible)continue;slot.time-=dt;
      slot.sprite.position.y+=dt*.6;slot.sprite.scale.setScalar(Math.max(0,slot.time/.45)*1.7);
      if(slot.time<=0)slot.sprite.visible=false;
    }
  }

  clear() {
    for (const mesh of this.bullets) mesh.visible = false;
    for (const slot of this.flashes) { slot.mesh.visible = false; slot.time = 0; }
    for(const slot of this.lightning){slot.line.visible=false;slot.time=0;}
    for(const slot of this.heals){slot.sprite.visible=false;slot.time=0;}
    this.elapsed=0;
  }

  dispose() {
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
