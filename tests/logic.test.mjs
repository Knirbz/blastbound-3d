import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/logic.ts';

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
