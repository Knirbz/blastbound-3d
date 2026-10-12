export const WIDTH = 13;
export const HEIGHT = 11;
export type Tile = 0 | 1 | 2; // floor, stone, crate
export type Direction = 'up' | 'down' | 'left' | 'right';
export type Point = { x: number; y: number };
export type Bomb = Point & { fuse: number; range: number; ownerPass: boolean; id: number };
export type Enemy = Point & { id: number; moveTimer: number; alive: boolean; facing: Direction };
export type Upgrade = Point & { type: 'range' | 'capacity' };
export type GameEvent = { type: 'explode' | 'crate' | 'hit' | 'upgrade' | 'enemy' | 'bomb'; x: number; y: number };

const dirs: Record<Direction, Point> = {
  up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 },
};
const directionList: Direction[] = ['up', 'right', 'down', 'left'];

export class Game {
  tiles: Tile[][] = [];
  fire = new Map<string, number>();
  bombs: Bomb[] = [];
  enemies: Enemy[] = [];
  upgrades: Upgrade[] = [];
  events: GameEvent[] = [];
  player = { x: 1, y: 1, lives: 3, invincible: 0, range: 2, capacity: 1, facing: 'down' as Direction };
  portal: Point = { x: 9, y: 7 };
  status: 'ready' | 'running' | 'paused' | 'won' | 'lost' = 'ready';
  elapsed = 0;
  private randomState = 1;
  private bombId = 0;
  private enemyId = 0;

  constructor(seed = Date.now()) { this.reset(seed); }
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
    this.fire.clear(); this.bombs = []; this.upgrades = []; this.events = [];
    this.player = { x: 1, y: 1, lives: 3, invincible: 0, range: 2, capacity: 1, facing: 'down' };
    this.enemies = [{x:11,y:1},{x:1,y:9},{x:11,y:9}].map(p => ({ ...p, id: ++this.enemyId, moveTimer: 0.4 + this.rand() * 0.25, alive: true, facing: 'down' as Direction }));
    this.status = 'ready'; this.elapsed = 0;
  }
  start() { if (this.status === 'ready') this.status = 'running'; }
  togglePause() { if (this.status === 'running') this.status = 'paused'; else if (this.status === 'paused') this.status = 'running'; }
  canEnter(x: number, y: number, who: 'player' | 'enemy') {
    if (this.tile(x,y) !== 0) return false;
    const bomb = this.bombs.find(b => b.x === x && b.y === y);
    if (!bomb) return true;
    return who === 'player' && bomb.ownerPass && this.player.x === x && this.player.y === y;
  }
  move(direction: Direction) {
    if (this.status !== 'running') return false;
    this.player.facing = direction;
    const d = dirs[direction], x = this.player.x + d.x, y = this.player.y + d.y;
    if (!this.canEnter(x,y,'player')) return false;
    const origin = { x: this.player.x, y: this.player.y };
    this.player.x = x; this.player.y = y;
    for (const bomb of this.bombs) if (bomb.x === origin.x && bomb.y === origin.y) bomb.ownerPass = false;
    this.collectUpgrade(); this.checkHazards(); this.checkWin();
    return true;
  }
  placeBomb() {
    if (this.status !== 'running' || this.bombs.length >= this.player.capacity) return false;
    const {x,y} = this.player;
    if (this.bombs.some(b => b.x === x && b.y === y)) return false;
    this.bombs.push({x,y,fuse:2.15,range:this.player.range,ownerPass:true,id:++this.bombId});
    this.events.push({type:'bomb',x,y});
    return true;
  }
  update(dt: number) {
    if (this.status !== 'running') return;
    dt = Math.min(dt, 0.1); this.elapsed += dt;
    if (this.player.invincible > 0) this.player.invincible = Math.max(0, this.player.invincible - dt);
    for (const [key,ttl] of this.fire) { const next = ttl - dt; if (next <= 0) this.fire.delete(key); else this.fire.set(key,next); }
    const exploding = this.bombs.filter(b => (b.fuse -= dt) <= 0);
    for (const bomb of exploding) this.explode(bomb);
    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      enemy.moveTimer -= dt;
      if (enemy.moveTimer <= 0) {
        enemy.moveTimer = 0.34 + this.rand() * 0.2;
        this.moveEnemy(enemy);
      }
    }
    this.checkHazards(); this.checkWin();
  }
  private moveEnemy(enemy: Enemy) {
    const choices = directionList.filter(dir => { const d=dirs[dir], x=enemy.x+d.x, y=enemy.y+d.y; return this.canEnter(x,y,'enemy') && !this.fire.has(Game.key(x,y)); });
    if (!choices.length) return;
    const direct = choices.map(dir => { const d=dirs[dir], x=enemy.x+d.x, y=enemy.y+d.y; return {dir, score: Math.abs(x-this.player.x)+Math.abs(y-this.player.y)+this.rand()*3}; });
    direct.sort((a,b)=>a.score-b.score);
    const chosen = this.rand() < 0.75 ? direct[0].dir : choices[Math.floor(this.rand()*choices.length)];
    enemy.x += dirs[chosen].x; enemy.y += dirs[chosen].y; enemy.facing = chosen;
  }
  private explode(bomb: Bomb) {
    const index = this.bombs.indexOf(bomb); if (index < 0) return;
    this.bombs.splice(index,1); this.events.push({type:'explode',x:bomb.x,y:bomb.y});
    const ignite = (x:number,y:number) => { this.fire.set(Game.key(x,y),0.56); const chained = this.bombs.find(b => b.x===x && b.y===y); if (chained) this.explode(chained); };
    ignite(bomb.x,bomb.y);
    for (const dir of directionList) {
      const d=dirs[dir];
      for (let step=1;step<=bomb.range;step++) {
        const x=bomb.x+d.x*step,y=bomb.y+d.y*step,tile=this.tile(x,y);
        if (tile===1) break;
        ignite(x,y);
        if (tile===2) {
          this.tiles[y][x]=0; this.events.push({type:'crate',x,y});
          if (this.rand()<0.16 && !(x===this.portal.x && y===this.portal.y)) this.upgrades.push({x,y,type:this.rand()<0.65?'range':'capacity'});
          break;
        }
      }
    }
    this.checkHazards();
  }
  private collectUpgrade() {
    const index=this.upgrades.findIndex(p=>p.x===this.player.x && p.y===this.player.y); if (index<0) return;
    const upgrade=this.upgrades.splice(index,1)[0];
    if (upgrade.type==='range') this.player.range=Math.min(6,this.player.range+1);
    else this.player.capacity=Math.min(5,this.player.capacity+1);
    this.events.push({type:'upgrade',x:upgrade.x,y:upgrade.y});
  }
  private checkHazards() {
    for (const enemy of this.enemies) if (enemy.alive && this.fire.has(Game.key(enemy.x,enemy.y))) { enemy.alive=false; this.events.push({type:'enemy',x:enemy.x,y:enemy.y}); }
    const dangerous = this.fire.has(Game.key(this.player.x,this.player.y)) || this.enemies.some(e=>e.alive && e.x===this.player.x && e.y===this.player.y);
    if (dangerous && this.player.invincible<=0) {
      this.player.lives--; this.player.invincible=1.45; this.events.push({type:'hit',x:this.player.x,y:this.player.y});
      if (this.player.lives<=0) this.status='lost';
    }
  }
  private checkWin() {
    if (this.status==='running' && this.enemies.every(e=>!e.alive) && this.player.x===this.portal.x && this.player.y===this.portal.y && this.tile(this.portal.x,this.portal.y)===0) this.status='won';
  }
  drainEvents() { return this.events.splice(0); }
  get aliveEnemies() { return this.enemies.filter(e=>e.alive).length; }
}
