import { DurableObject } from "cloudflare:workers";

const SIZE = 8;
const DIRS = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
const B = 'B', W = 'W';

function newBoard() {
  const b = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
  b[3][3] = W; b[4][4] = W;
  b[3][4] = B; b[4][3] = B;
  return b;
}
function inBounds(r, c) { return r >= 0 && r < SIZE && c >= 0 && c < SIZE; }
function getFlips(board, row, col, player) {
  if (board[row][col] !== null) return [];
  const opp = player === B ? W : B;
  let all = [];
  for (const [dr, dc] of DIRS) {
    let r = row + dr, c = col + dc;
    const line = [];
    while (inBounds(r, c) && board[r][c] === opp) { line.push([r, c]); r += dr; c += dc; }
    if (line.length && inBounds(r, c) && board[r][c] === player) all = all.concat(line);
  }
  return all;
}
function validMoves(board, player) {
  const moves = [];
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
    const flips = getFlips(board, r, c, player);
    if (flips.length) moves.push({ row: r, col: c });
  }
  return moves;
}
function applyMove(board, row, col, player, flips) {
  board[row][col] = player;
  for (const [r, c] of flips) board[r][c] = player;
}
function countDiscs(board, player) {
  let n = 0;
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) if (board[r][c] === player) n++;
  return n;
}

const MAX_MSG_LEN = 2000;
const ROOM_IDLE_MS = 1000 * 60 * 60 * 6; // 6h auto-cleanup safety net

export class OthelloRoom extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.board = newBoard();
    this.turn = B;
    this.status = 'waiting'; // waiting | playing | finished
    this.names = {};
    this.winner = null;
    this.loaded = false;

    ctx.blockConcurrencyWhile(async () => {
      const saved = await ctx.storage.get('state');
      if (saved) {
        this.board = saved.board;
        this.turn = saved.turn;
        this.status = saved.status;
        this.names = saved.names || {};
        this.winner = saved.winner ?? null;
      }
      this.loaded = true;
    });
  }

  async persist() {
    await this.ctx.storage.put('state', {
      board: this.board, turn: this.turn, status: this.status, names: this.names, winner: this.winner,
    });
    await this.ctx.storage.setAlarm(Date.now() + ROOM_IDLE_MS);
  }

  alarm() {
    // Idle room cleanup: drop persisted state after long inactivity.
    this.ctx.storage.deleteAll();
  }

  slotOf(ws) {
    const tags = this.ctx.getTags(ws);
    return tags.includes(B) ? B : (tags.includes(W) ? W : null);
  }

  connectedSlots() {
    const set = new Set();
    for (const ws of this.ctx.getWebSockets()) {
      const s = this.slotOf(ws);
      if (s) set.add(s);
    }
    return set;
  }

  publicState(extra) {
    return {
      type: 'sync',
      board: this.board,
      turn: this.turn,
      status: this.status,
      names: this.names,
      winner: this.winner,
      ...extra,
    };
  }

  broadcast(payload) {
    const msg = JSON.stringify(payload);
    for (const ws of this.ctx.getWebSockets()) {
      try { ws.send(msg); } catch (e) { /* socket may be closing */ }
    }
  }

  async fetch(request) {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('expected websocket', { status: 400 });
    }
    const url = new URL(request.url);
    const name = (url.searchParams.get('name') || '익명').slice(0, 20);

    const connected = this.connectedSlots();
    let slot;
    if (!connected.has(B)) slot = B;
    else if (!connected.has(W)) slot = W;
    else {
      return new Response(JSON.stringify({ error: 'room full' }), { status: 409 });
    }

    const pair = new WebSocketPair();
    const client = pair[0], server = pair[1];

    this.ctx.acceptWebSocket(server, [slot]);
    this.names[slot] = name;
    if (this.names[B] && this.names[W] && this.status === 'waiting') this.status = 'playing';
    await this.persist();

    server.send(JSON.stringify({ type: 'hello', slot }));
    this.broadcast(this.publicState());

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws, message) {
    if (typeof message !== 'string' || message.length > MAX_MSG_LEN) return;
    let data;
    try { data = JSON.parse(message); } catch (e) { return; }

    const slot = this.slotOf(ws);
    if (!slot) return;

    if (data.type === 'move') {
      if (this.status !== 'playing') return;
      if (this.turn !== slot) return;
      const row = data.row | 0, col = data.col | 0;
      if (row < 0 || row >= SIZE || col < 0 || col >= SIZE) return;

      const flips = getFlips(this.board, row, col, slot);
      if (!flips.length) return;

      applyMove(this.board, row, col, slot, flips);
      this.advanceTurn(slot === B ? W : B);
      await this.persist();
      this.broadcast(this.publicState());
    } else if (data.type === 'rematch') {
      if (this.status !== 'finished') return;
      this.board = newBoard();
      this.turn = B;
      this.status = 'playing';
      this.winner = null;
      await this.persist();
      this.broadcast(this.publicState());
    }
  }

  advanceTurn(nextPlayer) {
    const nextMoves = validMoves(this.board, nextPlayer);
    if (nextMoves.length > 0) {
      this.turn = nextPlayer;
      return;
    }
    const other = nextPlayer === B ? W : B;
    const otherMoves = validMoves(this.board, other);
    if (otherMoves.length > 0) {
      this.turn = other; // nextPlayer has no moves, passes
      return;
    }
    // neither side can move -> game over
    this.status = 'finished';
    const bCount = countDiscs(this.board, B), wCount = countDiscs(this.board, W);
    this.winner = bCount === wCount ? 'draw' : (bCount > wCount ? B : W);
  }

  async webSocketClose(ws, code, reason, wasClean) {
    const slot = this.slotOf(ws);
    try { ws.close(code, reason); } catch (e) { /* already closing */ }
    if (slot) this.broadcast({ type: 'peer-left', slot });
  }

  async webSocketError(ws, error) {
    const slot = this.slotOf(ws);
    if (slot) this.broadcast({ type: 'peer-left', slot });
  }
}
