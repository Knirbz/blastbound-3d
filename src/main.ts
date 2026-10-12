import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';
import { Game, WIDTH, HEIGHT, type Direction, type Point } from './logic';
import './style.css';

const stage = document.querySelector<HTMLElement>('#stage')!;
const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas')!;
const intro = document.querySelector<HTMLElement>('#intro')!;
const result = document.querySelector<HTMLElement>('#result')!;
const toast = document.querySelector<HTMLElement>('#toast')!;
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
const stone=mat('#8694b4',0.83), stoneTop=mat('#acbad0',0.7), stoneTrim=mat('#5e708e');
const wood=mat('#bf794f',0.72), woodTop=mat('#e29a64',0.7), woodTrim=mat('#81563f',0.78), woodNail=mat('#e7c88a',0.3,0.55);
const bombMat=mat('#222b4c',0.22,0.25), bombCap=mat('#596582',0.4,0.3);
const glow = new THREE.MeshStandardMaterial({color:'#ffda6a',emissive:'#ff8e2e',emissiveIntensity:3,roughness:0.25});
const fireMat = new THREE.MeshBasicMaterial({color:'#ffab43',transparent:true,opacity:0.83,depthWrite:false});
const fireCore = new THREE.MeshBasicMaterial({color:'#fff1a0',transparent:true,opacity:0.92,depthWrite:false});
const portalMat = new THREE.MeshStandardMaterial({color:'#76dfff',emissive:'#18baf0',emissiveIntensity:2.7,metalness:0.35,roughness:0.2});
const upgradeMats={range:new THREE.MeshStandardMaterial({color:'#ffae54',emissive:'#ff6828',emissiveIntensity:0.65,metalness:0.3,roughness:0.3}),capacity:new THREE.MeshStandardMaterial({color:'#80ecdb',emissive:'#25bfa8',emissiveIntensity:0.7,metalness:0.3,roughness:0.3})};
const mesh=(geometry:THREE.BufferGeometry, material:THREE.Material, shadow=true) => {const o=new THREE.Mesh(geometry,material); o.castShadow=shadow; o.receiveShadow=true; return o;};
const rounded=(w:number,h:number,d:number,r:number,m:THREE.Material)=>mesh(new RoundedBoxGeometry(w,h,d,3,r),m);
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
  return g;
}
function bombObject(){
  const g=new THREE.Group();
  const body=mesh(new THREE.SphereGeometry(0.31,24,16),bombMat);body.position.y=0.34;g.add(body);
  const band=mesh(new THREE.TorusGeometry(0.23,0.025,8,24),bombCap);band.rotation.x=Math.PI/2;band.position.y=0.45;g.add(band);
  const fuse=mesh(new THREE.CylinderGeometry(0.065,0.09,0.16,10),bombCap);fuse.position.y=0.7;g.add(fuse);
  const light=mesh(new THREE.SphereGeometry(0.075,12,10),glow);light.position.y=0.81;g.add(light);
  const point=new THREE.PointLight('#ff9439',0.8,2.2);point.position.y=0.8;g.add(point);
  return g;
}
function fireObject(){
  const g=new THREE.Group();
  const outer=rounded(0.82,0.22,0.82,0.13,fireMat);outer.position.y=0.15;g.add(outer);
  const core=rounded(0.52,0.32,0.52,0.12,fireCore);core.position.y=0.22;core.rotation.y=Math.PI/4;g.add(core);
  const top=mesh(new THREE.OctahedronGeometry(0.17,0),fireCore,false);top.position.y=0.46;g.add(top);
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
function upgradeObject(type:'range'|'capacity'){
  const g=new THREE.Group();
  const base=mesh(new THREE.CylinderGeometry(0.22,0.25,0.08,8),mat('#26365b'));base.position.y=0.06;g.add(base);
  const gem=mesh(new THREE.OctahedronGeometry(0.2,0),upgradeMats[type]);gem.position.y=0.31;g.add(gem);
  return g;
}

type AnimatedArt={model:THREE.Object3D;mixer:THREE.AnimationMixer;idle:THREE.AnimationAction|null;walk:THREE.AnimationAction|null;active:THREE.AnimationAction|null};
function makeAnimatedArt(gltf:GLTF):AnimatedArt{
  const model=cloneSkeleton(gltf.scene);
  model.traverse(child=>{if(child instanceof THREE.Mesh){child.castShadow=true;child.receiveShadow=true;}});
  const bounds=new THREE.Box3().setFromObject(model);
  const size=bounds.getSize(new THREE.Vector3());
  const scale=Math.min(0.82/Math.max(size.x,size.z,0.01),0.95/Math.max(size.y,0.01));
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
let playerArt:AnimatedArt|null=null;
let enemyTemplate:GLTF|null=null;
const playerShadow=mesh(new THREE.CircleGeometry(0.33,20),new THREE.MeshBasicMaterial({color:'#121e39',transparent:true,opacity:0.22}),false);
playerShadow.rotation.x=-Math.PI/2; playerShadow.position.y=0.004;actors.add(playerShadow);
const key=(x:number,y:number)=>Game.key(x,y);
function applyEnemyArt(group:THREE.Group,id:number){
  if(!enemyTemplate)return;
  const old=enemyArt.get(id);if(old)old.mixer.stopAllAction();
  const art=makeAnimatedArt(enemyTemplate);group.clear();group.add(art.model);enemyArt.set(id,art);
}
function loadKenneyAssets(){
  const loader=new GLTFLoader();
  const base='/assets/kenney/';
  loader.load(`${base}characters/character-female-b.glb`,gltf=>{
    playerArt=makeAnimatedArt(gltf);playerObject.clear();playerObject.add(playerArt.model);
  },undefined,error=>console.warn('Kenney player asset unavailable',error));
  loader.load(`${base}arena/character-soldier.glb`,gltf=>{
    enemyTemplate=gltf;
    for(const [id,obj] of enemyObjects)applyEnemyArt(obj,id);
  },undefined,error=>console.warn('Kenney enemy asset unavailable',error));
}
function syncStatic(){
  for(let y=0;y<HEIGHT;y++)for(let x=0;x<WIDTH;x++){
    const id=key(x,y),tile=game.tile(x,y),existing=tileObjects.get(id);
    if(tile===0){if(existing){props.remove(existing);tileObjects.delete(id);}continue;}
    if(existing)continue;
    const obj=tile===1?stoneBlock():crate();obj.position.copy(world({x,y}));props.add(obj);tileObjects.set(id,obj);
  }
  if(game.tile(game.portal.x,game.portal.y)===0 && !portalObjectRef){portalObjectRef=portalObject();portalObjectRef.position.copy(world(game.portal));props.add(portalObjectRef);}
  if(game.tile(game.portal.x,game.portal.y)!==0 && portalObjectRef){props.remove(portalObjectRef);portalObjectRef=null;}
}
function syncDynamic(){
  const p=world(game.player),playerTarget=new THREE.Vector3(p.x,0,p.z);
  playerObject.rotation.y=facingYaw[game.player.facing];
  setAnimatedState(playerArt,playerObject.position.distanceTo(playerTarget)>0.025);
  playerObject.position.lerp(playerTarget,0.34);playerShadow.position.x=playerObject.position.x;playerShadow.position.z=playerObject.position.z;
  playerObject.visible=game.player.invincible<=0||Math.floor(performance.now()/90)%2===0;
  for(const enemy of game.enemies){
    let obj=enemyObjects.get(enemy.id);
    if(!enemy.alive){if(obj){actors.remove(obj);enemyObjects.delete(enemy.id);enemyArt.get(enemy.id)?.mixer.stopAllAction();enemyArt.delete(enemy.id);}continue;}
    if(!obj){obj=new THREE.Group();obj.add(character('#b768ec','#edb6ff',true));obj.position.copy(world(enemy));actors.add(obj);enemyObjects.set(enemy.id,obj);applyEnemyArt(obj,enemy.id);}
    const v=world(enemy),target=new THREE.Vector3(v.x,0,v.z);
    obj.rotation.y=facingYaw[enemy.facing];
    setAnimatedState(enemyArt.get(enemy.id)??null,obj.position.distanceTo(target)>0.025);
    obj.position.lerp(target,0.25);
  }
  for(const bomb of game.bombs){
    let obj=bombObjects.get(bomb.id);
    if(!obj){obj=bombObject();obj.position.copy(world(bomb));props.add(obj);bombObjects.set(bomb.id,obj);}
    const pulse=1+0.075*Math.sin(performance.now()*0.015 + bomb.id);
    obj.scale.setScalar(pulse);
  }
  for(const [id,obj] of bombObjects)if(!game.bombs.some(b=>b.id===id)){props.remove(obj);bombObjects.delete(id);}
  for(const [id,ttl] of game.fire){
    let obj=fireObjects.get(id);
    if(!obj){const [x,y]=id.split(',').map(Number);obj=fireObject();obj.position.copy(world({x,y}));effects.add(obj);fireObjects.set(id,obj);}
    obj.scale.setScalar(0.8+0.28*Math.min(ttl/0.3,1)+0.08*Math.sin(performance.now()*0.03));
  }
  for(const [id,obj] of fireObjects)if(!game.fire.has(id)){effects.remove(obj);fireObjects.delete(id);}
  for(const upgrade of game.upgrades){const id=key(upgrade.x,upgrade.y);if(!upgradeObjects.has(id)){const obj=upgradeObject(upgrade.type);obj.position.copy(world(upgrade));props.add(obj);upgradeObjects.set(id,obj);}}
  for(const [id,obj] of upgradeObjects)if(!game.upgrades.some(u=>key(u.x,u.y)===id)){props.remove(obj);upgradeObjects.delete(id);}
  if(portalObjectRef){portalObjectRef.rotation.y+=0.012;portalObjectRef.position.y=0.04*Math.sin(performance.now()*0.003);}
  const t=performance.now()*0.002;
  playerObject.position.y=0.025*Math.sin(t*2);
}
function clearObjects(){
  for(const obj of tileObjects.values())props.remove(obj);tileObjects.clear();
  for(const obj of bombObjects.values())props.remove(obj);bombObjects.clear();
  for(const obj of enemyObjects.values())actors.remove(obj);enemyObjects.clear();
  for(const art of enemyArt.values())art.mixer.stopAllAction();enemyArt.clear();
  for(const obj of fireObjects.values())effects.remove(obj);fireObjects.clear();
  for(const obj of upgradeObjects.values())props.remove(obj);upgradeObjects.clear();
  for(const p of particles){effects.remove(p.object);(p.object.material as THREE.Material).dispose();}particles.length=0;
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
  document.querySelector('#lives')!.textContent=Array.from({length:3},(_,i)=>i<game.player.lives?'♥':'♡').join(' ');
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
  result.classList.remove('hidden');beep(win?780:180,0.35,'triangle',0.08);
}
function start(restart=false){
  if(restart){clearObjects();game.reset();playerObject.position.copy(world(game.player));syncStatic();}
  game.start();intro.classList.add('hidden');result.classList.add('hidden');updateHud();
}
document.querySelector('#start-button')!.addEventListener('click',()=>start());
document.querySelector('#restart-button')!.addEventListener('click',()=>start(true));
document.querySelector('#pause-button')!.addEventListener('click',()=>{game.togglePause();showToast(game.status==='paused'?'PAUSIERT':'WEITER GEHT’S');updateHud();});
const held=new Set<Direction>();
const keyMap:Record<string,Direction>={ArrowUp:'up',KeyW:'up',ArrowDown:'down',KeyS:'down',ArrowLeft:'left',KeyA:'left',ArrowRight:'right',KeyD:'right'};
let moveDelay=0;
function attemptMove(direction:Direction){if(game.move(direction)){beep(260,0.025,'sine',0.008);moveDelay=0.115;}}
function placeBomb(){if(game.placeBomb()){beep(460,0.09,'triangle',0.025);updateHud();}}
window.addEventListener('keydown',e=>{
  if(keyMap[e.code]){e.preventDefault();held.add(keyMap[e.code]);if(!e.repeat&&moveDelay<=0)attemptMove(keyMap[e.code]);}
  if(e.code==='Space'){e.preventDefault();if(!e.repeat)placeBomb();}
  if(e.code==='KeyP'||e.code==='Escape'){e.preventDefault();game.togglePause();showToast(game.status==='paused'?'PAUSIERT':'WEITER GEHT’S');updateHud();}
});
window.addEventListener('keyup',e=>{if(keyMap[e.code])held.delete(keyMap[e.code]);});
window.addEventListener('blur',()=>held.clear());
for(const button of document.querySelectorAll<HTMLButtonElement>('[data-dir]')){
  const direction=button.dataset.dir as Direction;
  button.addEventListener('pointerdown',e=>{e.preventDefault();held.add(direction);attemptMove(direction);button.setPointerCapture(e.pointerId);});
  button.addEventListener('pointerup',()=>held.delete(direction));button.addEventListener('pointercancel',()=>held.delete(direction));
}
document.querySelector('#touch-bomb')!.addEventListener('pointerdown',e=>{e.preventDefault();placeBomb();});

let last=performance.now(),accumulator=0,lastStatus=game.status;
function frame(now:number){
  requestAnimationFrame(frame);
  const dt=Math.min((now-last)/1000,0.1);last=now;accumulator+=dt;moveDelay=Math.max(0,moveDelay-dt);
  if(moveDelay===0&&held.size)attemptMove(Array.from(held).at(-1)!);
  while(accumulator>=1/60){game.update(1/60);accumulator-=1/60;}
  for(const event of game.drainEvents()){
    if(event.type==='explode'){burst(event.x,event.y,'#ffcd62',18);beep(120,0.26,'sawtooth',0.07);}
    if(event.type==='crate'){burst(event.x,event.y,'#e7a56e',9);syncStatic();}
    if(event.type==='hit'){showToast('AU! EIN LEBEN VERLOREN');beep(170,0.28,'square',0.04);}
    if(event.type==='upgrade'){showToast('UPGRADE EINGESAMMELT!');beep(880,0.24,'triangle',0.05);}
    if(event.type==='enemy'){burst(event.x,event.y,'#eab0ff',12);showToast('GEGNER AUSGESCHALTET!');beep(660,0.14,'triangle',0.04);}
  }
  if(lastStatus!==game.status){if(game.status==='won'||game.status==='lost')showResult();lastStatus=game.status;}
  if(toastTimer>0){toastTimer-=dt;if(toastTimer<=0)toast.classList.add('hidden');}
  updateParticles(dt);syncDynamic();playerArt?.mixer.update(dt);for(const art of enemyArt.values())art.mixer.update(dt);updateHud();renderer.render(scene,camera);
}
playerObject.position.copy(world(game.player));syncStatic();loadKenneyAssets();updateHud();requestAnimationFrame(frame);
