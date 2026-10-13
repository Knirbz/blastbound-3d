import type { Direction, Upgrade } from './logic';

export type RoomPlayer = { id: string; x: number; y: number; facing: Direction; character: string; moving: boolean };
export type RoomBomb = { networkId: string; ownerId: string; x: number; y: number; range: number; remote: boolean; pierce: boolean; slime: boolean; fuse: number };
export type RoomMessage =
  | { type: 'snapshot'; selfId: string; players: RoomPlayer[]; upgrades: Upgrade[]; bombs: RoomBomb[] }
  | { type: 'player'; player: RoomPlayer }
  | { type: 'left'; id: string }
  | { type: 'upgrades'; upgrades: Upgrade[] }
  | { type: 'bomb'; bomb: RoomBomb }
  | { type: 'bombMove'; networkId: string; x: number; y: number }
  | { type: 'detonate'; networkId: string };

const apiBase = (import.meta.env.VITE_LOBBY_API_URL || 'http://127.0.0.1:8787').replace(/\/$/, '');
async function readResponse<T>(response: Response): Promise<T> {
  const body = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(body.error || `Serverfehler ${response.status}`);
  return body;
}

export async function createRoom(): Promise<string> {
  const result = await readResponse<{ code: string }>(await fetch(`${apiBase}/api/lobbies`, { method: 'POST' }));
  return result.code;
}

export async function checkRoom(code: string): Promise<void> {
  await readResponse(await fetch(`${apiBase}/api/lobbies/${encodeURIComponent(code)}`));
}

export class LobbyConnection {
  private socket: WebSocket;
  private intentionalClose = false;
  onMessage: (message: RoomMessage) => void = () => {};
  onClose: () => void = () => {};

  private constructor(socket: WebSocket) { this.socket = socket; }

  static async join(code: string, character: string): Promise<{ connection: LobbyConnection; snapshot: Extract<RoomMessage, { type: 'snapshot' }> }> {
    await checkRoom(code);
    const socketUrl = new URL(`${apiBase}/api/lobbies/${code}/socket`);
    socketUrl.protocol = socketUrl.protocol === 'https:' ? 'wss:' : 'ws:';
    socketUrl.searchParams.set('character', character);
    const socket = new WebSocket(socketUrl);
    const connection = new LobbyConnection(socket);
    const snapshot = await new Promise<Extract<RoomMessage, { type: 'snapshot' }>>((resolve, reject) => {
      const timeout = window.setTimeout(() => { socket.close(); reject(new Error('Verbindung zur Lobby hat zu lange gedauert.')); }, 10000);
      socket.onmessage = event => {
        try {
          const message = JSON.parse(event.data) as RoomMessage;
          if (message.type === 'snapshot') {
            window.clearTimeout(timeout);
            resolve(message);
          } else connection.onMessage(message);
        } catch { /* Ignore malformed server messages. */ }
      };
      socket.onerror = () => { window.clearTimeout(timeout); reject(new Error('Lobby-Verbindung fehlgeschlagen.')); };
      socket.onclose = () => { window.clearTimeout(timeout); reject(new Error('Lobby-Verbindung wurde geschlossen.')); };
    });
    socket.onclose = () => { if (!connection.intentionalClose) connection.onClose(); };
    return { connection, snapshot };
  }

  send(data: unknown) { if (this.socket.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(data)); }
  close() { this.intentionalClose = true; this.socket.close(); }
}
