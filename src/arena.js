import * as THREE from 'three';
import { BATTLE_CONFIG } from './config.js';
export async function createArena(scene,assets,config=BATTLE_CONFIG){
 const bases=[];
 const paths={
  blueCastle:'buildings/blue/building_castle_blue',redCastle:'buildings/red/building_castle_red',
  blueTower:'buildings/blue/building_tower_A_blue',redTower:'buildings/red/building_tower_A_red',
  wall:'buildings/neutral/wall_straight',gate:'buildings/neutral/wall_straight_gate',
  treeA:'decoration/nature/tree_single_A',treeB:'decoration/nature/tree_single_B',
  rockA:'decoration/nature/rock_single_A',rockC:'decoration/nature/rock_single_C'
 };
 const models=Object.fromEntries(await Promise.all(Object.entries(paths).map(async ([key,path])=>[key,await assets.loadFile(`kingdom/${path}.gltf`)])));
 const batches=new Map();
 function prop(name,height,x,z,rotation=0,batch=false){
  const {root}=assets.instance(models[name],height);root.position.set(x,.13,z);root.rotation.y=rotation;
  if(!batch){scene.add(root);return root}
  root.updateMatrixWorld(true);
  root.traverse(node=>{if(!node.isMesh)return;const key=`${node.geometry.uuid}:${node.material.uuid}`;
   if(!batches.has(key))batches.set(key,{geometry:node.geometry,material:node.material,matrices:[]});
   batches.get(key).matrices.push(node.matrixWorld.clone());
  });
  return root;
 }
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
 // Keep the central combat corridor clear; surrounding terrain remains unchanged.
 const scenery=new THREE.Group();scene.add(scenery);
 const landscapeMaterials={
   hill:new THREE.MeshStandardMaterial({color:0x64846a,roughness:1}),
   hillLight:new THREE.MeshStandardMaterial({color:0x789776,roughness:1})
 };
 const addScenery=(geometry,material,x,y,z,sx=1,sy=1,sz=1)=>{
   const m=new THREE.Mesh(geometry,material);m.position.set(x,y,z);m.scale.set(sx,sy,sz);
   m.castShadow=true;m.receiveShadow=true;scenery.add(m);return m;
 };
 const rand=n=>{const t=Math.sin(n*127.1+39.7)*43758.5453;return t-Math.floor(t)};
 const hillGeometry=new THREE.SphereGeometry(1,10,7);
 // Natural low ridges on all sides. Broad, flattened hills blend into the terrain.
 for(let i=0;i<46;i++){
   const angle=i*2.3999632;
   const radius=16+rand(i+91)*16;
   const x=Math.cos(angle)*radius*1.35,z=Math.sin(angle)*radius;
   if(Math.abs(x)<13&&Math.abs(z)<9)continue;
   const height=.65+rand(i+13)*1.15;
   addScenery(hillGeometry,i%3?landscapeMaterials.hill:landscapeMaterials.hillLight,x,-.55,z,2.2+rand(i+1)*2.4,height,2+rand(i+2)*2.4);
 }
 // Reuse real tree and rock models with deterministic visual placement.
 for(let i=0;i<145;i++){
   const angle=i*2.3999632;
   const radius=11.5+Math.sqrt(rand(i+251))*25;
   const x=Math.cos(angle)*radius*1.35,z=Math.sin(angle)*radius;
   if(Math.abs(x)<12.8&&Math.abs(z)<9.1)continue;
   if(i%7===0){
     const size=.5+rand(i+7)*.8;
     prop(i%2?'rockA':'rockC',size,x,z,rand(i+6)*6.28,true);
   }else if(i%4===0){
     const size=.35+rand(i+3)*.45;
     prop('treeA',size*1.8,x,z,rand(i+8)*6.28,true);
   }else{
     const h=1.3+rand(i+4)*1.75;
     prop(i%3?'treeA':'treeB',h,x,z,rand(i+8)*6.28,true);
   }
 }
 // Stone approaches and small roadside details lead into each kingdom.
 for(const side of [-1,1]){
   for(let i=0;i<7;i++){
     const x=side*(12.7+i*1.65),z=(i%2?1:-1)*(1.5+rand(i+side+9)*2.4);
     const size=.25+rand(i+43)*.3;
     prop('rockC',size,x,z,rand(i+43)*6.28,true);
   }
 }

 // Continuous near-edge forest fills the frame without covering the soldier lane.
 for(const edge of [-1,1])for(let row=0;row<2;row++)for(let i=0;i<12;i++){
  const x=-15.5+i*2.8+(row%2)*.8,z=edge*(7.3+row*2.4+.3*Math.sin(i*2.3));
  prop(i%3?'treeA':'treeB',2.5+(i%4)*.25,x,z,i*1.7,true);
  if(i%3===0)prop(i%2?'rockA':'rockC',.9,x+.8,z-edge*.7,i,true);
 }

 mesh(new THREE.BoxGeometry(19,.03,5.2),0xaab59a,0,.08,0);
 const ring=(x,z,color,r=1.4)=>{const m=mesh(new THREE.RingGeometry(r-.07,r,64),color,x,.13,z);m.rotation.x=-Math.PI/2;return m};
 ring(0,0,0xd0dbb7,2.1);ring(0,0,0x566f61,1.75);mesh(new THREE.CylinderGeometry(.28,.35,.15,6),0xe2d8a6,0,.18,0);
 for(const side of [-1,1]){
  const color=side===-1?0x55baff:0xff7668;
  const baseX=side*config.baseX;
  const platform=mesh(new THREE.CylinderGeometry(2.05,2.2,.24,48),color,baseX,.15,0);ring(baseX,0,0xf3e7c8,2.25);
  const tower=prop(side===-1?'blueCastle':'redCastle',3.8,baseX,0,side===-1?Math.PI/2:-Math.PI/2);
  bases.push({tower,platform,flash:0,x:baseX});
  for(const z of [-4.4,4.4]){
   prop(side===-1?'blueTower':'redTower',3.2,side*10.6,z);
   for(const x of [6.4,8.5])prop('wall',1.35,side*x,z);
  }
  prop('gate',1.5,side*11.7,0,Math.PI/2);
 }
 // Shared geometry/materials keep the forest to a few instanced draw calls.
 for(const {geometry,material,matrices} of batches.values()){
  const instances=new THREE.InstancedMesh(geometry,material,matrices.length);
  matrices.forEach((matrix,i)=>instances.setMatrixAt(i,matrix));
  instances.instanceMatrix.needsUpdate=true;instances.receiveShadow=true;
  instances.computeBoundingSphere();scene.add(instances);
 }
 return {ring,bases};
}
