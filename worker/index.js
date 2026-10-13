import { DurableObject } from 'cloudflare:workers';

const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const upgradePool = ['range', 'capacity', 'speed', 'remote', 'bombPass', 'glove', 'kick', 'maxRange', 'powerBomb', 'pierce', 'slime', 'shield'];
const initialSpawns = [{ x: 6, y: 5 }, { x: 4, y: 3 }, { x: 8, y: 7 }, { x: 8, y: 3 }, { x: 4, y: 7 }, { x: 6, y: 3 }, { x: 6, y: 7 }, { x: 4, y: 5 }];
const matchSpawns = [{ x: 1, y: 1 }, { x: 11, y: 9 }, { x: 11, y: 1 }, { x: 1, y: 9 }, { x: 1, y: 5 }, { x: 11, y: 5 }, { x: 5, y: 1 }, { x: 7, y: 9 }];
const matchMaps = new Set(['courtyard', 'foundry', 'market', 'graveyard', 'pirate']);
const validCharacter = /^character-(?:female|male)-[abc]$/;
const response = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers } });

function allowedOrigin(origin) {
  if (!origin) return true;
  try {
    const url = new URL(origin);
    return url.hostname === 'blastbound-3d.pages.dev' || url.hostname.endsWith('.blastbound-3d.pages.dev') || (['localhost', '127.0.0.1'].includes(url.hostname) && ['http:', 'https:'].includes(url.protocol));
  } catch { return false; }
}

function cors(origin) { return { 'Access-Control-Allow-Origin': origin || '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Vary': 'Origin' }; }

function newCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, value => alphabet[value % alphabet.length]).join('');
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin');
    if (!allowedOrigin(origin)) return response({ error: 'Dieser Ursprung ist nicht zugelassen.' }, 403);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(origin) });
    const pathname = new URL(request.url).pathname;
    if (pathname === '/api/lobbies' && request.method === 'POST') {
      for (let attempt = 0; attempt < 5; attempt++) {
        const code = newCode();
        const room = env.ROOMS.get(env.ROOMS.idFromName(code));
        let result;
        try { result = await room.fetch('https://room.internal/initialize', { method: 'POST' }); }
        catch (error) { console.error('Room initialize request failed', error?.stack || error); throw error; }
        if (result.status === 201) return response({ code }, 201, cors(origin));
      }
      return response({ error: 'Lobby konnte nicht erstellt werden. Bitte erneut versuchen.' }, 503, cors(origin));
    }
    const match = pathname.match(/^\/api\/lobbies\/([A-HJ-NP-Z2-9]{6})(\/socket)?$/);
    if (!match) return response({ error: 'Nicht gefunden.' }, 404, cors(origin));
    const room = env.ROOMS.get(env.ROOMS.idFromName(match[1]));
    if (match[2] && request.method === 'GET') return room.fetch(new Request(`https://room.internal/socket${new URL(request.url).search}`, request));
    if (!match[2] && request.method === 'GET') {
      const result = await room.fetch('https://room.internal/status');
      return response(await result.json(), result.status, cors(origin));
    }
    return response({ error: 'Methode nicht erlaubt.' }, 405, cors(origin));
  },
};

export class LobbyRoom extends DurableObject {
  rates = new WeakMap();
  async room() {
    const room = await this.ctx.storage.get('room');
    if (room && !room.settings) { room.settings = { map: 'courtyard', cpu: false }; room.phase = 'practice'; room.hostId = this.players()[0]?.id || ''; room.cpuAlive = false; await this.save(room); }
    return room;
  }
  async save(room) { await this.ctx.storage.put('room', room); }
  players() { return this.ctx.getWebSockets().map(socket => socket.deserializeAttachment()).filter(Boolean); }
  roomState(room) { return { type: 'room', players: this.players(), hostId: room.hostId, settings: room.settings, phase: room.phase, upgrades: room.upgrades }; }
  announce(room) { this.broadcast(this.roomState(room)); }
  async finishIfDecided(room) {
    if (room.phase !== 'match') return;
    const survivors = this.players().filter(player => !player.eliminated);
    const cpuAlive = !!room.settings.cpu && room.cpuAlive;
    if (survivors.length + Number(cpuAlive) > 1) return;
    const winnerId = survivors.length === 1 ? survivors[0].id : null;
    room.phase = 'practice'; room.cpuAlive = false; room.bombs = []; room.upgrades = []; room.lastSpawn = Date.now();
    for (const [index, socket] of this.ctx.getWebSockets().entries()) {
      const player = socket.deserializeAttachment();
      if (player) { Object.assign(player, initialSpawns[index], { ready: false, eliminated: false, moving: false }); socket.serializeAttachment(player); }
    }
    for (let i = 0; i < 3; i++) this.spawnUpgrade(room);
    await this.save(room);
    this.broadcast({ type: 'ended', winnerId });
    this.announce(room);
  }
  broadcast(data, except = null) {
    const message = JSON.stringify(data);
    for (const socket of this.ctx.getWebSockets()) if (socket !== except) {
      try { socket.send(message); } catch { /* Closed socket is cleaned up by webSocketClose. */ }
    }
  }
  spawnUpgrade(room) {
    if (room.upgrades.length >= 5) return false;
    const occupied = new Set(room.upgrades.map(item => `${item.x},${item.y}`));
    const players = this.players();
    const free = [];
    for (let y = 2; y <= 8; y++) for (let x = 3; x <= 9; x++) {
      if (!occupied.has(`${x},${y}`) && players.every(player => Math.hypot(player.x - x, player.y - y) > 1.1)) free.push({ x, y });
    }
    if (!free.length) return false;
    const cell = free[Math.floor(Math.random() * free.length)];
    room.upgrades.push({ ...cell, type: upgradePool[Math.floor(Math.random() * upgradePool.length)] });
    return true;
  }
  async fetch(request) {
    try { return await this.handleFetch(request); }
    catch (error) { console.error('LobbyRoom fetch failed', error?.stack || error); throw error; }
  }
  async handleFetch(request) {
    const url = new URL(request.url);
    let room = await this.room();
    if (url.pathname === '/initialize' && request.method === 'POST') {
      if (room) return response({ error: 'Code bereits vergeben.' }, 409);
      room = { createdAt: Date.now(), lastSpawn: Date.now(), upgrades: [], bombs: [], hostId: '', settings: { map: 'courtyard', cpu: false }, phase: 'practice', cpuAlive: false };
      for (let i = 0; i < 3; i++) this.spawnUpgrade(room);
      await this.save(room);
      return response({ ok: true }, 201);
    }
    if (!room || Date.now() - room.createdAt > 24 * 60 * 60 * 1000) return response({ error: 'Lobby nicht gefunden oder abgelaufen.' }, 404);
    if (url.pathname === '/status') return response({ code: this.ctx.id.name, players: this.players().length, maxPlayers: 8, phase: room.phase });
    if (url.pathname !== '/socket' || request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') return response({ error: 'Nicht gefunden.' }, 404);
    if (this.players().length >= 8) return response({ error: 'Die Lobby ist voll.' }, 409);
    if (room.phase === 'match') return response({ error: 'Das Match läuft bereits. Bitte warte auf die nächste Runde.' }, 409);
    const character = url.searchParams.get('character') || '';
    if (!validCharacter.test(character)) return response({ error: 'Ungültige Figur.' }, 400);
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    const spawn = initialSpawns[this.players().length];
    const player = { id: crypto.randomUUID(), x: spawn.x, y: spawn.y, facing: 'down', character, moving: false, ready: false, eliminated: false };
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment(player);
    if (!room.hostId) { room.hostId = player.id; await this.save(room); }
    const now = Date.now();
    room.bombs = room.bombs.filter(bomb => bomb.expiresAt > now);
    server.send(JSON.stringify({ type: 'snapshot', selfId: player.id, players: this.players(), upgrades: room.upgrades, bombs: room.bombs.map(bomb => ({ ...bomb, fuse: Math.max(0.1, (bomb.expiresAt - now) / 1000) })), hostId: room.hostId, settings: room.settings, phase: room.phase }));
    this.broadcast({ type: 'player', player }, server);
    this.announce(room);
    return new Response(null, { status: 101, webSocket: client });
  }
  async webSocketMessage(socket, raw) {
    const player = socket.deserializeAttachment();
    if (!player || typeof raw !== 'string' || raw.length > 6000) return;
    const now = Date.now();
    const rate = this.rates.get(socket) || { start: now, count: 0 };
    if (now - rate.start > 1000) { rate.start = now; rate.count = 0; }
    if (++rate.count > 80) { socket.close(1008, 'Zu viele Nachrichten'); return; }
    this.rates.set(socket, rate);
    let message;
    try { message = JSON.parse(raw); } catch { return; }
    const room = await this.room();
    if (!room) return;
    if (message.type === 'ready' && room.phase === 'practice') {
      player.ready = !!message.ready; socket.serializeAttachment(player); this.announce(room); return;
    }
    if (message.type === 'settings' && room.phase === 'practice' && player.id === room.hostId) {
      if (!matchMaps.has(message.map) || typeof message.cpu !== 'boolean') return;
      room.settings = { map: message.map, cpu: message.cpu };
      for (const peer of this.ctx.getWebSockets()) { const member = peer.deserializeAttachment(); if (member) { member.ready = false; peer.serializeAttachment(member); } }
      await this.save(room); this.announce(room); return;
    }
    if (message.type === 'start' && room.phase === 'practice' && player.id === room.hostId) {
      const members = this.players();
      if (!members.every(member => member.ready) || members.length < 2 && !room.settings.cpu) return;
      room.phase = 'match'; room.seed = crypto.getRandomValues(new Uint32Array(1))[0]; room.cpuAlive = room.settings.cpu;
      room.bombs = []; room.upgrades = [];
      for (let i = 0; i < this.ctx.getWebSockets().length; i++) {
        const peer = this.ctx.getWebSockets()[i], member = peer.deserializeAttachment();
        if (!member) continue;
        Object.assign(member, matchSpawns[i], { eliminated: false, moving: false, facing: 'down' }); peer.serializeAttachment(member);
      }
      await this.save(room);
      this.broadcast({ type: 'start', players: this.players(), settings: room.settings, seed: room.seed });
      return;
    }
    if (message.type === 'world' && room.phase === 'match' && player.id === room.hostId) {
      if (!Array.isArray(message.tiles) || message.tiles.length !== 11 || !Array.isArray(message.upgrades) || !Array.isArray(message.enemies)) return;
      this.broadcast({ type: 'world', tiles: message.tiles, upgrades: message.upgrades, enemies: message.enemies, cannonShots: message.cannonShots || [], cannonWarning: message.cannonWarning || null }, socket);
      room.cpuAlive = !!room.settings.cpu && message.enemies.some(enemy => enemy.alive);
      await this.finishIfDecided(room);
      return;
    }
    if (message.type === 'out' && room.phase === 'match') {
      if (player.eliminated) return;
      player.eliminated = true; player.moving = false; socket.serializeAttachment(player);
      if (room.hostId === player.id) room.hostId = this.players().find(member => !member.eliminated)?.id || player.id;
      await this.save(room);
      this.announce(room); await this.finishIfDecided(room); return;
    }
    if (message.type === 'position') {
      const match = room.phase === 'match';
      if (match && player.eliminated) return;
      if (![message.x, message.y].every(Number.isFinite) || message.x < (match ? 0.7 : 2.7) || message.x > (match ? 11.3 : 9.3) || message.y < (match ? 0.7 : 1.7) || message.y > (match ? 9.3 : 8.3)) return;
      if (!['up', 'down', 'left', 'right'].includes(message.facing)) return;
      player.x = message.x; player.y = message.y; player.facing = message.facing; player.moving = !!message.moving;
      socket.serializeAttachment(player);
      this.broadcast({ type: 'player', player }, socket);
      let movedBomb = false;
      if (Array.isArray(message.bombs)) for (const update of message.bombs.slice(0, 9)) {
        if (![update.id, update.x, update.y].every(Number.isInteger) || update.x < 3 || update.x > 9 || update.y < 2 || update.y > 8) continue;
        const bomb = room.bombs.find(item => item.networkId === `${player.id}:${update.id}`);
        if (bomb && (bomb.x !== update.x || bomb.y !== update.y)) {
          bomb.x = update.x; bomb.y = update.y; movedBomb = true;
          this.broadcast({ type: 'bombMove', networkId: bomb.networkId, x: bomb.x, y: bomb.y }, socket);
        }
      }
      if (movedBomb) await this.save(room);
      if (!match && Date.now() - room.lastSpawn >= 4500) {
        room.lastSpawn = Date.now();
        if (this.spawnUpgrade(room)) this.broadcast({ type: 'upgrades', upgrades: room.upgrades });
        await this.save(room);
      }
      return;
    }
    if (message.type === 'pickup' && room.phase === 'match') {
      if (player.eliminated || ![message.x, message.y].every(Number.isInteger) || Math.hypot(player.x - message.x, player.y - message.y) >= 0.8) return;
      this.broadcast({ type: 'pickup', x: message.x, y: message.y, playerId: player.id });
      return;
    }
    if (message.type === 'pickup' && room.phase === 'practice') {
      const index = room.upgrades.findIndex(item => item.x === message.x && item.y === message.y && Math.hypot(player.x - item.x, player.y - item.y) < 0.8);
      if (index < 0) return;
      room.upgrades.splice(index, 1);
      await this.save(room);
      this.broadcast({ type: 'upgrades', upgrades: room.upgrades });
      return;
    }
    if (message.type === 'bomb') {
      const { x, y, id } = message;
      const match = room.phase === 'match';
      const bot = match && player.id === room.hostId && message.bot === true;
      if (player.eliminated || ![x, y, id].every(Number.isInteger) || x < (match ? 1 : 3) || x > (match ? 11 : 9) || y < (match ? 1 : 2) || y > (match ? 9 : 8) || !bot && Math.hypot(player.x - x, player.y - y) > 1.2) return;
      if (room.bombs.filter(bomb => bomb.ownerId === player.id).length >= 9) return;
      const ownerId = bot ? 'cpu' : player.id;
      const networkId = `${ownerId}:${id}`;
      if (room.bombs.some(bomb => bomb.networkId === networkId)) return;
      const bomb = { networkId, ownerId, x, y, range: Math.max(1, Math.min(9, Number(message.range) || 1)), remote: !!message.remote, pierce: !!message.pierce, slime: !!message.slime, expiresAt: Date.now() + (message.remote ? 120000 : 2800) };
      room.bombs.push(bomb);
      await this.save(room);
      this.broadcast({ type: 'bomb', bomb: { ...bomb, fuse: 2.8 } }, socket);
      return;
    }
    if (message.type === 'detonate' && Number.isInteger(message.id)) {
      const networkId = `${room.phase === 'match' && player.id === room.hostId && message.bot === true ? 'cpu' : player.id}:${message.id}`;
      const index = room.bombs.findIndex(bomb => bomb.networkId === networkId);
      if (index < 0) return;
      const [bomb] = room.bombs.splice(index, 1);
      const before = room.upgrades.length;
      if (room.phase === 'practice') room.upgrades = room.upgrades.filter(item => !(item.x === bomb.x && Math.abs(item.y - bomb.y) <= bomb.range || item.y === bomb.y && Math.abs(item.x - bomb.x) <= bomb.range));
      await this.save(room);
      this.broadcast({ type: 'detonate', networkId }, socket);
      if (room.upgrades.length !== before) this.broadcast({ type: 'upgrades', upgrades: room.upgrades });
    }
  }
  async webSocketClose(socket) {
    const player = socket.deserializeAttachment();
    if (!player) return;
    this.broadcast({ type: 'left', id: player.id }, socket);
    const room = await this.room(); if (!room) return;
    if (room.hostId === player.id) room.hostId = this.players().find(member => member.id !== player.id)?.id || '';
    await this.save(room); this.announce(room); await this.finishIfDecided(room);
  }
  async webSocketError(socket) { await this.webSocketClose(socket); }
}

