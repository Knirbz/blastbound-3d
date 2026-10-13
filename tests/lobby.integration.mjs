import assert from 'node:assert/strict';

const base = process.env.LOBBY_URL || 'http://127.0.0.1:8787';
const roomResponse = await fetch(`${base}/api/lobbies`, { method: 'POST' });
assert.equal(roomResponse.status, 201);
const { code } = await roomResponse.json();

function connect(character) {
  const url = new URL(`${base}/api/lobbies/${code}/socket`);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.searchParams.set('character', character);
  const socket = new WebSocket(url);
  const messages = [];
  const listeners = [];
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    messages.push(message);
    for (const listener of [...listeners]) listener();
  });
  return {
    socket,
    send: message => socket.send(JSON.stringify(message)),
    next(type, predicate = () => true) {
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => { listeners.splice(listeners.indexOf(check), 1); reject(new Error(`Timed out waiting for ${type}`)); }, 5000);
        function check() {
          const index = messages.findIndex(message => message.type === type && predicate(message));
          if (index < 0) return;
          const [message] = messages.splice(index, 1);
          clearTimeout(timeout);
          listeners.splice(listeners.indexOf(check), 1);
          resolve(message);
        }
        listeners.push(check);
        check();
      });
    },
  };
}

const host = connect('character-female-a');
const hostSnapshot = await host.next('snapshot');
assert.equal(hostSnapshot.hostId, hostSnapshot.selfId);
assert.equal(hostSnapshot.phase, 'practice');
const guest = connect('character-male-a');
const guestSnapshot = await guest.next('snapshot');
assert.equal(guestSnapshot.players.length, 2);
host.send({ type: 'settings', map: 'pirate', cpu: true });
const settings = await host.next('room', message => message.settings.map === 'pirate');
assert.equal(settings.players.every(player => !player.ready), true);
host.send({ type: 'ready', ready: true });
guest.send({ type: 'ready', ready: true });
await host.next('room', message => message.players.length === 2 && message.players.every(player => player.ready));
guest.send({ type: 'start' });
const statusBeforeHostStart = await (await fetch(`${base}/api/lobbies/${code}`)).json();
assert.equal(statusBeforeHostStart.phase, 'practice');
host.send({ type: 'start' });
const hostStart = await host.next('start');
const guestStart = await guest.next('start');
assert.equal(hostStart.seed, guestStart.seed);
assert.equal(hostStart.settings.map, 'pirate');
assert.equal(hostStart.players.length, 2);
guest.send({ type: 'out' });
await host.next('room', message => message.players.some(player => player.id === guestSnapshot.selfId && player.eliminated));
host.send({ type: 'world', tiles: Array.from({ length: 11 }, () => Array(13).fill(0)), upgrades: [], enemies: [] });
const end = await host.next('ended');
assert.equal(end.winnerId, hostSnapshot.selfId);
await host.next('room', message => message.phase === 'practice' && message.players.every(player => !player.ready));
host.socket.close();guest.socket.close();
console.log(`Online lobby flow passed for room ${code}`);
