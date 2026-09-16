export const RESOURCES = ['wood', 'brick', 'wool', 'grain', 'ore'];

export const COSTS = {
    road: { wood: 1, brick: 1 },
    settlement: { wood: 1, brick: 1, wool: 1, grain: 1 },
    city: { grain: 2, ore: 3 },
    devcard: { wool: 1, grain: 1, ore: 1 },
};

export const MAX_PIECES = { road: 15, settlement: 5, city: 4 };
const TILE_COUNTS = { wood: 4, brick: 3, wool: 4, grain: 4, ore: 3, desert: 1 };
const NUMBER_TOKENS = [2, 3, 3, 4, 4, 5, 5, 6, 6, 8, 8, 9, 9, 10, 10, 11, 11, 12];
const DEV_CARD_COUNTS = { knight: 14, victorypoint: 5, roadbuilding: 2, yearofplenty: 2, monopoly: 2 };
const HEX_SIZE = 1;

function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

function hexPixel(q, r) {
    return {
        x: HEX_SIZE * Math.sqrt(3) * (q + r / 2),
        y: HEX_SIZE * 1.5 * r,
    };
}

function hexCorner(cx, cy, i) {
    const deg = 60 * i - 30;
    const rad = (Math.PI / 180) * deg;
    return { x: cx + HEX_SIZE * Math.cos(rad), y: cy + HEX_SIZE * Math.sin(rad) };
}

function snap(n) {
    const r = Math.round(n * 10000) / 10000;
    return r === 0 ? 0 : r;
}
function vkey(x, y) { return `${snap(x)}_${snap(y)}`; }
function ekey(a, b) { return a < b ? `${a}|${b}` : `${b}|${a}`; }

function buildAxialCoords() {
    const coords = [];
    for (let q = -2; q <= 2; q++) {
        for (let r = -2; r <= 2; r++) {
            if (q + r >= -2 && q + r <= 2) coords.push({ q, r });
        }
    }
    return coords;
}

function buildGraph(tiles) {
    const vertices = new Map();
    const edges = new Map();

    function getVertex(x, y) {
        const id = vkey(x, y);
        if (!vertices.has(id)) {
            vertices.set(id, { id, x, y, tileIds: [], edgeIds: [], building: null, port: null });
        }
        return vertices.get(id);
    }
    function getEdge(v1, v2) {
        const id = ekey(v1, v2);
        if (!edges.has(id)) {
            edges.set(id, { id, v1, v2, tileIds: [], road: null });
        }
        return edges.get(id);
    }

    tiles.forEach((tile, tileIdx) => {
        const corners = [];
        for (let i = 0; i < 6; i++) {
            const c = hexCorner(tile.x, tile.y, i);
            corners.push(getVertex(c.x, c.y));
        }
        tile.vertexIds = corners.map(v => v.id);
        for (const v of corners) {
            if (!v.tileIds.includes(tileIdx)) v.tileIds.push(tileIdx);
        }
        const tileEdgeIds = [];
        for (let i = 0; i < 6; i++) {
            const a = corners[i], b = corners[(i + 1) % 6];
            const e = getEdge(a.id, b.id);
            if (!e.tileIds.includes(tileIdx)) e.tileIds.push(tileIdx);
            if (!a.edgeIds.includes(e.id)) a.edgeIds.push(e.id);
            if (!b.edgeIds.includes(e.id)) b.edgeIds.push(e.id);
            tileEdgeIds.push(e.id);
        }
        tile.edgeIds = tileEdgeIds;
    });

    return { vertices, edges };
}

function tileAdjacency(tiles, edges) {
    const adj = tiles.map(() => new Set());
    for (const e of edges.values()) {
        if (e.tileIds.length === 2) {
            const [a, b] = e.tileIds;
            adj[a].add(b);
            adj[b].add(a);
        }
    }
    return adj;
}

function assignNumbersNoAdjacent68(tiles, adj) {
    const nonDesertIdx = tiles.map((t, i) => i).filter(i => tiles[i].resource !== 'desert');
    for (let attempt = 0; attempt < 300; attempt++) {
        const nums = shuffle(NUMBER_TOKENS);
        nonDesertIdx.forEach((tileIdx, i) => { tiles[tileIdx].number = nums[i]; });
        let ok = true;
        for (const i of nonDesertIdx) {
            const n = tiles[i].number;
            if (n !== 6 && n !== 8) continue;
            for (const j of adj[i]) {
                if (tiles[j].number === 6 || tiles[j].number === 8) { ok = false; break; }
            }
            if (!ok) break;
        }
        if (ok) return;
    }
}

function placePorts(vertices, edges) {
    const boundary = [...edges.values()].filter(e => e.tileIds.length === 1);
    const withAngle = boundary.map(e => {
        const v1 = vertices.get(e.v1), v2 = vertices.get(e.v2);
        const mx = (v1.x + v2.x) / 2, my = (v1.y + v2.y) / 2;
        return { e, angle: Math.atan2(my, mx) };
    });
    withAngle.sort((a, b) => a.angle - b.angle);
    const ordered = withAngle.map(w => w.e);

    const portTypes = shuffle(['3:1', '3:1', '3:1', '3:1', 'wood', 'brick', 'wool', 'grain', 'ore']);
    const n = ordered.length;
    const portCount = portTypes.length;
    const ports = [];
    for (let i = 0; i < portCount; i++) {
        const idx = Math.floor((i * n) / portCount);
        const edge = ordered[idx];
        const type = portTypes[i];
        const v1 = vertices.get(edge.v1), v2 = vertices.get(edge.v2);
        v1.port = type; v2.port = type;
        ports.push({ type, vertexIds: [v1.id, v2.id] });
    }
    return ports;
}

export function generateBoard() {
    const coords = buildAxialCoords();
    const resourcePool = shuffle(
        Object.entries(TILE_COUNTS).flatMap(([res, n]) => Array(n).fill(res))
    );
    const tiles = coords.map(({ q, r }, i) => {
        const { x, y } = hexPixel(q, r);
        return { id: i, q, r, x, y, resource: resourcePool[i], number: null, vertexIds: [], edgeIds: [] };
    });

    const { vertices, edges } = buildGraph(tiles);
    const adj = tileAdjacency(tiles, edges);
    assignNumbersNoAdjacent68(tiles, adj);

    const desertIdx = tiles.findIndex(t => t.resource === 'desert');
    const ports = placePorts(vertices, edges);

    return {
        tiles,
        vertices: Object.fromEntries(vertices),
        edges: Object.fromEntries(edges),
        ports,
        robberTileId: desertIdx,
    };
}

export function createGame(playerIds) {
    const board = generateBoard();
    const players = playerIds.map((id, i) => ({
        id,
        colorIdx: i,
        resources: { wood: 0, brick: 0, wool: 0, grain: 0, ore: 0 },
        devCards: [],
        playedKnights: 0,
        roads: [],
        settlements: [],
        cities: [],
        pendingFreeRoads: 0,
        isBot: false,
        botLevel: null,
    }));
    const setupOrder = [...playerIds, ...[...playerIds].reverse()];

    return {
        board,
        players,
        bank: { wood: 19, brick: 19, wool: 19, grain: 19, ore: 19 },
        devDeck: shuffle(Object.entries(DEV_CARD_COUNTS).flatMap(([t, n]) => Array(n).fill(t))),
        turn: playerIds[0],
        turnNumber: 0,
        phase: 'setup',
        setupOrder,
        setupIndex: 0,
        setupSettlementJustPlaced: null,
        pendingDiscards: {},
        lastDice: null,
        devCardPlayedThisTurn: false,
        longestRoadOwner: null,
        longestRoadLengths: {},
        largestArmyOwner: null,
        winner: null,
        log: [],
    };
}

function player(state, id) { return state.players.find(p => p.id === id); }
function vertex(state, id) { return state.board.vertices[id]; }
function edge(state, id) { return state.board.edges[id]; }
function tile(state, id) { return state.board.tiles[id]; }

function canAfford(p, cost) {
    return Object.entries(cost).every(([res, n]) => p.resources[res] >= n);
}
function pay(state, p, cost) {
    for (const [res, n] of Object.entries(cost)) { p.resources[res] -= n; state.bank[res] += n; }
}
function refund(state, p, cost) {
    for (const [res, n] of Object.entries(cost)) { p.resources[res] += n; state.bank[res] -= n; }
}

export function getVictoryPoints(state, playerId, { includeHidden = true } = {}) {
    const p = player(state, playerId);
    let vp = p.settlements.length + p.cities.length * 2;
    if (state.longestRoadOwner === playerId) vp += 2;
    if (state.largestArmyOwner === playerId) vp += 2;
    if (includeHidden) vp += p.devCards.filter(c => c.type === 'victorypoint').length;
    return vp;
}

export function rollDice() {
    const d1 = 1 + Math.floor(Math.random() * 6);
    const d2 = 1 + Math.floor(Math.random() * 6);
    return { d1, d2, total: d1 + d2 };
}

export function distributeResources(state, total) {
    const gains = {};
    for (const p of state.players) gains[p.id] = { wood: 0, brick: 0, wool: 0, grain: 0, ore: 0 };

    for (const res of RESOURCES) {
        const claims = [];
        for (const t of state.board.tiles) {
            if (t.number !== total || t.id === state.board.robberTileId) continue;
            if (t.resource !== res) continue;
            for (const vid of t.vertexIds) {
                const v = vertex(state, vid);
                if (v.building) claims.push({ playerId: v.building.owner, amount: v.building.type === 'city' ? 2 : 1 });
            }
        }
        if (!claims.length) continue;
        const totalDemand = claims.reduce((s, c) => s + c.amount, 0);
        const distinctPlayers = new Set(claims.map(c => c.playerId));
        if (state.bank[res] >= totalDemand) {
            for (const c of claims) { gains[c.playerId][res] += c.amount; }
            state.bank[res] -= totalDemand;
        } else if (distinctPlayers.size === 1) {
            const only = [...distinctPlayers][0];
            const amt = Math.min(totalDemand, state.bank[res]);
            gains[only][res] += amt;
            state.bank[res] -= amt;
        }
    }
    for (const p of state.players) {
        for (const res of RESOURCES) p.resources[res] += gains[p.id][res];
    }
    return gains;
}

export function getDiscardRequirements(state) {
    const req = {};
    for (const p of state.players) {
        const total = RESOURCES.reduce((s, r) => s + p.resources[r], 0);
        if (total > 7) req[p.id] = Math.floor(total / 2);
    }
    return req;
}

export function applyDiscard(state, playerId, discard) {
    const p = player(state, playerId);
    const need = state.pendingDiscards[playerId];
    if (need == null) return false;
    const sum = RESOURCES.reduce((s, r) => s + (discard[r] || 0), 0);
    if (sum !== need) return false;
    for (const r of RESOURCES) {
        const n = discard[r] || 0;
        if (n > p.resources[r]) return false;
    }
    for (const r of RESOURCES) {
        const n = discard[r] || 0;
        p.resources[r] -= n; state.bank[r] += n;
    }
    delete state.pendingDiscards[playerId];
    return true;
}

export function getStealCandidates(state, tileId, exceptPlayerId) {
    const t = tile(state, tileId);
    const owners = new Set();
    for (const vid of t.vertexIds) {
        const v = vertex(state, vid);
        if (v.building && v.building.owner !== exceptPlayerId) owners.add(v.building.owner);
    }
    return [...owners];
}

export function moveRobberAndSteal(state, tileId, thiefId, victimId) {
    if (tileId === state.board.robberTileId) return false;
    state.board.robberTileId = tileId;
    if (victimId) {
        const victim = player(state, victimId);
        const pool = [];
        for (const r of RESOURCES) for (let i = 0; i < victim.resources[r]; i++) pool.push(r);
        if (pool.length) {
            const res = pool[Math.floor(Math.random() * pool.length)];
            victim.resources[res]--;
            player(state, thiefId).resources[res]++;
        }
    }
    return true;
}

function verticesAdjacentTo(state, vertexId) {
    const v = vertex(state, vertexId);
    return v.edgeIds.map(eid => {
        const e = edge(state, eid);
        return e.v1 === vertexId ? e.v2 : e.v1;
    });
}

export function canBuildSettlement(state, playerId, vertexId, isSetup) {
    const v = vertex(state, vertexId);
    if (v.building) return false;
    for (const nvid of verticesAdjacentTo(state, vertexId)) {
        if (vertex(state, nvid).building) return false;
    }
    const p = player(state, playerId);
    if (p.settlements.length >= MAX_PIECES.settlement) return false;
    if (isSetup) return true;
    return v.edgeIds.some(eid => p.roads.includes(eid));
}

export function buildSettlement(state, playerId, vertexId, { free = false } = {}) {
    const p = player(state, playerId);
    if (!free) {
        if (!canAfford(p, COSTS.settlement)) return false;
        pay(state, p, COSTS.settlement);
    }
    vertex(state, vertexId).building = { owner: playerId, type: 'settlement' };
    p.settlements.push(vertexId);
    recomputeLongestRoad(state);
    return true;
}

export function canBuildCity(state, playerId, vertexId) {
    const v = vertex(state, vertexId);
    if (!v.building || v.building.owner !== playerId || v.building.type !== 'settlement') return false;
    const p = player(state, playerId);
    return p.cities.length < MAX_PIECES.city;
}

export function buildCity(state, playerId, vertexId) {
    const p = player(state, playerId);
    if (!canBuildCity(state, playerId, vertexId)) return false;
    if (!canAfford(p, COSTS.city)) return false;
    pay(state, p, COSTS.city);
    vertex(state, vertexId).building.type = 'city';
    p.settlements = p.settlements.filter(v => v !== vertexId);
    p.cities.push(vertexId);
    return true;
}

export function canBuildRoad(state, playerId, edgeId, isSetup, setupFromVertex) {
    const e = edge(state, edgeId);
    if (e.road) return false;
    const p = player(state, playerId);
    if (p.roads.length >= MAX_PIECES.road) return false;
    if (isSetup) {
        return e.v1 === setupFromVertex || e.v2 === setupFromVertex;
    }
    for (const vid of [e.v1, e.v2]) {
        const v = vertex(state, vid);
        if (v.building && v.building.owner === playerId) return true;
        if (v.building && v.building.owner !== playerId) continue;
        if (v.edgeIds.some(id => id !== edgeId && edge(state, id).road === playerId)) return true;
    }
    return false;
}

export function buildRoad(state, playerId, edgeId, { free = false } = {}) {
    const p = player(state, playerId);
    if (!free) {
        if (!canAfford(p, COSTS.road)) return false;
        pay(state, p, COSTS.road);
    }
    edge(state, edgeId).road = playerId;
    p.roads.push(edgeId);
    recomputeLongestRoad(state);
    return true;
}

function computeLongestRoadForPlayer(state, playerId) {
    const ownedEdgeIds = player(state, playerId).roads;
    if (!ownedEdgeIds.length) return 0;
    const touchedVertices = new Set();
    for (const eid of ownedEdgeIds) {
        const e = edge(state, eid);
        touchedVertices.add(e.v1); touchedVertices.add(e.v2);
    }
    function isBlocked(vid) {
        const v = vertex(state, vid);
        return !!(v.building && v.building.owner !== playerId);
    }
    function edgesAt(vid) {
        return vertex(state, vid).edgeIds.filter(eid => ownedEdgeIds.includes(eid));
    }
    function dfs(vid, visited) {
        let best = 0;
        for (const eid of edgesAt(vid)) {
            if (visited.has(eid)) continue;
            const e = edge(state, eid);
            const other = e.v1 === vid ? e.v2 : e.v1;
            visited.add(eid);
            let branch = 1;
            if (!isBlocked(other)) branch += dfs(other, visited);
            if (branch > best) best = branch;
            visited.delete(eid);
        }
        return best;
    }
    let max = 0;
    for (const vid of touchedVertices) {
        const len = dfs(vid, new Set());
        if (len > max) max = len;
    }
    return max;
}

export function recomputeLongestRoad(state) {
    const lens = {};
    for (const p of state.players) lens[p.id] = computeLongestRoadForPlayer(state, p.id);
    let holder = state.longestRoadOwner;
    if (holder !== null && lens[holder] < 5) holder = null;
    let maxLen = 0, leaders = [];
    for (const p of state.players) {
        if (lens[p.id] > maxLen) { maxLen = lens[p.id]; leaders = [p.id]; }
        else if (lens[p.id] === maxLen && maxLen > 0) leaders.push(p.id);
    }
    if (maxLen >= 5) {
        const holderLen = holder ? lens[holder] : 0;
        if (!holder && leaders.length === 1) holder = leaders[0];
        else if (holder && maxLen > holderLen && leaders.length === 1) holder = leaders[0];
    }
    state.longestRoadOwner = holder;
    state.longestRoadLengths = lens;
}

export function recomputeLargestArmy(state) {
    let holder = state.largestArmyOwner;
    const holderCount = holder ? player(state, holder).playedKnights : 0;
    let maxCount = 0, leaders = [];
    for (const p of state.players) {
        if (p.playedKnights > maxCount) { maxCount = p.playedKnights; leaders = [p.id]; }
        else if (p.playedKnights === maxCount && maxCount > 0) leaders.push(p.id);
    }
    if (maxCount >= 3) {
        if (!holder && leaders.length === 1) holder = leaders[0];
        else if (holder && maxCount > holderCount && leaders.length === 1) holder = leaders[0];
    }
    state.largestArmyOwner = holder;
}

export function buyDevCard(state, playerId) {
    const p = player(state, playerId);
    if (!canAfford(p, COSTS.devcard)) return false;
    if (!state.devDeck.length) return false;
    pay(state, p, COSTS.devcard);
    const type = state.devDeck.pop();
    p.devCards.push({ type, boughtTurn: state.turnNumber, played: false });
    return true;
}

export function playDevCard(state, playerId, cardIndex, params = {}) {
    const p = player(state, playerId);
    const card = p.devCards[cardIndex];
    if (!card || card.played) return { ok: false };
    if (card.type === 'victorypoint') return { ok: false };
    if (card.boughtTurn === state.turnNumber) return { ok: false };
    if (state.devCardPlayedThisTurn) return { ok: false };

    if (card.type === 'knight') {
        p.playedKnights++;
        recomputeLargestArmy(state);
        state.devCardPlayedThisTurn = true;
        card.played = true;
        state.phase = 'robber';
        return { ok: true, needsRobber: true };
    }
    if (card.type === 'roadbuilding') {
        p.pendingFreeRoads += 2;
        state.devCardPlayedThisTurn = true;
        card.played = true;
        return { ok: true };
    }
    if (card.type === 'yearofplenty') {
        const { resource1, resource2 } = params;
        if (!resource1 || !resource2) return { ok: false };
        if (state.bank[resource1] < 1) return { ok: false };
        const need2 = resource1 === resource2 ? 2 : 1;
        if (state.bank[resource1] < need2) return { ok: false };
        if (resource1 !== resource2 && state.bank[resource2] < 1) return { ok: false };
        state.bank[resource1] -= 1; p.resources[resource1] += 1;
        state.bank[resource2] -= 1; p.resources[resource2] += 1;
        state.devCardPlayedThisTurn = true;
        card.played = true;
        return { ok: true };
    }
    if (card.type === 'monopoly') {
        const { resource } = params;
        if (!resource) return { ok: false };
        let total = 0;
        for (const other of state.players) {
            if (other.id === playerId) continue;
            total += other.resources[resource];
            p.resources[resource] += other.resources[resource];
            other.resources[resource] = 0;
        }
        state.devCardPlayedThisTurn = true;
        card.played = true;
        return { ok: true, stolen: total };
    }
    return { ok: false };
}

export function getTradeRatio(state, playerId, resource) {
    const p = player(state, playerId);
    let ratio = 4;
    const myVertices = [...p.settlements, ...p.cities];
    for (const vid of myVertices) {
        const v = vertex(state, vid);
        if (!v.port) continue;
        if (v.port === '3:1' && ratio > 3) ratio = 3;
        if (v.port === resource && ratio > 2) ratio = 2;
    }
    return ratio;
}

export function bankTrade(state, playerId, giveResource, wantResource) {
    const p = player(state, playerId);
    const ratio = getTradeRatio(state, playerId, giveResource);
    if (p.resources[giveResource] < ratio) return false;
    if (state.bank[wantResource] < 1) return false;
    p.resources[giveResource] -= ratio;
    state.bank[giveResource] += ratio;
    p.resources[wantResource] += 1;
    state.bank[wantResource] -= 1;
    return true;
}

export function executePlayerTrade(state, fromId, toId, give, receive) {
    const from = player(state, fromId), to = player(state, toId);
    for (const r of RESOURCES) {
        if ((give[r] || 0) > from.resources[r]) return false;
        if ((receive[r] || 0) > to.resources[r]) return false;
    }
    for (const r of RESOURCES) {
        const g = give[r] || 0, w = receive[r] || 0;
        from.resources[r] += w - g;
        to.resources[r] += g - w;
    }
    return true;
}

export function placeSetupPick(state, playerId, vertexId, edgeId) {
    if (!canBuildSettlement(state, playerId, vertexId, true)) return false;
    if (!canBuildRoad(state, playerId, edgeId, true, vertexId)) return false;
    buildSettlement(state, playerId, vertexId, { free: true });
    buildRoad(state, playerId, edgeId, { free: true });

    const isSecondRound = state.setupIndex >= state.players.length;
    if (isSecondRound) {
        const t = { wood: 0, brick: 0, wool: 0, grain: 0, ore: 0 };
        const v = vertex(state, vertexId);
        for (const tid of v.tileIds) {
            const tl = tile(state, tid);
            if (tl.resource !== 'desert') t[tl.resource]++;
        }
        const p = player(state, playerId);
        for (const r of RESOURCES) { p.resources[r] += t[r]; state.bank[r] -= t[r]; }
    }

    state.setupIndex++;
    if (state.setupIndex >= state.setupOrder.length) {
        state.phase = 'roll';
        state.turn = state.players[0].id;
        state.turnNumber = 1;
    } else {
        state.turn = state.setupOrder[state.setupIndex];
    }
    return true;
}

export function endTurn(state) {
    state.devCardPlayedThisTurn = false;
    const idx = state.players.findIndex(p => p.id === state.turn);
    const next = state.players[(idx + 1) % state.players.length];
    state.turn = next.id;
    state.turnNumber++;
    state.phase = 'roll';
    state.lastDice = null;
}

export function applyRoll(state) {
    const { d1, d2, total } = rollDice();
    state.lastDice = { d1, d2, total };
    if (total === 7) {
        const req = getDiscardRequirements(state);
        state.pendingDiscards = req;
        state.phase = Object.keys(req).length ? 'discard' : 'robber';
        return { d1, d2, total, gains: null };
    }
    const gains = distributeResources(state, total);
    state.phase = 'main';
    return { d1, d2, total, gains };
}

export function checkVictory(state) {
    for (const p of state.players) {
        if (getVictoryPoints(state, p.id, { includeHidden: true }) >= 10) {
            state.winner = p.id;
            state.phase = 'gameover';
            return p.id;
        }
    }
    return null;
}

export function serializeForClient(state) {
    return JSON.parse(JSON.stringify(state));
}
