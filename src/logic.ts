export const WIDTH = 13;
export const HEIGHT = 11;
export const PLAYER_SPEED = 3.1; // tiles per second
export const ENEMY_SPEED = 1.45;
export const BOMB_FUSE = 2.8;
export const FIRE_DURATION = 0.56;
export type Difficulty = 'training' | 'easy' | 'medium' | 'hard';
const difficultySettings: Record<Difficulty, { speed: number; focus: number; cooldown: number; range: number }> = {
  training: { speed: 0, focus: 0, cooldown: Infinity, range: 0 },
  easy: { speed: 0.95, focus: 0.35, cooldown: 6, range: 1 },
  medium: { speed: ENEMY_SPEED, focus: 0.7, cooldown: 4, range: 1 },
  hard: { speed: 1.75, focus: 0.95, cooldown: 2.7, range: 2 },
};
export type Tile = 0 | 1 | 2; // floor, stone, crate
export type Direction = 'up' | 'down' | 'left' | 'right';
export type Point = { x: number; y: number };
export type Bomb = Point & { fuse: number; range: number; ownerPass: boolean; id: number; owner?: number; remote?: boolean; pierce?: boolean; slime?: boolean; moving?: Direction; moveTimer?: number; carried?: boolean };
export type Enemy = Point & { id: number; targetX: number; targetY: number; moveTimer: number; bombCooldown: number; escapePath: Point[]; alive: boolean; facing: Direction };
export type UpgradeType = 'range' | 'capacity' | 'speed' | 'remote' | 'bombPass' | 'blockPass' | 'glove' | 'kick' | 'heart' | 'maxRange' | 'powerBomb' | 'pierce' | 'slime' | 'skull' | 'shield';
export const CLASSIC_UPGRADES: UpgradeType[] = ['range','capacity','speed','remote','bombPass','blockPass','glove','kick','heart','maxRange','powerBomb','pierce','slime','skull'];
export type BlastKind = 'normal' | 'powered' | 'chain';
export type BlastCell = Point & { distance: number; direction: Direction | null };
export type Upgrade = Point & { type: UpgradeType };
export type CurseType = 'slow' | 'fast' | 'autoBomb' | 'noBomb' | 'weak';
export type GameEvent = { type: 'explode' | 'crate' | 'hit' | 'shield' | 'upgrade' | 'enemy' | 'bomb'; x: number; y: number; kind?: BlastKind; upgrade?: UpgradeType; cells?: BlastCell[] };

const dirs: Record<Direction, Point> = {
  up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 },
};
const directionList: Direction[] = ['up', 'right', 'down', 'left'];
const PLAYER_RADIUS = 0.26;
const BOMB_RADIUS = 0.31;
const BLOCK_HALF_SIZE = 0.455;

function circleTouchesSquare(x: number, y: number, radius: number, cx: number, cy: number, halfSize: number) {
  const dx = Math.max(Math.abs(x - cx) - halfSize, 0);
  const dy = Math.max(Math.abs(y - cy) - halfSize, 0);
  return dx * dx + dy * dy < radius * radius;
}

export class Game {
  tiles: Tile[][] = [];
  fire = new Map<string, number>();
  fireKinds = new Map<string, BlastKind>();
  bombs: Bomb[] = [];
  enemies: Enemy[] = [];
  upgrades: Upgrade[] = [];
  events: GameEvent[] = [];
  player = { x: 1, y: 1, lives: 3, shield: 0, invincible: 0, range: 1, capacity: 1, speed: 0, remote: false, bombPass: false, blockPass: false, glove: false, kick: false, powerBomb: false, pierce: false, slime: false, curse: 0, curseType: null as CurseType|null, facing: 'down' as Direction };
  carriedBombId: number | null = null;
  private autoBombTimer=0;
  difficulty: Difficulty = 'easy';
  portal: Point = { x: 9, y: 7 };
  status: 'ready' | 'running' | 'paused' | 'won' | 'lost' = 'ready';
  elapsed = 0;
  private randomState = 1;
  private bombId = 0;
  private enemyId = 0;

  constructor(seed = Date.now(), difficulty: Difficulty = 'easy') { this.difficulty=difficulty; this.reset(seed); }
  private rand() { this.randomState = (Math.imul(this.randomState, 1664525) + 1013904223) >>> 0; return this.randomState / 4294967296; }
  static key(x: number, y: number) { return `${x},${y}`; }
  inBounds(x: number, y: number) { return x >= 0 && x < WIDTH && y >= 0 && y < HEIGHT; }
  tile(x: number, y: number): Tile { return this.inBounds(x, y) ? this.tiles[y][x] : 1; }
  reset(seed = Date.now()) {
    this.randomState = seed >>> 0;
    this.tiles = Array.from({ length: HEIGHT }, (_, y) => Array.from({ length: WIDTH }, (_, x): Tile => {
      if (x === 0 || y === 0 || x === WIDTH - 1 || y === HEIGHT - 1 || (x % 2 === 0 && y % 2 === 0)) return 1;
      return this.rand() < 0.64 ? 2 : 0;
    }));
    const safe = [[1,1],[2,1],[1,2],[11,1],[10,1],[11,2],[1,9],[2,9],[1,8],[11,9],[10,9],[11,8]];
    for (const [x,y] of safe) this.tiles[y][x] = 0;
    this.tiles[this.portal.y][this.portal.x] = 2;
    this.fire.clear(); this.fireKinds.clear(); this.bombs = []; this.upgrades = []; this.events = []; this.carriedBombId = null;this.autoBombTimer=0;
    this.player = { x: 1, y: 1, lives: 3, shield: 0, invincible: 0, range: 1, capacity: 1, speed: 0, remote: false, bombPass: false, blockPass: false, glove: false, kick: false, powerBomb: false, pierce: false, slime: false, curse: 0, curseType: null, facing: 'down' };
    this.enemies = [{x:11,y:1},{x:1,y:9},{x:11,y:9}].map(p => ({ ...p, targetX:p.x, targetY:p.y, id: ++this.enemyId, moveTimer: 0.45 + this.rand() * 0.2, bombCooldown: 1.8 + this.rand() * 1.4, escapePath: [], alive: true, facing: 'down' as Direction }));
    this.status = 'ready'; this.elapsed = 0;
  }
  start() { if (this.status === 'ready') this.status = 'running'; }
  setDifficulty(difficulty: Difficulty) { if (this.status === 'ready') this.difficulty=difficulty; }
  togglePause() { if (this.status === 'running') this.status = 'paused'; else if (this.status === 'paused') this.status = 'running'; }
  canEnemyEnter(x: number, y: number) {
    if (this.tile(x,y) !== 0) return false;
    return !this.bombs.some(b => b.x === x && b.y === y);
  }
  private canOccupy(x: number, y: number) {
    for (let ty = Math.floor(y - 1); ty <= Math.ceil(y + 1); ty++) {
      for (let tx = Math.floor(x - 1); tx <= Math.ceil(x + 1); tx++) {
        if (this.tile(tx,ty) !== 0 && !(this.player.blockPass && this.tile(tx,ty) === 2) && circleTouchesSquare(x,y,PLAYER_RADIUS,tx,ty,BLOCK_HALF_SIZE)) return false;
      }
    }
    return this.player.bombPass || !this.bombs.some(b => !b.ownerPass && !b.carried && Math.hypot(x-b.x,y-b.y) < PLAYER_RADIUS + BOMB_RADIUS);
  }
  move(dx: number, dy: number, dt: number, facing: Direction) {
    if (this.status !== 'running') return false;
    if (!dx && !dy) return false;
    this.player.facing = facing;
    const length = Math.hypot(dx,dy);
    const speed=PLAYER_SPEED+this.player.speed*0.32;
    const curseSpeed=this.player.curse>0?(this.player.curseType==='slow'?0.65:this.player.curseType==='fast'?1.55:1):1;
    const step = speed * Math.min(dt,0.1) / length * curseSpeed;
    const nextX = this.player.x + dx * step;
    const nextY = this.player.y + dy * step;
    const oldX = this.player.x, oldY = this.player.y;
    if (this.canOccupy(nextX,this.player.y) || this.tryKick(nextX,this.player.y,dx>0?'right':'left')) this.player.x = nextX;
    if (this.canOccupy(this.player.x,nextY) || this.tryKick(this.player.x,nextY,dy>0?'down':'up')) this.player.y = nextY;
    for (const bomb of this.bombs)
      if (bomb.ownerPass && Math.hypot(this.player.x-bomb.x,this.player.y-bomb.y) >= PLAYER_RADIUS+BOMB_RADIUS) bomb.ownerPass = false;
    if (this.player.x === oldX && this.player.y === oldY) return false;
    this.collectUpgrade(); this.checkHazards(); this.checkWin();
    return true;
  }
  placeBomb() {
    if (this.status !== 'running' || this.playerBombCount >= (this.player.curse>0&&this.player.curseType==='weak'?1:this.player.capacity)) return false;
    const x = Math.round(this.player.x), y = Math.round(this.player.y);
    if (this.tile(x,y) !== 0) return false;
    if (this.bombs.some(b => b.x === x && b.y === y)) return false;
    if(this.player.curse>0&&this.player.curseType==='noBomb')return false;
    const range=this.player.curse>0&&this.player.curseType==='weak'?1:this.player.powerBomb?9:this.player.range;
    this.bombs.push({x,y,fuse:BOMB_FUSE,range,ownerPass:true,id:++this.bombId,remote:this.player.remote,pierce:this.player.pierce,slime:this.player.slime});
    this.player.powerBomb=false;
    this.events.push({type:'bomb',x,y});
    return true;
  }
  private tryKick(x:number,y:number,dir:Direction){
    if(!this.player.kick || this.player.bombPass)return false;
    const bomb=this.bombs.find(b=>!b.ownerPass&&!b.carried&&Math.hypot(x-b.x,y-b.y)<PLAYER_RADIUS+BOMB_RADIUS);
    if(!bomb)return false;
    const d=dirs[dir],nx=bomb.x+d.x,ny=bomb.y+d.y;
    if(this.tile(nx,ny)!==0||this.bombs.some(b=>b!==bomb&&!b.carried&&b.x===nx&&b.y===ny))return false;
    if(!bomb.moving){bomb.moving=dir;bomb.moveTimer=0.12;}
    return false;
  }
  useAction(){
    if(this.status!=='running')return false;
    if(this.carriedBombId!==null){
      const bomb=this.bombs.find(b=>b.id===this.carriedBombId);
      this.carriedBombId=null;
      if(!bomb)return false;
      bomb.carried=false;bomb.ownerPass=false;
      const d=dirs[this.player.facing];
      let x=Math.round(this.player.x),y=Math.round(this.player.y);
      for(let i=0;i<3;i++){const nx=x+d.x,ny=y+d.y;if(this.tile(nx,ny)!==0||this.bombs.some(b=>b!==bomb&&!b.carried&&b.x===nx&&b.y===ny))break;x=nx;y=ny;}
      bomb.x=x;bomb.y=y;
      if(bomb.slime){bomb.moving=this.player.facing;bomb.moveTimer=0.12;}
      this.events.push({type:'bomb',x,y});return true;
    }
    if(this.player.glove){
      const bomb=this.bombs.find(b=>!b.carried&&Math.hypot(b.x-this.player.x,b.y-this.player.y)<0.8);
      if(bomb){bomb.carried=true;bomb.moving=undefined;this.carriedBombId=bomb.id;return true;}
    }
    const remote=this.bombs.find(b=>b.owner===undefined&&b.remote);
    if(remote){this.explode(remote);return true;}
    const moving=this.bombs.find(b=>b.moving);
    if(this.player.kick&&moving){moving.moving=undefined;return true;}
    return false;
  }
  update(dt: number) {
    if (this.status !== 'running') return;
    dt = Math.min(dt, 0.1); this.elapsed += dt;
    if (this.player.invincible > 0) this.player.invincible = Math.max(0, this.player.invincible - dt);
    if (this.player.curse > 0) {
      this.player.curse=Math.max(0,this.player.curse-dt);
      if(this.player.curse===0)this.player.curseType=null;
      else if(this.player.curseType==='autoBomb'){
        this.autoBombTimer-=dt;
        if(this.autoBombTimer<=0){this.placeBomb();this.autoBombTimer=0.85;}
      }
    }
    for (const [key,ttl] of this.fire) { const next = ttl - dt; if (next <= 0) { this.fire.delete(key); this.fireKinds.delete(key); } else this.fire.set(key,next); }
    for(const bomb of this.bombs){
      if(bomb.carried){bomb.x=Math.round(this.player.x);bomb.y=Math.round(this.player.y);continue;}
      if(!bomb.moving)continue;
      bomb.moveTimer=(bomb.moveTimer??0)-dt;
      if(bomb.moveTimer>0)continue;
      const d=dirs[bomb.moving],nx=bomb.x+d.x,ny=bomb.y+d.y;
      if(this.tile(nx,ny)!==0||this.bombs.some(other=>other!==bomb&&!other.carried&&other.x===nx&&other.y===ny)){
        if(bomb.slime){bomb.moving=directionList[(directionList.indexOf(bomb.moving)+2)%4];bomb.moveTimer=0.16;}
        else bomb.moving=undefined;
      }else{bomb.x=nx;bomb.y=ny;bomb.ownerPass=false;bomb.moveTimer=0.16;}
    }
    const exploding = this.bombs.filter(b => !b.remote && (b.fuse -= dt) <= 0);
    for (const bomb of exploding) this.explode(bomb);
    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      if (this.difficulty === 'training') continue;
      enemy.bombCooldown=Math.max(0,enemy.bombCooldown-dt);
      const remaining = Math.hypot(enemy.targetX-enemy.x,enemy.targetY-enemy.y);
      if (remaining > 0) {
        const step = Math.min(remaining,difficultySettings[this.difficulty].speed*dt);
        enemy.x += (enemy.targetX-enemy.x)/remaining*step;
        enemy.y += (enemy.targetY-enemy.y)/remaining*step;
        if (step === remaining) { enemy.x=enemy.targetX; enemy.y=enemy.targetY; }
      } else {
        enemy.moveTimer -= dt;
        if (enemy.moveTimer <= 0) {
          enemy.moveTimer = 0.08 + this.rand() * 0.12;
          this.moveEnemy(enemy);
        }
      }
    }
    this.checkHazards(); this.checkWin();
  }
  private blastFootprint(x: number, y: number, range: number) {
    const cells = new Set<string>([Game.key(x,y)]);
    for (const dir of directionList) {
      const d=dirs[dir];
      for (let step=1;step<=range;step++) {
        const bx=x+d.x*step,by=y+d.y*step,tile=this.tile(bx,by);
        if (tile===1) break;
        cells.add(Game.key(bx,by));
        if (tile===2) break;
      }
    }
    return cells;
  }
  private escapeRoute(enemy: Enemy, range: number | null) {
    const x=Math.round(enemy.x),y=Math.round(enemy.y);
    const danger=range===null?new Set<string>():this.blastFootprint(x,y,range);
    for (const bomb of this.bombs) for (const cell of this.blastFootprint(bomb.x,bomb.y,bomb.range)) danger.add(cell);
    const nearestFuse=range===null?Math.min(...this.bombs.filter(b=>this.blastFootprint(b.x,b.y,b.range).has(Game.key(x,y))).map(b=>b.fuse)):BOMB_FUSE;
    const maxSteps=Math.max(1,Math.floor((nearestFuse-0.35)*difficultySettings[this.difficulty].speed));
    const queue:{x:number;y:number;path:Point[]}[]=[{x,y,path:[]}];
    const visited=new Set<string>([Game.key(x,y)]);
    for (let i=0;i<queue.length;i++) {
      const item=queue[i];
      if(item.path.length && !danger.has(Game.key(item.x,item.y)) && !this.fire.has(Game.key(item.x,item.y))) return item.path;
      if(item.path.length>=maxSteps) continue;
      for(const dir of directionList){
        const d=dirs[dir],nx=item.x+d.x,ny=item.y+d.y,key=Game.key(nx,ny);
        if(visited.has(key)||this.tile(nx,ny)!==0||this.bombs.some(b=>b.x===nx&&b.y===ny)||this.fire.has(key))continue;
        visited.add(key);queue.push({x:nx,y:ny,path:[...item.path,{x:nx,y:ny}]});
      }
    }
    return null;
  }
  private tryPlaceEnemyBomb(enemy: Enemy) {
    const profile=difficultySettings[this.difficulty];
    if(enemy.bombCooldown>0||this.bombs.some(b=>b.owner===enemy.id))return false;
    const x=Math.round(enemy.x),y=Math.round(enemy.y);
    if(this.tile(x,y)!==0||this.bombs.some(b=>b.x===x&&b.y===y)||this.fire.has(Game.key(x,y)))return false;
    const blast=this.blastFootprint(x,y,profile.range);
    const nearCrate=directionList.some(dir=>{const d=dirs[dir];return this.tile(x+d.x,y+d.y)===2;});
    const canHitPlayer=[...blast].some(key=>{const [bx,by]=key.split(',').map(Number);return circleTouchesSquare(this.player.x,this.player.y,PLAYER_RADIUS,bx,by,0.44);});
    if(!nearCrate&&!canHitPlayer)return false;
    const route=this.escapeRoute(enemy,profile.range);
    if(!route)return false;
    this.bombs.push({x,y,fuse:BOMB_FUSE,range:profile.range,ownerPass:false,id:++this.bombId,owner:enemy.id});
    this.events.push({type:'bomb',x,y});
    enemy.bombCooldown=profile.cooldown;
    enemy.escapePath=route;
    return true;
  }
  private pathDistancesToPlayer() {
    const distances=new Map<string,number>();
    const start={x:Math.round(this.player.x),y:Math.round(this.player.y),cost:0};
    const frontier=[start];
    while(frontier.length){
      frontier.sort((a,b)=>a.cost-b.cost);
      const node=frontier.shift()!,key=Game.key(node.x,node.y);
      if(distances.has(key))continue;
      distances.set(key,node.cost);
      for(const dir of directionList){
        const d=dirs[dir],x=node.x+d.x,y=node.y+d.y,tile=this.tile(x,y);
        if(tile===1||distances.has(Game.key(x,y)))continue;
        // A crate is reachable after a bomb, but costs more than an open detour.
        frontier.push({x,y,cost:node.cost+(this.tile(node.x,node.y)===2?4:1)});
      }
    }
    return distances;
  }
  private moveEnemy(enemy: Enemy) {
    const current=Game.key(Math.round(enemy.x),Math.round(enemy.y));
    if(!enemy.escapePath.length&&this.bombs.some(b=>this.blastFootprint(b.x,b.y,b.range).has(current)))
      enemy.escapePath=this.escapeRoute(enemy,null)??[];
    if(enemy.escapePath.length||this.tryPlaceEnemyBomb(enemy)){
      const next=enemy.escapePath.shift();
      if(next&&this.canEnemyEnter(next.x,next.y)){
        enemy.facing=next.x>enemy.x?'right':next.x<enemy.x?'left':next.y>enemy.y?'down':'up';
        enemy.targetX=next.x;enemy.targetY=next.y;return;
      }
      enemy.escapePath=[];
    }
    const choices = directionList.filter(dir => { const d=dirs[dir], x=enemy.x+d.x, y=enemy.y+d.y; return this.canEnemyEnter(x,y) && !this.fire.has(Game.key(x,y)); });
    if (!choices.length) return;
    const safe=choices.filter(dir=>{const d=dirs[dir],x=Math.round(enemy.x)+d.x,y=Math.round(enemy.y)+d.y;return !this.bombs.some(b=>this.blastFootprint(b.x,b.y,b.range).has(Game.key(x,y)));});
    if(!safe.length&&!this.bombs.some(b=>this.blastFootprint(b.x,b.y,b.range).has(current)))return;
    const available=safe.length?safe:choices;
    const distances=this.difficulty==='hard'?this.pathDistancesToPlayer():null;
    const direct = available.map(dir => {
      const d=dirs[dir],x=enemy.x+d.x,y=enemy.y+d.y;
      const distance=distances?.get(Game.key(Math.round(x),Math.round(y)))??Math.abs(x-this.player.x)+Math.abs(y-this.player.y);
      return {dir,score:distance+this.rand()*(distances?0.35:3)};
    });
    direct.sort((a,b)=>a.score-b.score);
    const chosen = this.rand() < difficultySettings[this.difficulty].focus ? direct[0].dir : available[Math.floor(this.rand()*available.length)];
    enemy.targetX = enemy.x + dirs[chosen].x; enemy.targetY = enemy.y + dirs[chosen].y; enemy.facing = chosen;
  }
  private explode(bomb: Bomb, chained = false) {
    const index = this.bombs.indexOf(bomb); if (index < 0) return;
    if(this.carriedBombId===bomb.id)this.carriedBombId=null;
    const kind:BlastKind = chained ? 'chain' : bomb.range > 2 ? 'powered' : 'normal';
    const cells:BlastCell[]=[];
    this.bombs.splice(index,1); this.events.push({type:'explode',x:bomb.x,y:bomb.y,kind,cells});
    const ignite = (x:number,y:number,distance:number,direction:Direction|null) => {
      cells.push({x,y,distance,direction});
      const key=Game.key(x,y);
      this.fire.set(key,FIRE_DURATION);
      this.upgrades=this.upgrades.filter(item=>item.x!==x||item.y!==y);
      const priority:Record<BlastKind,number>={normal:0,chain:1,powered:2};
      const previous=this.fireKinds.get(key);
      if(!previous || priority[kind]>=priority[previous])this.fireKinds.set(key,kind);
      const chainedBomb = this.bombs.find(b => b.x===x && b.y===y);
      if (chainedBomb) this.explode(chainedBomb,true);
    };
    ignite(bomb.x,bomb.y,0,null);
    this.fireKinds.set(Game.key(bomb.x,bomb.y),kind);
    for (const dir of directionList) {
      const d=dirs[dir];
      for (let step=1;step<=bomb.range;step++) {
        const x=bomb.x+d.x*step,y=bomb.y+d.y*step,tile=this.tile(x,y);
        if (tile===1) break;
        ignite(x,y,step,dir);
        if (tile===2) {
          this.tiles[y][x]=0; this.events.push({type:'crate',x,y});
          if (this.rand()<0.34 && !(x===this.portal.x && y===this.portal.y)) {
            const roll=this.rand();
            const pool:UpgradeType[]=['range','range','range','capacity','capacity','speed','speed','remote','bombPass','blockPass','glove','kick','heart','maxRange','powerBomb','pierce','slime','skull','shield'];
            this.upgrades.push({x,y,type:pool[Math.floor(roll*pool.length)]});
          }
          if(!bomb.pierce)break;
        }
      }
    }
    this.checkHazards();
  }
  private collectUpgrade() {
    const index=this.upgrades.findIndex(p=>Math.hypot(p.x-this.player.x,p.y-this.player.y)<0.4); if (index<0) return;
    const upgrade=this.upgrades.splice(index,1)[0];
    if(upgrade.type!=='skull'){this.player.curse=0;this.player.curseType=null;}
    switch(upgrade.type){
      case 'range':this.player.range=Math.min(9,this.player.range+1);break;
      case 'capacity':this.player.capacity=Math.min(9,this.player.capacity+1);break;
      case 'speed':this.player.speed=Math.min(5,this.player.speed+1);break;
      case 'remote':this.player.remote=true;break;
      case 'bombPass':this.player.bombPass=true;break;
      case 'blockPass':this.player.blockPass=true;break;
      case 'glove':this.player.glove=true;break;
      case 'kick':this.player.kick=true;break;
      case 'heart':this.player.lives=Math.min(3,this.player.lives+1);break;
      case 'maxRange':this.player.range=9;break;
      case 'powerBomb':this.player.powerBomb=true;break;
      case 'pierce':this.player.pierce=true;break;
      case 'slime':this.player.slime=true;break;
      case 'skull':this.player.curse=8;this.player.curseType=(['slow','fast','autoBomb','noBomb','weak'] as CurseType[])[Math.floor(this.rand()*5)];this.autoBombTimer=0.5;break;
      case 'shield':this.player.shield=1;break;
    }
    this.events.push({type:'upgrade',x:upgrade.x,y:upgrade.y,upgrade:upgrade.type});
  }
  private checkHazards() {
    const fireCells = [...this.fire.keys()].map(key=>key.split(',').map(Number));
    for (const enemy of this.enemies) if (enemy.alive && fireCells.some(([x,y])=>circleTouchesSquare(enemy.x,enemy.y,PLAYER_RADIUS,x,y,0.44))) {
      enemy.alive=false; this.events.push({type:'enemy',x:Math.round(enemy.x),y:Math.round(enemy.y)});
    }
    const inFire = fireCells.some(([x,y])=>circleTouchesSquare(this.player.x,this.player.y,PLAYER_RADIUS,x,y,0.44));
    const dangerous = inFire || (this.difficulty!=='training' && this.enemies.some(e=>e.alive && Math.hypot(e.x-this.player.x,e.y-this.player.y)<PLAYER_RADIUS*2));
    if (dangerous && this.player.invincible<=0) {
      if (this.player.shield>0) {
        this.player.shield=0; this.player.invincible=0.8;
        this.events.push({type:'shield',x:Math.round(this.player.x),y:Math.round(this.player.y)});
        return;
      }
      this.player.lives--; this.player.invincible=1.45; this.events.push({type:'hit',x:Math.round(this.player.x),y:Math.round(this.player.y)});
      if(this.carriedBombId!==null){const carried=this.bombs.find(b=>b.id===this.carriedBombId);if(carried){carried.carried=false;carried.ownerPass=false;}this.carriedBombId=null;}
      for(const bomb of this.bombs)if(bomb.owner===undefined&&bomb.remote){bomb.remote=false;bomb.fuse=Math.min(bomb.fuse,1.2);}
      this.player.speed=0;this.player.remote=false;this.player.bombPass=false;this.player.blockPass=false;this.player.glove=false;this.player.kick=false;this.player.pierce=false;this.player.slime=false;this.player.powerBomb=false;this.player.curse=0;this.player.curseType=null;
      if (this.player.lives<=0) this.status='lost';
    }
  }
  private checkWin() {
    if (this.status==='running' && this.enemies.every(e=>!e.alive) && Math.hypot(this.player.x-this.portal.x,this.player.y-this.portal.y)<0.4 && this.tile(this.portal.x,this.portal.y)===0) this.status='won';
  }
  drainEvents() { return this.events.splice(0); }
  get aliveEnemies() { return this.enemies.filter(e=>e.alive).length; }
  get playerBombCount() { return this.bombs.filter(b=>b.owner===undefined).length; }
}
