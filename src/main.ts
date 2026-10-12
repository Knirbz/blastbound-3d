import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';
import { Game, WIDTH, HEIGHT, BOMB_FUSE, type BlastKind, type BlastCell, type Difficulty, type Direction, type Point, type UpgradeType } from './logic';
import { makeBlastFlame, makeBlastCore } from './blastArt';
import './style.css';

const stage = document.querySelector<HTMLElement>('#stage')!;
const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas')!;
const intro = document.querySelector<HTMLElement>('#intro')!;
const result = document.querySelector<HTMLElement>('#result')!;
const toast = document.querySelector<HTMLElement>('#toast')!;
const characterOptions = document.querySelector<HTMLElement>('#character-options')!;
const difficultyOptions = document.querySelector<HTMLElement>('.difficulty-options')!;
const difficultyHint = document.querySelector<HTMLElement>('#difficulty-hint')!;
const difficultyDescriptions:Record<Difficulty,string>={
  training:'Bots bleiben stehen und greifen nicht an.',
  easy:'Langsame Bots, wenige Bomben.',
  medium:'Aktive Bots, häufiger Bomben.',
  hard:'Schnelle Bots mit stärkeren Bomben.',
};
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
const difficultyStorageKey = 'blastbound-difficulty';
let selectedCharacter:CharacterId = 'character-female-b';
let selectedDifficulty:Difficulty = 'easy';
try {
  const saved = localStorage.getItem(characterStorageKey);
  if(characters.some(character=>character.id===saved))selectedCharacter=saved as CharacterId;
  const savedDifficulty=localStorage.getItem(difficultyStorageKey);
  if(savedDifficulty&&Object.hasOwn(difficultyDescriptions,savedDifficulty))selectedDifficulty=savedDifficulty as Difficulty;
} catch { /* Private browsing can disable storage. */ }
const game = new Game(Date.now(),selectedDifficulty);
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
const floorMats=['#4b627f','#506783','#48607d','#4d6580'].map(color=>mat(color,0.88));
const floorEdge=mat('#263a58');
const stone=mat('#347c98',0.68), stoneTop=mat('#62c9ca',0.5), stoneTrim=mat('#20526f');
const wood=mat('#bf794f',0.72), woodTop=mat('#e29a64',0.7), woodTrim=mat('#81563f',0.78), woodNail=mat('#e7c88a',0.3,0.55);
const bombMat=mat('#222b4c',0.22,0.25), bombCap=mat('#596582',0.4,0.3);
const bombAccent={normal:mat('#ff9b59',0.26,0.25),powered:mat('#6eeff2',0.26,0.25),enemy:mat('#f36b83',0.26,0.25)};
const glow = new THREE.MeshStandardMaterial({color:'#ffda6a',emissive:'#ff8e2e',emissiveIntensity:3,roughness:0.25});
const blastPalette:Record<BlastKind,{edge:string;core:string;spark:string}>={
  normal:{edge:'#ff773c',core:'#ffe08b',spark:'#ffd064'},
  powered:{edge:'#35bde2',core:'#bbfaff',spark:'#70e8ff'},
  chain:{edge:'#aa71f4',core:'#ffe0ff',spark:'#d6a2ff'},
};
const textureLoader=new THREE.TextureLoader();
const particleTexture=(name:string)=>{
  const texture=textureLoader.load(`/assets/kenney/particles/${name}.png`);
  texture.colorSpace=THREE.SRGBColorSpace;
  return texture;
};
const fxTextures={fire:particleTexture('fire_01'),flame:particleTexture('flame_02'),smoke:particleTexture('smoke_05'),spark:particleTexture('spark_05'),scorch:particleTexture('scorch_01'),scratch:particleTexture('scratch_01'),dirt:particleTexture('dirt_02'),flare:particleTexture('flare_01')};
const explosionJetTexture=textureLoader.load('/assets/vfx/explosion-jet.png');
explosionJetTexture.colorSpace=THREE.SRGBColorSpace;
const blastFlames:Record<BlastKind,THREE.Texture[]>={
  normal:[explosionJetTexture,explosionJetTexture,explosionJetTexture],
  powered:[0,1,2].map(variant=>makeBlastFlame('powered',variant)),
  chain:[0,1,2].map(variant=>makeBlastFlame('chain',variant)),
};
const explosionCoreTexture=textureLoader.load('/assets/vfx/explosion-core.png');
explosionCoreTexture.colorSpace=THREE.SRGBColorSpace;
const blastCores:Record<BlastKind,THREE.Texture>={
  normal:explosionCoreTexture,
  powered:makeBlastCore('powered'),
  chain:makeBlastCore('chain'),
};
const fxMaterial=(texture:THREE.Texture,color:string,opacity=1,additive=true)=>new THREE.SpriteMaterial({map:texture,color,transparent:true,opacity,blending:additive?THREE.AdditiveBlending:THREE.NormalBlending,depthWrite:false});
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
  const variation=(x*17+y*31+x*y*7)%floorMats.length;
  const cell=mesh(new THREE.BoxGeometry(0.995,0.07,0.995),floorMats[variation],false);
  cell.position.set(x-6,-0.07,y-5); cell.receiveShadow=true; board.add(cell);
}
const floorWearMaterial=new THREE.MeshBasicMaterial({map:fxTextures.scratch,color:'#9fb8ca',transparent:true,opacity:0.2,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1});
const floorDirtMaterial=new THREE.MeshBasicMaterial({map:fxTextures.dirt,color:'#1c2e46',transparent:true,opacity:0.32,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1});
for(let y=1;y<HEIGHT-1;y++)for(let x=1;x<WIDTH-1;x++){
  const variant=(x*23+y*19+x*y*11)%17;
  if(variant>2)continue;
  const wear=mesh(new THREE.PlaneGeometry(0.72,0.72),variant===0?floorWearMaterial:floorDirtMaterial,false);
  wear.rotation.x=-Math.PI/2;wear.rotation.z=(x*7+y*3)*0.31;
  wear.position.set(x-6,0.003,y-5);board.add(wear);
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
  g.scale.setScalar(1.36);
  return g;
}
function bombObject(range:number,enemyOwned=false){
  const g=new THREE.Group();
  const charged=range>2,accent=bombAccent[enemyOwned?'enemy':charged?'powered':'normal'];
  const base=mesh(new THREE.CylinderGeometry(0.36,0.36,0.065,12),bombCap);base.position.y=0.055;g.add(base);
  const body=mesh(new THREE.SphereGeometry(0.33,20,14),bombMat);body.position.y=0.37;g.add(body);
  const band=mesh(new THREE.TorusGeometry(0.3,0.043,8,24),accent);band.rotation.x=Math.PI/2;band.position.y=0.37;g.add(band);
  const stripe=mesh(new THREE.TorusGeometry(0.3,0.027,8,24),bombCap);stripe.position.y=0.37;g.add(stripe);
  const cap=mesh(new THREE.CylinderGeometry(0.13,0.18,0.11,10),bombCap);cap.position.y=0.69;g.add(cap);
  const fuse=mesh(new THREE.CylinderGeometry(0.045,0.06,0.15,8),accent);fuse.position.y=0.79;g.add(fuse);
  const led=mesh(new THREE.SphereGeometry(0.1,12,8),accent,false);led.position.y=0.89;g.add(led);
  const halo=mesh(new THREE.TorusGeometry(0.41,0.025,6,24),accent,false);halo.rotation.x=Math.PI/2;halo.position.y=0.08;g.add(halo);
  const warningRing=mesh(new THREE.RingGeometry(0.38,0.5,28),new THREE.MeshBasicMaterial({color:enemyOwned?'#f36b83':charged?'#65e8f5':'#ff9a4b',transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide}),false);
  warningRing.rotation.x=-Math.PI/2;warningRing.position.y=0.025;g.add(warningRing);
  const fuseSpark=new THREE.Sprite(fxMaterial(fxTextures.flame,enemyOwned?'#ffb3bc':charged?'#a9faff':'#ffe293',0));
  fuseSpark.position.y=0.97;fuseSpark.scale.set(0.25,0.32,1);g.add(fuseSpark);
  const point=new THREE.PointLight(enemyOwned?'#f36b83':charged?'#6eeff2':'#ff9439',0.8,2.1);point.position.y=0.83;g.add(point);
  g.userData={led,halo,warningRing,fuseSpark,point};
  return g;
}
function disposeBombObject(object:THREE.Object3D){
  disposeVisualGeometry(object);
  ((object.userData.warningRing as THREE.Mesh).material as THREE.Material).dispose();
  (object.userData.fuseSpark as THREE.Sprite).material.dispose();
}
type FireParts={marker:THREE.Mesh;ground:THREE.Mesh;ribbon:THREE.Mesh;hot:THREE.Mesh;outer:THREE.Sprite;arc:THREE.Sprite|null;chargeRing:THREE.Mesh|null};
function flameShapeGeometry(center:boolean){
  const shape=new THREE.Shape();
  if(center){
    for(let i=0;i<16;i++){
      const angle=i*Math.PI/8,r=i%2===0?0.53:0.39;
      const x=Math.cos(angle)*r,y=Math.sin(angle)*r;
      if(i===0)shape.moveTo(x,y);else shape.lineTo(x,y);
    }
    shape.closePath();
  }else{
    shape.moveTo(-0.57,-0.2);
    shape.bezierCurveTo(-0.24,-0.34,0.03,-0.25,0.2,-0.31);
    shape.lineTo(0.59,-0.08);
    shape.lineTo(0.48,0.09);
    shape.bezierCurveTo(0.13,0.18,-0.18,0.35,-0.55,0.21);
    shape.closePath();
  }
  return new THREE.ShapeGeometry(shape);
}
function fireObject(kind:BlastKind,cell:BlastCell|undefined){
  const g=new THREE.Group();
  const palette=blastPalette[kind];
  // The full danger footprint is visible from the same frame in which the game applies damage.
  const marker=mesh(new THREE.PlaneGeometry(0.97,0.97),new THREE.MeshBasicMaterial({color:palette.edge,transparent:true,opacity:0.3,depthWrite:false,side:THREE.DoubleSide}),false);
  marker.rotation.x=-Math.PI/2;marker.position.y=0.016;g.add(marker);
  const ground=mesh(new THREE.PlaneGeometry(1.12,1.12),new THREE.MeshBasicMaterial({map:fxTextures.fire,color:palette.edge,transparent:true,opacity:0.7,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide}),false);
  ground.rotation.x=-Math.PI/2;ground.position.y=0.027;g.add(ground);
  const angle=cell?.direction==='up'?-Math.PI/2:cell?.direction==='down'?Math.PI/2:cell?.direction==='left'?Math.PI:0;
  const ribbon=mesh(flameShapeGeometry(!cell?.direction),new THREE.MeshBasicMaterial({color:palette.edge,transparent:true,opacity:0.85,depthWrite:false,side:THREE.DoubleSide}),false);
  ribbon.rotation.set(-Math.PI/2,0,angle);ribbon.position.y=0.039;g.add(ribbon);
  const hot=mesh(flameShapeGeometry(!cell?.direction),new THREE.MeshBasicMaterial({color:palette.core,transparent:true,opacity:0.85,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide}),false);
  hot.rotation.set(-Math.PI/2,0,angle);hot.position.y=0.048;hot.scale.setScalar(0.63);g.add(hot);
  const variant=cell?Math.abs(cell.x*17+cell.y*31)%3:1;
  const outer=new THREE.Sprite(new THREE.SpriteMaterial({map:cell?.direction?blastFlames[kind][variant]:blastCores[kind],transparent:true,alphaTest:0.03,depthWrite:false}));
  outer.position.set(0,0.77,0);outer.scale.set(1.65,1.67,1);g.add(outer);
  let arc:THREE.Sprite|null=null;
  if(kind==='chain'){
    arc=new THREE.Sprite(fxMaterial(fxTextures.spark,'#f4c9ff',0.84));
    arc.position.set(0,0.55,0);arc.scale.set(0.92,1.02,1);g.add(arc);
  }
  let chargeRing:THREE.Mesh|null=null;
  if(kind==='powered'){
    chargeRing=mesh(new THREE.TorusGeometry(0.32,0.045,7,24),new THREE.MeshBasicMaterial({color:palette.core,transparent:true,opacity:0.76,blending:THREE.AdditiveBlending,depthWrite:false}),false);
    chargeRing.rotation.x=Math.PI/2;chargeRing.position.y=0.16;g.add(chargeRing);
  }
  g.userData={kind,parts:{marker,ground,ribbon,hot,outer,arc,chargeRing} satisfies FireParts,cell};
  return g;
}
function disposeFireObject(object:THREE.Object3D){
  object.traverse(child=>{
    if(child instanceof THREE.Mesh){child.geometry.dispose();(child.material as THREE.Material).dispose();}
    if(child instanceof THREE.Sprite)(child.material as THREE.Material).dispose();
  });
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
  const scale=Math.min(1.16/Math.max(size.x,size.z,0.01),1.36/Math.max(size.y,0.01));
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
const firePatterns=new Map<string,BlastCell>();
const upgradeObjects=new Map<string,THREE.Object3D>();
type Particle = { object: THREE.Mesh; velocity: THREE.Vector3; life: number; maxLife: number };
const particles:Particle[]=[];
const particleGeometry=new THREE.OctahedronGeometry(0.055,0);
const splinterGeometry=new THREE.BoxGeometry(0.075,0.19,0.065);
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
function woodBurst(x:number,y:number){
  const origin=world({x,y});
  for(let i=0;i<9;i++){
    const material=new THREE.MeshBasicMaterial({color:i%3===0?'#e6a473':i%3===1?'#a56543':'#c88557',transparent:true,opacity:1,depthWrite:false});
    const object=new THREE.Mesh(splinterGeometry,material);
    object.position.set(origin.x+(Math.random()-.5)*0.4,0.35+Math.random()*0.3,origin.z+(Math.random()-.5)*0.4);
    effects.add(object);
    const life=0.45+Math.random()*0.35;
    particles.push({object,velocity:new THREE.Vector3((Math.random()-.5)*2.5,1.2+Math.random()*2,(Math.random()-.5)*2.5),life,maxLife:life});
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
type SpriteFx={object:THREE.Sprite;velocity:THREE.Vector3;age:number;delay:number;duration:number;opacity:number;startScale:number;endScale:number};
const spriteEffects:SpriteFx[]=[];
function transientSprite(x:number,y:number,texture:THREE.Texture,color:string,options:{height:number;duration:number;delay?:number;opacity:number;startScale:number;endScale:number;velocity?:THREE.Vector3;additive?:boolean}){
  const object=new THREE.Sprite(fxMaterial(texture,color,0,options.additive??true));
  object.position.copy(world({x,y}));object.position.y=options.height;
  object.scale.setScalar(options.startScale);
  effects.add(object);
  spriteEffects.push({object,velocity:options.velocity??new THREE.Vector3(),age:0,delay:options.delay??0,duration:options.duration,opacity:options.opacity,startScale:options.startScale,endScale:options.endScale});
}
function updateSpriteEffects(dt:number){
  for(let i=spriteEffects.length-1;i>=0;i--){
    const fx=spriteEffects[i];fx.age+=dt;
    const progress=(fx.age-fx.delay)/fx.duration;
    if(progress<0)continue;
    if(progress>=1){effects.remove(fx.object);fx.object.material.dispose();spriteEffects.splice(i,1);continue;}
    const envelope=Math.min(1,progress*6)*Math.pow(1-progress,1.35);
    fx.object.material.opacity=fx.opacity*envelope;
    fx.object.scale.setScalar(fx.startScale+(fx.endScale-fx.startScale)*progress);
    fx.object.position.addScaledVector(fx.velocity,dt);
  }
}
type Scorch={object:THREE.Mesh;age:number;duration:number};
const scorches:Scorch[]=[];
function markScorch(x:number,y:number){
  const material=new THREE.MeshBasicMaterial({map:fxTextures.scorch,color:'#263246',transparent:true,opacity:0.34,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2});
  const object=new THREE.Mesh(new THREE.PlaneGeometry(1.15,1.15),material);
  object.rotation.x=-Math.PI/2;object.rotation.z=(x*7+y*13)*0.4;
  object.position.copy(world({x,y}));object.position.y=0.009;
  board.add(object);scorches.push({object,age:0,duration:7});
  if(scorches.length>26){const old=scorches.shift()!;board.remove(old.object);old.object.geometry.dispose();(old.object.material as THREE.Material).dispose();}
}
function updateScorches(dt:number){
  for(let i=scorches.length-1;i>=0;i--){
    const scorch=scorches[i];scorch.age+=dt;
    (scorch.object.material as THREE.MeshBasicMaterial).opacity=0.34*Math.max(0,1-scorch.age/scorch.duration);
    if(scorch.age>=scorch.duration){board.remove(scorch.object);scorch.object.geometry.dispose();(scorch.object.material as THREE.Material).dispose();scorches.splice(i,1);}
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
const playerShadow=mesh(new THREE.CircleGeometry(0.44,20),new THREE.MeshBasicMaterial({color:'#121e39',transparent:true,opacity:0.3}),false);
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
  if(name==='wood-structure')model.rotation.y=((x*7+y*11)%4)*Math.PI/2;
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
function renderDifficultyOptions(){
  for(const button of difficultyOptions.querySelectorAll<HTMLButtonElement>('[data-difficulty]')){
    const difficulty=button.dataset.difficulty as Difficulty;
    button.setAttribute('aria-pressed',String(difficulty===selectedDifficulty));
    button.addEventListener('click',()=>{
      selectedDifficulty=difficulty;
      game.setDifficulty(difficulty);
      difficultyHint.textContent=difficultyDescriptions[difficulty];
      for(const option of difficultyOptions.querySelectorAll<HTMLButtonElement>('[data-difficulty]'))
        option.setAttribute('aria-pressed',String(option.dataset.difficulty===difficulty));
      try {localStorage.setItem(difficultyStorageKey,difficulty);} catch { /* Selection still works for this visit. */ }
    });
  }
  difficultyHint.textContent=difficultyDescriptions[selectedDifficulty];
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
    if(!obj){obj=bombObject(bomb.range,bomb.owner!==undefined);obj.position.copy(world(bomb));props.add(obj);bombObjects.set(bomb.id,obj);}
    const age=BOMB_FUSE-bomb.fuse;
    const landing=Math.max(0,1-age/0.13);
    const warning=Math.max(0,Math.min(1,(0.72-bomb.fuse)/0.72));
    const shake=Math.max(0,Math.min(1,(0.26-bomb.fuse)/0.26));
    const time=performance.now()/1000;
    obj.position.y=landing*landing*0.13;
    obj.scale.set(1+landing*0.08+shake*0.026*Math.sin(time*55+bomb.id),1-landing*0.1,1+landing*0.08-shake*0.026*Math.sin(time*55+bomb.id));
    obj.rotation.z=shake*0.075*Math.sin(time*49+bomb.id);
    obj.rotation.x=shake*0.06*Math.sin(time*57+bomb.id*1.7);
    const led=obj.userData.led as THREE.Mesh;
    led.scale.setScalar(0.72+warning*0.28*Math.max(0,Math.sin(time*(10+warning*20))));
    const halo=obj.userData.halo as THREE.Mesh;
    halo.visible=warning>0.02;
    halo.scale.setScalar(0.9+warning*0.25);
    const warningRing=obj.userData.warningRing as THREE.Mesh;
    (warningRing.material as THREE.MeshBasicMaterial).opacity=warning*0.72*(0.72+0.28*Math.sin(time*(10+warning*18)));
    warningRing.scale.setScalar(0.86+warning*0.24);
    const fuseSpark=obj.userData.fuseSpark as THREE.Sprite;
    fuseSpark.material.opacity=warning*(0.45+0.45*Math.max(0,Math.sin(time*(12+warning*25))));
    fuseSpark.scale.set(0.25+warning*0.23,0.32+warning*0.3,1);
    (obj.userData.point as THREE.PointLight).intensity=0.25+warning*(0.4+0.55*Math.max(0,Math.sin(time*(10+warning*20))));
    const tick=Math.floor((0.72-bomb.fuse)/0.18);
    if(warning>0&&tick>(obj.userData.lastTick??-1)){obj.userData.lastTick=tick;beep(450+tick*90,0.045,'triangle',0.012);}
  }
  for(const [id,obj] of bombObjects)if(!game.bombs.some(b=>b.id===id)){props.remove(obj);disposeBombObject(obj);bombObjects.delete(id);}
  for(const [id,ttl] of game.fire){
    let obj=fireObjects.get(id);
    const kind=game.fireKinds.get(id)??'normal';
    if(obj&&obj.userData.kind!==kind){effects.remove(obj);disposeFireObject(obj);fireObjects.delete(id);obj=undefined;}
    if(!obj){const [x,y]=id.split(',').map(Number);obj=fireObject(kind,firePatterns.get(id));obj.position.copy(world({x,y}));effects.add(obj);fireObjects.set(id,obj);}
    const age=0.56-ttl,cell=obj.userData.cell as BlastCell|undefined;
    const distance=cell?.distance??0;
    const opening=Math.max(0,Math.min(1,(age-distance*0.035)/0.085));
    const closing=Math.min(1,ttl/0.14);
    const flicker=0.88+0.12*Math.sin(performance.now()*0.037+distance*2.1);
    const parts=obj.userData.parts as FireParts;
    (parts.marker.material as THREE.MeshBasicMaterial).opacity=(0.32+0.2*opening)*closing;
    (parts.ground.material as THREE.MeshBasicMaterial).opacity=(0.45+0.5*opening)*closing;
    (parts.ribbon.material as THREE.MeshBasicMaterial).opacity=(0.5+0.4*opening)*closing;
    (parts.hot.material as THREE.MeshBasicMaterial).opacity=(0.35+0.43*opening)*closing;
    parts.ribbon.scale.setScalar(0.82+0.18*opening);
    parts.hot.scale.setScalar(0.48+0.21*opening);
    parts.ground.scale.setScalar(0.95+0.25*opening);
    parts.ground.rotation.z=age*(kind==='powered'?3:kind==='chain'?2.4:0.7)+distance*0.75;
    parts.outer.material.opacity=(0.55+0.45*opening)*closing;
    const isCore=!cell?.direction;
    const normalJet=kind==='normal'&&!isCore;
    parts.outer.scale.set(isCore?1.35+1.05*opening:normalJet?1.35+0.75*opening:0.9+0.38*opening,isCore?1.35+1.05*opening:normalJet?1.4+0.35*opening*flicker:0.95+0.68*opening*flicker,1);
    parts.outer.position.y=isCore?0.95:normalJet?0.66:0.47+0.32*opening;
    const directionAngle=normalJet?
      cell?.direction==='right'?0:cell?.direction==='left'?Math.PI:cell?.direction==='up'?Math.PI/2:-Math.PI/2:
      cell?.direction==='right'?-Math.PI/2:cell?.direction==='left'?Math.PI/2:cell?.direction==='down'?Math.PI:0;
    parts.outer.material.rotation=directionAngle+(kind==='chain'?-1:1)*Math.sin(age*17+distance*2.4)*0.05;
    if(parts.arc){parts.arc.material.opacity=(0.18+0.78*opening)*closing*(Math.sin(age*68+distance)>0?1:0.28);parts.arc.material.rotation=age*7+distance;}
    if(parts.chargeRing){
      (parts.chargeRing.material as THREE.MeshBasicMaterial).opacity=(0.3+0.55*opening)*closing;
      parts.chargeRing.scale.setScalar(0.75+0.55*Math.abs(Math.sin(age*22)));
    }
  }
  for(const [id,obj] of fireObjects)if(!game.fire.has(id)){effects.remove(obj);disposeFireObject(obj);fireObjects.delete(id);firePatterns.delete(id);}
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
  for(const obj of bombObjects.values()){props.remove(obj);disposeBombObject(obj);}bombObjects.clear();
  for(const obj of enemyObjects.values())actors.remove(obj);enemyObjects.clear();
  for(const art of enemyArt.values())art.mixer.stopAllAction();enemyArt.clear();
  for(const obj of fireObjects.values()){effects.remove(obj);disposeFireObject(obj);}fireObjects.clear();firePatterns.clear();
  for(const obj of upgradeObjects.values()){props.remove(obj);disposeVisualGeometry(obj);}upgradeObjects.clear();
  for(const p of particles){effects.remove(p.object);(p.object.material as THREE.Material).dispose();}particles.length=0;
  for(const fx of spriteEffects){effects.remove(fx.object);fx.object.material.dispose();}spriteEffects.length=0;
  for(const scorch of scorches){board.remove(scorch.object);scorch.object.geometry.dispose();(scorch.object.material as THREE.Material).dispose();}scorches.length=0;
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
let impactNoise:AudioBuffer|null=null;
function noiseHit(duration:number,volume:number,highpass=240){
  if(!audioEnabled)return;
  audioContext ??= new AudioContext();
  if(!impactNoise){
    impactNoise=audioContext.createBuffer(1,Math.floor(audioContext.sampleRate*0.45),audioContext.sampleRate);
    const samples=impactNoise.getChannelData(0);
    for(let i=0;i<samples.length;i++)samples[i]=Math.random()*2-1;
  }
  const source=audioContext.createBufferSource(),filter=audioContext.createBiquadFilter(),gain=audioContext.createGain();
  source.buffer=impactNoise;filter.type='highpass';filter.frequency.value=highpass;
  gain.gain.setValueAtTime(volume,audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001,audioContext.currentTime+duration);
  source.connect(filter);filter.connect(gain);gain.connect(audioContext.destination);
  source.start();source.stop(audioContext.currentTime+duration);
}
function explosionSound(kind:BlastKind){
  beep(kind==='powered'?105:kind==='chain'?140:115,0.31,'sine',0.12);
  noiseHit(0.24,kind==='powered'?0.095:0.075,kind==='chain'?650:280);
  if(kind==='chain')beep(820,0.13,'sawtooth',0.022);
}
document.querySelector<HTMLButtonElement>('#sound-button')!.addEventListener('click',e=>{audioEnabled=!audioEnabled;(e.currentTarget as HTMLButtonElement).classList.toggle('active',audioEnabled);(e.currentTarget as HTMLButtonElement).setAttribute('aria-label',audioEnabled?'Ton ausschalten':'Ton einschalten');beep(700,0.12);});

let toastTimer=0;
function showToast(message:string){toast.textContent=message;toast.classList.remove('hidden');toastTimer=1.7;}
function updateHud(){
  const lives=document.querySelector<HTMLElement>('#lives')!;
  lives.innerHTML=Array.from({length:3},(_,i)=>i<game.player.lives?'♥':'♡').join(' ')+(game.player.shield?' <span class="shield-hud">✦</span>':'');
  lives.setAttribute('aria-label',`${game.player.lives} Leben${game.player.shield?', Schild aktiv':''}`);
  document.querySelector('#enemies')!.textContent=String(game.aliveEnemies).padStart(2,'0');
  document.querySelector('#bombs')!.textContent=`${game.player.capacity-game.playerBombCount} / ${game.player.capacity}`;
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
function returnToMenu(){
  clearObjects();game.reset();playerObject.position.copy(world(game.player));syncStatic();
  stage.classList.remove('game-active');result.classList.add('hidden');intro.classList.remove('hidden');updateHud();
}
document.querySelector('#start-button')!.addEventListener('click',()=>start());
document.querySelector('#restart-button')!.addEventListener('click',()=>start(true));
document.querySelector('#menu-button')!.addEventListener('click',returnToMenu);
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

let last=performance.now(),accumulator=0,lastStatus=game.status,footstepTimer=0,cameraJolt=0;
const cameraRest=camera.position.clone();
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
      for(const cell of event.cells??[])firePatterns.set(key(cell.x,cell.y),cell);
      burst(event.x,event.y,palette.spark,kind==='normal'?10:15);
      shockwave(event.x,event.y,palette.edge,kind==='powered'?1.2:1);
      transientSprite(event.x,event.y,fxTextures.flare,palette.core,{height:1.02,duration:0.16,opacity:0.9,startScale:0.5,endScale:2.55});
      transientSprite(event.x,event.y,fxTextures.smoke,'#64728a',{height:0.83,delay:0.18,duration:0.86,opacity:0.42,startScale:0.55,endScale:1.45,velocity:new THREE.Vector3(0,0.4,0),additive:false});
      markScorch(event.x,event.y);
      cameraJolt=Math.min(0.13,cameraJolt+(kind==='powered'?0.085:0.055));
      stage.classList.remove('blast-impact');void stage.offsetWidth;
      stage.classList.add('blast-impact');
      explosionSound(kind);
    }
    if(event.type==='crate'){woodBurst(event.x,event.y);syncStatic();noiseHit(0.12,0.025,750);}
    if(event.type==='bomb')transientSprite(event.x,event.y,fxTextures.smoke,'#a7b1ba',{height:0.13,duration:0.2,opacity:0.25,startScale:0.12,endScale:0.58,additive:false});
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
  updateParticles(dt);updateSpriteEffects(dt);updateScorches(dt);updateShockwaves(dt);syncDynamic();
  cameraJolt=Math.max(0,cameraJolt-dt*0.8);
  camera.position.copy(cameraRest);
  if(cameraJolt>0){camera.position.x+=Math.sin(now*0.071)*cameraJolt;camera.position.z+=Math.sin(now*0.096)*cameraJolt*0.6;}
  if(game.status==='running'){playerArt?.mixer.update(dt);for(const art of enemyArt.values())art.mixer.update(dt);}updateHud();renderer.render(scene,camera);
}
playerObject.position.copy(world(game.player));syncStatic();renderCharacterOptions();renderDifficultyOptions();loadKenneyAssets();void loadDungeonAssets();updateHud();requestAnimationFrame(frame);
