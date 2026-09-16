import { DurableObject } from "cloudflare:workers";
import * as Engine from '../mini67/catan-engine.js';
import * as AI from '../mini67/catan-ai.js';

const MAX_MSG_LEN = 4000;
const ROOM_IDLE_MS = 1000 * 60 * 60 * 6;

export class CatanRoom extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.seatCount = 4;
    this.fillBots = true;
    this.botLevel = 'easy';
    this.seats = [];
    this.hostSeatId = null;
    this.started = false;
    this.game = null;
    this.tradeOffers = {};

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
        this.tradeOffers = saved.tradeOffers || {};
      }
    });
  }

  async persist() {
    await this.ctx.storage.put('state', {
      seatCount: this.seatCount,
      fillBots: this.fillBots,
      botLevel: this.botLevel,
      seats: this.seats,
      hostSeatId: this.hostSeatId,
      started: this.started,
      game: this.game,
      tradeOffers: this.tradeOffers,
    });
    await this.ctx.storage.setAlarm(Date.now() + ROOM_IDLE_MS);
  }

  alarm() {
    this.ctx.storage.deleteAll();
  }

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
    seat.name = name;
    seat.connected = true;
    seat.isBot = false;
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
      for (let i = 0; i < n; i++) {
        newSeats.push(this.seats[i] || { id: 'S' + i, name: null, isBot: false, botLevel: null, connected: false });
      }
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
          if (!this.fillBots) {
            this.sendTo(seatId, { type: 'error', message: '모든 자리를 채우거나 봇 채우기를 켜주세요.' });
            return;
          }
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

    switch (data.type) {
      case 'setupPick':
        if (g.phase !== 'setup' || !isMyTurn) return;
        if (!Engine.canBuildSettlement(g, seatId, data.vertexId, true)) return;
        if (!Engine.canBuildRoad(g, seatId, data.edgeId, true, data.vertexId)) return;
        Engine.placeSetupPick(g, seatId, data.vertexId, data.edgeId);
        break;
      case 'roll': {
        if (g.phase !== 'roll' || !isMyTurn) return;
        const r = Engine.applyRoll(g);
        this.log(`🎲 ${this.seatName(seatId)}: ${r.d1}+${r.d2}=${r.total}`);
        break;
      }
      case 'discard':
        if (g.phase !== 'discard' || g.pendingDiscards[seatId] == null) return;
        Engine.applyDiscard(g, seatId, data.resources || {});
        break;
      case 'robber':
        if (g.phase !== 'robber' || !isMyTurn) return;
        if (!Engine.moveRobberAndSteal(g, data.tileId, seatId, data.victimId)) return;
        g.phase = 'main';
        break;
      case 'buildRoad': {
        if (g.phase !== 'main' || !isMyTurn) return;
        const p = g.players.find(x => x.id === seatId);
        const free = p.pendingFreeRoads > 0;
        if (!Engine.canBuildRoad(g, seatId, data.edgeId, false)) return;
        Engine.buildRoad(g, seatId, data.edgeId, { free });
        if (free) p.pendingFreeRoads--;
        break;
      }
      case 'buildSettlement':
        if (g.phase !== 'main' || !isMyTurn) return;
        if (!Engine.canBuildSettlement(g, seatId, data.vertexId, false)) return;
        Engine.buildSettlement(g, seatId, data.vertexId);
        break;
      case 'buildCity':
        if (g.phase !== 'main' || !isMyTurn) return;
        if (!Engine.canBuildCity(g, seatId, data.vertexId)) return;
        Engine.buildCity(g, seatId, data.vertexId);
        break;
      case 'buyDevCard':
        if (g.phase !== 'main' || !isMyTurn) return;
        Engine.buyDevCard(g, seatId);
        break;
      case 'playDevCard':
        if (g.phase !== 'main' || !isMyTurn) return;
        Engine.playDevCard(g, seatId, data.cardIndex, data.params || {});
        break;
      case 'bankTrade':
        if (g.phase !== 'main' || !isMyTurn) return;
        Engine.bankTrade(g, seatId, data.giveResource, data.wantResource);
        break;
      case 'tradeOffer': {
        if (g.phase !== 'main' || !isMyTurn) return;
        const offerId = 'T' + Date.now() + Math.random().toString(36).slice(2, 7);
        const offer = { fromSeatId: seatId, give: data.give || {}, receive: data.receive || {} };
        this.tradeOffers[offerId] = offer;
        for (const s of this.seats) {
          if (s.id === seatId) continue;
          if (s.isBot) {
            if (AI.respondToTrade(g, s.id, offer, s.botLevel)) {
              Engine.executePlayerTrade(g, seatId, s.id, offer.give, offer.receive);
              this.log(`${this.seatName(s.id)}이(가) 무역을 수락했습니다.`);
              delete this.tradeOffers[offerId];
              break;
            }
          } else {
            this.sendTo(s.id, { type: 'tradeOffered', offerId, fromSeatId: seatId, give: offer.give, receive: offer.receive });
          }
        }
        if (this.tradeOffers[offerId]) {
          this.sendTo(seatId, { type: 'tradeSent', offerId });
        }
        break;
      }
      case 'tradeResponse': {
        const offer = this.tradeOffers[data.offerId];
        if (!offer) return;
        if (data.accept && offer.fromSeatId !== seatId) {
          const ok = Engine.executePlayerTrade(g, offer.fromSeatId, seatId, offer.give, offer.receive);
          if (ok) this.log(`${this.seatName(seatId)}이(가) 무역을 수락했습니다.`);
          else this.sendTo(seatId, { type: 'error', message: '자원이 부족해 무역이 성사되지 않았습니다.' });
        }
        delete this.tradeOffers[data.offerId];
        this.sendTo(offer.fromSeatId, { type: 'tradeResolved', offerId: data.offerId });
        break;
      }
      case 'tradeCancel': {
        const offer = this.tradeOffers[data.offerId];
        if (!offer || offer.fromSeatId !== seatId) return;
        delete this.tradeOffers[data.offerId];
        this.broadcast({ type: 'tradeCancelled', offerId: data.offerId });
        break;
      }
      case 'endTurn':
        if (g.phase !== 'main' || !isMyTurn) return;
        for (const [offerId, offer] of Object.entries(this.tradeOffers)) {
          if (offer.fromSeatId === seatId) {
            delete this.tradeOffers[offerId];
            this.broadcast({ type: 'tradeCancelled', offerId });
          }
        }
        Engine.endTurn(g);
        break;
      default:
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
    this.tradeOffers = {};
    this.advance();
  }

  advance() {
    const g = this.game;
    if (!g) return;
    for (let guard = 0; guard < 200; guard++) {
      if (Engine.checkVictory(g)) return;

      if (g.phase === 'discard') {
        for (const p of g.players) {
          if (p.isBot && g.pendingDiscards[p.id] != null) {
            Engine.applyDiscard(g, p.id, AI.chooseDiscard(g, p.id));
          }
        }
        const anyHumanPending = Object.keys(g.pendingDiscards).some(pid => {
          const seat = this.seats.find(s => s.id === pid);
          return seat && !seat.isBot;
        });
        if (anyHumanPending) return;
        g.phase = 'robber';
        continue;
      }

      if (g.phase === 'robber') {
        const seat = this.seats.find(s => s.id === g.turn);
        if (seat && seat.isBot) {
          const { tileId, victimId } = AI.chooseRobberPlacement(g, g.turn, seat.botLevel);
          Engine.moveRobberAndSteal(g, tileId, g.turn, victimId);
          g.phase = 'main';
          continue;
        }
        return;
      }

      const curSeat = this.seats.find(s => s.id === g.turn);
      if (!curSeat) return;

      if (g.phase === 'setup') {
        if (curSeat.isBot) {
          const { vertexId, edgeId } = AI.chooseSetupPick(g, g.turn, curSeat.botLevel);
          Engine.placeSetupPick(g, g.turn, vertexId, edgeId);
          continue;
        }
        return;
      }

      if (g.phase === 'roll') {
        if (curSeat.isBot) { Engine.applyRoll(g); continue; }
        return;
      }

      if (g.phase === 'main') {
        if (curSeat.isBot) {
          AI.runBuildPhase(g, g.turn, curSeat.botLevel);
          if (Engine.checkVictory(g)) return;
          Engine.endTurn(g);
          continue;
        }
        return;
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
