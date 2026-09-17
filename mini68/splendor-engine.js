export const COLORS = ['white', 'blue', 'green', 'red', 'black'];

const TIER_TEMPLATES = {
    1: [
        { pts: 0, cost: [1, 1, 1, 0] },
        { pts: 0, cost: [2, 1, 0, 0] },
        { pts: 0, cost: [2, 2, 0, 0] },
        { pts: 0, cost: [3, 0, 0, 0] },
        { pts: 0, cost: [1, 1, 1, 1] },
        { pts: 0, cost: [2, 1, 1, 0] },
        { pts: 0, cost: [3, 1, 0, 0] },
        { pts: 1, cost: [4, 0, 0, 0] },
    ],
    2: [
        { pts: 1, cost: [3, 2, 2, 0] },
        { pts: 1, cost: [5, 0, 0, 0] },
        { pts: 2, cost: [5, 3, 0, 0] },
        { pts: 2, cost: [2, 2, 3, 0] },
        { pts: 2, cost: [4, 2, 1, 0] },
        { pts: 3, cost: [6, 0, 0, 0] },
    ],
    3: [
        { pts: 3, cost: [3, 3, 3, 5] },
        { pts: 4, cost: [7, 0, 0, 0] },
        { pts: 4, cost: [6, 3, 3, 0] },
        { pts: 5, cost: [7, 3, 0, 0] },
    ],
};

const NOBLE_TEMPLATES = [
    { white: 4, blue: 4 },
    { blue: 4, green: 4 },
    { green: 4, red: 4 },
    { red: 4, black: 4 },
    { black: 4, white: 4 },
    { white: 3, blue: 3, green: 3 },
    { blue: 3, green: 3, red: 3 },
    { green: 3, red: 3, black: 3 },
    { red: 3, black: 3, white: 3 },
    { black: 3, white: 3, blue: 3 },
];

function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

function buildDeck(tier) {
    const cards = [];
    let id = 0;
    for (let ci = 0; ci < COLORS.length; ci++) {
        const color = COLORS[ci];
        for (const tpl of TIER_TEMPLATES[tier]) {
            const cost = {};
            for (let k = 0; k < 4; k++) {
                if (tpl.cost[k] > 0) {
                    const otherColor = COLORS[(ci + 1 + k) % 5];
                    cost[otherColor] = tpl.cost[k];
                }
            }
            cards.push({ id: `t${tier}_${id++}`, tier, color, points: tpl.pts, cost });
        }
    }
    return cards;
}

export function buildNobles() {
    return NOBLE_TEMPLATES.map((req, i) => ({ id: 'n' + i, requirements: req }));
}

function bankForPlayers(n) {
    const perColor = n === 2 ? 4 : n === 3 ? 5 : 7;
    const bank = { gold: 5 };
    for (const c of COLORS) bank[c] = perColor;
    return bank;
}

export function createGame(playerIds) {
    const decks = {
        1: shuffle(buildDeck(1)),
        2: shuffle(buildDeck(2)),
        3: shuffle(buildDeck(3)),
    };
    const board = { 1: [], 2: [], 3: [] };
    for (const tier of [1, 2, 3]) {
        for (let i = 0; i < 4; i++) board[tier].push(decks[tier].pop() || null);
    }
    const allNobles = shuffle(buildNobles());
    const nobles = allNobles.slice(0, playerIds.length + 1);

    const players = playerIds.map(id => ({
        id,
        tokens: { white: 0, blue: 0, green: 0, red: 0, black: 0, gold: 0 },
        bonuses: { white: 0, blue: 0, green: 0, red: 0, black: 0 },
        cards: [],
        reserved: [],
        nobles: [],
        isBot: false,
        botLevel: null,
    }));

    return {
        decks, board, nobles, bank: bankForPlayers(playerIds.length),
        players,
        turn: playerIds[0],
        turnNumber: 1,
        phase: 'main',
        pendingDiscard: {},
        pendingNobleChoice: null,
        finalRound: false,
        finalRoundStarterId: null,
        actionTakenThisTurn: false,
        winner: null,
        log: [],
    };
}

function player(state, id) { return state.players.find(p => p.id === id); }

export function getPoints(p) {
    return p.cards.reduce((s, c) => s + c.points, 0) + p.nobles.length * 3;
}

function totalTokens(p) {
    return COLORS.reduce((s, c) => s + p.tokens[c], 0) + p.tokens.gold;
}

export function canTakeThreeDifferent(state, colors) {
    if (!Array.isArray(colors) || colors.length !== 3) return false;
    if (new Set(colors).size !== 3) return false;
    return colors.every(c => COLORS.includes(c) && state.bank[c] > 0);
}

export function takeThreeDifferent(state, playerId, colors) {
    if (state.phase !== 'main' || state.turn !== playerId || state.actionTakenThisTurn) return false;
    if (!canTakeThreeDifferent(state, colors)) return false;
    const p = player(state, playerId);
    for (const c of colors) { state.bank[c]--; p.tokens[c]++; }
    state.actionTakenThisTurn = true;
    afterTokenGain(state, p);
    return true;
}

export function canTakeTwoSame(state, color) {
    return COLORS.includes(color) && state.bank[color] >= 4;
}

export function takeTwoSame(state, playerId, color) {
    if (state.phase !== 'main' || state.turn !== playerId || state.actionTakenThisTurn) return false;
    if (!canTakeTwoSame(state, color)) return false;
    const p = player(state, playerId);
    state.bank[color] -= 2;
    p.tokens[color] += 2;
    state.actionTakenThisTurn = true;
    afterTokenGain(state, p);
    return true;
}

function afterTokenGain(state, p) {
    const total = totalTokens(p);
    if (total > 10) {
        state.pendingDiscard[p.id] = total - 10;
        state.phase = 'discard';
    }
}

export function applyDiscard(state, playerId, discard) {
    const need = state.pendingDiscard[playerId];
    if (need == null) return false;
    const p = player(state, playerId);
    const sum = [...COLORS, 'gold'].reduce((s, c) => s + (discard[c] || 0), 0);
    if (sum !== need) return false;
    for (const c of [...COLORS, 'gold']) {
        const n = discard[c] || 0;
        if (n > p.tokens[c]) return false;
    }
    for (const c of [...COLORS, 'gold']) {
        const n = discard[c] || 0;
        p.tokens[c] -= n; state.bank[c] += n;
    }
    delete state.pendingDiscard[playerId];
    if (Object.keys(state.pendingDiscard).length === 0) state.phase = 'main';
    return true;
}

function findCard(state, source, cardId) {
    if (source === 'reserved') return null;
    for (const tier of [1, 2, 3]) {
        const idx = state.board[tier].findIndex(c => c && c.id === cardId);
        if (idx >= 0) return { tier, idx, card: state.board[tier][idx] };
    }
    return null;
}

export function canReserve(state, playerId) {
    const p = player(state, playerId);
    return state.phase === 'main' && state.turn === playerId && !state.actionTakenThisTurn && p.reserved.length < 3;
}

export function reserveCard(state, playerId, { tier, cardId, blind }) {
    if (!canReserve(state, playerId)) return false;
    const p = player(state, playerId);
    let card = null;
    if (blind) {
        if (!state.decks[tier] || !state.decks[tier].length) return false;
        card = state.decks[tier].pop();
    } else {
        const found = findCard(state, 'board', cardId);
        if (!found) return false;
        card = found.card;
        state.board[found.tier][found.idx] = state.decks[found.tier].pop() || null;
    }
    p.reserved.push(card);
    if (state.bank.gold > 0) { state.bank.gold--; p.tokens.gold++; }
    state.actionTakenThisTurn = true;
    afterTokenGain(state, p);
    return true;
}

function computePaymentCost(p, card) {
    const cost = {};
    for (const c of COLORS) {
        const discounted = Math.max(0, (card.cost[c] || 0) - p.bonuses[c]);
        cost[c] = discounted;
    }
    return cost;
}

export function canAfford(state, playerId, card) {
    const p = player(state, playerId);
    const cost = computePaymentCost(p, card);
    let goldNeeded = 0;
    for (const c of COLORS) {
        const shortfall = Math.max(0, cost[c] - p.tokens[c]);
        goldNeeded += shortfall;
    }
    return goldNeeded <= p.tokens.gold;
}

export function purchaseCard(state, playerId, { source, cardId }) {
    if (state.phase !== 'main' || state.turn !== playerId || state.actionTakenThisTurn) return { ok: false };
    const p = player(state, playerId);
    let card, removeFn;
    if (source === 'reserved') {
        const idx = p.reserved.findIndex(c => c.id === cardId);
        if (idx < 0) return { ok: false };
        card = p.reserved[idx];
        removeFn = () => p.reserved.splice(idx, 1);
    } else {
        const found = findCard(state, 'board', cardId);
        if (!found) return { ok: false };
        card = found.card;
        removeFn = () => { state.board[found.tier][found.idx] = state.decks[found.tier].pop() || null; };
    }
    if (!canAfford(state, playerId, card)) return { ok: false };
    const cost = computePaymentCost(p, card);
    for (const c of COLORS) {
        const useColor = Math.min(cost[c], p.tokens[c]);
        const useGold = cost[c] - useColor;
        p.tokens[c] -= useColor; state.bank[c] += useColor;
        p.tokens.gold -= useGold; state.bank.gold += useGold;
    }
    removeFn();
    p.cards.push(card);
    p.bonuses[card.color]++;
    state.actionTakenThisTurn = true;

    const qualifying = getQualifyingNobles(state, playerId);
    if (qualifying.length === 1) {
        claimNoble(state, playerId, qualifying[0].id);
    } else if (qualifying.length > 1) {
        state.pendingNobleChoice = playerId;
    }
    checkForFinalRound(state);
    return { ok: true, needsNobleChoice: qualifying.length > 1 };
}

export function getQualifyingNobles(state, playerId) {
    const p = player(state, playerId);
    return state.nobles.filter(n =>
        Object.entries(n.requirements).every(([c, n2]) => p.bonuses[c] >= n2)
    );
}

export function claimNoble(state, playerId, nobleId) {
    const p = player(state, playerId);
    const idx = state.nobles.findIndex(n => n.id === nobleId);
    if (idx < 0) return false;
    const qualifying = getQualifyingNobles(state, playerId);
    if (!qualifying.some(n => n.id === nobleId)) return false;
    p.nobles.push(state.nobles[idx]);
    state.nobles.splice(idx, 1);
    if (state.pendingNobleChoice === playerId) state.pendingNobleChoice = null;
    return true;
}

function checkForFinalRound(state) {
    if (state.finalRound) return;
    for (const p of state.players) {
        if (getPoints(p) >= 15) {
            state.finalRound = true;
            state.finalRoundStarterId = state.turn;
            break;
        }
    }
}

export function endTurn(state) {
    if (state.phase === 'discard' || state.pendingNobleChoice) return false;
    const idx = state.players.findIndex(p => p.id === state.turn);
    const next = state.players[(idx + 1) % state.players.length];
    if (state.finalRound && next.id === state.finalRoundStarterId) {
        finishGame(state);
        return true;
    }
    state.turn = next.id;
    state.turnNumber++;
    state.phase = 'main';
    state.actionTakenThisTurn = false;
    return true;
}

function finishGame(state) {
    let best = null, bestPts = -1, bestCards = Infinity;
    for (const p of state.players) {
        const pts = getPoints(p);
        if (pts > bestPts || (pts === bestPts && p.cards.length < bestCards)) {
            best = p.id; bestPts = pts; bestCards = p.cards.length;
        }
    }
    state.winner = best;
    state.phase = 'gameover';
}

export function checkVictory(state) {
    return state.winner;
}
