import test from 'node:test';
import assert from 'node:assert/strict';
import { Game, PLAYER_SPEED, ENEMY_SPEED, BOMB_FUSE, CLASSIC_UPGRADES } from '../src/logic.ts';

function openArena(game){for(const row of game.tiles)row.fill(0);game.difficulty='training';game.enemies.slice(1).forEach(enemy=>enemy.alive=false);game.enemies[0].x=11;game.enemies[0].y=9;}
function collect(game,type){game.upgrades.push({x:game.player.x,y:game.player.y,type});game.move(1,0,1/60,'right');}

test('a placed bomb ticks for the full fuse before exploding', () => {
  const game = new Game(2); game.start();
  game.enemies.forEach(enemy=>enemy.alive=false);
  assert.equal(game.placeBomb(),true);
  assert.equal(game.bombs[0].fuse,BOMB_FUSE);
  game.player.x=5; game.player.y=5;
  for (let i=0;i<27;i++) game.update(0.1);
  assert.equal(game.bombs.length,1);
  game.update(0.1); game.update(0.1);
  assert.equal(game.bombs.length,0);
  assert.equal(game.drainEvents().some(event=>event.type==='explode'),true);
});

test('player moves smoothly at the configured speed, including diagonals', () => {
  const game = new Game(2); game.start();
  for (const row of game.tiles) row.fill(0);
  game.move(1,0,1/60,'right');
  assert.ok(game.player.x > 1 && game.player.x < 2);
  assert.ok(Math.abs(game.player.x - 1 - PLAYER_SPEED/60) < 1e-9);
  const before = {x:game.player.x,y:game.player.y};
  game.move(1,1,1/60,'down');
  assert.ok(Math.abs(Math.hypot(game.player.x-before.x,game.player.y-before.y)-PLAYER_SPEED/60)<1e-9);
});

test('solid tiles stop the player without snapping to a grid cell', () => {
  const game = new Game(2); game.start();
  for (const row of game.tiles) row.fill(0);
  game.tiles[1][2] = 1;
  for (let i=0;i<20;i++) game.move(1,0,1/60,'right');
  assert.ok(game.player.x > 1.2 && game.player.x < 1.3);
  assert.equal(game.player.y,1);
});

test('bombs snap to the nearest cell but cannot be reentered after leaving', () => {
  const game = new Game(2); game.start();
  for (const row of game.tiles) row.fill(0);
  game.player.x=1.35;
  assert.equal(game.placeBomb(),true);
  assert.deepEqual({x:game.bombs[0].x,y:game.bombs[0].y},{x:1,y:1});
  for (let i=0;i<6;i++) game.move(1,0,1/60,'right');
  assert.equal(game.bombs[0].ownerPass,false);
  for (let i=0;i<10;i++) game.move(-1,0,1/60,'left');
  assert.ok(game.player.x > 1.57 && game.player.x < 1.66);
});

test('a partial overlap with fire can hurt the player', () => {
  const game = new Game(2); game.start();
  for (const row of game.tiles) row.fill(0);
  game.enemies.forEach(enemy=>enemy.alive=false);
  game.player.x=1.4;
  game.fire.set('2,1',0.5);
  game.update(0.01);
  assert.equal(game.player.lives,2);
});

test('enemies travel continuously and more slowly than the player', () => {
  const game = new Game(2,'medium'); game.start();
  for (const row of game.tiles) row.fill(0);
  const enemy=game.enemies[0]; enemy.x=5; enemy.y=5; enemy.targetX=5; enemy.targetY=5; enemy.moveTimer=0;
  game.enemies.slice(1).forEach(other=>other.alive=false);
  game.update(0.01);
  assert.equal(enemy.x,5); assert.equal(enemy.y,5);
  assert.equal(Math.abs(enemy.targetX-5)+Math.abs(enemy.targetY-5),1);
  game.update(0.1);
  const traveled=Math.hypot(enemy.x-5,enemy.y-5);
  assert.ok(Math.abs(traveled-ENEMY_SPEED*0.1)<1e-9);
  assert.ok(ENEMY_SPEED<PLAYER_SPEED);
});

test('training bots stand still and never place bombs', () => {
  const game = new Game(6,'training'); game.start();
  const initial=game.enemies.map(enemy=>({x:enemy.x,y:enemy.y}));
  for(let i=0;i<100;i++)game.update(0.1);
  assert.deepEqual(game.enemies.map(enemy=>({x:enemy.x,y:enemy.y})),initial);
  assert.equal(game.bombs.length,0);
  game.player.x=game.enemies[0].x;game.player.y=game.enemies[0].y;
  game.update(0.1);
  assert.equal(game.player.lives,3);
});

test('active bots place bombs, plan an escape, and do not use player capacity', () => {
  for(const [difficulty,range] of [['easy',1],['medium',1],['hard',2]]){
    const game=new Game(7,difficulty); game.start();
    for(const row of game.tiles)row.fill(0);
    game.tiles[5][6]=2;
    game.enemies.slice(1).forEach(enemy=>enemy.alive=false);
    const enemy=game.enemies[0];
    Object.assign(enemy,{x:5,y:5,targetX:5,targetY:5,moveTimer:0,bombCooldown:0});
    game.player.x=10;game.player.y=9;
    game.update(0.01);
    assert.equal(game.bombs.length,1,difficulty);
    assert.equal(game.bombs[0].owner,enemy.id,difficulty);
    assert.equal(game.bombs[0].range,range,difficulty);
    assert.equal(game.playerBombCount,0,difficulty);
    assert.ok(enemy.escapePath.length>0||enemy.targetX!==enemy.x||enemy.targetY!==enemy.y,difficulty);
    assert.equal(game.placeBomb(),true,difficulty);
    assert.equal(game.playerBombCount,1,difficulty);
  }
});

test('a bot follows its escape route before its own bomb detonates', () => {
  const game=new Game(8,'hard');game.start();
  for(const row of game.tiles)row.fill(0);
  game.tiles[5][6]=2;
  game.enemies.slice(1).forEach(enemy=>enemy.alive=false);
  const enemy=game.enemies[0];
  Object.assign(enemy,{x:5,y:5,targetX:5,targetY:5,moveTimer:0,bombCooldown:0});
  game.player.x=10;game.player.y=9;
  game.update(0.01);
  assert.equal(game.bombs[0].owner,enemy.id);
  for(let i=0;i<29;i++)game.update(0.1);
  assert.equal(enemy.alive,true);
  assert.equal(game.bombs.length,0);
});

test('hard bots route around solid walls instead of chasing into them', () => {
  const game=new Game(3,'hard');game.start();
  for(const row of game.tiles)row.fill(0);
  for(let y=1;y<=7;y++)game.tiles[y][6]=1;
  game.player.x=8;game.player.y=5;
  const enemy=game.enemies[0];
  Object.assign(enemy,{x:5,y:5,targetX:5,targetY:5,bombCooldown:100});
  game.moveEnemy(enemy);
  assert.equal(enemy.facing,'down');
  assert.deepEqual({x:enemy.targetX,y:enemy.targetY},{x:5,y:6});
});

test('stone and crates stop a cross explosion; the first crate is destroyed', () => {
  const game = new Game(4); game.start();
  for (const row of game.tiles) row.fill(0);
  game.tiles[1][4] = 2; game.tiles[1][6] = 1;
  game.player.x = 1; game.player.y = 1;
  game.bombs.push({x:2,y:1,fuse:0.01,range:5,ownerPass:false,id:1});
  game.update(0.02);
  assert.equal(game.tiles[1][4],0);
  assert.equal(game.fire.has('4,1'),true);
  assert.equal(game.fire.has('5,1'),false);
  assert.equal(game.fire.has('6,1'),false);
  const blast=game.drainEvents().find(event=>event.type==='explode');
  assert.deepEqual(blast.cells.find(cell=>cell.x===2&&cell.y===1),{x:2,y:1,distance:0,direction:null});
  assert.deepEqual(blast.cells.find(cell=>cell.x===4&&cell.y===1),{x:4,y:1,distance:2,direction:'right'});
  assert.equal(blast.cells.some(cell=>cell.x===5&&cell.y===1),false);
});

test('blast chains into another bomb', () => {
  const game = new Game(7); game.start();
  for (const row of game.tiles) row.fill(0);
  game.player.x=1; game.player.y=1;
  game.bombs=[
    {x:3,y:3,fuse:0.01,range:2,ownerPass:false,id:1},
    {x:5,y:3,fuse:2,range:2,ownerPass:false,id:2},
  ];
  game.update(0.02);
  assert.equal(game.bombs.length,0);
  assert.equal(game.fire.has('7,3'),true);
});

test('range and capacity pickups alter bombs, while a shield absorbs one hit', () => {
  const game = new Game(11); game.start();
  for (const row of game.tiles) row.fill(0);
  game.enemies.forEach(enemy=>enemy.alive=false);
  game.upgrades.push({x:1,y:1,type:'range'},{x:1,y:1,type:'capacity'},{x:1,y:1,type:'shield'});
  for (let i=0;i<3;i++) game.move(1,0,1/60,'right');
  assert.equal(game.player.range,2);
  assert.equal(game.player.capacity,2);
  assert.equal(game.player.shield,1);
  assert.equal(game.placeBomb(),true);
  assert.equal(game.bombs[0].range,2);
  game.fire.set('1,1',2);
  game.update(0.01);
  assert.equal(game.player.lives,3);
  assert.equal(game.player.shield,0);
  assert.equal(game.drainEvents().some(event=>event.type==='shield'),true);
  for (let i=0;i<9;i++) game.update(0.1);
  assert.equal(game.player.lives,2);
});

test('rare double fire pickup adds two tiles and respects the range cap',()=>{
  const game=new Game(245);game.start();openArena(game);
  collect(game,'range2');
  assert.equal(game.player.range,3);
  game.player.range=8;
  collect(game,'range2');
  assert.equal(game.player.range,9);
  game.player.x=3;game.player.y=3;
  assert.equal(game.placeBomb(),true);
  assert.equal(game.bombs[0].range,9);
});

test('powered and chain explosions carry distinct visual kinds', () => {
  const game = new Game(12); game.start();
  for (const row of game.tiles) row.fill(0);
  game.player.x=1; game.player.y=1;
  game.bombs=[
    {x:3,y:3,fuse:0.01,range:3,ownerPass:false,id:1},
    {x:5,y:3,fuse:2,range:2,ownerPass:false,id:2},
  ];
  game.update(0.02);
  const kinds=game.drainEvents().filter(event=>event.type==='explode').map(event=>event.kind);
  assert.deepEqual(kinds,['powered','chain']);
  assert.equal(game.fireKinds.get('3,3'),'powered');
  assert.equal(game.fireKinds.get('5,3'),'chain');
});

test('player needs all enemies defeated and the portal cleared to win', () => {
  const game = new Game(8); game.start();
  game.player.x=game.portal.x; game.player.y=game.portal.y;
  game.enemies.forEach(e=>e.alive=false);
  game.update(0.01);
  assert.equal(game.status,'running');
  game.tiles[game.portal.y][game.portal.x]=0;
  game.update(0.01);
  assert.equal(game.status,'won');
});

test('the complete classic item set is available',()=>{
  assert.deepEqual(CLASSIC_UPGRADES,['range','capacity','speed','remote','bombPass','blockPass','glove','kick','heart','maxRange','powerBomb','pierce','slime','skull']);
});

test('speed, heart, max range and one shot power bomb change player stats',()=>{
  const game=new Game(31);game.start();openArena(game);
  game.player.lives=2;
  for(const type of ['speed','heart','maxRange','powerBomb'])collect(game,type);
  assert.equal(game.player.speed,1);assert.equal(game.player.lives,3);assert.equal(game.player.range,9);
  assert.equal(game.placeBomb(),true);assert.equal(game.bombs[0].range,9);assert.equal(game.player.powerBomb,false);
});

test('remote bombs wait for the action key and chain into other bombs',()=>{
  const game=new Game(32);game.start();openArena(game);
  collect(game,'remote');game.player.x=3;game.player.y=3;
  assert.equal(game.placeBomb(),true);
  assert.equal(game.bombs[0].remote,true);
  game.player.x=5;game.player.y=5;
  for(let i=0;i<40;i++)game.update(0.1);
  assert.equal(game.bombs.length,1);
  assert.equal(game.useAction(),true);assert.equal(game.bombs.length,0);
  assert.equal(game.fire.has('3,3'),true);
});

test('losing remote control turns placed bombs back into timed bombs',()=>{
  const game=new Game(38);game.start();openArena(game);
  collect(game,'remote');game.player.x=3;game.player.y=3;game.placeBomb();
  game.player.x=1;game.player.y=1;game.fire.set('1,1',0.5);game.update(0.01);
  assert.equal(game.player.remote,false);assert.equal(game.bombs[0].remote,false);
  for(let i=0;i<13;i++)game.update(0.1);
  assert.equal(game.bombs.length,0);
});

test('bomb pass and block pass allow movement through their obstacles',()=>{
  const game=new Game(33);game.start();openArena(game);
  game.player.x=1;game.player.y=1;game.tiles[1][2]=2;
  for(let i=0;i<20;i++)game.move(1,0,1/60,'right');
  assert.ok(game.player.x<1.3);
  game.player.x=1;game.player.y=3;collect(game,'blockPass');game.player.x=1;game.player.y=1;
  for(let i=0;i<20;i++)game.move(1,0,1/60,'right');
  assert.ok(game.player.x>2);
  collect(game,'bombPass');
  game.bombs.push({x:3,y:1,id:99,range:1,fuse:2,ownerPass:false});
  for(let i=0;i<20;i++)game.move(1,0,1/60,'right');
  assert.ok(game.player.x>3);
});

test('kick moves a bomb, glove carries and throws it, slime bounces',()=>{
  const game=new Game(34);game.start();openArena(game);
  collect(game,'kick');collect(game,'glove');collect(game,'slime');
  game.player.x=1;game.player.y=1;game.bombs.push({x:2,y:1,id:100,range:1,fuse:2,ownerPass:false,slime:true});
  for(let i=0;i<12;i++)game.move(1,0,1/60,'right');
  assert.equal(game.bombs[0].moving,'right');
  game.update(0.1);game.update(0.03);assert.equal(game.bombs[0].x,3);
  assert.equal(game.useAction(),true);assert.equal(game.bombs[0].moving,undefined);
  game.player.x=game.bombs[0].x-0.7;game.player.y=1;game.player.facing='right';
  assert.equal(game.useAction(),true);assert.equal(game.carriedBombId,100);
  game.player.facing='right';assert.equal(game.useAction(),true);
  assert.equal(game.carriedBombId,null);assert.equal(game.bombs[0].moving,'right');assert.equal(game.bombs[0].bouncy,true);
  game.tiles[1][game.bombs[0].x+1]=1;game.update(0.1);game.update(0.03);
  assert.equal(game.bombs[0].moving,'left');
});

test('bomb button grabs only a bomb in front and throws ordinary bombs so they bounce',()=>{
  const game=new Game(341);game.start();openArena(game);
  collect(game,'glove');
  game.player.x=3;game.player.y=3;game.player.facing='right';
  game.bombs.push({x:4,y:3,id:200,range:1,fuse:2,ownerPass:false});
  assert.equal(game.useBombButton(),true);
  assert.equal(game.carriedBombId,200);
  assert.equal(game.bombs.length,1);
  game.tiles[3][7]=1;
  assert.equal(game.useBombButton(),true);
  assert.equal(game.carriedBombId,null);
  assert.equal(game.bombs[0].bouncy,true);
  assert.equal(game.bombs[0].moving,'right');
  assert.equal(game.bombs[0].x,6);
  game.update(0.1);game.update(0.03);
  assert.equal(game.bombs[0].moving,'left');
});

test('looking away from a nearby bomb places a new one instead of grabbing it',()=>{
  const game=new Game(342);game.start();openArena(game);
  collect(game,'glove');
  game.player.x=3;game.player.y=3;game.player.facing='up';game.player.capacity=2;
  game.bombs.push({x:4,y:3,id:201,range:1,fuse:2,ownerPass:false});
  assert.equal(game.useBombButton(),true);
  assert.equal(game.carriedBombId,null);
  assert.equal(game.bombs.length,2);
  assert.deepEqual({x:game.bombs[1].x,y:game.bombs[1].y},{x:3,y:3});
});

test('holding a direction keeps a kicked bomb moving during frame updates',()=>{
  const game=new Game(37);game.start();openArena(game);
  collect(game,'kick');game.player.x=1;game.player.y=1;
  game.bombs.push({x:2,y:1,id:101,range:1,fuse:2,ownerPass:false});
  for(let i=0;i<24;i++){game.move(1,0,1/60,'right');game.update(1/60);}
  assert.ok(game.bombs[0].x>=3);
});

test('super bombs pierce crates while ordinary bombs stop at the first',()=>{
  const game=new Game(35);game.start();openArena(game);
  game.tiles[3][4]=2;game.tiles[3][5]=2;
  game.player.x=3;game.player.y=3;collect(game,'pierce');game.player.x=3;game.player.y=3;
  game.player.range=3;game.placeBomb();game.bombs[0].fuse=0.01;game.player.x=1;game.player.y=1;game.update(0.02);
  assert.equal(game.tiles[3][4],0);assert.equal(game.tiles[3][5],0);
  assert.equal(game.fire.has('6,3'),true);
});

test('a skull causes a temporary curse and another pickup cures it',()=>{
  const game=new Game(36);game.start();openArena(game);
  collect(game,'skull');assert.equal(game.player.curse,8);assert.ok(game.player.curseType);
  collect(game,'range');assert.equal(game.player.curse,0);assert.equal(game.player.curseType,null);
});

test('the foundry is a distinct selectable arena with clear conveyor lanes',()=>{
  const game=new Game(40,'training','foundry');
  assert.equal(game.map,'foundry');
  assert.deepEqual(game.portal,{x:9,y:5});
  assert.equal(game.conveyors.size,14);
  for(const [key,direction] of game.conveyors){
    const [x,y]=key.split(',').map(Number);
    assert.equal(game.tile(x,y),0);
    assert.equal(direction,y===3?'right':'left');
  }
  assert.equal(game.tile(1,1),0);
  assert.equal(game.tile(11,9),0);
  game.setMap('courtyard');
  assert.equal(game.conveyors.size,0);
  assert.deepEqual(game.portal,{x:9,y:7});
  game.start();game.setMap('foundry');assert.equal(game.map,'courtyard');
});

test('panorama arena expands the grid while preserving corner spawns and one-cell corridors',()=>{
  const game=new Game(401,'training','panorama');
  assert.equal(game.width,19);
  assert.equal(game.tiles.length,11);
  assert.ok(game.tiles.every(row=>row.length===19));
  assert.equal(game.tile(18,5),1);
  assert.equal(game.tile(16,2),1);
  for(const [x,y] of [[1,1],[17,1],[1,9],[17,9],[16,9]])assert.equal(game.tile(x,y),0);
  for(const y of [3,7])for(let x=3;x<=15;x++)assert.equal(game.tile(x,y),0);
  assert.deepEqual(game.enemies.map(({x,y})=>({x,y})),[{x:17,y:1},{x:1,y:9},{x:17,y:9}]);
  assert.deepEqual(game.portal,{x:15,y:5});
  game.onlineMatch=true;game.reset(401);
  for(const [x,y] of [[1,5],[17,5],[9,1],[9,9],[9,5]])assert.equal(game.tile(x,y),0);
  game.setMap('courtyard');
  assert.equal(game.width,13);
  assert.ok(game.tiles.every(row=>row.length===13));
});

test('foundry conveyors transport a bomb while its fuse continues to tick',()=>{
  const game=new Game(41,'training','foundry');game.start();
  game.player.x=4;game.player.y=3;
  assert.equal(game.placeBomb(),true);
  assert.equal(game.bombs[0].x,4);
  for(let i=0;i<6;i++)game.update(0.1);
  assert.equal(game.bombs[0].x,5);
  assert.ok(game.bombs[0].fuse<BOMB_FUSE-0.5);
  game.bombs.push({x:6,y:3,id:999,range:1,fuse:2,ownerPass:false});
  for(let i=0;i<6;i++)game.update(0.1);
  assert.equal(game.bombs[0].x,5);
});

test('market keeps Bomberman corridors and carries bombs through checkout lanes',()=>{
  const game=new Game(42,'training','market');
  assert.equal(game.tiles.length,11);
  assert.equal(game.tiles[0].length,13);
  assert.deepEqual(game.portal,{x:9,y:5});
  assert.equal(game.tile(2,2),1);
  assert.equal(game.tile(3,3),0);
  assert.equal(game.tile(9,7),0);
  assert.equal(game.tile(2,3),1);
  assert.equal(game.tile(10,7),1);
  assert.equal(game.conveyors.size,14);
  assert.equal(game.tile(1,1),0);
  game.start();game.player.x=4;game.player.y=3;
  assert.equal(game.placeBomb(),true);
  for(let i=0;i<6;i++)game.update(0.1);
  assert.equal(game.bombs[0].x,5);
  assert.ok(game.bombs[0].fuse<BOMB_FUSE-0.5);
});

test('graveyard ghost graves warp bombs once while their fuses continue',()=>{
  const game=new Game(43,'training','graveyard');
  assert.equal(game.tiles.length,11);
  assert.equal(game.tiles[0].length,13);
  assert.deepEqual(game.ghostGraves,[{x:3,y:3},{x:9,y:7}]);
  assert.equal(game.tile(3,3),0);
  assert.equal(game.tile(9,7),0);
  assert.equal(game.tile(2,2),1);
  assert.equal(game.tile(game.portal.x,game.portal.y),2);
  game.start();game.player.x=3;game.player.y=3;
  assert.equal(game.placeBomb(),true);
  assert.deepEqual({x:game.bombs[0].x,y:game.bombs[0].y},{x:9,y:7});
  assert.equal(game.bombs[0].ownerPass,false);
  assert.deepEqual(game.drainEvents().find(event=>event.type==='warp')?.source,{x:3,y:3});
  game.update(0.1);
  assert.deepEqual({x:game.bombs[0].x,y:game.bombs[0].y},{x:9,y:7});
  assert.ok(game.bombs[0].fuse<BOMB_FUSE);
});

test('a blocked ghost grave delays transport, and sliding bombs also warp',()=>{
  const game=new Game(44,'training','graveyard');game.start();
  game.bombs.push({x:9,y:7,id:999,range:1,fuse:2,ownerPass:false,owner:999});
  game.player.x=3;game.player.y=3;
  assert.equal(game.placeBomb(),true);
  assert.deepEqual({x:game.bombs[1].x,y:game.bombs[1].y},{x:3,y:3});
  game.bombs.shift();game.update(0.02);
  assert.deepEqual({x:game.bombs[0].x,y:game.bombs[0].y},{x:9,y:7});
  game.bombs=[];game.tiles[3][2]=0;
  game.bombs.push({x:2,y:3,id:1000,range:1,fuse:2,ownerPass:false,moving:'right',moveTimer:0.01});
  game.update(0.02);
  assert.deepEqual({x:game.bombs[0].x,y:game.bombs[0].y},{x:9,y:7});
  assert.equal(game.bombs[0].moving,undefined);
});

test('pirate cannon lanes stay open and warn before alternating shots',()=>{
  const game=new Game(45,'training','pirate');
  assert.equal(game.tiles.length,11);
  assert.equal(game.tiles[0].length,13);
  assert.deepEqual(game.cannonLanes,[{x:2,y:3,direction:'right',endX:10},{x:10,y:7,direction:'left',endX:2}]);
  assert.equal(game.tile(2,3),1);
  assert.equal(game.tile(10,7),1);
  for(let x=3;x<=9;x++){assert.equal(game.tile(x,3),0);assert.equal(game.tile(x,7),0);}
  game.start();for(let i=0;i<31;i++)game.update(0.1);
  assert.equal(game.cannonWarning?.lane,0);
  for(let i=0;i<13;i++)game.update(0.1);
  assert.equal(game.cannonShots[0]?.direction,'right');
  assert.equal(game.drainEvents().some(event=>event.type==='cannonFire'),true);
  for(let i=0;i<70;i++)game.update(0.1);
  assert.equal(game.drainEvents().some(event=>event.type==='cannonFire'&&event.y===7),true);
});

test('a pirate cannon shot chains bombs and can hurt the player',()=>{
  const game=new Game(46,'training','pirate');game.start();
  game.bombs.push({x:4,y:3,id:999,range:1,fuse:30,ownerPass:false,owner:999,remote:true});
  for(let i=0;i<50;i++)game.update(0.1);
  assert.equal(game.bombs.length,0);
  assert.equal(game.drainEvents().some(event=>event.type==='explode'&&event.kind==='chain'),true);
  const playerGame=new Game(47,'training','pirate');playerGame.start();
  playerGame.player.x=5;playerGame.player.y=3;
  for(let i=0;i<50;i++)playerGame.update(0.1);
  assert.equal(playerGame.player.lives,2);
  assert.equal(playerGame.drainEvents().some(event=>event.type==='hit'),true);
});

test('the compact lobby stays playable and keeps spawning random upgrades',()=>{
  const game=new Game(51,'training','lobby');
  assert.deepEqual({x:game.player.x,y:game.player.y},{x:6,y:5});
  assert.equal(game.enemies.length,0);
  assert.equal(game.tile(3,2),0);
  assert.equal(game.tile(9,8),0);
  assert.equal(game.tile(2,5),1);
  assert.equal(game.tile(10,5),1);
  assert.equal(game.upgrades.length,3);
  assert.equal(new Set(game.upgrades.map(u=>`${u.x},${u.y}`)).size,3);
  game.start();
  for(let i=0;i<46;i++)game.update(0.1);
  assert.equal(game.upgrades.length,4);
  assert.equal(game.status,'running');
  assert.equal(game.placeBomb(),true);
  for(let i=0;i<29;i++)game.update(0.1);
  assert.equal(game.status,'running');
  assert.equal(game.player.lives,3);
  assert.equal(game.drainEvents().some(event=>event.type==='explode'),true);
});

test('online lobby leaves upgrade spawning to the room and remote bombs do not consume local capacity',()=>{
  const game=new Game(52,'training','lobby');
  game.onlineLobby=true;game.reset(52);game.start();
  assert.equal(game.upgrades.length,0);
  game.bombs.push({x:4,y:4,id:-1,networkId:'friend:1',remoteOwner:'friend',range:1,fuse:2,ownerPass:false});
  assert.equal(game.playerBombCount,0);
  assert.equal(game.placeBomb(),true);
  assert.equal(game.playerBombCount,1);
  for(let i=0;i<46;i++)game.update(0.1);
  assert.equal(game.upgrades.length,0);
});
