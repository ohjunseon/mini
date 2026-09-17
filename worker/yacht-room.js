import { DurableObject } from "cloudflare:workers";
import * as Engine from '../mini69/yacht-engine.js';
import * as AI from '../mini69/yacht-ai.js';

const MAX_MSG_LEN = 4000;
const ROOM_IDLE_MS = 1000 * 60 * 60 * 6;

export class YachtRoom extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.seatCount = 4;
    this.fillBots = true;
    this.botLevel = 'easy';
    this.seats = [];
    this.hostSeatId = null;
    this.started = false;
    this.game = null;

    ctx.blockConcurrencyWhile(async () => {
      const saved = await ctx.storage.get('state');
      if (saved) {
        this.seatCount = saved.seatCount;
        this.fillBots = saved.fillBots;
        this.botLevel = saved.botLevel;
        this.seats = saved.seats;
        this.hostSeatId = saved.hostSeatId;
        this.started = saved.started;
        this.game = saved.game;
      }
    });
  }

  async persist() {
    await this.ctx.storage.put('state', {
      seatCount: this.seatCount, fillBots: this.fillBots, botLevel: this.botLevel,
      seats: this.seats, hostSeatId: this.hostSeatId, started: this.started, game: this.game,
    });
    await this.ctx.storage.setAlarm(Date.now() + ROOM_IDLE_MS);
  }

  alarm() { this.ctx.storage.deleteAll(); }

  slotOf(ws) {
    const tags = this.ctx.getTags(ws);
    return tags[0] || null;
  }

  broadcast(payload) {
    const msg = JSON.stringify(payload);
    for (const ws of this.ctx.getWebSockets()) {
      try { ws.send(msg); } catch (e) { /* closing */ }
    }
  }

  sendTo(seatId, payload) {
    const msg = JSON.stringify(payload);
    for (const ws of this.ctx.getWebSockets()) {
      if (this.slotOf(ws) === seatId) { try { ws.send(msg); } catch (e) { /* closing */ } }
    }
  }

  seatName(id) {
    const s = this.seats.find(x => x.id === id);
    return s ? s.name : id;
  }

  broadcastLobby() {
    this.broadcast({ type: 'lobby', seats: this.seats, status: this.started ? 'started' : 'waiting' });
  }

  broadcastSync() {
    this.broadcast({ type: 'sync', state: this.game, seats: this.seats });
  }

  log(message) {
    this.broadcast({ type: 'log', message });
  }

  async fetch(request) {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('expected websocket', { status: 400 });
    }
    const url = new URL(request.url);
    const name = (url.searchParams.get('name') || '익명').slice(0, 20);

    if (this.seats.length === 0) {
      this.seatCount = 4;
      this.seats = Array.from({ length: 4 }, (_, i) => ({ id: 'S' + i, name: null, isBot: false, botLevel: null, connected: false }));
      this.hostSeatId = 'S0';
    }

    let seatId = null;
    if (!this.started) {
      for (let i = 0; i < this.seatCount; i++) {
        if (!this.seats[i].connected && !this.seats[i].isBot) { seatId = this.seats[i].id; break; }
      }
    } else {
      for (const s of this.seats) {
        if (!s.isBot && !s.connected) { seatId = s.id; break; }
      }
    }
    if (!seatId) {
      return new Response(JSON.stringify({ error: 'room full' }), { status: 409 });
    }

    const pair = new WebSocketPair();
    const client = pair[0], server = pair[1];
    this.ctx.acceptWebSocket(server, [seatId]);

    const seat = this.seats.find(s => s.id === seatId);
    seat.name = name; seat.connected = true; seat.isBot = false;
    await this.persist();

    server.send(JSON.stringify({ type: 'hello', seatId, isHost: seatId === this.hostSeatId }));
    if (this.started) this.sendTo(seatId, { type: 'sync', state: this.game, seats: this.seats });
    this.broadcastLobby();
    if (this.started) this.broadcastSync();

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws, message) {
    if (typeof message !== 'string' || message.length > MAX_MSG_LEN) return;
    let data;
    try { data = JSON.parse(message); } catch (e) { return; }
    const seatId = this.slotOf(ws);
    if (!seatId) return;
    try {
      await this.handleMessage(seatId, data);
    } catch (e) {
      this.sendTo(seatId, { type: 'error', message: '처리 중 오류가 발생했습니다.' });
    }
  }

  async handleMessage(seatId, data) {
    if (data.type === 'configure') {
      if (seatId !== this.hostSeatId || this.started) return;
      const n = Math.max(2, Math.min(4, parseInt(data.seatCount, 10) || 4));
      this.seatCount = n;
      const newSeats = [];
      for (let i = 0; i < n; i++) newSeats.push(this.seats[i] || { id: 'S' + i, name: null, isBot: false, botLevel: null, connected: false });
      this.seats = newSeats;
      this.fillBots = !!data.fillBots;
      this.botLevel = data.botLevel === 'hard' ? 'hard' : 'easy';
      await this.persist();
      this.broadcastLobby();
      return;
    }

    if (data.type === 'start') {
      if (seatId !== this.hostSeatId || this.started) return;
      for (let i = 0; i < this.seatCount; i++) {
        const s = this.seats[i];
        if (!s.connected) {
          if (!this.fillBots) { this.sendTo(seatId, { type: 'error', message: '모든 자리를 채우거나 봇 채우기를 켜주세요.' }); return; }
          s.isBot = true; s.botLevel = this.botLevel; s.name = `봇 ${i}`; s.connected = true;
        }
      }
      this.startGame();
      await this.persist();
      this.broadcastLobby();
      this.broadcastSync();
      return;
    }

    if (data.type === 'rematch') {
      if (!this.started || !this.game || this.game.phase !== 'gameover') return;
      this.startGame();
      await this.persist();
      this.broadcastSync();
      return;
    }

    if (!this.started || !this.game) return;
    const g = this.game;
    if (g.phase === 'gameover') return;
    const isMyTurn = g.turn === seatId;

    let ok = false;
    switch (data.type) {
      case 'roll':
        if (!isMyTurn) return;
        ok = Engine.rollDice(g, seatId, data.hold);
        break;
      case 'score':
        if (!isMyTurn) return;
        ok = Engine.scoreCategory(g, seatId, data.category);
        if (ok) this.log(`${this.seatName(seatId)}님이 '${data.category}'에 점수를 기록했습니다.`);
        break;
      default:
        return;
    }

    if (!ok) {
      this.sendTo(seatId, { type: 'error', message: '해당 행동을 할 수 없습니다.' });
      return;
    }

    this.advance();
    await this.persist();
    this.broadcastSync();
  }

  startGame() {
    const ids = this.seats.map(s => s.id);
    this.game = Engine.createGame(ids);
    for (const p of this.game.players) {
      const seat = this.seats.find(s => s.id === p.id);
      p.isBot = seat.isBot;
      p.botLevel = seat.botLevel;
    }
    this.started = true;
    this.advance();
  }

  advance() {
    const g = this.game;
    if (!g) return;
    for (let guard = 0; guard < 200; guard++) {
      if (g.phase === 'gameover') return;
      const curSeat = this.seats.find(s => s.id === g.turn);
      if (!curSeat) return;
      if (curSeat.isBot) {
        AI.runBotTurn(g, g.turn, curSeat.botLevel);
        continue;
      }
      return;
    }
  }

  async webSocketClose(ws, code, reason, wasClean) {
    const seatId = this.slotOf(ws);
    try { ws.close(code, reason); } catch (e) { /* already closing */ }
    if (seatId) {
      const seat = this.seats.find(s => s.id === seatId);
      if (seat) seat.connected = false;
      await this.persist();
      this.broadcast({ type: 'peer-left', seatId });
      if (!this.started) this.broadcastLobby();
    }
  }

  async webSocketError(ws, error) {
    const seatId = this.slotOf(ws);
    if (seatId) {
      const seat = this.seats.find(s => s.id === seatId);
      if (seat) seat.connected = false;
      this.broadcast({ type: 'peer-left', seatId });
    }
  }
}
