import * as THREE from 'three';
import { BATTLE_CONFIG } from './config.js';
export async function createArena(scene,assets,config=BATTLE_CONFIG){
 const bases=[];
 const mesh=(geometry,color,x,y,z)=>{const m=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color,roughness:.85}));m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;scene.add(m);return m};
 // Seamless terrain instead of a raised, floating rectangular board.
 const ground=new THREE.Mesh(
   new THREE.PlaneGeometry(220,220),
   new THREE.MeshStandardMaterial({color:0x647e67,roughness:1})
 );
 ground.rotation.x=-Math.PI/2;
 ground.position.y=-.11;
 ground.receiveShadow=true;
 scene.add(ground);
 // The playable area is a subtle ground-color variation, not a thick slab.
 const field=new THREE.Mesh(
   new THREE.PlaneGeometry(24,16),
   new THREE.MeshStandardMaterial({color:0x77967a,roughness:1})
 );
 field.rotation.x=-Math.PI/2;
 field.position.y=-.085;
 field.receiveShadow=true;
 scene.add(field);
 // Soft surrounding terrain patches add depth without obscuring the battle.
 const patches=new THREE.Group();
 const patchMaterial=new THREE.MeshStandardMaterial({color:0x738e72,roughness:1,transparent:true,opacity:.45,depthWrite:false});
 for(let i=0;i<54;i++){
   const angle=i*2.399963229728653, distance=12+Math.sqrt(i/54)*24;
   const x=Math.cos(angle)*distance,z=Math.sin(angle)*distance;
   if(Math.abs(x)<13&&Math.abs(z)<9)continue;
   const patch=new THREE.Mesh(new THREE.CircleGeometry(.7+(i%5)*.33,12),patchMaterial);
   patch.rotation.x=-Math.PI/2;patch.rotation.z=(i*1.37)%6.28;
   patch.scale.set(1.7,.65,1);
   patch.position.set(x,-.096,z);
   patches.add(patch);
 }
 scene.add(patches);

 // Surrounding kingdom landscape: scenery belongs to the same world as the battlefield.
 // Keep a clear 24x16 combat footprint; all decoration sits beyond its edges.
 const scenery=new THREE.Group();scene.add(scenery);
 const landscapeMaterials={
   hill:new THREE.MeshStandardMaterial({color:0x64846a,roughness:1}),
   hillLight:new THREE.MeshStandardMaterial({color:0x789776,roughness:1}),
   rock:new THREE.MeshStandardMaterial({color:0x929a8c,roughness:1,flatShading:true}),
   rockDark:new THREE.MeshStandardMaterial({color:0x6d827d,roughness:1,flatShading:true}),
   path:new THREE.MeshStandardMaterial({color:0xb0a88c,roughness:1}),
   trunk:new THREE.MeshStandardMaterial({color:0x705a40,roughness:1}),
   leaves:new THREE.MeshStandardMaterial({color:0x4f7955,roughness:1,flatShading:true}),
   leavesLight:new THREE.MeshStandardMaterial({color:0x7da46a,roughness:1,flatShading:true})
 };
 const addScenery=(geometry,material,x,y,z,sx=1,sy=1,sz=1)=>{
   const m=new THREE.Mesh(geometry,material);m.position.set(x,y,z);m.scale.set(sx,sy,sz);
   m.castShadow=true;m.receiveShadow=true;scenery.add(m);return m;
 };
 const rand=n=>{const t=Math.sin(n*127.1+39.7)*43758.5453;return t-Math.floor(t)};
 const hillGeometry=new THREE.SphereGeometry(1,10,7);
 const rockGeometry=new THREE.DodecahedronGeometry(1,0);
 const trunkGeometry=new THREE.CylinderGeometry(.12,.2,1,6);
 const crownGeometry=new THREE.IcosahedronGeometry(1,0);
 const shrubGeometry=new THREE.IcosahedronGeometry(1,1);
 // Natural low ridges on all sides. Broad, flattened hills blend into the terrain.
 for(let i=0;i<46;i++){
   const angle=i*2.3999632;
   const radius=16+rand(i+91)*16;
   const x=Math.cos(angle)*radius*1.35,z=Math.sin(angle)*radius;
   if(Math.abs(x)<13&&Math.abs(z)<9)continue;
   const height=.65+rand(i+13)*1.15;
   addScenery(hillGeometry,i%3?landscapeMaterials.hill:landscapeMaterials.hillLight,x,-.55,z,2.2+rand(i+1)*2.4,height,2+rand(i+2)*2.4);
 }
 // Forest clusters, rocks and shrubs: deterministic placement, no loading/network costs.
 for(let i=0;i<145;i++){
   const angle=i*2.3999632;
   const radius=11.5+Math.sqrt(rand(i+251))*25;
   const x=Math.cos(angle)*radius*1.35,z=Math.sin(angle)*radius;
   if(Math.abs(x)<12.8&&Math.abs(z)<9.1)continue;
   if(i%7===0){
     const size=.5+rand(i+7)*.8;
     const rock=addScenery(rockGeometry,i%2?landscapeMaterials.rock:landscapeMaterials.rockDark,x,size*.45-.06,z,size*1.25,size*.65,size);
     rock.rotation.y=rand(i+6)*6.28;
   }else if(i%4===0){
     const size=.35+rand(i+3)*.45;
     addScenery(shrubGeometry,i%2?landscapeMaterials.leaves:landscapeMaterials.leavesLight,x,size*.55-.04,z,size*1.4,size,size);
   }else{
     const h=1.3+rand(i+4)*1.75;
     addScenery(trunkGeometry,landscapeMaterials.trunk,x,h*.32-.05,z,1,h*.64,1);
     const canopy=addScenery(crownGeometry,i%3?landscapeMaterials.leaves:landscapeMaterials.leavesLight,x,h*.78,z,.55+h*.12,.62+h*.12,.55+h*.12);
     canopy.rotation.y=rand(i+8)*6.28;
   }
 }
 // Stone approaches and small roadside details lead into each kingdom.
 for(const side of [-1,1]){
   for(let i=0;i<7;i++){
     const x=side*(12.7+i*1.65),z=(i%2?1:-1)*(1.5+rand(i+side+9)*2.4);
     const size=.25+rand(i+43)*.3;
     addScenery(rockGeometry,landscapeMaterials.rock,x,size*.35-.05,z,size*1.3,size*.6,size);
   }
 }

 mesh(new THREE.BoxGeometry(19,.03,5.2),0xaab59a,0,.08,0);
 for(let x=-10;x<=10;x+=2)for(const z of [-6.9,6.9])mesh(new THREE.BoxGeometry(1.7,.09,.12),0xb5c6a4,x,.12,z);
 const ring=(x,z,color,r=1.4)=>{const m=mesh(new THREE.RingGeometry(r-.07,r,64),color,x,.13,z);m.rotation.x=-Math.PI/2;return m};
 ring(0,0,0xd0dbb7,2.1);ring(0,0,0x566f61,1.75);mesh(new THREE.CylinderGeometry(.28,.35,.15,6),0xe2d8a6,0,.18,0);
 const names=['WaterTank_Platform','Container_Small','Crate','Tree_1','Tree_3','Barrier_Large'];
 const models=await Promise.all(names.map(n=>assets.load('Environment',n)));
 function prop(name,height,x,z,rotation=0){const {root}=assets.instance(models[names.indexOf(name)],height);root.position.set(x,.13,z);root.rotation.y=rotation;scene.add(root);return root}

// Fantasy castle silhouettes flank the battlefield without blocking the central lane.
 const stone=0xb9b3a3,trim=0x777a78;
 function castle(side,x,color){
   const outer=side*1.9;
   // Back curtain wall and four battlement towers, offset away from combat.
   mesh(new THREE.BoxGeometry(.55,1.65,6.5),stone,x+outer,.82,0);
   for(const z of [-3.2,3.2]){
     const tx=x+outer;
     mesh(new THREE.CylinderGeometry(.67,.76,2.65,8),stone,tx,1.26,z);
     mesh(new THREE.CylinderGeometry(.84,.84,.22,8),trim,tx,2.65,z);
     const roof=mesh(new THREE.ConeGeometry(.85,1.15,8),color,tx,3.35,z);
     roof.castShadow=true;
   }
   for(let z=-2.5;z<=2.5;z+=.85)mesh(new THREE.BoxGeometry(.72,.4,.47),stone,x+outer,1.85,z);
   // Team banners remain readable even when the arena is viewed from above.
   for(const z of [-2.2,2.2]){
     mesh(new THREE.CylinderGeometry(.045,.045,2.2,6),trim,x+outer,3,z);
     mesh(new THREE.BoxGeometry(.08,.86,.65),color,x+outer,3.55,z+.34);
   }
 }
 for(const side of [-1,1]){
  const color=side===-1?0x55baff:0xff7668;
  const baseX=side*config.baseX;
  castle(side,baseX,color);
  const platform=mesh(new THREE.CylinderGeometry(2.05,2.2,.24,48),color,baseX,.15,0);ring(baseX,0,0xf3e7c8,2.25);
  const tower=prop('WaterTank_Platform',2.7,baseX,0);
  bases.push({tower,platform,flash:0,x:baseX});
  for(const z of [-4.7,4.7]){prop('Container_Small',1.3,side*7,z,side===-1?Math.PI:0);prop('Crate',.8,side*4.8,z);prop('Barrier_Large',.65,side*2.7,z,Math.PI/2)}
  for(const z of [-6,6]){prop('Tree_1',2.6,side*10,z);prop('Tree_3',2.1,side*8.1,z)}
  const beacon=mesh(new THREE.CylinderGeometry(.12,.12,1.6,8),0x314957,side*10.2,.9,0);beacon.castShadow=false;
  const light=mesh(new THREE.SphereGeometry(.21,12,8),color,side*10.2,1.8,0);light.material.emissive.set(color);light.material.emissiveIntensity=1;
 }
 return {ring,bases};
}
