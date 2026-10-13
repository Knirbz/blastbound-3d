import { DurableObject } from 'cloudflare:workers';

const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const upgradePool = ['range', 'capacity', 'speed', 'remote', 'bombPass', 'glove', 'kick', 'maxRange', 'powerBomb', 'pierce', 'slime', 'shield'];
const initialSpawns = [{ x: 6, y: 5 }, { x: 4, y: 3 }, { x: 8, y: 7 }, { x: 8, y: 3 }, { x: 4, y: 7 }, { x: 6, y: 3 }, { x: 6, y: 7 }, { x: 4, y: 5 }];
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
        const result = await room.fetch('https://room.internal/initialize', { method: 'POST' });
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
  async room() { return this.ctx.storage.get('room'); }
  async save(room) { await this.ctx.storage.put('room', room); }
  players() { return this.ctx.getWebSockets().map(socket => socket.deserializeAttachment()).filter(Boolean); }
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
    const url = new URL(request.url);
    let room = await this.room();
    if (url.pathname === '/initialize' && request.method === 'POST') {
      if (room) return response({ error: 'Code bereits vergeben.' }, 409);
      room = { createdAt: Date.now(), lastSpawn: Date.now(), upgrades: [], bombs: [] };
      for (let i = 0; i < 3; i++) this.spawnUpgrade(room);
      await this.save(room);
      return response({ ok: true }, 201);
    }
    if (!room || Date.now() - room.createdAt > 24 * 60 * 60 * 1000) return response({ error: 'Lobby nicht gefunden oder abgelaufen.' }, 404);
    if (url.pathname === '/status') return response({ code: this.ctx.id.name, players: this.players().length, maxPlayers: 8 });
    if (url.pathname !== '/socket' || request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') return response({ error: 'Nicht gefunden.' }, 404);
    if (this.players().length >= 8) return response({ error: 'Die Lobby ist voll.' }, 409);
    const character = url.searchParams.get('character') || '';
    if (!validCharacter.test(character)) return response({ error: 'Ungültige Figur.' }, 400);
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    const spawn = initialSpawns[this.players().length];
    const player = { id: crypto.randomUUID(), x: spawn.x, y: spawn.y, facing: 'down', character, moving: false };
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment(player);
    const now = Date.now();
    room.bombs = room.bombs.filter(bomb => bomb.expiresAt > now);
    server.send(JSON.stringify({ type: 'snapshot', selfId: player.id, players: this.players(), upgrades: room.upgrades, bombs: room.bombs.map(bomb => ({ ...bomb, fuse: Math.max(0.1, (bomb.expiresAt - now) / 1000) })) }));
    this.broadcast({ type: 'player', player }, server);
    return new Response(null, { status: 101, webSocket: client });
  }
  async webSocketMessage(socket, raw) {
    const player = socket.deserializeAttachment();
    if (!player || typeof raw !== 'string' || raw.length > 1000) return;
    const now = Date.now();
    const rate = this.rates.get(socket) || { start: now, count: 0 };
    if (now - rate.start > 1000) { rate.start = now; rate.count = 0; }
    if (++rate.count > 80) { socket.close(1008, 'Zu viele Nachrichten'); return; }
    this.rates.set(socket, rate);
    let message;
    try { message = JSON.parse(raw); } catch { return; }
    const room = await this.room();
    if (!room) return;
    if (message.type === 'position') {
      if (![message.x, message.y].every(Number.isFinite) || message.x < 2.7 || message.x > 9.3 || message.y < 1.7 || message.y > 8.3) return;
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
      if (Date.now() - room.lastSpawn >= 4500) {
        room.lastSpawn = Date.now();
        if (this.spawnUpgrade(room)) this.broadcast({ type: 'upgrades', upgrades: room.upgrades });
        await this.save(room);
      }
      return;
    }
    if (message.type === 'pickup') {
      const index = room.upgrades.findIndex(item => item.x === message.x && item.y === message.y && Math.hypot(player.x - item.x, player.y - item.y) < 0.8);
      if (index < 0) return;
      room.upgrades.splice(index, 1);
      await this.save(room);
      this.broadcast({ type: 'upgrades', upgrades: room.upgrades });
      return;
    }
    if (message.type === 'bomb') {
      const { x, y, id } = message;
      if (![x, y, id].every(Number.isInteger) || x < 3 || x > 9 || y < 2 || y > 8 || Math.hypot(player.x - x, player.y - y) > 1.2) return;
      if (room.bombs.filter(bomb => bomb.ownerId === player.id).length >= 9) return;
      const networkId = `${player.id}:${id}`;
      if (room.bombs.some(bomb => bomb.networkId === networkId)) return;
      const bomb = { networkId, ownerId: player.id, x, y, range: Math.max(1, Math.min(9, Number(message.range) || 1)), remote: !!message.remote, pierce: !!message.pierce, slime: !!message.slime, expiresAt: Date.now() + (message.remote ? 120000 : 2800) };
      room.bombs.push(bomb);
      await this.save(room);
      this.broadcast({ type: 'bomb', bomb: { ...bomb, fuse: 2.8 } }, socket);
      return;
    }
    if (message.type === 'detonate' && Number.isInteger(message.id)) {
      const networkId = `${player.id}:${message.id}`;
      const index = room.bombs.findIndex(bomb => bomb.networkId === networkId);
      if (index < 0) return;
      const [bomb] = room.bombs.splice(index, 1);
      const before = room.upgrades.length;
      room.upgrades = room.upgrades.filter(item => !(item.x === bomb.x && Math.abs(item.y - bomb.y) <= bomb.range || item.y === bomb.y && Math.abs(item.x - bomb.x) <= bomb.range));
      await this.save(room);
      this.broadcast({ type: 'detonate', networkId }, socket);
      if (room.upgrades.length !== before) this.broadcast({ type: 'upgrades', upgrades: room.upgrades });
    }
  }
  webSocketClose(socket) {
    const player = socket.deserializeAttachment();
    if (player) this.broadcast({ type: 'left', id: player.id }, socket);
  }
  webSocketError(socket) {
    const player = socket.deserializeAttachment();
    if (player) this.broadcast({ type: 'left', id: player.id }, socket);
  }
}

