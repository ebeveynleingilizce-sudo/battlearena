import {Box3,Group,Vector3} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
export class AssetLibrary{
 constructor(panel){this.loader=new GLTFLoader();this.cache=new Map();this.panel=panel}
 async load(kind,name){const key=`${kind}/glTF/${name}.gltf`;if(!this.cache.has(key))this.cache.set(key,this.loader.loadAsync(`${import.meta.env?.BASE_URL ?? '/'}assets/toon/${key}`).then(gltf=>{this.panel.state.models++;this.panel.refresh();return gltf}));return this.cache.get(key)}
 instance(gltf,height){const model=clone(gltf.scene);model.updateMatrixWorld(true);const bounds=new Box3().setFromObject(model);const size=bounds.getSize(new Vector3());const scale=height/size.y;model.scale.setScalar(scale);const center=bounds.getCenter(new Vector3());model.position.set(-center.x*scale,-bounds.min.y*scale,-center.z*scale);model.traverse(node=>{if(node.isMesh){node.castShadow=true;node.receiveShadow=true}});const root=new Group();root.add(model);this.panel.state.instances++;return {root,model}}
}
