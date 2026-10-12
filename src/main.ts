import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';
import { Game, WIDTH, HEIGHT, type BlastKind, type Direction, type Point, type UpgradeType } from './logic';
import './style.css';

const stage = document.querySelector<HTMLElement>('#stage')!;
const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas')!;
const intro = document.querySelector<HTMLElement>('#intro')!;
const result = document.querySelector<HTMLElement>('#result')!;
const toast = document.querySelector<HTMLElement>('#toast')!;
const characterOptions = document.querySelector<HTMLElement>('#character-options')!;
const characters = [
  {id:'character-female-a',name:'Lina'},
  {id:'character-female-b',name:'Mira'},
  {id:'character-female-c',name:'Nia'},
  {id:'character-male-a',name:'Ben'},
  {id:'character-male-b',name:'Finn'},
  {id:'character-male-c',name:'Kai'},
] as const;
type CharacterId = typeof characters[number]['id'];
const characterStorageKey = 'blastbound-character';
let selectedCharacter:CharacterId = 'character-female-b';
try {
  const saved = localStorage.getItem(characterStorageKey);
  if(characters.some(character=>character.id===saved))selectedCharacter=saved as CharacterId;
} catch { /* Private browsing can disable storage. */ }
const game = new Game();
let renderer: THREE.WebGLRenderer;
try { renderer = new THREE.WebGLRenderer({canvas, antialias:true, alpha:false, powerPreference:'high-performance'}); }
catch { stage.innerHTML='<div class="webgl-error">Dieses Spiel benötigt WebGL. Bitte aktiviere die Grafikhardware im Browser.</div>'; throw new Error('WebGL unavailable'); }
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;

const scene = new THREE.Scene();
scene.background = new THREE.Color('#171e34');
scene.fog = new THREE.Fog('#171e34', 20, 38);
const camera = new THREE.OrthographicCamera(-8,8,7,-7,0.1,100);
camera.position.set(0,19,11.5); camera.lookAt(0,0,0);
scene.add(new THREE.HemisphereLight('#e7f6ff','#59618a',2.0));
const sun = new THREE.DirectionalLight('#fff3d9',2.4);
sun.position.set(-5,13,7); sun.castShadow=true;
sun.shadow.mapSize.set(2048,2048); sun.shadow.camera.left=-12; sun.shadow.camera.right=12; sun.shadow.camera.top=12; sun.shadow.camera.bottom=-12;
sun.shadow.normalBias=0.025; sun.shadow.bias=-0.0001;
scene.add(sun);
const rim = new THREE.DirectionalLight('#7789ff',0.8); rim.position.set(8,6,-9); scene.add(rim);

const mat = (color:string, roughness=0.65, metalness=0) => new THREE.MeshStandardMaterial({color,roughness,metalness});
const floorA=mat('#536985'), floorB=mat('#49617e'), floorEdge=mat('#263a58');
const stone=mat('#347c98',0.68), stoneTop=mat('#62c9ca',0.5), stoneTrim=mat('#20526f');
const wood=mat('#bf794f',0.72), woodTop=mat('#e29a64',0.7), woodTrim=mat('#81563f',0.78), woodNail=mat('#e7c88a',0.3,0.55);
const bombMat=mat('#222b4c',0.22,0.25), bombCap=mat('#596582',0.4,0.3);
const bombAccent={normal:mat('#ff9b59',0.26,0.25),powered:mat('#6eeff2',0.26,0.25)};
const glow = new THREE.MeshStandardMaterial({color:'#ffda6a',emissive:'#ff8e2e',emissiveIntensity:3,roughness:0.25});
const blastPalette:Record<BlastKind,{edge:string;core:string;spark:string}>={
  normal:{edge:'#ff773c',core:'#ffe08b',spark:'#ffd064'},
  powered:{edge:'#35bde2',core:'#bbfaff',spark:'#70e8ff'},
  chain:{edge:'#aa71f4',core:'#ffe0ff',spark:'#d6a2ff'},
};
const fireMaterials=Object.fromEntries(Object.entries(blastPalette).map(([kind,colors])=>[kind,{
  edge:new THREE.MeshBasicMaterial({color:colors.edge,transparent:true,opacity:0.78,depthWrite:false}),
  core:new THREE.MeshBasicMaterial({color:colors.core,transparent:true,opacity:0.94,depthWrite:false}),
}])) as Record<BlastKind,{edge:THREE.MeshBasicMaterial;core:THREE.MeshBasicMaterial}>;
const portalMat = new THREE.MeshStandardMaterial({color:'#76dfff',emissive:'#18baf0',emissiveIntensity:2.7,metalness:0.35,roughness:0.2});
const upgradeMats:Record<UpgradeType,THREE.MeshStandardMaterial>={
  range:new THREE.MeshStandardMaterial({color:'#ffae54',emissive:'#ff6828',emissiveIntensity:0.9,metalness:0.3,roughness:0.3}),
  capacity:new THREE.MeshStandardMaterial({color:'#80ecdb',emissive:'#25bfa8',emissiveIntensity:0.9,metalness:0.3,roughness:0.3}),
  shield:new THREE.MeshStandardMaterial({color:'#7eb7ff',emissive:'#4b83ef',emissiveIntensity:1.1,metalness:0.4,roughness:0.26}),
};
const pickupBase=mat('#24334f');
const mesh=(geometry:THREE.BufferGeometry, material:THREE.Material, shadow=true) => {const o=new THREE.Mesh(geometry,material); o.castShadow=shadow; o.receiveShadow=true; return o;};
const rounded=(w:number,h:number,d:number,r:number,m:THREE.Material)=>mesh(new RoundedBoxGeometry(w,h,d,3,r),m);
function disposeVisualGeometry(object:THREE.Object3D){object.traverse(child=>{if(child instanceof THREE.Mesh)child.geometry.dispose();});}
const world=(p:Point)=>new THREE.Vector3(p.x-(WIDTH-1)/2,0,p.y-(HEIGHT-1)/2);
const facingYaw:Record<Direction,number>={down:0,right:Math.PI/2,up:Math.PI,left:-Math.PI/2};
const board = new THREE.Group(); scene.add(board);
const props = new THREE.Group(); scene.add(props);
const actors = new THREE.Group(); scene.add(actors);
const effects = new THREE.Group(); scene.add(effects);
const floorBase=rounded(WIDTH+0.28,0.34,HEIGHT+0.28,0.14,floorEdge); floorBase.position.y=-0.28; floorBase.receiveShadow=true; board.add(floorBase);
for(let y=0;y<HEIGHT;y++)for(let x=0;x<WIDTH;x++){
  const cell=mesh(new THREE.BoxGeometry(0.995,0.07,0.995),(x+y)%2?floorA:floorB,false);
  cell.position.set(x-6,-0.07,y-5); cell.receiveShadow=true; board.add(cell);
}
const rimBase=rounded(WIDTH+1.2,0.34,HEIGHT+1.2,0.22,mat('#202d48'));
rimBase.position.y=-0.55; board.add(rimBase);
function stoneBlock(){
  const g=new THREE.Group();
  const body=rounded(0.91,0.89,0.91,0.13,stone); body.position.y=0.43;g.add(body);
  const cap=rounded(0.9,0.15,0.9,0.1,stoneTop);cap.position.y=0.85;g.add(cap);
  const inset=rounded(0.64,0.035,0.64,0.015,stoneTrim);inset.position.y=0.93;g.add(inset);
  const glint=rounded(0.46,0.025,0.09,0.012,stoneTop);glint.position.set(-0.07,0.954,-0.14);g.add(glint);
  return g;
}
function crate(){
  const g=new THREE.Group();
  const body=rounded(0.84,0.76,0.84,0.085,wood);body.position.y=0.38;g.add(body);
  const top=rounded(0.87,0.09,0.87,0.04,woodTop);top.position.y=0.79;g.add(top);
  for(const z of [-0.3,0.3])for(const x of [-0.3,0.3]){
    const nail=mesh(new THREE.CylinderGeometry(0.025,0.025,0.012,8),woodNail);nail.position.set(x,0.845,z);g.add(nail);
  }
  for(const z of [-0.32,0.32]){const band=rounded(0.92,0.085,0.1,0.02,woodTrim);band.position.set(0,0.4,z);g.add(band);}
  for(const x of [-0.32,0.32]){const band=rounded(0.1,0.085,0.92,0.02,woodTrim);band.position.set(x,0.4,0);g.add(band);}
  return g;
}
function character(primary:string,accent:string,evil=false){
  const g=new THREE.Group();
  const suit=mat(primary,0.43), highlight=mat(accent,0.3), dark=mat(evil?'#392449':'#284b64',0.35);
  const torso=mesh(new THREE.SphereGeometry(0.31,20,14),suit);torso.scale.set(1,0.92,0.86);torso.position.y=0.48;g.add(torso);
  const head=mesh(new THREE.SphereGeometry(0.27,20,14),highlight);head.position.y=0.84;g.add(head);
  const face=rounded(0.4,0.16,0.06,0.055,dark);face.position.set(0,0.85,0.25);g.add(face);
  for(const x of [-0.095,0.095]){const eye=mesh(new THREE.SphereGeometry(0.035,10,8),mat(evil?'#ff7e88':'#ebffff',0.15));eye.position.set(x,0.86,0.286);g.add(eye);}
  for(const x of [-0.18,0.18]){
    const arm=mesh(new THREE.SphereGeometry(0.12,12,10),highlight);arm.position.set(x*1.78,0.45,0);g.add(arm);
    const foot=rounded(0.18,0.16,0.24,0.05,dark);foot.position.set(x,0.08,0.06);g.add(foot);
  }
  const crest=mesh(new THREE.SphereGeometry(0.09,12,8),mat(evil?'#ff8aa1':'#ffffff'));crest.position.set(0,1.08,0);g.add(crest);
  g.scale.setScalar(1.15);
  return g;
}
function bombObject(range:number){
  const g=new THREE.Group();
  const charged=range>2,accent=bombAccent[charged?'powered':'normal'];
  const base=mesh(new THREE.CylinderGeometry(0.36,0.36,0.065,12),bombCap);base.position.y=0.055;g.add(base);
  const body=mesh(new THREE.SphereGeometry(0.33,20,14),bombMat);body.position.y=0.37;g.add(body);
  const band=mesh(new THREE.TorusGeometry(0.3,0.043,8,24),accent);band.rotation.x=Math.PI/2;band.position.y=0.37;g.add(band);
  const stripe=mesh(new THREE.TorusGeometry(0.3,0.027,8,24),bombCap);stripe.position.y=0.37;g.add(stripe);
  const cap=mesh(new THREE.CylinderGeometry(0.13,0.18,0.11,10),bombCap);cap.position.y=0.69;g.add(cap);
  const fuse=mesh(new THREE.CylinderGeometry(0.045,0.06,0.15,8),accent);fuse.position.y=0.79;g.add(fuse);
  const led=mesh(new THREE.SphereGeometry(0.1,12,8),accent,false);led.position.y=0.89;g.add(led);
  const halo=mesh(new THREE.TorusGeometry(0.41,0.025,6,24),accent,false);halo.rotation.x=Math.PI/2;halo.position.y=0.08;g.add(halo);
  const point=new THREE.PointLight(charged?'#6eeff2':'#ff9439',0.8,2.1);point.position.y=0.83;g.add(point);
  g.userData={led,halo,point};
  return g;
}
function fireObject(kind:BlastKind){
  const g=new THREE.Group();
  const materials=fireMaterials[kind];
  const outer=rounded(0.88,0.12,0.88,0.11,materials.edge);outer.position.y=0.1;g.add(outer);
  const core=mesh(new THREE.OctahedronGeometry(0.34,0),materials.core,false);core.scale.set(1,0.6,1);core.position.y=0.28;g.add(core);
  for(const [x,z] of [[-0.28,0],[0.28,0],[0,-0.28],[0,0.28]]){
    const flame=mesh(new THREE.ConeGeometry(0.15,0.48,5),materials.edge,false);
    flame.position.set(x,0.31,z);flame.rotation.z=x*0.45;flame.rotation.x=z*0.45;g.add(flame);
  }
  const top=mesh(new THREE.OctahedronGeometry(0.13,0),materials.core,false);top.position.y=0.65;g.add(top);
  g.userData.kind=kind;
  return g;
}
function portalObject(){
  const g=new THREE.Group();
  const disc=mesh(new THREE.CylinderGeometry(0.4,0.4,0.035,32),mat('#174763',0.2));disc.position.y=0.03;g.add(disc);
  const ring=mesh(new THREE.TorusGeometry(0.31,0.065,12,32),portalMat,false);ring.rotation.x=Math.PI/2;ring.position.y=0.08;g.add(ring);
  const orb=mesh(new THREE.OctahedronGeometry(0.15,1),portalMat,false);orb.position.y=0.42;g.add(orb);
  const light=new THREE.PointLight('#3ad9ff',1.6,2.7);light.position.y=0.5;g.add(light);
  return g;
}
function upgradeObject(type:UpgradeType){
  const g=new THREE.Group();
  const accent=upgradeMats[type];
  const base=mesh(new THREE.CylinderGeometry(0.27,0.31,0.08,8),pickupBase);base.position.y=0.05;g.add(base);
  const ring=mesh(new THREE.TorusGeometry(0.29,0.035,7,24),accent,false);ring.rotation.x=Math.PI/2;ring.position.y=0.12;g.add(ring);
  const icon=new THREE.Group();icon.position.y=0.4;g.add(icon);
  if(type==='range'){
    const flame=mesh(new THREE.ConeGeometry(0.22,0.48,6),accent);flame.rotation.z=-0.2;icon.add(flame);
    const ember=mesh(new THREE.OctahedronGeometry(0.11,0),glow,false);ember.position.set(0,0.02,0.18);icon.add(ember);
  }else if(type==='capacity'){
    const sphere=mesh(new THREE.SphereGeometry(0.2,14,10),bombMat);icon.add(sphere);
    const fuse=mesh(new THREE.CylinderGeometry(0.055,0.075,0.1,8),accent);fuse.position.y=0.23;icon.add(fuse);
    const crossA=rounded(0.29,0.07,0.045,0.01,accent);crossA.position.z=0.19;icon.add(crossA);
    const crossB=rounded(0.07,0.29,0.045,0.01,accent);crossB.position.z=0.19;icon.add(crossB);
  }else{
    const gem=mesh(new THREE.IcosahedronGeometry(0.23,0),accent);gem.scale.set(1,1.18,0.65);icon.add(gem);
    const orbit=mesh(new THREE.TorusGeometry(0.28,0.025,6,20),accent,false);orbit.rotation.x=Math.PI/2;icon.add(orbit);
  }
  g.userData.icon=icon;
  return g;
}

type AnimatedArt={model:THREE.Object3D;mixer:THREE.AnimationMixer;idle:THREE.AnimationAction|null;walk:THREE.AnimationAction|null;active:THREE.AnimationAction|null};
function makeAnimatedArt(gltf:GLTF):AnimatedArt{
  const model=cloneSkeleton(gltf.scene);
  model.traverse(child=>{if(child instanceof THREE.Mesh){child.castShadow=true;child.receiveShadow=true;}});
  const bounds=new THREE.Box3().setFromObject(model);
  const size=bounds.getSize(new THREE.Vector3());
  const scale=Math.min(0.95/Math.max(size.x,size.z,0.01),1.10/Math.max(size.y,0.01));
  model.scale.multiplyScalar(scale);
  model.position.y=-bounds.min.y*scale;
  const mixer=new THREE.AnimationMixer(model);
  const idleClip=THREE.AnimationClip.findByName(gltf.animations,'idle');
  const walkClip=THREE.AnimationClip.findByName(gltf.animations,'walk');
  const idle=idleClip?mixer.clipAction(idleClip):null;
  const walk=walkClip?mixer.clipAction(walkClip):null;
  if(idle)idle.play();
  return {model,mixer,idle,walk,active:idle};
}
function setAnimatedState(art:AnimatedArt|null,moving:boolean){
  if(!art)return;
  const next=moving?(art.walk??art.idle):(art.idle??art.walk);
  if(next&&next!==art.active){next.reset().play();if(art.active)next.crossFadeFrom(art.active,0.14,false);art.active=next;}
}
const tileObjects=new Map<string,THREE.Object3D>();
const bombObjects=new Map<number,THREE.Object3D>();
const enemyObjects=new Map<number,THREE.Group>();
const enemyArt=new Map<number,AnimatedArt>();
const fireObjects=new Map<string,THREE.Object3D>();
const upgradeObjects=new Map<string,THREE.Object3D>();
type Particle = { object: THREE.Mesh; velocity: THREE.Vector3; life: number; maxLife: number };
const particles:Particle[]=[];
const particleGeometry=new THREE.OctahedronGeometry(0.055,0);
type Shockwave={object:THREE.Mesh;material:THREE.MeshBasicMaterial;age:number;duration:number;size:number};
const shockwaves:Shockwave[]=[];
function shockwave(x:number,y:number,color:string,size=1){
  const material=new THREE.MeshBasicMaterial({color,transparent:true,opacity:0.8,side:THREE.DoubleSide,depthWrite:false});
  const object=new THREE.Mesh(new THREE.RingGeometry(0.33,0.43,32),material);
  object.rotation.x=-Math.PI/2;object.position.copy(world({x,y}));object.position.y=0.13;
  effects.add(object);shockwaves.push({object,material,age:0,duration:0.48,size});
}
function updateShockwaves(dt:number){
  for(let i=shockwaves.length-1;i>=0;i--){
    const wave=shockwaves[i];wave.age+=dt;
    const progress=Math.min(1,wave.age/wave.duration);
    wave.object.scale.setScalar((0.35+2.4*progress)*wave.size);
    wave.material.opacity=0.8*(1-progress);
    if(progress>=1){effects.remove(wave.object);wave.material.dispose();wave.object.geometry.dispose();shockwaves.splice(i,1);}
  }
}
function burst(x:number,y:number,color:string,count:number){
  const origin=world({x,y});
  for(let i=0;i<count;i++){
    const material=new THREE.MeshBasicMaterial({color,transparent:true,opacity:1,depthWrite:false});
    const object=new THREE.Mesh(particleGeometry,material);
    object.position.set(origin.x+(Math.random()-.5)*.22,.38,origin.z+(Math.random()-.5)*.22);
    object.scale.setScalar(.6+Math.random()*1.5);effects.add(object);
    particles.push({object,velocity:new THREE.Vector3((Math.random()-.5)*2.7,1.3+Math.random()*2.2,(Math.random()-.5)*2.7),life:.55+Math.random()*.25,maxLife:.8});
  }
}
function updateParticles(dt:number){
  for(let i=particles.length-1;i>=0;i--){
    const p=particles[i];p.life-=dt;p.velocity.y-=dt*5;p.object.position.addScaledVector(p.velocity,dt);
    p.object.rotation.x+=dt*8;p.object.rotation.z+=dt*6;
    (p.object.material as THREE.MeshBasicMaterial).opacity=Math.max(0,p.life/p.maxLife);
    if(p.life<=0){effects.remove(p.object);(p.object.material as THREE.Material).dispose();particles.splice(i,1);}
  }
}
let portalObjectRef:THREE.Object3D|null=null;
const playerObject=new THREE.Group();playerObject.add(character('#24cbbd','#9cf9e6'));actors.add(playerObject);
const shieldAura=new THREE.Group();
const shieldMaterial=new THREE.MeshBasicMaterial({color:'#80c8ff',transparent:true,opacity:0.35,depthWrite:false});
const shieldShell=mesh(new THREE.IcosahedronGeometry(0.6,1),new THREE.MeshBasicMaterial({color:'#80c8ff',wireframe:true,transparent:true,opacity:0.23,depthWrite:false}),false);
shieldShell.position.y=0.58;shieldAura.add(shieldShell);
const shieldRing=mesh(new THREE.TorusGeometry(0.53,0.035,6,28),shieldMaterial,false);
shieldRing.rotation.x=Math.PI/2;shieldRing.position.y=0.52;shieldAura.add(shieldRing);
shieldAura.visible=false;actors.add(shieldAura);
let playerArt:AnimatedArt|null=null;
let enemyTemplate:GLTF|null=null;
let playerLoadRequest=0;
const playerShadow=mesh(new THREE.CircleGeometry(0.38,20),new THREE.MeshBasicMaterial({color:'#121e39',transparent:true,opacity:0.22}),false);
playerShadow.rotation.x=-Math.PI/2; playerShadow.position.y=0.004;actors.add(playerShadow);
const key=(x:number,y:number)=>Game.key(x,y);
function applyEnemyArt(group:THREE.Group,id:number){
  if(!enemyTemplate)return;
  const old=enemyArt.get(id);if(old)old.mixer.stopAllAction();
  const art=makeAnimatedArt(enemyTemplate);group.clear();group.add(art.model);enemyArt.set(id,art);
}
const assetLoader=new GLTFLoader();
type TileProp='wall'|'wood-structure'|'barrel'|'chest';
const tileModels=new Map<TileProp,THREE.Object3D>();
function prepareTileModel(gltf:GLTF,width:number,height:number,fullFootprint=false){
  const model=gltf.scene;
  const bounds=new THREE.Box3().setFromObject(model);
  const size=bounds.getSize(new THREE.Vector3());
  const scale=Math.min(width/size.x,width/size.z,height/size.y);
  const sx=fullFootprint?width/size.x:scale,sy=fullFootprint?height/size.y:scale,sz=fullFootprint?width/size.z:scale;
  model.scale.set(sx,sy,sz);
  model.position.set(-(bounds.min.x+bounds.max.x)*sx/2,-bounds.min.y*sy,-(bounds.min.z+bounds.max.z)*sz/2);
  model.traverse(child=>{
    if(!(child instanceof THREE.Mesh))return;
    child.castShadow=true;child.receiveShadow=true;
    if(fullFootprint){
      const tint=(material:THREE.Material)=>{
        if(!(material instanceof THREE.MeshStandardMaterial))return material;
        const copy=material.clone();copy.color.multiply(new THREE.Color('#52d5d0'));copy.roughness=0.52;
        return copy;
      };
      child.material=Array.isArray(child.material)?child.material.map(tint):tint(child.material);
    }
  });
  return model;
}
async function loadDungeonAssets(){
  const assets:[TileProp,string,number,number,boolean][]=[
    ['wall','arena/wall',0.92,0.95,true],
    ['wood-structure','dungeon/wood-structure',0.89,0.82,false],
    ['barrel','dungeon/barrel',0.80,0.78,false],
    ['chest','dungeon/chest',0.84,0.78,false],
  ];
  await Promise.all(assets.map(async ([name,path,width,height,fullFootprint])=>{
    try{
      const gltf=await assetLoader.loadAsync(`/assets/kenney/${path}.glb`);
      tileModels.set(name,prepareTileModel(gltf,width,height,fullFootprint));
    }catch(error){console.warn(`Kenney ${name} asset unavailable`,error);}
  }));
  for(const obj of tileObjects.values())props.remove(obj);
  tileObjects.clear();
  syncStatic();
}
function tileModel(x:number,y:number,tile:1|2){
  const name:TileProp=tile===1?'wall':x===game.portal.x&&y===game.portal.y?'chest':(x*7+y*11)%5===0?'barrel':'wood-structure';
  const template=tileModels.get(name);
  if(!template)return tile===1?stoneBlock():crate();
  const model=template.clone(true);
  const group=new THREE.Group();
  group.add(model);
  if(name!=='wood-structure')return group;
  const core=rounded(0.66,0.58,0.66,0.035,wood);core.position.y=0.32;
  const lid=rounded(0.7,0.08,0.7,0.02,woodTop);lid.position.y=0.64;
  group.add(core,lid);
  return group;
}
function loadPlayerArt(){
  const request=++playerLoadRequest;
  const base='/assets/kenney/';
  assetLoader.load(`${base}characters/${selectedCharacter}.glb`,gltf=>{
    if(request!==playerLoadRequest)return;
    playerArt?.mixer.stopAllAction();
    playerArt=makeAnimatedArt(gltf);playerObject.clear();playerObject.add(playerArt.model);
  },undefined,error=>{
    if(request!==playerLoadRequest)return;
    console.warn('Kenney player asset unavailable',error);
    playerArt?.mixer.stopAllAction();playerArt=null;
    playerObject.clear();playerObject.add(character('#24cbbd','#9cf9e6'));
  });
}
function renderCharacterOptions(){
  for(const character of characters){
    const button=document.createElement('button');
    button.type='button';button.className='character-option';
    button.setAttribute('aria-label',`${character.name} auswählen`);
    button.setAttribute('aria-pressed',String(character.id===selectedCharacter));
    button.dataset.character=character.id;
    const preview=document.createElement('img');
    preview.src=`/assets/kenney/characters/previews/${character.id}.png`;
    preview.alt='';preview.width=64;preview.height=64;
    button.append(preview,document.createElement('span'));
    button.lastElementChild!.textContent=character.name;
    button.addEventListener('click',()=>{
      if(selectedCharacter===character.id)return;
      selectedCharacter=character.id;
      try {localStorage.setItem(characterStorageKey,selectedCharacter);} catch { /* Selection still works for this visit. */ }
      for(const option of characterOptions.querySelectorAll<HTMLButtonElement>('button'))
        option.setAttribute('aria-pressed',String(option.dataset.character===selectedCharacter));
      loadPlayerArt();
    });
    characterOptions.append(button);
  }
}
function loadKenneyAssets(){
  loadPlayerArt();
  assetLoader.load('/assets/kenney/arena/character-soldier.glb',gltf=>{
    enemyTemplate=gltf;
    for(const [id,obj] of enemyObjects)applyEnemyArt(obj,id);
  },undefined,error=>console.warn('Kenney enemy asset unavailable',error));
}
function syncStatic(){
  for(let y=0;y<HEIGHT;y++)for(let x=0;x<WIDTH;x++){
    const id=key(x,y),tile=game.tile(x,y),existing=tileObjects.get(id);
    if(tile===0){if(existing){props.remove(existing);tileObjects.delete(id);}continue;}
    if(existing)continue;
    const obj=tileModel(x,y,tile);obj.position.copy(world({x,y}));props.add(obj);tileObjects.set(id,obj);
  }
  if(game.tile(game.portal.x,game.portal.y)===0 && !portalObjectRef){portalObjectRef=portalObject();portalObjectRef.position.copy(world(game.portal));props.add(portalObjectRef);}
  if(game.tile(game.portal.x,game.portal.y)!==0 && portalObjectRef){props.remove(portalObjectRef);portalObjectRef=null;}
}
let playerMoving=false;
function syncDynamic(){
  const p=world(game.player),playerTarget=new THREE.Vector3(p.x,0,p.z);
  playerObject.rotation.y=facingYaw[game.player.facing];
  setAnimatedState(playerArt,playerMoving);
  playerObject.position.copy(playerTarget);playerShadow.position.x=playerObject.position.x;playerShadow.position.z=playerObject.position.z;
  playerObject.visible=game.player.invincible<=0||Math.floor(performance.now()/90)%2===0;
  shieldAura.visible=game.player.shield>0;
  if(shieldAura.visible){
    shieldAura.position.copy(playerTarget);
    shieldAura.rotation.y+=0.012;
    shieldRing.scale.setScalar(1+0.06*Math.sin(performance.now()*0.006));
  }
  for(const enemy of game.enemies){
    let obj=enemyObjects.get(enemy.id);
    if(!enemy.alive){if(obj){actors.remove(obj);enemyObjects.delete(enemy.id);enemyArt.get(enemy.id)?.mixer.stopAllAction();enemyArt.delete(enemy.id);}continue;}
    if(!obj){obj=new THREE.Group();obj.add(character('#b768ec','#edb6ff',true));obj.position.copy(world(enemy));actors.add(obj);enemyObjects.set(enemy.id,obj);applyEnemyArt(obj,enemy.id);}
    const v=world(enemy),target=new THREE.Vector3(v.x,0,v.z);
    obj.rotation.y=facingYaw[enemy.facing];
    setAnimatedState(enemyArt.get(enemy.id)??null,game.status==='running'&&Math.hypot(enemy.targetX-enemy.x,enemy.targetY-enemy.y)>0.025);
    obj.position.copy(target);
  }
  for(const bomb of game.bombs){
    let obj=bombObjects.get(bomb.id);
    if(!obj){obj=bombObject(bomb.range);obj.position.copy(world(bomb));props.add(obj);bombObjects.set(bomb.id,obj);}
    const tempo=0.012+(2.15-bomb.fuse)*0.012;
    const pulse=1+0.055*Math.sin(performance.now()*tempo + bomb.id);
    obj.scale.setScalar(pulse);
    (obj.userData.led as THREE.Mesh).scale.setScalar(0.75+0.35*Math.max(0,Math.sin(performance.now()*tempo*1.8)));
    (obj.userData.halo as THREE.Mesh).rotation.y+=0.012;
    (obj.userData.point as THREE.PointLight).intensity=0.55+0.55*Math.max(0,Math.sin(performance.now()*tempo));
  }
  for(const [id,obj] of bombObjects)if(!game.bombs.some(b=>b.id===id)){props.remove(obj);disposeVisualGeometry(obj);bombObjects.delete(id);}
  for(const [id,ttl] of game.fire){
    let obj=fireObjects.get(id);
    const kind=game.fireKinds.get(id)??'normal';
    if(obj&&obj.userData.kind!==kind){effects.remove(obj);disposeVisualGeometry(obj);fireObjects.delete(id);obj=undefined;}
    if(!obj){const [x,y]=id.split(',').map(Number);obj=fireObject(kind);obj.position.copy(world({x,y}));effects.add(obj);fireObjects.set(id,obj);}
    const age=0.56-ttl,opening=Math.min(1,age/0.08),closing=Math.min(1,ttl/0.16);
    const size=(0.77+0.17*Math.sin(performance.now()*0.03))*Math.max(0.05,opening*closing);
    obj.scale.set(size,size*(1+0.25*Math.sin(performance.now()*0.025)),size);
    obj.rotation.y=kind==='chain'?age*4:kind==='powered'?age*2:0;
  }
  for(const [id,obj] of fireObjects)if(!game.fire.has(id)){effects.remove(obj);disposeVisualGeometry(obj);fireObjects.delete(id);}
  for(const upgrade of game.upgrades){
    const id=key(upgrade.x,upgrade.y);
    if(!upgradeObjects.has(id)){const obj=upgradeObject(upgrade.type);obj.position.copy(world(upgrade));props.add(obj);upgradeObjects.set(id,obj);}
    const obj=upgradeObjects.get(id)!;
    obj.position.y=0.06+0.07*Math.sin(performance.now()*0.004+upgrade.x);
    (obj.userData.icon as THREE.Group).rotation.y+=0.018;
  }
  for(const [id,obj] of upgradeObjects)if(!game.upgrades.some(u=>key(u.x,u.y)===id)){props.remove(obj);disposeVisualGeometry(obj);upgradeObjects.delete(id);}
  if(portalObjectRef){portalObjectRef.rotation.y+=0.012;portalObjectRef.position.y=0.04*Math.sin(performance.now()*0.003);}
  const t=performance.now()*0.002;
  playerObject.position.y=0.025*Math.sin(t*2);
}
function clearObjects(){
  for(const obj of tileObjects.values())props.remove(obj);tileObjects.clear();
  for(const obj of bombObjects.values()){props.remove(obj);disposeVisualGeometry(obj);}bombObjects.clear();
  for(const obj of enemyObjects.values())actors.remove(obj);enemyObjects.clear();
  for(const art of enemyArt.values())art.mixer.stopAllAction();enemyArt.clear();
  for(const obj of fireObjects.values()){effects.remove(obj);disposeVisualGeometry(obj);}fireObjects.clear();
  for(const obj of upgradeObjects.values()){props.remove(obj);disposeVisualGeometry(obj);}upgradeObjects.clear();
  for(const p of particles){effects.remove(p.object);(p.object.material as THREE.Material).dispose();}particles.length=0;
  for(const wave of shockwaves){effects.remove(wave.object);wave.material.dispose();wave.object.geometry.dispose();}shockwaves.length=0;
  if(portalObjectRef){props.remove(portalObjectRef);portalObjectRef=null;}
}
function resize(){
  const w=stage.clientWidth,h=stage.clientHeight;if(!w||!h)return;
  renderer.setSize(w,h,false);
  const aspect=w/h,halfH=Math.max(6.15,7.05/aspect);
  camera.left=-halfH*aspect;camera.right=halfH*aspect;camera.top=halfH;camera.bottom=-halfH;camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(stage);resize();

let audioEnabled=false; let audioContext:AudioContext|null=null;
function beep(freq:number,duration:number,type:OscillatorType='sine',volume=0.045){
  if(!audioEnabled)return;
  audioContext ??= new AudioContext();
  const osc=audioContext.createOscillator(),gain=audioContext.createGain();
  osc.type=type;osc.frequency.setValueAtTime(freq,audioContext.currentTime);
  osc.frequency.exponentialRampToValueAtTime(Math.max(70,freq*0.5),audioContext.currentTime+duration);
  gain.gain.setValueAtTime(volume,audioContext.currentTime);gain.gain.exponentialRampToValueAtTime(0.001,audioContext.currentTime+duration);
  osc.connect(gain);gain.connect(audioContext.destination);osc.start();osc.stop(audioContext.currentTime+duration);
}
document.querySelector<HTMLButtonElement>('#sound-button')!.addEventListener('click',e=>{audioEnabled=!audioEnabled;(e.currentTarget as HTMLButtonElement).classList.toggle('active',audioEnabled);(e.currentTarget as HTMLButtonElement).setAttribute('aria-label',audioEnabled?'Ton ausschalten':'Ton einschalten');beep(700,0.12);});

let toastTimer=0;
function showToast(message:string){toast.textContent=message;toast.classList.remove('hidden');toastTimer=1.7;}
function updateHud(){
  const lives=document.querySelector<HTMLElement>('#lives')!;
  lives.innerHTML=Array.from({length:3},(_,i)=>i<game.player.lives?'♥':'♡').join(' ')+(game.player.shield?' <span class="shield-hud">✦</span>':'');
  lives.setAttribute('aria-label',`${game.player.lives} Leben${game.player.shield?', Schild aktiv':''}`);
  document.querySelector('#enemies')!.textContent=String(game.aliveEnemies).padStart(2,'0');
  document.querySelector('#bombs')!.textContent=`${game.player.capacity-game.bombs.length} / ${game.player.capacity}`;
  const seconds=Math.floor(game.elapsed);document.querySelector('#timer')!.textContent=`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;
  const pause=document.querySelector<HTMLButtonElement>('#pause-button')!;pause.innerHTML=game.status==='paused'?'▶ <span>WEITER</span>':'Ⅱ <span>PAUSE</span>';
}
function showResult(){
  const win=game.status==='won';
  document.querySelector('#result-kicker')!.textContent=win?'ARENA GESCHAFFT':'RUNDE VORBEI';
  document.querySelector('#result-title')!.textContent=win?'STARK GESPIELT!':'KABOOM!';
  document.querySelector('#result-copy')!.textContent=win?`Alle Gegner besiegt in ${Math.floor(game.elapsed)} Sekunden. Bereit für eine neue Runde?`:'Deine Leben sind aufgebraucht. Plane deinen nächsten Fluchtweg und versuch es erneut.';
  stage.classList.remove('game-active');result.classList.remove('hidden');beep(win?780:180,0.35,'triangle',0.08);
}
function start(restart=false){
  if(restart){clearObjects();game.reset();playerObject.position.copy(world(game.player));syncStatic();}
  game.start();stage.classList.add('game-active');intro.classList.add('hidden');result.classList.add('hidden');updateHud();
}
document.querySelector('#start-button')!.addEventListener('click',()=>start());
document.querySelector('#restart-button')!.addEventListener('click',()=>start(true));
document.querySelector('#pause-button')!.addEventListener('click',()=>{game.togglePause();showToast(game.status==='paused'?'PAUSIERT':'WEITER GEHT’S');updateHud();});
const keyMap:Record<string,Direction>={ArrowUp:'up',KeyW:'up',ArrowDown:'down',KeyS:'down',ArrowLeft:'left',KeyA:'left',ArrowRight:'right',KeyD:'right'};
const heldKeys=new Set<string>();
const touchDirections=new Set<Direction>();
let touchFacing:Direction|null=null;
const dpad=document.querySelector<HTMLElement>('#touch-dpad')!;
const mobileControls=document.querySelector<HTMLElement>('.mobile-controls')!;
let padPointer:number|null=null;
function resetDpad(){
  padPointer=null;touchFacing=null;touchDirections.clear();
  dpad.style.setProperty('--thumb-x','0px');dpad.style.setProperty('--thumb-y','0px');
  for(const button of dpad.querySelectorAll<HTMLButtonElement>('[data-dir]'))button.classList.remove('active');
}
function updateDpad(clientX:number,clientY:number){
  const rect=dpad.getBoundingClientRect();
  const x=(clientX-rect.left-rect.width/2)/(rect.width/2);
  const y=(clientY-rect.top-rect.height/2)/(rect.height/2);
  const length=Math.hypot(x,y);
  const nx=length?x/length:0,ny=length?y/length:0;
  touchDirections.clear();touchFacing=null;
  if(length>0.18){
    if(nx>0.33)touchDirections.add('right');else if(nx< -0.33)touchDirections.add('left');
    if(ny>0.33)touchDirections.add('down');else if(ny< -0.33)touchDirections.add('up');
    touchFacing=Math.abs(x)>Math.abs(y)?(x>0?'right':'left'):(y>0?'down':'up');
  }
  const thumbTravel=Math.min(length,1)*17;
  dpad.style.setProperty('--thumb-x',`${nx*thumbTravel}px`);
  dpad.style.setProperty('--thumb-y',`${ny*thumbTravel}px`);
  for(const button of dpad.querySelectorAll<HTMLButtonElement>('[data-dir]'))button.classList.toggle('active',touchDirections.has(button.dataset.dir as Direction));
}
function isHeld(direction:Direction){
  if(touchDirections.has(direction))return true;
  for(const code of heldKeys)if(keyMap[code]===direction)return true;
  return false;
}
function inputFacing():Direction{
  if(touchFacing)return touchFacing;
  for(const code of Array.from(heldKeys).reverse())if(keyMap[code])return keyMap[code];
  return game.player.facing;
}
function placeBomb(){if(game.placeBomb()){beep(460,0.09,'triangle',0.025);updateHud();}}
window.addEventListener('keydown',e=>{
  if(keyMap[e.code]){e.preventDefault();heldKeys.add(e.code);}
  if(e.code==='Space'){e.preventDefault();if(!e.repeat)placeBomb();}
  if(e.code==='KeyP'||e.code==='Escape'){e.preventDefault();game.togglePause();showToast(game.status==='paused'?'PAUSIERT':'WEITER GEHT’S');updateHud();}
});
window.addEventListener('keyup',e=>{if(keyMap[e.code])heldKeys.delete(e.code);});
window.addEventListener('blur',()=>{heldKeys.clear();resetDpad();});
dpad.addEventListener('pointerdown',e=>{
  if(padPointer!==null||e.button!==0)return;
  e.preventDefault();padPointer=e.pointerId;dpad.setPointerCapture(e.pointerId);updateDpad(e.clientX,e.clientY);
});
dpad.addEventListener('pointermove',e=>{if(e.pointerId===padPointer){e.preventDefault();updateDpad(e.clientX,e.clientY);}});
for(const eventName of ['pointerup','pointercancel','lostpointercapture'])
  dpad.addEventListener(eventName,e=>{if((e as PointerEvent).pointerId===padPointer)resetDpad();});
for(const button of dpad.querySelectorAll<HTMLButtonElement>('[data-dir]'))
  button.addEventListener('click',e=>{
    if(e.detail!==0)return;
    const direction=button.dataset.dir as Direction;
    const dx=Number(direction==='right')-Number(direction==='left');
    const dy=Number(direction==='down')-Number(direction==='up');
    game.move(dx,dy,0.1,direction);
  });
const touchBomb=document.querySelector<HTMLButtonElement>('#touch-bomb')!;
touchBomb.addEventListener('pointerdown',e=>{e.preventDefault();touchBomb.classList.add('active');placeBomb();touchBomb.setPointerCapture(e.pointerId);});
for(const eventName of ['pointerup','pointercancel','lostpointercapture'])touchBomb.addEventListener(eventName,()=>touchBomb.classList.remove('active'));
touchBomb.addEventListener('click',e=>{if(e.detail===0)placeBomb();});
for(const target of [stage,mobileControls]){
  for(const eventName of ['gesturestart','gesturechange'])target.addEventListener(eventName,e=>e.preventDefault(),{passive:false});
  target.addEventListener('dblclick',e=>e.preventDefault());
}

let last=performance.now(),accumulator=0,lastStatus=game.status,footstepTimer=0;
function frame(now:number){
  requestAnimationFrame(frame);
  const dt=Math.min((now-last)/1000,0.1);last=now;accumulator+=dt;footstepTimer=Math.max(0,footstepTimer-dt);
  playerMoving=false;
  while(accumulator>=1/60){
    const dx=Number(isHeld('right'))-Number(isHeld('left'));
    const dy=Number(isHeld('down'))-Number(isHeld('up'));
    const facing=inputFacing();
    playerMoving=game.move(dx,dy,1/60,facing)||playerMoving;
    game.update(1/60);accumulator-=1/60;
  }
  if(playerMoving&&footstepTimer===0){beep(260,0.025,'sine',0.008);footstepTimer=0.18;}
  for(const event of game.drainEvents()){
    if(event.type==='explode'){
      const kind=event.kind??'normal',palette=blastPalette[kind];
      burst(event.x,event.y,palette.spark,kind==='normal'?18:26);
      shockwave(event.x,event.y,palette.edge,kind==='powered'?1.2:1);
      beep(kind==='chain'?180:kind==='powered'?100:120,0.26,'sawtooth',0.07);
    }
    if(event.type==='crate'){burst(event.x,event.y,'#e7a56e',9);syncStatic();}
    if(event.type==='hit'){showToast('AU! EIN LEBEN VERLOREN');beep(170,0.28,'square',0.04);}
    if(event.type==='shield'){burst(event.x,event.y,'#8ec8ff',16);shockwave(event.x,event.y,'#8ec8ff',0.75);showToast('SCHILD HAT DICH GESCHÜTZT!');beep(520,0.21,'triangle',0.04);}
    if(event.type==='upgrade'){
      const type=event.upgrade??'range';
      const messages:Record<UpgradeType,string>={range:'FLAMMENREICHWEITE +1',capacity:'EINE BOMBE MEHR',shield:'SCHUTZSCHILD AKTIV'};
      const colors:Record<UpgradeType,string>={range:'#ffae54',capacity:'#80ecdb',shield:'#7eb7ff'};
      showToast(messages[type]);burst(event.x,event.y,colors[type],12);beep(880,0.24,'triangle',0.05);
    }
    if(event.type==='enemy'){burst(event.x,event.y,'#eab0ff',12);showToast('GEGNER AUSGESCHALTET!');beep(660,0.14,'triangle',0.04);}
  }
  if(lastStatus!==game.status){if(game.status==='won'||game.status==='lost')showResult();lastStatus=game.status;}
  if(toastTimer>0){toastTimer-=dt;if(toastTimer<=0)toast.classList.add('hidden');}
  updateParticles(dt);updateShockwaves(dt);syncDynamic();if(game.status==='running'){playerArt?.mixer.update(dt);for(const art of enemyArt.values())art.mixer.update(dt);}updateHud();renderer.render(scene,camera);
}
playerObject.position.copy(world(game.player));syncStatic();renderCharacterOptions();loadKenneyAssets();void loadDungeonAssets();updateHud();requestAnimationFrame(frame);
