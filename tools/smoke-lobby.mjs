// Run manually after deployment: node tools/smoke-lobby.mjs [worker URL]
import assert from 'node:assert/strict';

const base = process.argv[2] || 'http://127.0.0.1:8787';
const created = await fetch(`${base}/api/lobbies`, { method: 'POST' });
assert.equal(created.status, 201);
const { code } = await created.json();
assert.match(code, /^[A-HJ-NP-Z2-9]{6}$/);
const status = await fetch(`${base}/api/lobbies/${code}`);
assert.equal((await status.json()).players, 0);

function connect(character) {
  const url = new URL(`${base}/api/lobbies/${code}/socket`);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.searchParams.set('character', character);
  const socket = new WebSocket(url);
  const queue = [];
  const waiting = [];
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    const waiter = waiting.find(entry => entry.type === message.type);
    if (waiter) { waiting.splice(waiting.indexOf(waiter), 1); waiter.resolve(message); }
    else queue.push(message);
  });
  const next = type => new Promise((resolve, reject) => {
    const queued = queue.find(message => message.type === type);
    if (queued) { queue.splice(queue.indexOf(queued), 1); resolve(queued); return; }
    const entry = { type, resolve };
    waiting.push(entry);
    setTimeout(() => { if (waiting.includes(entry)) { waiting.splice(waiting.indexOf(entry), 1); reject(new Error(`Timeout waiting for ${type}`)); } }, 5000);
  });
  return { socket, next };
}

const host = connect('character-female-b');
const first = await host.next('snapshot');
assert.equal(first.players.length, 1);
assert.equal(first.upgrades.length, 3);
const guest = connect('character-male-a');
const second = await guest.next('snapshot');
assert.equal(second.players.length, 2);
assert.notEqual(first.selfId, second.selfId);
assert.equal((await host.next('player')).player.id, second.selfId);

guest.socket.send(JSON.stringify({ type: 'position', x: 5, y: 5, facing: 'left', moving: true }));
assert.equal((await host.next('player')).player.facing, 'left');
const upgrade = first.upgrades[0];
host.socket.send(JSON.stringify({ type: 'position', x: upgrade.x, y: upgrade.y, facing: 'down', moving: true }));
host.socket.send(JSON.stringify({ type: 'pickup', x: upgrade.x, y: upgrade.y }));
assert.equal((await guest.next('upgrades')).upgrades.length, 2);
const edgeUpgrade = first.upgrades[1];
const edgeX = edgeUpgrade.x === 9 ? edgeUpgrade.x - 0.7 : edgeUpgrade.x + 0.7;
host.socket.send(JSON.stringify({ type: 'position', x: edgeX, y: edgeUpgrade.y, facing: 'right', moving: true }));
host.socket.send(JSON.stringify({ type: 'pickup', x: edgeUpgrade.x, y: edgeUpgrade.y, playerX: edgeX, playerY: edgeUpgrade.y }));
assert.equal((await guest.next('upgrades')).upgrades.length, 1);
guest.socket.send(JSON.stringify({ type: 'bomb', id: 1, x: 5, y: 5, range: 2 }));
const bomb = (await host.next('bomb')).bomb;
assert.equal(bomb.ownerId, second.selfId);
guest.socket.send(JSON.stringify({ type: 'position', x: 5, y: 5, facing: 'left', moving: false, bombs: [{ networkId: bomb.networkId, x: 6, y: 5 }] }));
assert.equal((await host.next('bombMove')).x, 6);
guest.socket.send(JSON.stringify({ type: 'detonate', id: 1 }));
assert.equal((await host.next('detonate')).networkId, bomb.networkId);

guest.socket.close();host.socket.close();
console.log(`Online lobby ${code}: two players, movement, bomb movement, detonation and pickup passed.`);
