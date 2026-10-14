import * as THREE from 'three';
import { BATTLE_CONFIG } from './config.js';

export async function createArena(scene, assets, config = BATTLE_CONFIG) {
  const mesh = (geometry, color, x, y, z) => {
    const object = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({color, roughness: 1}));
    object.position.set(x,y,z); object.receiveShadow = true; scene.add(object); return object;
  };
  // Continuous ground extends beneath the forest, including wide screen corners.
  const ground = mesh(new THREE.PlaneGeometry(160,160),0x617b48,0,.02,0);
  ground.rotation.x = -Math.PI/2;
  const path = mesh(new THREE.PlaneGeometry(21.5,6.5),0xa7a37a,0,.035,0);
  path.rotation.x = -Math.PI/2;
  const ring = (x,z,color,r=1.4) => {
    const object=mesh(new THREE.RingGeometry(r-.045,r,48),color,x,.05,z);
    object.rotation.x=-Math.PI/2; return object;
  };
  const paths = {
    blueCastle:'buildings/blue/building_castle_blue', redCastle:'buildings/red/building_castle_red',
    blueTower:'buildings/blue/building_tower_A_blue', redTower:'buildings/red/building_tower_A_red',
    wall:'buildings/neutral/wall_straight', gate:'buildings/neutral/wall_straight_gate',
    oak:'decoration/nature/tree_single_A', pine:'decoration/nature/tree_single_B',
    rockA:'decoration/nature/rock_single_A', rockC:'decoration/nature/rock_single_C',
  };
  const models = Object.fromEntries(await Promise.all(Object.entries(paths).map(async ([key,path]) =>
    [key,await assets.loadFile(`kingdom/${path}.gltf`)])));
  const foliageBatches = new Map();
  function prop(key,height,x,z,rotation=0,batch=false) {
    const {root}=assets.instance(models[key],height);
    root.position.set(x,.04,z); root.rotation.y=rotation;
    if (!batch) { scene.add(root); return root; }
    root.updateMatrixWorld(true);
    root.traverse(child => {
      if(!child.isMesh) return;
      const id=`${child.geometry.uuid}:${child.material.uuid}`;
      if(!foliageBatches.has(id))foliageBatches.set(id,{geometry:child.geometry,material:child.material,matrices:[]});
      foliageBatches.get(id).matrices.push(child.matrixWorld.clone());
    });
    return root;
  }
  const bases=[];
  for(const side of [-1,1]) {
    const blue=side===-1, baseX=side*config.baseX, color=blue?0x55baff:0xff7668;
    // Retain the original base visual contract for hit flashes and shake.
    const platform=mesh(new THREE.CylinderGeometry(2.15,2.15,.08,48),color,baseX,.065,0);
    ring(baseX,0,0xf4e6bd,2.25);
    const tower=prop(blue?'blueCastle':'redCastle',3.8,baseX,0,blue?Math.PI/2:-Math.PI/2);
    bases.push({tower,platform,flash:0,x:baseX});
    for(const z of [-4.1,4.1]) {
      prop(blue?'blueTower':'redTower',3.2,side*10.7,z);
      for(const x of [6.5,8.6]) prop('wall',1.35,side*x,z);
    }
    // Rear gate stays outside the combat lane and spawn positions.
    prop('gate',1.5,side*11.7,0,Math.PI/2);
  }
  // Deterministic visual layout; it never consumes combat RNG.
  for(let row=0;row<3;row++)for(let i=0;i<13;i++)for(const edge of [-1,1]) {
    const x=-16+i*2.65+(row%2)*.85;
    const z=edge*(7.1+row*2.25+.35*Math.sin(i*2.3));
    const key=(i+row)%3===0?'pine':'oak';
    prop(key,2.3+((i*7+row*3)%5)*.3,x,z,i*1.7,true);
    if((i+row)%3===0)prop((i%2)?'rockA':'rockC',.65+(i%3)*.2,x+.9,z-edge*.7,i,true);
  }
  for(const edge of [-1,1])for(let i=0;i<7;i++) {
    const z=-6+i*2;
    prop(i%2?'pine':'oak',2.7+(i%3)*.25,edge*(14.2+(i%2)*1.1),z,i*.8,true);
    prop(i%2?'rockA':'rockC',1.1+(i%3)*.25,edge*12.8,z+.3,i*.6,true);
  }
  for(const {geometry,material,matrices} of foliageBatches.values()) {
    const instances=new THREE.InstancedMesh(geometry,material,matrices.length);
    matrices.forEach((matrix,i)=>instances.setMatrixAt(i,matrix));
    instances.instanceMatrix.needsUpdate=true;
    instances.receiveShadow=true; instances.castShadow=false;
    instances.computeBoundingSphere(); scene.add(instances);
  }
  return {ring,bases};
}
