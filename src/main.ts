import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';
import { Game, WIDTH, HEIGHT, BOMB_FUSE, FIRE_DURATION, type BlastKind, type BlastCell, type Bomb, type Difficulty, type Direction, type MapType, type Point, type UpgradeType } from './logic';
import { createRoom, LobbyConnection, type RoomBomb, type RoomMessage, type RoomPlayer, type RoomSettings } from './lobby-network';
import './style.css';

const stage = document.querySelector<HTMLElement>('#stage')!;
const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas')!;
const mainMenu = document.querySelector<HTMLElement>('#main-menu')!;
const optionsMenu = document.querySelector<HTMLElement>('#options-menu')!;
const lobbyToolbar = document.querySelector<HTMLElement>('#lobby-toolbar')!;
const lobbyMatchPanel = document.querySelector<HTMLElement>('#lobby-match-panel')!;
const lobbyReadyList = document.querySelector<HTMLElement>('#lobby-ready-list')!;
const lobbyMap = document.querySelector<HTMLSelectElement>('#lobby-map')!;
const lobbyAddCpu = document.querySelector<HTMLInputElement>('#lobby-add-cpu')!;
const lobbyReadyButton = document.querySelector<HTMLButtonElement>('#lobby-ready')!;
const lobbyStartButton = document.querySelector<HTMLButtonElement>('#lobby-start')!;
const lobbySetup = document.querySelector<HTMLElement>('#lobby-setup')!;
const lobbyCharacterOptions = document.querySelector<HTMLElement>('#lobby-character-options')!;
const lobbyCodeInput = document.querySelector<HTMLInputElement>('#lobby-code-input')!;
const lobbySubmit = document.querySelector<HTMLButtonElement>('#lobby-submit')!;
const lobbySetupError = document.querySelector<HTMLElement>('#lobby-setup-error')!;
const intro = document.querySelector<HTMLElement>('#intro')!;
const pauseMenu = document.querySelector<HTMLElement>('#pause-menu')!;
const result = document.querySelector<HTMLElement>('#result')!;
const toast = document.querySelector<HTMLElement>('#toast')!;
const characterOptions = document.querySelector<HTMLElement>('#character-options')!;
const difficultyOptions = document.querySelector<HTMLElement>('.difficulty-options')!;
const difficultyHint = document.querySelector<HTMLElement>('#difficulty-hint')!;
const mapOptions = document.querySelector<HTMLElement>('.map-options')!;
const mapHint = document.querySelector<HTMLElement>('#map-hint')!;
const difficultyDescriptions:Record<Difficulty,string>={
  training:'Bots bleiben stehen und greifen nicht an.',
  easy:'Langsame Bots, wenige Bomben.',
  medium:'Aktive Bots, häufiger Bomben.',
  hard:'Schnelle Bots mit stärkeren Bomben.',
};
const difficultyNames:Record<Difficulty,string>={training:'Training',easy:'Leicht',medium:'Mittel',hard:'Schwer'};
type ArenaMap=Exclude<MapType,'lobby'>;
const mapNames:Record<MapType,string>={courtyard:'Burghof',foundry:'Werkhalle',market:'Kassenchaos',graveyard:'Spukfriedhof',pirate:'Kanonenbucht',lobby:'Übungs-Lobby'};
const mapDescriptions:Record<ArenaMap,string>={courtyard:'Klassische Kisten und feste Mauern.',foundry:'Förderbänder bewegen gelegte Bomben.',market:'Regale freisprengen. Einkaufswagen fahren Bomben durch die Kassenbahnen.',graveyard:'Bomben auf Spukgräbern erscheinen am anderen Grab.',pirate:'Küstenkanonen feuern abwechselnd durch zwei freie Bahnen.'};
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
const mapStorageKey = 'blastbound-map';
const graphicsStorageKey = 'blastbound-economy-graphics';
const soundStorageKey = 'blastbound-sound';
let selectedCharacter:CharacterId = 'character-female-b';
let selectedDifficulty:Difficulty = 'easy';
let selectedMap:ArenaMap = 'courtyard';
let economyGraphics=false;
try {
  const saved = localStorage.getItem(characterStorageKey);
  if(characters.some(character=>character.id===saved))selectedCharacter=saved as CharacterId;
  const savedDifficulty=localStorage.getItem(difficultyStorageKey);
  if(savedDifficulty&&Object.hasOwn(difficultyDescriptions,savedDifficulty))selectedDifficulty=savedDifficulty as Difficulty;
  const savedMap=localStorage.getItem(mapStorageKey);
  if(savedMap&&Object.hasOwn(mapDescriptions,savedMap))selectedMap=savedMap as ArenaMap;
  economyGraphics=localStorage.getItem(graphicsStorageKey)==='true';
} catch { /* Private browsing can disable storage. */ }
const game = new Game(Date.now(),selectedDifficulty,selectedMap);
const lowPowerDevice=window.matchMedia('(pointer:coarse)').matches;
const pixelRatio=()=>Math.min(window.devicePixelRatio,economyGraphics?1:lowPowerDevice?1.25:1.6);
let renderer: THREE.WebGLRenderer;
try { renderer = new THREE.WebGLRenderer({canvas, antialias:!lowPowerDevice, alpha:false, powerPreference:'high-performance'}); }
catch { stage.innerHTML='<div class="webgl-error">Dieses Spiel benötigt WebGL. Bitte aktiviere die Grafikhardware im Browser.</div>'; throw new Error('WebGL unavailable'); }
renderer.setPixelRatio(pixelRatio());
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
sun.shadow.mapSize.set(lowPowerDevice?1024:2048,lowPowerDevice?1024:2048); sun.shadow.camera.left=-12; sun.shadow.camera.right=12; sun.shadow.camera.top=12; sun.shadow.camera.bottom=-12;
sun.shadow.normalBias=0.025; sun.shadow.bias=-0.0001;
scene.add(sun);
const rim = new THREE.DirectionalLight('#7789ff',0.8); rim.position.set(8,6,-9); scene.add(rim);

const mat = (color:string, roughness=0.65, metalness=0) => new THREE.MeshStandardMaterial({color,roughness,metalness});
const floorMats=['#4b627f','#506783','#48607d','#4d6580'].map(color=>mat(color,0.88));
const foundryFloorMats=['#4c5361','#545c68','#444e5f','#59616c'].map(color=>mat(color,0.73,0.14));
const marketFloorMats=['#667b72','#70847b','#60746b','#75877d'].map(color=>mat(color,0.82));
const graveyardFloorMats=['#525b63','#596269','#4c5660','#616970'].map(color=>mat(color,0.9));
const pirateFloorMats=['#82634d','#8c6c53','#7d5e49','#907059'].map(color=>mat(color,0.89));
const floorEdge=mat('#263a58');
const foundryEdge=mat('#343a4b',0.55,0.3);
const marketEdge=mat('#677e78',0.67);
const graveyardEdge=mat('#3a3d51',0.85);
const pirateEdge=mat('#514137',0.86);
const stone=mat('#347c98',0.68), stoneTop=mat('#62c9ca',0.5), stoneTrim=mat('#20526f');
const wood=mat('#bf794f',0.72), woodTop=mat('#e29a64',0.7), woodTrim=mat('#81563f',0.78), woodNail=mat('#e7c88a',0.3,0.55);
const foundrySteel=mat('#303c4e',0.48,0.52),foundryTrim=mat('#a8aeb1',0.34,0.55),foundryGold=new THREE.MeshStandardMaterial({color:'#ff9d35',emissive:'#a8450a',emissiveIntensity:0.4,roughness:0.43,metalness:0.16});
const foundryGlow=new THREE.MeshStandardMaterial({color:'#6fe5e8',emissive:'#25bbc8',emissiveIntensity:1.8,roughness:0.28,metalness:0.2});
const beltMat=mat('#1f2938',0.7,0.35),beltArrowMat=new THREE.MeshBasicMaterial({color:'#f6bd66'});
const bombMat=mat('#34415d',0.26,0.25), bombCap=mat('#8b9bb4',0.34,0.55);
const bombHighlight=mat('#7188aa',0.18,0.25),bombCore=mat('#f8fcff',0.2),bombFuseMat=mat('#e4c993',0.88);
type BombVariant='normal'|'boosted'|'power'|'super'|'remote'|'slime'|'enemy';
const bombAccent:Record<BombVariant,THREE.MeshStandardMaterial>={normal:mat('#ffb45e',0.26,0.25),boosted:mat('#6eeff2',0.26,0.25),power:mat('#f6c364',0.26,0.25),super:mat('#ff6262',0.26,0.25),enemy:mat('#f36b83',0.26,0.25),remote:mat('#8a8cff',0.26,0.25),slime:mat('#81ed78',0.26,0.25)};
const bombColors:Record<BombVariant,string>={normal:'#ffb45e',boosted:'#6eeff2',power:'#f6c364',super:'#ff6262',enemy:'#f36b83',remote:'#8a8cff',slime:'#81ed78'};
const bombModels=new Map<BombVariant,THREE.Object3D>();
const glow = new THREE.MeshStandardMaterial({color:'#ffda6a',emissive:'#ff8e2e',emissiveIntensity:3,roughness:0.25});
const blastPalette:Record<BlastKind,{edge:string;core:string;spark:string}>={
  normal:{edge:'#ff6b2c',core:'#fff1b5',spark:'#ffd064'},
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
const fxMaterial=(texture:THREE.Texture,color:string,opacity=1,additive=true)=>new THREE.SpriteMaterial({map:texture,color,transparent:true,opacity,blending:additive?THREE.AdditiveBlending:THREE.NormalBlending,depthWrite:false});
const portalMat = new THREE.MeshStandardMaterial({color:'#76dfff',emissive:'#18baf0',emissiveIntensity:2.7,metalness:0.35,roughness:0.2});
const upgradeColors:Record<UpgradeType,string>={range:'#ffae54',capacity:'#80ecdb',speed:'#f4da73',remote:'#a5a0ff',bombPass:'#c7a6f1',blockPass:'#a3d5ef',glove:'#f8bd80',kick:'#f49676',heart:'#ff7d9a',maxRange:'#ffdf69',powerBomb:'#f6a852',pierce:'#ff7070',slime:'#8be275',skull:'#bb9bd5',shield:'#7eb7ff'};
const upgradeMats=Object.fromEntries(Object.entries(upgradeColors).map(([type,color])=>[type,new THREE.MeshStandardMaterial({color,emissive:color,emissiveIntensity:0.65,metalness:0.22,roughness:0.32})])) as Record<UpgradeType,THREE.MeshStandardMaterial>;
const pickupFrame=mat('#f4f0df',0.33,0.06);
const pickupShadowMat=new THREE.MeshBasicMaterial({color:'#11182a',transparent:true,opacity:0.24,depthWrite:false});
function upgradeIconTexture(type:UpgradeType){
  const canvas=document.createElement('canvas');canvas.width=128;canvas.height=128;
  const c=canvas.getContext('2d')!;
  const roundedPath=(x:number,y:number,w:number,h:number,r:number)=>{c.beginPath();c.moveTo(x+r,y);c.lineTo(x+w-r,y);c.quadraticCurveTo(x+w,y,x+w,y+r);c.lineTo(x+w,y+h-r);c.quadraticCurveTo(x+w,y+h,x+w-r,y+h);c.lineTo(x+r,y+h);c.quadraticCurveTo(x,y+h,x,y+h-r);c.lineTo(x,y+r);c.quadraticCurveTo(x,y,x+r,y);c.closePath();};
  c.fillStyle='#fff7e6';roundedPath(4,4,120,120,18);c.fill();
  c.strokeStyle=upgradeColors[type];c.lineWidth=9;roundedPath(11,11,106,106,14);c.stroke();
  c.save();c.translate(64,66);c.lineJoin='round';c.lineCap='round';c.strokeStyle='#29354a';c.lineWidth=6;
  const bomb=(color='#30364d')=>{
    c.fillStyle=color;c.beginPath();c.arc(0,9,29,0,Math.PI*2);c.fill();c.stroke();
    c.fillStyle='#fffdf2';c.beginPath();c.ellipse(-10,-1,8,5,-0.5,0,Math.PI*2);c.fill();
    c.fillStyle='#d3b284';c.fillRect(-5,-27,10,11);c.strokeRect(-5,-27,10,11);
    c.strokeStyle='#d3b284';c.lineWidth=7;c.beginPath();c.moveTo(0,-27);c.quadraticCurveTo(11,-43,15,-35);c.stroke();
    c.fillStyle='#ffcf60';c.beginPath();c.arc(17,-35,5,0,Math.PI*2);c.fill();
  };
  const flame=()=>{
    c.fillStyle='#f15b32';c.beginPath();c.moveTo(0,-42);c.bezierCurveTo(21,-13,34,-3,28,20);c.bezierCurveTo(24,39,12,42,0,42);c.bezierCurveTo(-30,42,-37,15,-25,-5);c.bezierCurveTo(-23,9,-11,11,-10,-6);c.closePath();c.fill();c.stroke();
    c.fillStyle='#ffdc57';c.beginPath();c.moveTo(3,-14);c.quadraticCurveTo(25,14,10,32);c.quadraticCurveTo(-10,42,-12,20);c.quadraticCurveTo(-9,10,3,-14);c.fill();
  };
  const arrow=()=>{c.strokeStyle='#fff8de';c.lineWidth=10;c.beginPath();c.moveTo(-20,15);c.lineTo(18,15);c.moveTo(5,2);c.lineTo(20,15);c.lineTo(5,28);c.stroke();};
  switch(type){
    case 'range':case 'maxRange':flame();if(type==='maxRange'){c.fillStyle='#fff';c.font='900 30px Arial';c.textAlign='center';c.fillText('★',29,-21);}break;
    case 'capacity':case 'powerBomb':case 'pierce':case 'slime':case 'bombPass':
      bomb(type==='powerBomb'?'#d7444c':type==='pierce'?'#e95c56':type==='slime'?'#55b4e5':'#28334d');
      if(type==='powerBomb'||type==='capacity'){c.fillStyle='#fff';c.font='900 35px Arial';c.textAlign='center';c.fillText(type==='powerBomb'?'P':'+',0,22);}
      if(type==='pierce'||type==='bombPass')arrow();
      if(type==='slime'){c.fillStyle='#a3f0ff';c.beginPath();c.arc(-12,11,5,0,Math.PI*2);c.arc(13,19,4,0,Math.PI*2);c.fill();}
      break;
    case 'speed':case 'kick':{
      c.fillStyle=type==='speed'?'#f5c448':'#ef9565';c.beginPath();c.moveTo(-37,1);c.lineTo(-8,-25);c.lineTo(4,-19);c.lineTo(2,2);c.lineTo(35,17);c.lineTo(32,31);c.lineTo(-35,31);c.closePath();c.fill();c.stroke();
      c.fillStyle='#30364d';c.fillRect(-34,29,65,8);if(type==='speed')for(const x of [-17,17]){c.beginPath();c.arc(x,39,7,0,Math.PI*2);c.fill();}break;
    }
    case 'remote':c.fillStyle='#5e80b7';roundedPath(-22,-25,44,62,8);c.fill();c.stroke();c.strokeStyle='#29354a';c.lineWidth=6;c.beginPath();c.moveTo(0,-25);c.lineTo(9,-43);c.stroke();c.fillStyle='#f06565';c.beginPath();c.arc(0,5,11,0,Math.PI*2);c.fill();break;
    case 'blockPass':c.fillStyle='#c98a59';c.fillRect(-29,-28,58,58);c.strokeRect(-29,-28,58,58);c.strokeStyle='#fff0cc';c.lineWidth=7;c.beginPath();c.moveTo(-25,-22);c.lineTo(25,25);c.stroke();arrow();break;
    case 'glove':c.fillStyle='#f1b57d';c.beginPath();c.moveTo(-27,3);c.lineTo(-24,-30);c.quadraticCurveTo(-18,-38,-11,-30);c.lineTo(-9,-8);c.lineTo(-5,-37);c.quadraticCurveTo(4,-43,8,-33);c.lineTo(9,-4);c.lineTo(14,-28);c.quadraticCurveTo(26,-30,25,-18);c.lineTo(25,20);c.quadraticCurveTo(20,38,0,38);c.quadraticCurveTo(-16,37,-27,3);c.fill();c.stroke();break;
    case 'heart':c.fillStyle='#ed5f79';c.beginPath();c.moveTo(0,37);c.bezierCurveTo(-52,8,-39,-30,-15,-26);c.quadraticCurveTo(-3,-24,0,-13);c.quadraticCurveTo(7,-32,24,-27);c.bezierCurveTo(49,-21,42,13,0,37);c.fill();c.stroke();break;
    case 'skull':c.fillStyle='#f1e8ed';c.beginPath();c.arc(0,-5,29,0,Math.PI*2);c.fill();c.stroke();c.fillRect(-17,15,34,18);c.strokeRect(-17,15,34,18);c.fillStyle='#29354a';for(const x of [-11,11]){c.beginPath();c.arc(x,-9,7,0,Math.PI*2);c.fill();}c.fillRect(-4,17,8,11);break;
    case 'shield':c.fillStyle='#69addc';c.beginPath();c.moveTo(0,-40);c.lineTo(31,-28);c.lineTo(26,13);c.quadraticCurveTo(16,33,0,42);c.quadraticCurveTo(-28,28,-31,-2);c.lineTo(-31,-28);c.closePath();c.fill();c.stroke();c.fillStyle='#fff';c.font='900 39px Arial';c.textAlign='center';c.fillText('✦',0,16);break;
  }
  c.restore();
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;
  return texture;
}
const upgradeIconMats=Object.fromEntries((Object.keys(upgradeColors) as UpgradeType[]).map(type=>[type,new THREE.MeshBasicMaterial({map:upgradeIconTexture(type)})])) as Record<UpgradeType,THREE.MeshBasicMaterial>;
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
const floorCells:THREE.Mesh[]=[];
const marketFloor=new THREE.Group();board.add(marketFloor);
const graveyardFloor=new THREE.Group();board.add(graveyardFloor);
const pirateFloor=new THREE.Group();board.add(pirateFloor);
const ghostGraveVisuals=new THREE.Group();board.add(ghostGraveVisuals);
const cannonWarningVisuals=new THREE.Group();board.add(cannonWarningVisuals);
for(let y=0;y<HEIGHT;y++)for(let x=0;x<WIDTH;x++){
  const variation=(x*17+y*31+x*y*7)%floorMats.length;
  const cell=mesh(new THREE.BoxGeometry(0.995,0.07,0.995),floorMats[variation],false);
  cell.position.set(x-6,-0.07,y-5); cell.receiveShadow=true; board.add(cell);
  floorCells.push(cell);
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
const conveyorVisuals=new THREE.Group();board.add(conveyorVisuals);
function applyMapTheme(){
  const lobby=game.map==='lobby';
  const foundry=game.map==='foundry';
  const market=game.map==='market';
  const graveyard=game.map==='graveyard';
  const pirate=game.map==='pirate';
  marketFloor.visible=market&&marketFloor.children.length>0;
  graveyardFloor.visible=graveyard&&graveyardFloor.children.length>0;
  pirateFloor.visible=pirate&&pirateFloor.children.length>0;
  ghostGraveVisuals.visible=graveyard;
  cannonWarningVisuals.visible=pirate;
  for(let i=0;i<floorCells.length;i++){
    floorCells[i].material=(foundry?foundryFloorMats:market?marketFloorMats:graveyard?graveyardFloorMats:pirate?pirateFloorMats:floorMats)[i%4];
    const x=i%WIDTH,y=Math.floor(i/WIDTH);
    floorCells[i].visible=!marketFloor.visible&&!graveyardFloor.visible&&!pirateFloor.visible&&(!lobby||(x>=2&&x<=10&&y>=1&&y<=9));
  }
  floorBase.material=foundry?foundryEdge:market?marketEdge:graveyard?graveyardEdge:pirate?pirateEdge:floorEdge;
  (rimBase.material as THREE.MeshStandardMaterial).color.set(foundry?'#242936':market?'#536e68':graveyard?'#292b3d':pirate?'#3d352f':'#202d48');
  scene.background=new THREE.Color(foundry?'#191b2a':market?'#1c2831':graveyard?'#1a1a29':pirate?'#1a2531':'#171e34');
  if(scene.fog instanceof THREE.Fog)scene.fog.color.set(foundry?'#191b2a':market?'#1c2831':graveyard?'#1a1a29':pirate?'#1a2531':'#171e34');
  for(const child of [...conveyorVisuals.children]){conveyorVisuals.remove(child);disposeVisualGeometry(child);}
  if(!foundry)return;
  const arrowShape=new THREE.Shape();arrowShape.moveTo(-0.16,-0.12);arrowShape.lineTo(0.02,-0.12);arrowShape.lineTo(0.02,-0.22);arrowShape.lineTo(0.23,0);arrowShape.lineTo(0.02,0.22);arrowShape.lineTo(0.02,0.12);arrowShape.lineTo(-0.16,0.12);arrowShape.closePath();
  for(const [cell,direction] of game.conveyors){
    const [x,y]=cell.split(',').map(Number);
    const group=new THREE.Group();group.position.copy(world({x,y}));
    const plate=rounded(0.96,0.018,0.82,0.03,beltMat);plate.position.y=0.015;group.add(plate);
    for(const offset of [-0.19,0.19]){
      const arrow=mesh(new THREE.ShapeGeometry(arrowShape),beltArrowMat,false);
      arrow.rotation.x=-Math.PI/2;arrow.position.set(offset,0.029,0);arrow.scale.setScalar(0.65);
      if(direction==='left')arrow.scale.x*=-1;
      group.add(arrow);
    }
    conveyorVisuals.add(group);
  }
}
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
function foundryWall(){
  const g=new THREE.Group();
  const body=rounded(0.91,0.86,0.91,0.075,foundrySteel);body.position.y=0.43;g.add(body);
  const top=rounded(0.93,0.13,0.93,0.035,foundryTrim);top.position.y=0.88;g.add(top);
  const core=rounded(0.66,0.025,0.66,0.012,foundrySteel);core.position.y=0.96;g.add(core);
  for(const x of [-0.37,0.37])for(const z of [-0.37,0.37]){
    const bolt=mesh(new THREE.CylinderGeometry(0.046,0.046,0.025,8),foundryGold);bolt.position.set(x,0.97,z);g.add(bolt);
  }
  const strip=rounded(0.5,0.07,0.02,0.015,foundryTrim);strip.position.set(0,0.5,0.464);g.add(strip);
  return g;
}
function foundryCrate(x:number,y:number,portal=false){
  const g=new THREE.Group();
  const drum=(x*5+y*7)%3===0&&!portal;
  if(drum){
    const body=mesh(new THREE.CylinderGeometry(0.34,0.37,0.68,16),foundryGold);body.position.y=0.38;g.add(body);
    for(const level of [0.12,0.68]){const ring=mesh(new THREE.CylinderGeometry(0.39,0.39,0.06,16),foundryTrim);ring.position.y=level;g.add(ring);}
    const lid=mesh(new THREE.CylinderGeometry(0.29,0.29,0.03,16),foundryGold);lid.position.y=0.725;g.add(lid);
  }else{
    const body=rounded(0.84,0.72,0.84,0.06,foundryGold);body.position.y=0.38;g.add(body);
    const panel=rounded(0.62,0.54,0.045,0.025,foundrySteel);panel.position.set(0,0.4,0.425);g.add(panel);
    const window=rounded(0.36,0.22,0.05,0.025,foundryGlow);window.position.set(0,0.43,0.454);g.add(window);
    const lid=rounded(0.86,0.08,0.86,0.025,foundryGold);lid.position.y=0.78;g.add(lid);
    if(portal){const beacon=mesh(new THREE.OctahedronGeometry(0.12,0),foundryGlow,false);beacon.position.y=0.92;g.add(beacon);}
  }
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
function bombVariant(bomb:Bomb):BombVariant{return bomb.owner!==undefined?'enemy':bomb.pierce?'super':bomb.slime?'slime':bomb.remote?'remote':bomb.range>=9?'power':bomb.range>2?'boosted':'normal';}
function bombObject(bomb:Bomb){
  const g=new THREE.Group();
  const variant=bombVariant(bomb);
  const accent=bombAccent[variant],color=bombColors[variant];
  const art=bombModels.get(variant)?.clone(true)??null;
  let face:THREE.Object3D;
  let fuseCurve:THREE.Curve<THREE.Vector3>;
  if(art){
    g.add(art);art.updateMatrixWorld(true);
    face=art.getObjectByName('indicator')??art;
    const tip=art.getObjectByName('ember tip')?.getWorldPosition(new THREE.Vector3())??new THREE.Vector3(0.15,1.05,0);
    fuseCurve=new THREE.CatmullRomCurve3([
      new THREE.Vector3(0,tip.y-0.22,0),new THREE.Vector3(0.03,tip.y-0.15,0),
      new THREE.Vector3(tip.x*0.72,tip.y-0.07,0),tip,
    ]);
  }else{
    // Technical fallback while standalone GLBs are loading.
    const base=mesh(new THREE.CylinderGeometry(0.35,0.35,0.065,24),bombCap);base.position.y=0.045;g.add(base);
    const body=mesh(new THREE.SphereGeometry(0.355,24,18),bombMat);body.position.y=0.39;g.add(body);
    const highlight=mesh(new THREE.SphereGeometry(0.16,16,12),bombHighlight,false);highlight.scale.set(1,0.48,0.13);highlight.position.set(-0.13,0.55,0.31);g.add(highlight);
    const lowerBand=mesh(new THREE.TorusGeometry(0.335,0.033,8,32),accent);lowerBand.rotation.x=Math.PI/2;lowerBand.position.y=0.29;g.add(lowerBand);
    const upperBand=mesh(new THREE.TorusGeometry(0.335,0.018,8,32),bombCap);upperBand.rotation.x=Math.PI/2;upperBand.position.y=0.47;g.add(upperBand);
    face=mesh(new THREE.CircleGeometry(0.125,24),accent,false);face.position.set(0,0.39,0.352);g.add(face);
    const core=mesh(new THREE.CircleGeometry(0.064,20),bombCore,false);core.position.set(0,0.39,0.355);g.add(core);
    for(const x of [-0.19,0.19]){const rivet=mesh(new THREE.SphereGeometry(0.028,8,6),bombCap,false);rivet.position.set(x,0.39,0.306);g.add(rivet);}
    const collar=mesh(new THREE.CylinderGeometry(0.155,0.2,0.13,16),bombCap);collar.position.y=0.72;g.add(collar);
    const socket=mesh(new THREE.CylinderGeometry(0.09,0.105,0.04,16),accent);socket.position.y=0.81;g.add(socket);
    fuseCurve=new THREE.CatmullRomCurve3([new THREE.Vector3(0,0.82,0),new THREE.Vector3(0.03,0.9,0),new THREE.Vector3(0.11,0.97,0),new THREE.Vector3(0.15,1.06,0)]);
    const fuse=mesh(new THREE.TubeGeometry(fuseCurve,14,0.039,7,false),bombFuseMat,false);g.add(fuse);
  }
  const halo=mesh(new THREE.TorusGeometry(0.41,0.022,6,28),accent,false);halo.rotation.x=Math.PI/2;halo.position.y=0.06;g.add(halo);
  const warningRing=mesh(new THREE.RingGeometry(0.39,0.52,32),new THREE.MeshBasicMaterial({color,transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide}),false);
  warningRing.rotation.x=-Math.PI/2;warningRing.position.y=0.025;g.add(warningRing);
  const fuseSpark=new THREE.Sprite(fxMaterial(fxTextures.flame,'#ffe5a0',0.65));
  fuseSpark.position.copy(fuseCurve.getPoint(1));fuseSpark.scale.set(0.19,0.23,1);g.add(fuseSpark);
  const point=new THREE.PointLight(color,0.25,1.6);point.position.y=0.87;g.add(point);
  g.userData={face,faceBaseScale:face.scale.clone(),art,halo,warningRing,fuseSpark,fuseCurve,point,variant};
  return g;
}
function disposeBombObject(object:THREE.Object3D){
  for(const child of object.children)if(child!==object.userData.art)disposeVisualGeometry(child);
  ((object.userData.warningRing as THREE.Mesh).material as THREE.Material).dispose();
  (object.userData.fuseSpark as THREE.Sprite).material.dispose();
}
type FireParts={marker:THREE.Mesh;ground:THREE.Mesh;flame:THREE.Mesh<THREE.PlaneGeometry,THREE.ShaderMaterial>;outer:THREE.Sprite;core:THREE.Sprite;smoke:THREE.Sprite;arc:THREE.Sprite|null;light:THREE.PointLight|null;chargeRing:THREE.Mesh|null};
const flameVertexShader=`
  varying vec2 vUv;
  void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}
`;
const flameFragmentShader=`
  varying vec2 vUv;
  uniform vec3 uEdge;
  uniform vec3 uCore;
  uniform float uTime;
  uniform float uOpacity;
  uniform float uCenter;
  uniform float uSeed;
  void main(){
    vec2 p=(vUv-0.5)*2.0;
    float wave=0.105*sin(p.x*18.0-uTime*19.0+uSeed)+0.05*sin(p.x*37.0+uTime*28.0+uSeed*1.7);
    float width=0.76-0.12*abs(p.x)+wave;
    float lane=1.0-smoothstep(width-0.17,width+0.04,abs(p.y));
    lane*=1.0-smoothstep(0.88,1.08,abs(p.x));
    float radius=length(p*vec2(1.0,1.05));
    float burst=1.0-smoothstep(0.65+wave,0.94+wave,radius);
    float shape=mix(lane,burst,uCenter);
    float center=mix(1.0-smoothstep(0.05,0.35,abs(p.y)),1.0-smoothstep(0.12,0.65,radius),uCenter);
    float pulse=0.82+0.18*sin(uTime*25.0+p.x*13.0+uSeed);
    vec3 color=mix(uEdge,uCore,0.2+0.75*center);
    gl_FragColor=vec4(color,shape*uOpacity*pulse);
  }
`;
function fireObject(kind:BlastKind,cell:BlastCell|undefined){
  const g=new THREE.Group();
  const palette=blastPalette[kind];
  const center=!cell?.direction;
  // The full danger footprint is visible from the same frame in which the game applies damage.
  const marker=mesh(new THREE.PlaneGeometry(0.96,0.96),new THREE.MeshBasicMaterial({color:palette.edge,transparent:true,opacity:0.17,depthWrite:false,side:THREE.DoubleSide}),false);
  marker.rotation.x=-Math.PI/2;marker.position.y=0.016;g.add(marker);
  const ground=mesh(new THREE.PlaneGeometry(1.12,1.12),new THREE.MeshBasicMaterial({map:fxTextures.fire,color:palette.edge,transparent:true,opacity:0.5,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide}),false);
  ground.rotation.x=-Math.PI/2;ground.position.y=0.027;g.add(ground);
  const angle=cell?.direction==='up'?-Math.PI/2:cell?.direction==='down'?Math.PI/2:cell?.direction==='left'?Math.PI:0;
  const material=new THREE.ShaderMaterial({vertexShader:flameVertexShader,fragmentShader:flameFragmentShader,uniforms:{uEdge:{value:new THREE.Color(palette.edge)},uCore:{value:new THREE.Color(palette.core)},uTime:{value:0},uOpacity:{value:0},uCenter:{value:center?1:0},uSeed:{value:Math.abs((cell?.x??0)*13+(cell?.y??0)*7)%11}},transparent:true,depthWrite:false,side:THREE.DoubleSide});
  const flame=new THREE.Mesh(new THREE.PlaneGeometry(center?1.1:1.28,center?1.1:1.05),material);
  flame.rotation.set(-Math.PI/2,0,angle);flame.position.y=0.055;g.add(flame);
  const outer=new THREE.Sprite(fxMaterial(fxTextures.fire,palette.edge,0));
  outer.position.y=0.38;outer.scale.set(center?1.45:1.35,center?1.2:1.1,1);g.add(outer);
  const core=new THREE.Sprite(fxMaterial(fxTextures.fire,palette.core,0));
  core.position.y=0.5;core.scale.set(center?1.15:1.05,center?0.95:0.9,1);g.add(core);
  const smoke=new THREE.Sprite(fxMaterial(fxTextures.smoke,'#49556a',0,false));
  smoke.position.y=0.43;smoke.scale.set(0.76,0.63,1);g.add(smoke);
  let arc:THREE.Sprite|null=null;
  if(kind==='chain'){
    arc=new THREE.Sprite(fxMaterial(fxTextures.spark,'#f1b9ff',0));
    arc.position.y=0.52;arc.scale.set(0.85,0.85,1);g.add(arc);
  }
  let light:THREE.PointLight|null=null;
  if(center){light=new THREE.PointLight(palette.core,0,3.6,2);light.position.y=0.8;g.add(light);}
  let chargeRing:THREE.Mesh|null=null;
  if(kind==='powered'&&center){
    chargeRing=mesh(new THREE.TorusGeometry(0.32,0.045,7,24),new THREE.MeshBasicMaterial({color:palette.core,transparent:true,opacity:0.76,blending:THREE.AdditiveBlending,depthWrite:false}),false);
    chargeRing.rotation.x=Math.PI/2;chargeRing.position.y=0.16;g.add(chargeRing);
  }
  g.userData={kind,parts:{marker,ground,flame,outer,core,smoke,arc,light,chargeRing} satisfies FireParts,cell};
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
  const shadow=mesh(new THREE.CircleGeometry(0.41,24),pickupShadowMat,false);shadow.rotation.x=-Math.PI/2;shadow.position.y=0.01;g.add(shadow);
  const icon=new THREE.Group();icon.position.y=0.17;g.add(icon);
  const base=rounded(0.9,0.16,0.9,0.09,accent);base.position.y=0;icon.add(base);
  const rim=rounded(0.84,0.035,0.84,0.06,pickupFrame);rim.position.y=0.096;icon.add(rim);
  const face=mesh(new THREE.PlaneGeometry(0.93,0.93),upgradeIconMats[type],false);face.position.y=0.66;icon.add(face);
  g.userData.icon=icon;g.userData.face=face;
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
const cartObjects=new Map<number,THREE.Object3D>();
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
function crateBurst(x:number,y:number){
  const origin=world({x,y});
  for(let i=0;i<9;i++){
    const colors=game.map==='foundry'?['#f1bd70','#8a9ba9','#71d7df']:['#e6a473','#a56543','#c88557'];
    const material=new THREE.MeshBasicMaterial({color:colors[i%3],transparent:true,opacity:1,depthWrite:false});
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
let graveyardEnemyTemplate:GLTF|null=null;
let playerLoadRequest=0;
const playerShadow=mesh(new THREE.CircleGeometry(0.44,20),new THREE.MeshBasicMaterial({color:'#121e39',transparent:true,opacity:0.3}),false);
playerShadow.rotation.x=-Math.PI/2; playerShadow.position.y=0.004;actors.add(playerShadow);
const key=(x:number,y:number)=>Game.key(x,y);
function applyEnemyArt(group:THREE.Group,id:number){
  const template=game.map==='graveyard'?(graveyardEnemyTemplate??enemyTemplate):enemyTemplate;
  if(!template)return;
  const old=enemyArt.get(id);if(old)old.mixer.stopAllAction();
  const art=makeAnimatedArt(template);group.clear();group.add(art.model);enemyArt.set(id,art);
}
const assetLoader=new GLTFLoader();
const remotePlayers=new Map<string,RoomPlayer>();
const remotePlayerObjects=new Map<string,THREE.Group>();
const remotePlayerArt=new Map<string,AnimatedArt>();
const remoteTemplates=new Map<string,Promise<GLTF>>();
function characterAsset(character:string){
  let template=remoteTemplates.get(character);
  if(!template){template=assetLoader.loadAsync(`/assets/kenney/characters/${character}.glb`);remoteTemplates.set(character,template);}
  return template;
}
let lobbyConnection:LobbyConnection|null=null;
let lobbyCode='';
let lobbySelfId='';
let lobbyHostId='';
let roomPlayers:RoomPlayer[]=[];
let roomSettings:RoomSettings={map:'courtyard',cpu:false};
let roomPhase:'practice'|'match'='practice';
let matchResultVisible=false;
let remoteBombId=0;
let positionSendTimer=0;
let lastPositionPayload='';
let lastPositionSentAt=0;
let worldSendTimer=0;
let outSent=false;
function removeRemotePlayer(id:string){
  remotePlayers.delete(id);
  const object=remotePlayerObjects.get(id);
  if(object){actors.remove(object);remotePlayerObjects.delete(id);}
  remotePlayerArt.get(id)?.mixer.stopAllAction();remotePlayerArt.delete(id);
}
function clearRemotePlayers(){for(const id of [...remotePlayers.keys()])removeRemotePlayer(id);}
function updateLobbyStatus(){
  document.querySelector('#lobby-room-code')!.textContent=lobbyCode;
  const ready=roomPlayers.filter(player=>player.ready).length;
  document.querySelector('#lobby-room-status')!.textContent=roomPhase==='match'?`${mapNames[roomSettings.map]} · ${roomPlayers.filter(player=>!player.eliminated).length} Spieler${roomSettings.cpu?' + CPU':''} im Match`:`Verbunden · ${roomPlayers.length}/8 Spieler · ${ready}/${roomPlayers.length} bereit`;
  lobbyMatchPanel.classList.toggle('hidden',roomPhase!=='practice'||matchResultVisible);
  lobbyMap.value=roomSettings.map;lobbyAddCpu.checked=roomSettings.cpu;
  const isHost=lobbySelfId===lobbyHostId;
  lobbyMap.disabled=!isHost;lobbyAddCpu.disabled=!isHost;
  const self=roomPlayers.find(player=>player.id===lobbySelfId);
  lobbyReadyButton.textContent=self?.ready?'NICHT MEHR READY':'READY';
  lobbyReadyButton.setAttribute('aria-pressed',String(!!self?.ready));
  lobbyStartButton.classList.toggle('hidden',!isHost);
  lobbyStartButton.disabled=roomPlayers.length<2&&!roomSettings.cpu||!roomPlayers.every(player=>player.ready);
  document.querySelector<HTMLButtonElement>('#lobby-share')!.classList.toggle('hidden',roomPhase==='match');
  lobbyReadyList.replaceChildren();
  for(const [index,player] of roomPlayers.entries()){
    const badge=document.createElement('span');
    badge.className=player.ready?'ready':'not-ready';
    const name=characters.find(character=>character.id===player.character)?.name??`Spieler ${index+1}`;
    badge.textContent=`${player.id===lobbyHostId?'★ ':''}${name}${player.id===lobbySelfId?' (du)':''} · ${player.ready?'READY':'WARTET'}`;
    lobbyReadyList.append(badge);
  }
}
function upsertRemotePlayer(player:RoomPlayer){
  if(player.id===lobbySelfId)return;
  remotePlayers.set(player.id,player);
  if(remotePlayerObjects.has(player.id))return;
  const object=new THREE.Group();actors.add(object);remotePlayerObjects.set(player.id,object);
  void characterAsset(player.character).then(gltf=>{
    if(remotePlayerObjects.get(player.id)!==object)return;
    const art=makeAnimatedArt(gltf);object.add(art.model);remotePlayerArt.set(player.id,art);
  }).catch(error=>console.warn('Remote character asset unavailable',error));
  updateLobbyStatus();
}
function addRemoteBomb(bomb:RoomBomb){
  if(game.bombs.some(existing=>existing.networkId===bomb.networkId))return;
  game.bombs.push({id:--remoteBombId,networkId:bomb.networkId,remoteOwner:bomb.ownerId,x:bomb.x,y:bomb.y,fuse:bomb.fuse,range:bomb.range,ownerPass:false,remote:bomb.remote,pierce:bomb.pierce,slime:bomb.slime});
}
let practiceUpgrades:typeof game.upgrades=[];
function applyRoomState(message:Extract<RoomMessage,{type:'room'}>){
  roomPlayers=message.players;lobbyHostId=message.hostId;roomSettings=message.settings;roomPhase=message.phase;
  practiceUpgrades=message.upgrades;
  for(const id of [...remotePlayers.keys()])if(!roomPlayers.some(player=>player.id===id))removeRemotePlayer(id);
  for(const player of roomPlayers)upsertRemotePlayer(player);
  if(game.map==='lobby'&&!matchResultVisible)game.upgrades=practiceUpgrades;
  if(game.onlineMatch)game.onlineMatchGuest=lobbySelfId!==lobbyHostId;
  updateLobbyStatus();
}
function beginOnlineMatch(message:Extract<RoomMessage,{type:'start'}>){
  roomSettings=message.settings;roomPlayers=message.players;roomPhase='match';matchResultVisible=false;outSent=false;
  prepareMap(message.settings.map,message.seed,true);
  game.difficulty='easy';
  game.player.lives=1;
  game.enemies=message.settings.cpu?game.enemies.slice(0,1):[];
  if(game.enemies[0])Object.assign(game.enemies[0],{x:6,y:5,targetX:6,targetY:5});
  const self=roomPlayers.find(player=>player.id===lobbySelfId);
  if(self)Object.assign(game.player,{x:self.x,y:self.y,facing:self.facing});
  clearRemotePlayers();for(const player of roomPlayers)upsertRemotePlayer(player);
  game.start();stage.classList.add('game-active');result.classList.add('hidden');lobbyToolbar.classList.remove('hidden');
  positionSendTimer=0;lastPositionPayload='';worldSendTimer=0;
  updateLobbyStatus();updateHud();showToast(`${mapNames[roomSettings.map].toUpperCase()} · MATCH GESTARTET!`);
}
function returnToPractice(){
  if(!lobbyConnection||roomPhase!=='practice')return;
  matchResultVisible=false;outSent=false;prepareMap('lobby');game.start();
  const self=roomPlayers.find(player=>player.id===lobbySelfId);
  if(self)Object.assign(game.player,{x:self.x,y:self.y,facing:self.facing});
  clearRemotePlayers();for(const player of roomPlayers)upsertRemotePlayer(player);
  game.upgrades=practiceUpgrades;
  positionSendTimer=0;lastPositionPayload='';
  result.classList.add('hidden');stage.classList.add('game-active');lobbyToolbar.classList.remove('hidden');
  updateLobbyStatus();updateHud();
}
function showOnlineResult(winnerId:string|null){
  matchResultVisible=true;
  roomPhase='practice';
  const won=winnerId===lobbySelfId;
  document.querySelector('#result-kicker')!.textContent='ONLINE-MATCH BEENDET';
  document.querySelector('#result-title')!.textContent=won?'DU HAST GEWONNEN!':winnerId?'MATCH VORBEI':'UNENTSCHIEDEN';
  const winner=roomPlayers.find(player=>player.id===winnerId);
  const winnerName=winner?characters.find(character=>character.id===winner.character)?.name??'Ein Spieler':null;
  document.querySelector('#result-copy')!.textContent=won?'Stark gespielt! Die nächste Runde kannst du in der Lobby vorbereiten.':winnerName?`${winnerName} hat die Runde gewonnen.`:'Alle wurden erwischt.';
  document.querySelector<HTMLButtonElement>('#restart-button')!.textContent='ZUR LOBBY';
  stage.classList.remove('game-active');result.classList.remove('hidden');lobbyMatchPanel.classList.add('hidden');
}
function handleLobbyMessage(message:RoomMessage){
  if(!lobbyConnection)return;
  if(message.type==='room'){applyRoomState(message);return;}
  if(message.type==='start'){beginOnlineMatch(message);return;}
  if(message.type==='ended'){showOnlineResult(message.winnerId);return;}
  if(message.type==='world'&&game.onlineMatchGuest){
    let changed=false;
    for(let y=0;y<HEIGHT;y++)for(let x=0;x<WIDTH;x++)if(game.tiles[y][x]!==message.tiles[y]?.[x]){game.tiles[y][x]=message.tiles[y][x];changed=true;}
    if(changed)syncStatic();
    game.upgrades=message.upgrades;game.enemies=message.enemies;
    game.cannonShots=message.cannonShots;game.cannonWarning=message.cannonWarning;
    return;
  }
  if(message.type==='player'){
    const index=roomPlayers.findIndex(player=>player.id===message.player.id);
    if(index>=0)roomPlayers[index]=message.player;
    upsertRemotePlayer(message.player);
  }
  if(message.type==='left')removeRemotePlayer(message.id);
  if(message.type==='upgrades'&&game.map==='lobby')game.upgrades=message.upgrades;
  if(message.type==='pickup'&&game.onlineMatch)game.upgrades=game.upgrades.filter(item=>item.x!==message.x||item.y!==message.y);
  if(message.type==='bomb')addRemoteBomb(message.bomb);
  if(message.type==='bombMove'){
    const bomb=game.bombs.find(existing=>existing.networkId===message.networkId);
    if(bomb){bomb.x=message.x;bomb.y=message.y;}
  }
  if(message.type==='detonate'){
    const bomb=game.bombs.find(existing=>existing.networkId===message.networkId);
    if(bomb){bomb.remote=false;bomb.fuse=0;}
  }
}
type TileProp='wall'|'wood-structure'|'barrel'|'chest';
const tileModels=new Map<TileProp,THREE.Object3D>();
type MarketProp='column'|'floor'|'shelf-boxes'|'shelf-bags'|'shelf-end'|'freezer'|'freezers-standing'|'cash-register'|'display-fruit'|'display-bread'|'shopping-cart'|'shopping-basket';
const marketModels=new Map<MarketProp,THREE.Object3D>();
type GraveyardProp='stone-wall-column'|'altar-stone'|'crypt-small'|'coffin'|'coffin-old'|'pumpkin'|'pumpkin-tall'|'grave-border'|'character-ghost'|'lantern-glass'|'floor-road';
const graveyardModels=new Map<GraveyardProp,THREE.Object3D>();
type PirateProp='barrel'|'cannon-ball'|'cannon'|'castle-wall'|'chest'|'crate-bottles'|'crate'|'flag-pirate'|'floor-planks'|'rocks-a'|'rocks-b'|'tower-base';
const pirateModels=new Map<PirateProp,THREE.Object3D>();
const cannonShotObjects=new Map<number,THREE.Object3D>();
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
async function loadBombAssets(){
  await Promise.all((Object.keys(bombColors) as BombVariant[]).map(async variant=>{
    try{
      const gltf=await assetLoader.loadAsync(`/assets/blastbound/bombs/${variant}.glb`);
      const width=variant==='super'?0.97:variant==='power'?0.91:0.83;
      bombModels.set(variant,prepareTileModel(gltf,width,1.08));
    }catch(error){console.warn(`Blastbound ${variant} bomb asset unavailable`,error);}
  }));
  for(const obj of bombObjects.values()){props.remove(obj);disposeBombObject(obj);}
  bombObjects.clear();
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
  if(game.map==='courtyard'||game.map==='lobby')rebuildStaticProps();
}
async function loadMarketAssets(){
  const assets:[MarketProp,number,number][]=[
    ['column',0.9,1.18],['floor',1,0.05],['shelf-boxes',0.88,0.88],['shelf-bags',0.88,0.88],
    ['shelf-end',0.88,0.88],['freezer',0.88,0.6],['freezers-standing',0.88,0.94],
    ['cash-register',0.88,0.72],['display-fruit',0.84,0.72],['display-bread',0.84,0.72],
    ['shopping-cart',0.78,0.72],['shopping-basket',0.78,0.7],
  ];
  await Promise.all(assets.map(async ([name,width,height])=>{
    try{
      const gltf=await assetLoader.loadAsync(`/assets/kenney/market/${name}.glb`);
      marketModels.set(name,prepareTileModel(gltf,width,height));
    }catch(error){console.warn(`Kenney market ${name} asset unavailable`,error);}
  }));
  const floor=marketModels.get('floor');
  if(floor){
    // Keep the Kenney tile's geometry and color pattern; only lower its surface value.
    floor.traverse(child=>{
      if(!(child instanceof THREE.Mesh))return;
      const shade=(material:THREE.Material)=>{
        if(!(material instanceof THREE.MeshStandardMaterial))return material;
        const shaded=material.clone();shaded.color.multiply(new THREE.Color('#667c73'));
        return shaded;
      };
      child.material=Array.isArray(child.material)?child.material.map(shade):shade(child.material);
    });
    marketFloor.clear();
    for(let y=0;y<HEIGHT;y++)for(let x=0;x<WIDTH;x++){
      const cell=floor.clone(true);cell.position.set(x-6,-0.03,y-5);marketFloor.add(cell);
    }
  }
  applyMapTheme();
  if(game.map==='market')rebuildStaticProps();
}
async function loadGraveyardAssets(){
  const assets:[GraveyardProp,string,number,number][]=[
    ['stone-wall-column','stone-wall-column',0.93,0.96],['altar-stone','altar-stone',0.91,0.9],
    ['crypt-small','crypt-small',0.93,1.05],['coffin','coffin',0.86,0.72],
    ['coffin-old','coffin-old',0.86,0.72],['pumpkin','pumpkin',0.83,0.7],
    ['pumpkin-tall','pumpkin-tall',0.83,0.78],['grave-border','grave-border',0.9,0.13],
    ['character-ghost','character-ghost',0.67,0.77],['lantern-glass','lantern-glass',0.3,0.38],
    ['floor-road','floor/road',1,0.06],
  ];
  await Promise.all(assets.map(async ([name,path,width,height])=>{
    try{
      const gltf=await assetLoader.loadAsync(`/assets/kenney/graveyard/${path}.glb`);
      graveyardModels.set(name,prepareTileModel(gltf,width,height));
    }catch(error){console.warn(`Kenney graveyard ${name} asset unavailable`,error);}
  }));
  try{
    graveyardEnemyTemplate=await assetLoader.loadAsync('/assets/kenney/graveyard/character-skeleton.glb');
    if(game.map==='graveyard')for(const [id,obj] of enemyObjects)applyEnemyArt(obj,id);
  }catch(error){console.warn('Kenney graveyard skeleton unavailable',error);}
  const floor=graveyardModels.get('floor-road');
  if(floor){
    floor.traverse(child=>{
      if(!(child instanceof THREE.Mesh))return;
      const shade=(material:THREE.Material)=>{
        if(!(material instanceof THREE.MeshStandardMaterial))return material;
        const shaded=material.clone();shaded.color.multiply(new THREE.Color('#87948c'));
        return shaded;
      };
      child.material=Array.isArray(child.material)?child.material.map(shade):shade(child.material);
    });
    graveyardFloor.clear();
    for(let y=0;y<HEIGHT;y++)for(let x=0;x<WIDTH;x++){
      const cell=floor.clone(true);cell.position.set(x-6,-0.03,y-5);graveyardFloor.add(cell);
    }
  }
  ghostGraveVisuals.clear();
  const border=graveyardModels.get('grave-border'),ghost=graveyardModels.get('character-ghost'),lantern=graveyardModels.get('lantern-glass');
  if(border&&ghost)for(const grave of [{x:3,y:3},{x:9,y:7}]){
    const marker=new THREE.Group();marker.position.copy(world(grave));
    marker.add(border.clone(true));
    const apparition=cloneSkeleton(ghost);apparition.position.y+=0.19;marker.add(apparition);
    if(lantern){const lamp=lantern.clone(true);lamp.position.set(0.31,0.02,0.29);marker.add(lamp);}
    const light=new THREE.PointLight('#a9f3ce',1.25,2.4);light.position.y=0.38;marker.add(light);
    marker.userData={grave,apparition};ghostGraveVisuals.add(marker);
  }
  applyMapTheme();
  if(game.map==='graveyard')rebuildStaticProps();
}
async function loadPirateAssets(){
  const assets:[PirateProp,number,number][]=[
    ['barrel',0.83,0.78],['cannon-ball',0.44,0.44],['cannon',0.86,0.78],
    ['castle-wall',0.93,0.96],['chest',0.84,0.72],['crate-bottles',0.86,0.78],
    ['crate',0.87,0.76],['flag-pirate',0.32,0.62],
    ['floor-planks',1.02,0.09],['rocks-a',0.92,0.9],['rocks-b',0.92,0.9],['tower-base',0.93,0.98],
  ];
  await Promise.all(assets.map(async ([name,width,height])=>{
    try{
      const path=name==='floor-planks'?'floor/planks':name;
      const gltf=await assetLoader.loadAsync(`/assets/kenney/pirate/${path}.glb`);
      pirateModels.set(name,prepareTileModel(gltf,width,height));
    }catch(error){console.warn(`Kenney pirate ${name} asset unavailable`,error);}
  }));
  const floor=pirateModels.get('floor-planks');
  if(floor){
    floor.traverse(child=>{
      if(!(child instanceof THREE.Mesh))return;
      const tint=(material:THREE.Material)=>{
        if(!(material instanceof THREE.MeshStandardMaterial))return material;
        const shaded=material.clone();shaded.color.multiply(new THREE.Color('#ae9680'));shaded.roughness=0.88;
        return shaded;
      };
      child.material=Array.isArray(child.material)?child.material.map(tint):tint(child.material);
      child.receiveShadow=true;
    });
    pirateFloor.clear();
    for(let y=0;y<HEIGHT;y++)for(let x=0;x<WIDTH;x++){
      const cell=floor.clone(true);cell.position.set(x-6,-0.03,y-5);pirateFloor.add(cell);
    }
  }
  cannonWarningVisuals.clear();
  for(const lane of [{x:2,y:3},{x:10,y:7}]){
    const signals=new THREE.Group();signals.userData.lane=lane.y===3?0:1;
    for(let x=3;x<=9;x++){
      const warning=new THREE.Sprite(fxMaterial(fxTextures.flare,'#ff7a36',0.9));
      warning.position.set(x-6,0.29,lane.y-5);warning.scale.set(1.3,1.3,1);signals.add(warning);
    }
    signals.visible=false;cannonWarningVisuals.add(signals);
  }
  applyMapTheme();
  if(game.map==='pirate')rebuildStaticProps();
}
function rebuildStaticProps(){
  for(const obj of tileObjects.values())removeTileObject(obj);
  tileObjects.clear();syncStatic();
}
function tileModel(x:number,y:number,tile:1|2){
  if(game.map==='foundry'){
    const model=tile===1?foundryWall():foundryCrate(x,y,x===game.portal.x&&y===game.portal.y);
    model.userData.procedural=true;return model;
  }
  if(game.map==='market'){
    const variant=(x*7+y*11+x*y*3)%8;
    const name:MarketProp=tile===1?(x===2&&y===3||x===10&&y===7?'cash-register':'column'):x===game.portal.x&&y===game.portal.y?'shopping-basket':
      (['shelf-boxes','shelf-bags','shelf-end','freezer','display-fruit','shelf-boxes','display-bread','freezers-standing'] as const)[variant];
    const template=marketModels.get(name);
    if(!template)return tile===1?stoneBlock():crate();
    const model=template.clone(true);
    if(tile===2)model.rotation.y=((x+y)%2)*Math.PI/2;
    return model;
  }
  if(game.map==='graveyard'){
    const corner=(x===0||x===WIDTH-1)&&(y===0||y===HEIGHT-1);
    const variant=(x*7+y*11+x*y*3)%7;
    const name:GraveyardProp=tile===1?(corner?'crypt-small':(x+y)%9===0?'altar-stone':'stone-wall-column'):
      x===game.portal.x&&y===game.portal.y?'coffin-old':
      (['coffin','coffin-old','pumpkin','coffin','pumpkin-tall','coffin-old','coffin'] as const)[variant];
    const template=graveyardModels.get(name);
    if(!template)return tile===1?stoneBlock():crate();
    const group=new THREE.Group(),model=template.clone(true);
    model.rotation.y=((x+y)%2)*Math.PI/2;group.add(model);
    if(tile===2&&x===game.portal.x&&y===game.portal.y){
      const lamp=graveyardModels.get('lantern-glass')?.clone(true);
      if(lamp){lamp.position.set(0,0.57,0);group.add(lamp);}
    }
    return group;
  }
  if(game.map==='pirate'){
    const cannon=game.cannonLanes.find(lane=>lane.x===x&&lane.y===y);
    const corner=(x===0||x===WIDTH-1)&&(y===0||y===HEIGHT-1);
    const variant=(x*7+y*11+x*y*3)%9;
    const name:PirateProp=tile===1?(cannon?'cannon':corner?'tower-base':variant===0?'rocks-a':variant===4?'rocks-b':'castle-wall'):
      x===game.portal.x&&y===game.portal.y?'chest':
      (['crate','barrel','crate-bottles','crate','barrel','crate','crate-bottles','crate','barrel'] as const)[variant];
    const template=pirateModels.get(name);
    if(!template)return tile===1?stoneBlock():crate();
    const group=new THREE.Group(),model=template.clone(true);
    model.rotation.y=cannon?(cannon.direction==='right'?-Math.PI/2:Math.PI/2):((x+y)%2)*Math.PI/2;
    group.add(model);
    if(cannon){
      const flag=pirateModels.get('flag-pirate')?.clone(true);
      if(flag){flag.position.set(cannon.direction==='right'?-0.26:0.26,0.28,0.28);group.add(flag);}
    }
    return group;
  }
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
function removeTileObject(object:THREE.Object3D){props.remove(object);if(object.userData.procedural)disposeVisualGeometry(object);}
async function loadPlayerArt(){
  const request=++playerLoadRequest;
  try{
    const gltf=await characterAsset(selectedCharacter);
    if(request!==playerLoadRequest)return;
    playerArt?.mixer.stopAllAction();
    playerArt=makeAnimatedArt(gltf);playerObject.clear();playerObject.add(playerArt.model);
  }catch(error){
    if(request!==playerLoadRequest)return;
    console.warn('Kenney player asset unavailable',error);
    playerArt?.mixer.stopAllAction();playerArt=null;
    playerObject.clear();playerObject.add(character('#24cbbd','#9cf9e6'));
  }
}
function renderCharacterOptions(){
  for(const container of [characterOptions,lobbyCharacterOptions])for(const character of characters){
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
      for(const option of document.querySelectorAll<HTMLButtonElement>('#character-options button, #lobby-character-options button'))
        option.setAttribute('aria-pressed',String(option.dataset.character===selectedCharacter));
      void loadPlayerArt();
    });
    container.append(button);
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
function renderMapOptions(){
  const introCopy=document.querySelector<HTMLElement>('#intro-copy')!;
  const updateCopy=()=>{introCopy.textContent=selectedMap==='foundry'?'Sprenge Energiecontainer. Auf den markierten Förderbändern fahren gelegte Bomben weiter.':selectedMap==='market'?'Räume die Regale frei. Einkaufswagen nehmen Bomben auf und fahren sie durch zwei Kassenbahnen.':selectedMap==='graveyard'?'Sprenge Särge und Kürbisse. Bomben auf einem Spukgrab erscheinen am zweiten Grab – mit laufendem Zünder.':selectedMap==='pirate'?'Sprenge Kisten und Fässer. Achte auf die Warnlichter: Die Kanonen feuern abwechselnd durch freie Gänge.':'Sprenge Holzkisten und Fässer, locke Gegner in die Kreuzexplosion und erreiche das Portal.';};
  for(const button of mapOptions.querySelectorAll<HTMLButtonElement>('[data-map]')){
    const map=button.dataset.map as ArenaMap;
    button.setAttribute('aria-pressed',String(map===selectedMap));
    button.addEventListener('click',()=>{
      if(map===selectedMap)return;
      clearObjects();selectedMap=map;game.setMap(map);applyMapTheme();syncStatic();updateHud();
      mapHint.textContent=mapDescriptions[map];
      updateCopy();
      for(const option of mapOptions.querySelectorAll<HTMLButtonElement>('[data-map]'))option.setAttribute('aria-pressed',String(option.dataset.map===map));
      try{localStorage.setItem(mapStorageKey,map);}catch{ /* Selection still works for this visit. */ }
    });
  }
  mapHint.textContent=mapDescriptions[selectedMap];
  updateCopy();
}
async function loadKenneyAssets(){
  const [enemy]=await Promise.all([assetLoader.loadAsync('/assets/kenney/arena/character-soldier.glb'),...characters.map(character=>characterAsset(character.id))]);
  enemyTemplate=enemy;
  for(const [id,obj] of enemyObjects)applyEnemyArt(obj,id);
  await loadPlayerArt();
}
function syncStatic(){
  for(let y=0;y<HEIGHT;y++)for(let x=0;x<WIDTH;x++){
    const id=key(x,y),tile=game.tile(x,y),existing=tileObjects.get(id);
    if(game.map==='lobby'&&(x<2||x>10||y<1||y>9)){if(existing){removeTileObject(existing);tileObjects.delete(id);}continue;}
    if(tile===0){if(existing){removeTileObject(existing);tileObjects.delete(id);}continue;}
    if(existing)continue;
    const obj=tileModel(x,y,tile);obj.position.copy(world({x,y}));props.add(obj);tileObjects.set(id,obj);
  }
  if(game.map!=='lobby'&&!game.onlineMatch&&game.tile(game.portal.x,game.portal.y)===0 && !portalObjectRef){portalObjectRef=portalObject();portalObjectRef.position.copy(world(game.portal));props.add(portalObjectRef);}
  if((game.map==='lobby'||game.onlineMatch||game.tile(game.portal.x,game.portal.y)!==0) && portalObjectRef){props.remove(portalObjectRef);portalObjectRef=null;}
}
let playerMoving=false;
function syncDynamic(){
  const p=world(game.player),playerTarget=new THREE.Vector3(p.x,0,p.z);
  playerObject.rotation.y=facingYaw[game.player.facing];
  setAnimatedState(playerArt,playerMoving);
  playerObject.position.copy(playerTarget);playerShadow.position.x=playerObject.position.x;playerShadow.position.z=playerObject.position.z;
  playerObject.visible=!outSent&&(game.player.invincible<=0||Math.floor(performance.now()/90)%2===0);
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
  for(const [id,player] of remotePlayers){
    const obj=remotePlayerObjects.get(id);
    if(!obj)continue;
    const target=world(player);
    obj.position.lerp(target,0.34);
    obj.rotation.y=facingYaw[player.facing];
    setAnimatedState(remotePlayerArt.get(id)??null,player.moving);
  }
  for(const bomb of game.bombs){
    let obj=bombObjects.get(bomb.id);
    if(obj&&obj.userData.variant!==bombVariant(bomb)){props.remove(obj);disposeBombObject(obj);bombObjects.delete(bomb.id);obj=undefined;}
    if(!obj){obj=bombObject(bomb);obj.position.copy(world(bomb));props.add(obj);bombObjects.set(bomb.id,obj);}
    const age=BOMB_FUSE-bomb.fuse;
    const landing=Math.max(0,1-age/0.13);
    const warning=Math.max(0,Math.min(1,(0.72-bomb.fuse)/0.72));
    const shake=Math.max(0,Math.min(1,(0.26-bomb.fuse)/0.26));
    const time=performance.now()/1000;
    const bombTarget=world(bomb.carried?game.player:bomb);
    obj.position.x+=(bombTarget.x-obj.position.x)*0.32;
    obj.position.z+=(bombTarget.z-obj.position.z)*0.32;
    obj.position.y=landing*landing*0.13+(bomb.carried?0.65:0);
    obj.scale.set(1+landing*0.08+shake*0.026*Math.sin(time*55+bomb.id),1-landing*0.1,1+landing*0.08-shake*0.026*Math.sin(time*55+bomb.id));
    obj.rotation.z=shake*0.075*Math.sin(time*49+bomb.id);
    obj.rotation.x=shake*0.06*Math.sin(time*57+bomb.id*1.7);
    const onCart=game.map==='market'&&!bomb.carried&&game.conveyors.has(key(bomb.x,bomb.y));
    const cartTemplate=marketModels.get('shopping-cart');
    let cart=cartObjects.get(bomb.id);
    if(onCart&&cartTemplate){
      if(!cart){cart=cartTemplate.clone(true);props.add(cart);cartObjects.set(bomb.id,cart);}
      cart.position.set(obj.position.x,0.025,obj.position.z);
      cart.rotation.y=game.conveyors.get(key(bomb.x,bomb.y))==='left'?-Math.PI/2:Math.PI/2;
      obj.position.y+=0.22;
    }else if(cart){props.remove(cart);cartObjects.delete(bomb.id);}
    const face=obj.userData.face as THREE.Mesh;
    face.scale.copy(obj.userData.faceBaseScale as THREE.Vector3).multiplyScalar(0.94+warning*0.18*Math.max(0,Math.sin(time*(10+warning*20))));
    const halo=obj.userData.halo as THREE.Mesh;
    halo.visible=warning>0.02;
    halo.scale.setScalar(0.9+warning*0.25);
    const warningRing=obj.userData.warningRing as THREE.Mesh;
    (warningRing.material as THREE.MeshBasicMaterial).opacity=warning*0.72*(0.72+0.28*Math.sin(time*(10+warning*18)));
    warningRing.scale.setScalar(0.86+warning*0.24);
    const fuseSpark=obj.userData.fuseSpark as THREE.Sprite;
    const fuseProgress=bomb.remote?0.12:Math.max(0,Math.min(1,age/BOMB_FUSE));
    fuseSpark.position.copy((obj.userData.fuseCurve as THREE.Curve<THREE.Vector3>).getPoint(1-fuseProgress*0.95));
    fuseSpark.material.opacity=0.55+warning*0.45;
    fuseSpark.scale.set(0.16+warning*0.2,0.2+warning*0.25,1);
    (obj.userData.point as THREE.PointLight).intensity=0.25+warning*(0.4+0.55*Math.max(0,Math.sin(time*(10+warning*20))));
    const tick=Math.floor((0.72-bomb.fuse)/0.18);
    if(warning>0&&tick>(obj.userData.lastTick??-1)){obj.userData.lastTick=tick;beep(450+tick*90,0.045,'triangle',0.012);}
  }
  for(const [id,obj] of bombObjects)if(!game.bombs.some(b=>b.id===id)){props.remove(obj);disposeBombObject(obj);bombObjects.delete(id);}
  for(const [id,obj] of cartObjects)if(!game.bombs.some(b=>b.id===id)){props.remove(obj);cartObjects.delete(id);}
  for(const [id,ttl] of game.fire){
    let obj=fireObjects.get(id);
    const kind=game.fireKinds.get(id)??'normal';
    if(obj&&obj.userData.kind!==kind){effects.remove(obj);disposeFireObject(obj);fireObjects.delete(id);obj=undefined;}
    if(!obj){const [x,y]=id.split(',').map(Number);obj=fireObject(kind,firePatterns.get(id));obj.position.copy(world({x,y}));effects.add(obj);fireObjects.set(id,obj);}
    const age=FIRE_DURATION-ttl,cell=obj.userData.cell as BlastCell|undefined;
    const distance=cell?.distance??0;
    const opening=Math.max(0,Math.min(1,(age-distance*0.035)/0.085));
    const closing=Math.min(1,ttl/0.14);
    const parts=obj.userData.parts as FireParts;
    const seed=Math.abs((cell?.x??0)*13+(cell?.y??0)*7)%11;
    (parts.marker.material as THREE.MeshBasicMaterial).opacity=(0.17+0.08*opening)*closing;
    (parts.ground.material as THREE.MeshBasicMaterial).opacity=(0.35+0.25*opening)*closing;
    parts.ground.scale.setScalar(0.9+0.15*opening);
    parts.ground.rotation.z=age*0.6+distance*0.5;
    parts.flame.material.uniforms.uTime.value=age;
    parts.flame.material.uniforms.uOpacity.value=(0.55+0.45*opening)*closing;
    parts.flame.scale.setScalar(0.85+0.15*opening);
    const billow=Math.max(0,Math.min(1,(age-distance*0.025)/0.09))*closing;
    const sway=Math.sin(age*21+seed*1.3);
    parts.outer.material.opacity=0.82*billow;
    parts.outer.material.rotation=age*0.65+seed*0.24;
    parts.outer.scale.set((cell?.direction?1.35:1.45)*(0.65+0.35*billow), (cell?.direction?1.1:1.2)*(0.72+0.28*billow)+0.06*sway,1);
    parts.outer.position.set(Math.sin(seed*2.3)*0.07,0.36+0.07*sway,Math.cos(seed*1.9)*0.07);
    parts.core.material.opacity=0.64*billow;
    parts.core.material.rotation=-age*0.75-seed*0.17;
    parts.core.scale.set((cell?.direction?1.05:1.15)*(0.6+0.4*billow), (cell?.direction?0.9:0.95)*(0.65+0.35*billow),1);
    parts.core.position.y=0.48+0.045*Math.sin(age*26+seed);
    parts.smoke.material.opacity=0.22*Math.max(0,Math.min(1,(age-0.18)/0.12))*closing;
    parts.smoke.scale.set(0.76+age*0.45,0.63+age*0.35,1);
    parts.smoke.position.y=0.43+age*0.3;
    if(parts.arc){parts.arc.material.opacity=0.62*billow*(Math.sin(age*65+distance*3)>0?1:0.24);parts.arc.material.rotation=age*9+distance;}
    if(parts.light)parts.light.intensity=3.3*opening*Math.max(0,1-age/0.32);
    if(parts.chargeRing){
      (parts.chargeRing.material as THREE.MeshBasicMaterial).opacity=0.55*opening*Math.max(0,1-age/0.32);
      parts.chargeRing.scale.setScalar(0.6+1.1*Math.min(1,age/0.32));
    }
  }
  for(const [id,obj] of fireObjects)if(!game.fire.has(id)){effects.remove(obj);disposeFireObject(obj);fireObjects.delete(id);firePatterns.delete(id);}
  for(const upgrade of game.upgrades){
    const id=key(upgrade.x,upgrade.y);
    if(!upgradeObjects.has(id)){const obj=upgradeObject(upgrade.type);obj.position.copy(world(upgrade));props.add(obj);upgradeObjects.set(id,obj);}
    const obj=upgradeObjects.get(id)!;
    const icon=obj.userData.icon as THREE.Group;
    icon.position.y=0.14+0.06*Math.sin(performance.now()*0.004+upgrade.x);
    icon.rotation.y=0;
    (obj.userData.face as THREE.Mesh).quaternion.copy(camera.quaternion);
  }
  for(const [id,obj] of upgradeObjects)if(!game.upgrades.some(u=>key(u.x,u.y)===id)){props.remove(obj);disposeVisualGeometry(obj);upgradeObjects.delete(id);}
  if(portalObjectRef){portalObjectRef.rotation.y+=0.012;portalObjectRef.position.y=0.04*Math.sin(performance.now()*0.003);}
  for(const marker of ghostGraveVisuals.children){
    const grave=marker.userData.grave as Point;
    const apparition=marker.userData.apparition as THREE.Object3D;
    apparition.visible=!game.bombs.some(b=>b.x===grave.x&&b.y===grave.y&&!b.carried);
    apparition.position.y=0.19+0.06*Math.sin(performance.now()*0.003+grave.x);
  }
  for(const warning of cannonWarningVisuals.children){
    warning.visible=game.map==='pirate'&&game.cannonWarning?.lane===warning.userData.lane;
    if(warning.visible)for(const flare of warning.children)
      (flare as THREE.Sprite).material.opacity=0.67+0.28*(0.5+0.5*Math.sin(performance.now()*0.023));
  }
  for(const shot of game.cannonShots){
    let object=cannonShotObjects.get(shot.id);
    if(!object){
      const model=pirateModels.get('cannon-ball');
      if(!model)continue;
      object=model.clone(true);effects.add(object);cannonShotObjects.set(shot.id,object);
    }
    object.position.copy(world(shot));object.position.y=0.26;object.rotation.z+=0.12;
  }
  for(const [id,object] of cannonShotObjects)if(!game.cannonShots.some(shot=>shot.id===id)){
    effects.remove(object);cannonShotObjects.delete(id);
  }
  const t=performance.now()*0.002;
  playerObject.position.y=0.025*Math.sin(t*2);
}
function clearObjects(){
  for(const obj of tileObjects.values())removeTileObject(obj);tileObjects.clear();
  for(const obj of bombObjects.values()){props.remove(obj);disposeBombObject(obj);}bombObjects.clear();
  for(const obj of cartObjects.values())props.remove(obj);cartObjects.clear();
  for(const obj of cannonShotObjects.values())effects.remove(obj);cannonShotObjects.clear();
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
try{audioEnabled=localStorage.getItem(soundStorageKey)==='true';}catch{ /* Sound still works for this visit. */ }
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
function toggleSound(){
  audioEnabled=!audioEnabled;
  const button=document.querySelector<HTMLButtonElement>('#sound-button')!;
  button.classList.toggle('active',audioEnabled);
  button.setAttribute('aria-label',audioEnabled?'Ton ausschalten':'Ton einschalten');
  document.querySelector<HTMLElement>('#options-sound strong')!.textContent=audioEnabled?'AN':'AUS';
  try{localStorage.setItem(soundStorageKey,String(audioEnabled));}catch{ /* Sound still works for this visit. */ }
  beep(700,0.12);
}
document.querySelector<HTMLButtonElement>('#sound-button')!.addEventListener('click',toggleSound);
document.querySelector<HTMLButtonElement>('#options-sound')!.addEventListener('click',toggleSound);
document.querySelector<HTMLElement>('#options-sound strong')!.textContent=audioEnabled?'AN':'AUS';
document.querySelector<HTMLButtonElement>('#sound-button')!.classList.toggle('active',audioEnabled);
document.querySelector<HTMLButtonElement>('#sound-button')!.setAttribute('aria-label',audioEnabled?'Ton ausschalten':'Ton einschalten');
document.querySelector<HTMLButtonElement>('#options-graphics')!.addEventListener('click',()=>{
  economyGraphics=!economyGraphics;
  renderer.setPixelRatio(pixelRatio());
  document.querySelector<HTMLElement>('#options-graphics strong')!.textContent=economyGraphics?'SPARSAM':'HOCH';
  try{localStorage.setItem(graphicsStorageKey,String(economyGraphics));}catch{ /* The setting still works for this visit. */ }
});
document.querySelector<HTMLElement>('#options-graphics strong')!.textContent=economyGraphics?'SPARSAM':'HOCH';

let toastTimer=0;
function showToast(message:string){toast.textContent=message;toast.classList.remove('hidden');toastTimer=1.7;}
function updateHud(){
  const lives=document.querySelector<HTMLElement>('#lives')!;
  lives.innerHTML=Array.from({length:3},(_,i)=>i<game.player.lives?'♥':'♡').join(' ')+(game.player.shield?' <span class="shield-hud">✦</span>':'');
  lives.setAttribute('aria-label',`${game.player.lives} Leben${game.player.shield?', Schild aktiv':''}`);
  const lobby=game.map==='lobby';
  document.querySelector('#enemies-label')!.textContent=lobby?'UPGRADES':game.onlineMatch?'IM MATCH':'GEGNER';
  document.querySelector('#enemies')!.textContent=String(lobby?game.upgrades.length:game.onlineMatch?roomPlayers.filter(player=>!player.eliminated).length+Number(game.aliveEnemies>0):game.aliveEnemies).padStart(2,'0');
  document.querySelector('#enemy-legend')!.classList.toggle('hidden',lobby||game.onlineMatch&&!roomSettings.cpu);
  document.querySelector('#portal-legend')!.classList.toggle('hidden',lobby||game.onlineMatch);
  document.querySelector('#stage-goal')!.textContent=lobby?'BOMBEN TESTEN · UPGRADES SAMMELN':game.onlineMatch?'LETZTER ÜBRIGER GEWINNT':'ZERSTÖRE ALLE GEGNER → ERREICHE DAS PORTAL';
  document.querySelector('#bombs')!.textContent=`${game.player.capacity-game.playerBombCount} / ${game.player.capacity}`;
  const seconds=Math.floor(game.elapsed);document.querySelector('#timer')!.textContent=`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;
  const pause=document.querySelector<HTMLButtonElement>('#pause-button')!;pause.innerHTML=game.status==='paused'?'▶ <span>WEITER</span>':'Ⅱ <span>PAUSE</span>';
  pause.setAttribute('aria-label',game.status==='paused'?'Spiel fortsetzen':'Spiel pausieren');
  const active=document.querySelector<HTMLElement>('#active-items')!;
  const labels:string[]=[];
  if(game.player.speed)labels.push(`TEMPO ${game.player.speed}`);
  if(game.player.remote)labels.push('FERNZÜNDER');
  if(game.player.bombPass)labels.push('BOMBENPASS');
  if(game.player.blockPass)labels.push('BLOCKPASS');
  if(game.player.glove)labels.push('HANDSCHUH');
  if(game.player.kick)labels.push('KICK');
  if(game.player.pierce)labels.push('SUPERBOMBE');
  if(game.player.slime)labels.push('SCHLEIMBOMBE');
  if(game.player.powerBomb)labels.push('POWERBOMBE BEREIT');
  if(game.cannonWarning)labels.push(`KANONE LÄDT: ${game.cannonWarning.lane===0?'OBERE':'UNTERE'} BAHN`);
  if(game.player.curse>0)labels.push(`FLUCH: ${game.player.curseType==='slow'?'LANGSAM':game.player.curseType==='fast'?'ZU SCHNELL':game.player.curseType==='autoBomb'?'AUTO-BOMBEN':game.player.curseType==='noBomb'?'KEINE BOMBEN':'MINI-BOMBEN'}`);
  active.textContent=labels.join(' · ');active.classList.toggle('hidden',labels.length===0);
  const action=document.querySelector<HTMLButtonElement>('#touch-action')!;
  action.classList.toggle('hidden',!game.player.remote&&!game.player.glove&&!game.player.kick);
  action.textContent=game.carriedBombId!==null?'WERFEN':game.player.remote?'ZÜNDEN':game.player.glove?'NEHMEN':'STOPP';
}
function showResult(){
  const win=game.status==='won';
  document.querySelector('#result-kicker')!.textContent=win?'ARENA GESCHAFFT':'RUNDE VORBEI';
  document.querySelector('#result-title')!.textContent=win?'STARK GESPIELT!':'KABOOM!';
  document.querySelector('#result-copy')!.textContent=win?`Alle Gegner besiegt in ${Math.floor(game.elapsed)} Sekunden. Bereit für eine neue Runde?`:'Deine Leben sind aufgebraucht. Plane deinen nächsten Fluchtweg und versuch es erneut.';
  stage.classList.remove('game-active');pauseMenu.classList.add('hidden');result.classList.remove('hidden');beep(win?780:180,0.35,'triangle',0.08);
}
function prepareMap(map:MapType,seed?:number,onlineMatch=false){
  clearObjects();game.map=map;game.onlineLobby=map==='lobby'&&!!lobbyConnection;game.onlineMatch=onlineMatch;game.onlineMatchGuest=onlineMatch&&lobbySelfId!==lobbyHostId;game.reset(seed);game.setDifficulty(selectedDifficulty);
  playerObject.position.copy(world(game.player));
  camera.zoom=map==='lobby'?1.22:1;camera.updateProjectionMatrix();
  applyMapTheme();syncStatic();updateHud();
}
function leaveLobby(){
  lobbyConnection?.close();lobbyConnection=null;lobbyCode='';lobbySelfId='';
  lobbyHostId='';roomPlayers=[];roomPhase='practice';matchResultVisible=false;practiceUpgrades=[];outSent=false;
  clearRemotePlayers();
  const url=new URL(location.href);
  if(url.searchParams.has('lobby')){url.searchParams.delete('lobby');history.replaceState(null,'',url);}
}
function showMainMenu(){
  leaveLobby();
  prepareMap(selectedMap);
  stage.classList.remove('game-active');
  mainMenu.classList.remove('hidden');optionsMenu.classList.add('hidden');intro.classList.add('hidden');lobbySetup.classList.add('hidden');
  pauseMenu.classList.add('hidden');result.classList.add('hidden');lobbyToolbar.classList.add('hidden');lobbyMatchPanel.classList.add('hidden');
}
function openCpuSetup(){
  leaveLobby();
  prepareMap(selectedMap);
  stage.classList.remove('game-active');
  mainMenu.classList.add('hidden');optionsMenu.classList.add('hidden');intro.classList.remove('hidden');lobbySetup.classList.add('hidden');
  pauseMenu.classList.add('hidden');result.classList.add('hidden');lobbyToolbar.classList.add('hidden');lobbyMatchPanel.classList.add('hidden');
}
let lobbySetupMode:'create'|'join'='create';
function openLobbySetup(mode:'create'|'join',code=''){
  lobbySetupMode=mode;
  mainMenu.classList.add('hidden');optionsMenu.classList.add('hidden');intro.classList.add('hidden');
  lobbySetup.classList.remove('hidden');lobbySetupError.classList.add('hidden');lobbySetupError.textContent='';
  document.querySelector('#lobby-setup-title')!.textContent=mode==='create'?'LOBBY ERSTELLEN':'LOBBY BEITRETEN';
  document.querySelector('#lobby-code-row')!.classList.toggle('hidden',mode==='create');
  lobbySubmit.innerHTML=mode==='create'?'LOBBY ERSTELLEN <span>→</span>':'LOBBY BEITRETEN <span>→</span>';
  lobbyCodeInput.value=code;
  if(mode==='join')lobbyCodeInput.focus();
}
async function enterLobby(code:string){
  const {connection,snapshot}=await LobbyConnection.join(code,selectedCharacter);
  lobbyConnection=connection;lobbyCode=code;lobbySelfId=snapshot.selfId;lobbyHostId=snapshot.hostId;
  roomPlayers=snapshot.players;roomSettings=snapshot.settings;roomPhase=snapshot.phase;practiceUpgrades=snapshot.upgrades;matchResultVisible=false;
  connection.onMessage=handleLobbyMessage;
  connection.onClose=()=>{
    if(lobbyConnection!==connection)return;
    showMainMenu();openLobbySetup('join',code);
    lobbySetupError.textContent='Verbindung unterbrochen. Du kannst mit dem Code erneut beitreten.';
    lobbySetupError.classList.remove('hidden');
  };
  prepareMap('lobby');game.start();
  positionSendTimer=0;lastPositionPayload='';
  const self=snapshot.players.find(player=>player.id===snapshot.selfId);
  if(self){game.player.x=self.x;game.player.y=self.y;game.player.facing=self.facing;}
  game.upgrades=snapshot.upgrades;
  for(const player of snapshot.players)upsertRemotePlayer(player);
  for(const bomb of snapshot.bombs)if(bomb.ownerId!==lobbySelfId)addRemoteBomb(bomb);
  stage.classList.add('game-active');
  mainMenu.classList.add('hidden');optionsMenu.classList.add('hidden');intro.classList.add('hidden');lobbySetup.classList.add('hidden');
  pauseMenu.classList.add('hidden');result.classList.add('hidden');lobbyToolbar.classList.remove('hidden');
  updateLobbyStatus();
  const url=new URL(location.href);url.search='';url.searchParams.set('lobby',code);history.replaceState(null,'',url);
  updateHud();
}
async function submitLobby(){
  if(lobbySubmit.disabled)return;
  lobbySetupError.classList.add('hidden');
  let code=lobbyCodeInput.value.toUpperCase().replace(/[^A-HJ-NP-Z2-9]/g,'');
  if(lobbySetupMode==='join'&&code.length!==6){lobbySetupError.textContent='Bitte einen sechsstelligen Lobby-Code eingeben.';lobbySetupError.classList.remove('hidden');return;}
  lobbySubmit.disabled=true;lobbySubmit.textContent='VERBINDE…';
  try{
    if(lobbySetupMode==='create')code=await createRoom();
    await enterLobby(code);
  }catch(error){
    lobbySetupError.textContent=error instanceof Error?error.message:'Lobby konnte nicht geöffnet werden.';
    lobbySetupError.classList.remove('hidden');
  }finally{
    lobbySubmit.disabled=false;
    lobbySubmit.innerHTML=lobbySetupMode==='create'?'LOBBY ERSTELLEN <span>→</span>':'LOBBY BEITRETEN <span>→</span>';
  }
}
function start(restart=false){
  if(restart)prepareMap(selectedMap);
  game.start();stage.classList.add('game-active');mainMenu.classList.add('hidden');intro.classList.add('hidden');
  pauseMenu.classList.add('hidden');result.classList.add('hidden');lobbyToolbar.classList.add('hidden');lobbyMatchPanel.classList.add('hidden');updateHud();
}
function togglePause(){
  if(lobbyConnection)return;
  if(game.status!=='running'&&game.status!=='paused')return;
  game.togglePause();
  const paused=game.status==='paused';
  pauseMenu.classList.toggle('hidden',!paused);
  if(paused)document.querySelector('#pause-mode')!.textContent=`${mapNames[game.map]} · Bots: ${difficultyNames[game.difficulty]}`;
  updateHud();
}
document.querySelector('#menu-cpu')!.addEventListener('click',openCpuSetup);
document.querySelector('#menu-lobby')!.addEventListener('click',()=>openLobbySetup('create'));
document.querySelector('#menu-join')!.addEventListener('click',()=>openLobbySetup('join'));
document.querySelector('#lobby-submit')!.addEventListener('click',()=>void submitLobby());
document.querySelector('#lobby-setup-back')!.addEventListener('click',showMainMenu);
lobbyMap.addEventListener('change',()=>lobbyConnection?.send({type:'settings',map:lobbyMap.value,cpu:lobbyAddCpu.checked}));
lobbyAddCpu.addEventListener('change',()=>lobbyConnection?.send({type:'settings',map:lobbyMap.value,cpu:lobbyAddCpu.checked}));
lobbyReadyButton.addEventListener('click',()=>{const self=roomPlayers.find(player=>player.id===lobbySelfId);if(self)lobbyConnection?.send({type:'ready',ready:!self.ready});});
lobbyStartButton.addEventListener('click',()=>lobbyConnection?.send({type:'start'}));
lobbyCodeInput.addEventListener('input',()=>{lobbyCodeInput.value=lobbyCodeInput.value.toUpperCase().replace(/[^A-HJ-NP-Z2-9]/g,'');});
lobbyCodeInput.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();void submitLobby();}});
document.querySelector('#lobby-share')!.addEventListener('click',async()=>{
  if(!lobbyCode)return;
  const url=new URL(location.href);url.search='';url.searchParams.set('lobby',lobbyCode);
  const invitation=`Blastbound 3D Lobby-Code: ${lobbyCode}\n${url}`;
  try{await navigator.clipboard.writeText(invitation);showToast('EINLADUNG KOPIERT!');}
  catch{
    const input=document.createElement('textarea');
    input.value=invitation;
    input.setAttribute('readonly','');
    input.style.position='fixed';input.style.opacity='0';input.style.pointerEvents='none';
    document.body.append(input);input.select();
    const copied=document.execCommand('copy');
    input.remove();
    showToast(copied?'EINLADUNG KOPIERT!':'KOPIEREN FEHLGESCHLAGEN');
  }
});
document.querySelector('#menu-options')!.addEventListener('click',()=>{mainMenu.classList.add('hidden');optionsMenu.classList.remove('hidden');});
document.querySelector('#options-back')!.addEventListener('click',()=>{optionsMenu.classList.add('hidden');mainMenu.classList.remove('hidden');});
document.querySelector('#setup-back')!.addEventListener('click',showMainMenu);
document.querySelector('#lobby-menu')!.addEventListener('click',showMainMenu);
document.querySelector('#start-button')!.addEventListener('click',()=>start());
document.querySelector('#restart-button')!.addEventListener('click',()=>{if(lobbyConnection)returnToPractice();else start(true);});
document.querySelector('#menu-button')!.addEventListener('click',showMainMenu);
document.querySelector('#pause-button')!.addEventListener('click',togglePause);
document.querySelector('#resume-button')!.addEventListener('click',togglePause);
document.querySelector('#pause-menu-button')!.addEventListener('click',showMainMenu);
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
  dpad.classList.remove('active');
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
  const thumbTravel=Math.min(length,1)*31;
  dpad.style.setProperty('--thumb-x',`${nx*thumbTravel}px`);
  dpad.style.setProperty('--thumb-y',`${ny*thumbTravel}px`);
  dpad.classList.toggle('active',touchDirections.size>0);
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
function pressBombButton(){
  if(outSent)return;
  game.player.facing=inputFacing();
  if(game.useBombButton()){beep(460,0.09,'triangle',0.025);updateHud();}
}
function useAction(){if(!outSent&&game.useAction()){beep(680,0.08,'triangle',0.03);updateHud();}}
window.addEventListener('keydown',e=>{
  if(e.code==='Escape'&&!lobbySetup.classList.contains('hidden')){e.preventDefault();showMainMenu();return;}
  if(e.target instanceof HTMLInputElement)return;
  if(keyMap[e.code]){e.preventDefault();heldKeys.add(e.code);}
  if(e.code==='Space'){e.preventDefault();if(!e.repeat)pressBombButton();}
  if(e.code==='KeyR'){e.preventDefault();if(!e.repeat)useAction();}
  if(e.code==='KeyP'||e.code==='Escape'){
    e.preventDefault();if(e.repeat)return;
    if(e.code==='Escape'&&!optionsMenu.classList.contains('hidden')){optionsMenu.classList.add('hidden');mainMenu.classList.remove('hidden');}
    else if(e.code==='Escape'&&!intro.classList.contains('hidden'))showMainMenu();
    else togglePause();
  }
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
const touchBomb=document.querySelector<HTMLElement>('#touch-bomb')!;
touchBomb.addEventListener('pointerdown',e=>{e.preventDefault();touchBomb.classList.add('active');pressBombButton();touchBomb.setPointerCapture(e.pointerId);});
for(const eventName of ['pointerup','pointercancel','lostpointercapture'])touchBomb.addEventListener(eventName,()=>touchBomb.classList.remove('active'));
touchBomb.addEventListener('keydown',e=>{if(e.code==='Space'||e.code==='Enter'){e.preventDefault();e.stopPropagation();pressBombButton();}});
stage.addEventListener('pointerdown',e=>{
  if(game.status==='running'&&window.matchMedia('(max-width:760px)').matches&&e.pointerType!=='mouse'&&e.clientX>=window.innerWidth/2&&(e.target===canvas||e.target===stage)){
    e.preventDefault();pressBombButton();
  }
});
const touchAction=document.querySelector<HTMLButtonElement>('#touch-action')!;
touchAction.addEventListener('pointerdown',e=>{e.preventDefault();useAction();});
touchAction.addEventListener('click',e=>{if(e.detail===0)useAction();});
for(const target of [stage,mobileControls]){
  for(const eventName of ['gesturestart','gesturechange'])target.addEventListener(eventName,e=>e.preventDefault(),{passive:false});
  target.addEventListener('dblclick',e=>e.preventDefault());
}

let last=performance.now(),accumulator=0,lastStatus=game.status,footstepTimer=0,cameraJolt=0,hudTimer=0;
const cameraRest=camera.position.clone();
function frame(now:number){
  requestAnimationFrame(frame);
  const dt=Math.min((now-last)/1000,0.1);last=now;accumulator+=dt;footstepTimer=Math.max(0,footstepTimer-dt);
  playerMoving=false;
  while(accumulator>=1/60){
    const dx=outSent?0:Number(isHeld('right'))-Number(isHeld('left'));
    const dy=outSent?0:Number(isHeld('down'))-Number(isHeld('up'));
    const facing=inputFacing();
    playerMoving=game.move(dx,dy,1/60,facing)||playerMoving;
    game.update(1/60);accumulator-=1/60;
  }
  if(lobbyConnection&&roomPhase==='match'&&!game.onlineMatchGuest){
    worldSendTimer-=dt;
    if(worldSendTimer<=0){
      lobbyConnection.send({type:'world',tiles:game.tiles,upgrades:game.upgrades,enemies:game.enemies,cannonShots:game.cannonShots,cannonWarning:game.cannonWarning});
      worldSendTimer=game.map==='pirate'?0.1:0.25;
    }
  }
  if(lobbyConnection&&(game.map==='lobby'||roomPhase==='match')&&!outSent){
    positionSendTimer-=dt;
    if(positionSendTimer<=0){
      const payload={type:'position',x:game.player.x,y:game.player.y,facing:game.player.facing,moving:playerMoving,bombs:game.bombs.filter(bomb=>!bomb.remoteOwner&&bomb.owner===undefined||bomb.carried||bomb.moving).map(bomb=>({networkId:bomb.networkId??`${bomb.owner!==undefined?'cpu':lobbySelfId}:${bomb.id}`,x:bomb.x,y:bomb.y}))};
      const serialized=JSON.stringify(payload);
      if(serialized!==lastPositionPayload||now-lastPositionSentAt>1000){lobbyConnection.send(payload);lastPositionPayload=serialized;lastPositionSentAt=now;}
      positionSendTimer=0.1;
    }
  }
  if(playerMoving&&footstepTimer===0){beep(260,0.025,'sine',0.008);footstepTimer=0.18;}
  for(const event of game.drainEvents()){
    if(event.type==='explode'){
      if(lobbyConnection&&!event.remoteOwner&&event.bombId!==undefined){
        lobbyConnection.send({type:'detonate',id:event.bombId,bot:game.onlineMatch&&event.bot});
      }
      const kind=event.kind??'normal',palette=blastPalette[kind];
      for(const cell of event.cells??[]){
        firePatterns.set(key(cell.x,cell.y),cell);
        if(cell.distance>0)burst(cell.x,cell.y,palette.spark,2);
        transientSprite(cell.x,cell.y,fxTextures.smoke,'#536078',{height:0.46,delay:0.3+cell.distance*0.025,duration:0.55,opacity:0.18,startScale:0.32,endScale:1.02,velocity:new THREE.Vector3(0,0.25,0),additive:false});
      }
      burst(event.x,event.y,palette.spark,kind==='normal'?8:12);
      shockwave(event.x,event.y,palette.edge,kind==='powered'?1.2:1);
      transientSprite(event.x,event.y,fxTextures.flare,palette.core,{height:0.72,duration:0.13,opacity:0.65,startScale:0.35,endScale:1.35});
      markScorch(event.x,event.y);
      cameraJolt=Math.min(0.13,cameraJolt+(kind==='powered'?0.085:0.055));
      stage.classList.remove('blast-impact');void stage.offsetWidth;
      stage.classList.add('blast-impact');
      explosionSound(kind);
    }
    if(event.type==='crate'){crateBurst(event.x,event.y);syncStatic();noiseHit(0.12,0.025,750);}
    if(event.type==='bomb'){
      transientSprite(event.x,event.y,fxTextures.smoke,'#a7b1ba',{height:0.13,duration:0.2,opacity:0.25,startScale:0.12,endScale:0.58,additive:false});
      if(lobbyConnection&&event.bombId!==undefined){
        const bomb=game.bombs.find(item=>item.id===event.bombId);
        if(bomb&&!bomb.remoteOwner)lobbyConnection.send({type:'bomb',id:bomb.id,x:bomb.x,y:bomb.y,range:bomb.range,remote:bomb.remote,pierce:bomb.pierce,slime:bomb.slime,bot:game.onlineMatch&&event.bot});
      }
    }
    if(event.type==='warp'){
      if(event.source)transientSprite(event.source.x,event.source.y,fxTextures.flare,'#b9fff0',{height:0.56,duration:0.28,opacity:0.75,startScale:0.35,endScale:1.1});
      transientSprite(event.x,event.y,fxTextures.flare,'#bdc7ff',{height:0.56,duration:0.32,opacity:0.8,startScale:0.25,endScale:1.3});
      beep(720,0.2,'sine',0.035);
    }
    if(event.type==='cannonFire'){
      burst(event.x,event.y,'#ffd480',10);
      transientSprite(event.x,event.y,fxTextures.smoke,'#59626b',{height:0.52,duration:0.4,opacity:0.45,startScale:0.25,endScale:1.05,additive:false});
      noiseHit(0.22,0.085,180);
    }
    if(event.type==='cannonImpact'){
      burst(event.x,event.y,'#ffda8b',9);
      transientSprite(event.x,event.y,fxTextures.flare,'#ffc26d',{height:0.3,duration:0.18,opacity:0.55,startScale:0.23,endScale:0.8});
    }
    if(event.type==='hit'){showToast(game.map==='lobby'?'TREFFER! ÜBE WEITER':'AU! EIN LEBEN VERLOREN');beep(170,0.28,'square',0.04);}
    if(event.type==='shield'){burst(event.x,event.y,'#8ec8ff',16);shockwave(event.x,event.y,'#8ec8ff',0.75);showToast('SCHILD HAT DICH GESCHÜTZT!');beep(520,0.21,'triangle',0.04);}
    if(event.type==='upgrade'){
      if(lobbyConnection)lobbyConnection.send({type:'pickup',x:event.x,y:event.y});
      const type=event.upgrade??'range';
      const messages:Record<UpgradeType,string>={range:'FLAMMENREICHWEITE +1',capacity:'EINE BOMBE MEHR',speed:'TEMPO +1',remote:'FERNZÜNDER AKTIV',bombPass:'DURCH BOMBEN LAUFEN',blockPass:'DURCH KISTEN LAUFEN',glove:'BOMBEN TRAGEN & WERFEN',kick:'BOMBEN KICKEN',heart:'EIN LEBEN ZURÜCK',maxRange:'MAXIMALE REICHWEITE',powerBomb:'NÄCHSTE BOMBE: MAXIMAL',pierce:'SUPERBOMBEN: DURCH KISTEN',slime:'SCHLEIMBOMBEN',skull:'FLUCH AKTIV',shield:'SCHUTZSCHILD AKTIV'};
      showToast(messages[type]);burst(event.x,event.y,upgradeColors[type],12);beep(880,0.24,'triangle',0.05);
    }
    if(event.type==='enemy'){burst(event.x,event.y,'#eab0ff',12);showToast('GEGNER AUSGESCHALTET!');beep(660,0.14,'triangle',0.04);}
  }
  if(game.onlineMatch&&game.status==='lost'&&!outSent){
    outSent=true;lobbyConnection?.send({type:'out'});game.status='running';game.player.invincible=Infinity;
    showToast('AUSGESCHIEDEN · MATCH LÄUFT WEITER');
  }
  if(lastStatus!==game.status){if(!game.onlineMatch&&(game.status==='won'||game.status==='lost'))showResult();lastStatus=game.status;}
  if(toastTimer>0){toastTimer-=dt;if(toastTimer<=0)toast.classList.add('hidden');}
  updateParticles(dt);updateSpriteEffects(dt);updateScorches(dt);updateShockwaves(dt);syncDynamic();
  cameraJolt=Math.max(0,cameraJolt-dt*0.8);
  camera.position.copy(cameraRest);
  if(cameraJolt>0){camera.position.x+=Math.sin(now*0.071)*cameraJolt;camera.position.z+=Math.sin(now*0.096)*cameraJolt*0.6;}
  if(game.status==='running'){playerArt?.mixer.update(dt);for(const art of enemyArt.values())art.mixer.update(dt);for(const art of remotePlayerArt.values())art.mixer.update(dt);}
  hudTimer-=dt;if(hudTimer<=0){updateHud();hudTimer=0.2;}
  renderer.render(scene,camera);
}
renderCharacterOptions();renderDifficultyOptions();renderMapOptions();
const inviteCode=new URL(location.href).searchParams.get('lobby')?.toUpperCase()??'';
if(/^[A-HJ-NP-Z2-9]{6}$/.test(inviteCode))openLobbySetup('join',inviteCode);
const assetLoading=document.querySelector<HTMLElement>('#asset-loading')!;
void Promise.all([loadKenneyAssets(),loadBombAssets(),loadDungeonAssets(),loadMarketAssets(),loadGraveyardAssets(),loadPirateAssets()]).then(()=>{
  playerObject.position.copy(world(game.player));applyMapTheme();syncStatic();updateHud();
  assetLoading.remove();last=performance.now();requestAnimationFrame(frame);
}).catch(error=>{
  console.error('Could not preload game assets',error);
  assetLoading.replaceChildren();
  const message=document.createElement('span');message.textContent='3D-ASSETS KONNTEN NICHT GELADEN WERDEN. BITTE SEITE NEU LADEN.';assetLoading.append(message);
});
