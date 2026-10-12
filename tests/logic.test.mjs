import test from 'node:test';
import assert from 'node:assert/strict';
import { Game, PLAYER_SPEED, ENEMY_SPEED } from '../src/logic.ts';

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
  const game = new Game(2); game.start();
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
