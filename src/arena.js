import * as THREE from 'three';
import { BATTLE_CONFIG } from './config.js';
export async function createArena(scene,assets,config=BATTLE_CONFIG){
 const bases=[];
 const mesh=(geometry,color,x,y,z)=>{const m=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color,roughness:.85}));m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;scene.add(m);return m};
 mesh(new THREE.BoxGeometry(24,.85,16),0x425957,0,-.48,0);mesh(new THREE.BoxGeometry(23.6,.12,15.6),0x77967a,0,0,0);
 mesh(new THREE.BoxGeometry(19,.03,5.2),0xaab59a,0,.08,0);
 for(let x=-10;x<=10;x+=2)for(const z of [-6.9,6.9])mesh(new THREE.BoxGeometry(1.7,.09,.12),0xb5c6a4,x,.12,z);
 const ring=(x,z,color,r=1.4)=>{const m=mesh(new THREE.RingGeometry(r-.07,r,64),color,x,.13,z);m.rotation.x=-Math.PI/2;return m};
 ring(0,0,0xd0dbb7,2.1);ring(0,0,0x566f61,1.75);mesh(new THREE.CylinderGeometry(.28,.35,.15,6),0xe2d8a6,0,.18,0);
 const names=['WaterTank_Platform','Container_Small','Crate','Tree_1','Tree_3','Barrier_Large'];
 const models=await Promise.all(names.map(n=>assets.load('Environment',n)));
 function prop(name,height,x,z,rotation=0){const {root}=assets.instance(models[names.indexOf(name)],height);root.position.set(x,.13,z);root.rotation.y=rotation;scene.add(root);return root}
 for(const side of [-1,1]){
  const color=side===-1?0x55baff:0xff7668;
  const baseX=side*config.baseX;
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
