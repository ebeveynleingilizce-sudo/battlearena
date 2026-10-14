import * as THREE from 'three';
import { BATTLE_CONFIG } from './config.js';
export async function createArena(scene,assets,config=BATTLE_CONFIG){
 const bases=[];
 const paths={
  blueCastle:'buildings/blue/building_castle_blue',redCastle:'buildings/red/building_castle_red',
  wall:'buildings/neutral/wall_straight',gate:'buildings/neutral/wall_straight_gate',
  treeA:'decoration/nature/tree_single_A',treeB:'decoration/nature/tree_single_B',
  rockA:'decoration/nature/rock_single_A',rockC:'decoration/nature/rock_single_C',
  blueHome:'buildings/blue/building_home_A_blue',redHome:'buildings/red/building_home_A_red',
  blueWell:'buildings/blue/building_well_blue',redWell:'buildings/red/building_well_red',
  blueFlag:'decoration/props/flag_blue',redFlag:'decoration/props/flag_red',
  tent:'decoration/props/tent',barrel:'decoration/props/barrel',crate:'decoration/props/crate_A_small',sack:'decoration/props/sack',
  hillA:'decoration/nature/hill_single_A',hillC:'decoration/nature/hill_single_C',ridge:'decoration/nature/mountain_A_grass',
  fence:'buildings/neutral/fence_wood_straight',
  weaponrack:'decoration/props/weaponrack',target:'decoration/props/target',arrows:'decoration/props/bucket_arrows',
  wheelbarrow:'decoration/props/wheelbarrow',lumber:'decoration/props/resource_lumber',stoneSupply:'decoration/props/resource_stone'
 };
 const models=Object.fromEntries(await Promise.all(Object.entries(paths).map(async ([key,path])=>[key,await assets.loadFile(`kingdom/${path}.gltf`)])));
 const extraPaths={shrub:'nature/plant_bushDetailed',shrubSmall:'nature/plant_bushSmall',grass:'nature/grass',fern:'nature/grass_leafs',purple:'nature/flower_purpleA',yellow:'nature/flower_yellowA',pathStone:'nature/path_stone',cart:'town/cart',
  castleTower:'castle-kit/tower-square',castleWall:'castle-kit/wall-narrow',castleStairs:'castle-kit/wall-narrow-stairs',castleDoor:'castle-kit/wall-doorway',pillar:'castle-kit/wall-pillar',rockKit:'castle-kit/rocks-small',bridge:'nature/bridge_stoneRound'};
 await Promise.all(Object.entries(extraPaths).map(async ([key,path])=>{models[key]=await assets.loadFile(`${path}.glb`)}));
 const batches=new Map();
 const riverCenter=z=>.65*Math.sin(z*.19);
 const riverWidth=z=>1.2+.18*Math.sin(z*.31);
 const terrainHeight=(x,z)=>{
  // Keep all simulation lanes/base footprints level. Rise only into the scenery.
  const rise=Math.max(0,Math.min(1,(Math.abs(z)-3.8)/3.5));
  const hill=rise*rise*(1.1+.55*Math.sin(x*.27+z*.1));
  const bankDistance=Math.abs(x-riverCenter(z))-riverWidth(z);
  if(bankDistance<0)return -.45;
  if(bankDistance<.7)return -.45+(bankDistance/.7)*(.45+hill);
  return hill;
 };
 function prop(name,height,x,z,rotation=0,batch=false){
  const {root}=assets.instance(models[name],height);
  // These rocks are very flat meshes: bound their footprint, not just their height.
  if(name.startsWith('rock')){
   const size=new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3());
   const footprint=Math.max(size.x,size.z);
   if(footprint>height*1.6)root.scale.multiplyScalar(height*1.6/footprint);
  }
  if(name.startsWith('hill')||name==='ridge'||name==='pathStone'){
   const size=new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3());
   const limit=name==='pathStone'?1.4:height*6;
   if(Math.max(size.x,size.z)>limit)root.scale.multiplyScalar(limit/Math.max(size.x,size.z));
  }
  const vegetation=['treeA','treeB','shrub','shrubSmall','grass','fern','purple','yellow'];
  const groundLevel=vegetation.includes(name)||name.startsWith('hill')||name.startsWith('rock')||name==='ridge'||name==='pathStone'?-.09:.13;
  root.position.set(x,groundLevel+terrainHeight(x,z),z);root.rotation.y=rotation;
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
   new THREE.PlaneGeometry(100,80,64,64),
   new THREE.MeshStandardMaterial({color:0x667c51,roughness:1})
 );
 ground.rotation.x=-Math.PI/2;
 const vertices=ground.geometry.attributes.position;
 for(let i=0;i<vertices.count;i++)vertices.setZ(i,terrainHeight(vertices.getX(i),-vertices.getY(i)));
 vertices.needsUpdate=true;ground.geometry.computeVertexNormals();
 ground.position.y=-.11;
 ground.receiveShadow=true;
 scene.add(ground);

 // A single connected clearing joins the two courtyards. No floating board or grid.
 for(const side of [-1,1]){
  const clearing=new THREE.Shape();clearing.moveTo(side*1.7,-3.1);
  for(const [x,z] of [[3.8,-2.9],[6.4,-3.45],[9.5,-3.65],[11.6,-2.9],[11.6,2.9],[9.5,3.65],[6.4,3.45],[3.8,2.9],[1.7,3.1]])clearing.lineTo(side*x,z);
  clearing.closePath();const road=mesh(new THREE.ShapeGeometry(clearing),0xb6a074,0,-.095,0);
  road.rotation.x=-Math.PI/2;road.castShadow=false;
 }
 // A continuous river ties foreground and distant scenery together. The bridge is
 // decorative and spans the entire existing soldier corridor; navigation is unchanged.
 const riverShape=new THREE.Shape();riverShape.moveTo(riverCenter(-30)-riverWidth(-30),-30);
 for(let z=-29;z<=30;z++)riverShape.lineTo(riverCenter(z)-riverWidth(z),z);
 for(let z=30;z>=-30;z--)riverShape.lineTo(riverCenter(z)+riverWidth(z),z);
 riverShape.closePath();const river=mesh(new THREE.ShapeGeometry(riverShape),0x4596a7,0,-.3,0);
 river.rotation.x=-Math.PI/2;river.castShadow=false;
 const bridge=assets.instance(models.bridge,1.1).root;
 bridge.updateMatrixWorld(true);
 const bridgeSize=new THREE.Box3().setFromObject(bridge).getSize(new THREE.Vector3());
 bridge.scale.x*=4.3/bridgeSize.x;bridge.scale.z*=7.4/bridgeSize.z;
 bridge.position.set(0,-.18,0);scene.add(bridge);
 // Interlocking bank rock groups, with low shrubs above the waterline.
 for(const side of [-1,1])for(const z of [-13,-10,-7,-5,5,7,10,13]){
  const x=riverCenter(z)+side*(riverWidth(z)+.65);
  prop('rockKit',.55,x,z,z*.3,true);
  prop('rockC',.38,x+side*.35,z+.6,z*.2,true);
  prop('shrubSmall',.35,x+side*.9,z+.3,z*.6,true);
  if(Math.abs(z)>6)prop('rockA',1.2,x+side*1.8,z,z*.2,true);
 }
 // Hand-composed mirrored groves: tall trees behind, low rocks at the clearing edge.
 // Model choices, positions and scale are intentional; no scattering RNG.
 const grove=[
  ['treeB',3.1,12.8,-5.4,.2],['treeA',2.6,14.4,-6.3,.7],['treeB',3.5,13.5,-8.1,.4],
  ['treeA',2.8,10.7,-7.7,1.1],['treeB',3.3,11.1,-10,.8],['treeA',2.5,8.9,-9.2,.4],
  ['treeB',3.6,14.9,-10.4,1.2],['treeA',2.8,16.3,-8.3,.6],
  ['treeA',2.6,6.3,-7.7,.4],['treeB',3.1,7.7,-9.4,.8],['treeA',2.5,4.5,-9.3,1.2],
  ['treeB',3.2,3.5,-7.8,.2],['treeA',2.7,1.7,-9.7,.7],
  ['treeB',2.7,13.7,4.8,.7],['treeA',2.3,15.6,6.5,1.1],['treeB',2.8,13.5,8.1,.2],
  ['treeA',2.2,11.4,8,.6],['treeB',2.6,10,9.8,1.2],
  ['treeA',2.1,6.7,8.5,.6],['treeB',2.5,4.8,10,.9],['treeA',2.1,3.2,8.6,.3],
  ['rockA',1.7,12.7,-4.3,.4],['rockC',1.1,11.5,-5.3,1.2],['rockC',.7,13.4,-3.6,.7],
  ['rockA',1.8,8.6,-6.9,.5],['rockC',1,7.3,-6.4,1.1],['rockC',.65,9.8,-6.1,.2],
  ['rockA',1.25,13.5,3.4,.6],['rockC',.8,12.5,4.6,1.4],
  ['rockA',1.3,6.2,7.3,1.2],['rockC',.7,5.1,7,.4]
 ];
 for(const side of [-1,1])for(const [name,height,x,z,angle] of grove)prop(name,height,side*x,z,side*angle,true);

 // Layered outskirts: stone ridges behind groves, low planted edges nearer the clearing.
 for(const side of [-1,1]){
  for(const [key,height,x,z,angle] of [
   ['ridge',1.35,16,-8,.5],['hillA',.85,8,-10,.8],['hillC',1,2,-11,.2],
   ['hillA',.7,14,8,.4],['hillC',.65,6,10,1.1],['ridge',1.1,18,3,.7]
  ])prop(key,height,side*x,z,side*angle,true);
  const plantingBeds=[[2.7,-6.5],[3.8,-7.8],[10.8,-8],[12.2,-8.6],[2.8,6.7],[4,7.8],[10.5,8.1],[12,8.8]];
  plantingBeds.forEach(([x,z],bed)=>{
   prop('shrub',.55+(bed%3)*.12,side*x,z,bed*.63,true);
   prop('shrubSmall',.36,side*(x+.8),z+.5,bed*.9,true);
   for(let i=0;i<4;i++){
    const angle=i*1.57+bed*.3,distance=.6+(i%2)*.3;
    const px=side*(x+Math.cos(angle)*distance),pz=z+Math.sin(angle)*distance;
    prop(i%2?'grass':'fern',.19+(i%3)*.05,px,pz,angle,true);
    if(i===1||i===4)prop(bed%2?'purple':'yellow',.25,px+side*.18,pz+.12,angle,true);
   }
  });
  // Small frontier settlements flank the walls; the playable corridor stays clear.
  prop(side===-1?'blueHome':'redHome',1.7,side*11.9,-5.4,side*Math.PI/2,true);
  prop(side===-1?'blueWell':'redWell',.75,side*10.2,-5.3,0,true);
  prop(side===-1?'blueFlag':'redFlag',1.5,side*6.1,-4.1,side*.2,true);
  prop('tent',1.15,side*9.1,5.4,side*Math.PI,true);
  prop('tent',.95,side*11.3,5.7,side*Math.PI,true);
  prop('cart',.7,side*11.5,4.6,Math.PI/2,true);
  for(const [x,z] of [[10.2,4.9],[10.65,4.9],[10.4,5.3]])prop('barrel',.4,side*x,z,0,true);
  prop('crate',.4,side*10.5,5.7,0,true);prop('sack',.34,side*10.9,5.7,.3,true);
  // Training and supply vignettes sit outside the combat corridor; decorative only.
  prop('weaponrack',.8,side*7.7,5.8,0,true);
  prop('target',.9,side*6.8,5.5,side*Math.PI/2,true);
  prop('arrows',.35,side*7.2,5.8,0,true);
  prop('wheelbarrow',.55,side*12.2,-4.3,Math.PI/2,true);
  prop('lumber',.38,side*12.6,-4.6,0,true);
  prop('stoneSupply',.34,side*13,-4.6,0,true);
  for(const x of [7.3,8.9,10.5])prop('fence',.52,side*x,6.8,0,true);
  // Stone verges connect courts and settlements rather than adding decorative dead ends.
  for(const [x,z,angle] of [[3.1,-3.8,.08],[4.4,-3.95,.12],[5.7,-4.05,.12],[3.1,3.8,-.08],[4.4,3.95,-.12],[5.7,4.05,-.12],[12,-.2,Math.PI/2],[13,-.2,Math.PI/2]])prop('pathStone',.12,side*x,z,side*angle,true);
 }

 const ring=(x,z,color,r=1.4)=>{const m=mesh(new THREE.RingGeometry(r-.07,r,64),color,x,.13,z);m.rotation.x=-Math.PI/2;return m};
 // The centre is kept clear so soldiers and projectiles remain the focal point.
 for(const side of [-1,1]){
  const color=side===-1?0x55baff:0xff7668;
  const baseX=side*config.baseX;
  const platform=mesh(new THREE.CylinderGeometry(1.85,1.95,.08,48),side===-1?0x608d9e:0xad776a,baseX,.02,0);ring(baseX,0,0xc7bb8c,2);
  const tower=prop(side===-1?'blueCastle':'redCastle',3.8,baseX,0,side===-1?Math.PI/2:-Math.PI/2);
  bases.push({tower,platform,flash:0,x:baseX});
  // Connected U-shaped walls surround each court, leaving the combat-facing side open.
  for(const z of [-4.15,4.15]){
   prop('castleTower',2.6,side*10.9,z);
   const banner=prop(side===-1?'blueFlag':'redFlag',.85,side*10.9,z);
   banner.position.y+=2.6;
   for(const x of [7.1,9.2])prop('wall',1.15,side*x,z);
   prop('pillar',1.15,side*6.15,z,0,true);
  }
  prop('gate',1.65,side*11.1,0,Math.PI/2);
  for(const z of [-2.8,2.8])prop('wall',1.15,side*11.1,z,Math.PI/2);
  prop('castleStairs',1.15,side*9.8,-3.5,side*Math.PI/2,true);
  prop('castleDoor',1.15,side*13.3,-4.8,Math.PI/2,true);
  for(const z of [-5.7,-6.55])prop('castleWall',1.15,side*13.3,z,0,true);
  prop('rockKit',.65,side*14.6,-3.6,.4,true);
  prop('rockKit',.45,side*5.5,5.2,1.2,true);
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
