import * as Engine from './splendor-engine.js';

function player(state, id) { return state.players.find(p => p.id === id); }

function allBoardCards(state) {
    return [1, 2, 3].flatMap(t => state.board[t].filter(Boolean));
}

function affordableOptions(state, playerId) {
    const p = player(state, playerId);
    const options = [];
    for (const c of allBoardCards(state)) {
        if (Engine.canAfford(state, playerId, c)) options.push({ source: 'board', card: c });
    }
    for (const c of p.reserved) {
        if (Engine.canAfford(state, playerId, c)) options.push({ source: 'reserved', card: c });
    }
    return options;
}

function nobleDeficits(state, playerId) {
    const p = player(state, playerId);
    return state.nobles.map(n => {
        let deficit = 0, total = 0;
        for (const [c, need] of Object.entries(n.requirements)) {
            total += need;
            deficit += Math.max(0, need - p.bonuses[c]);
        }
        return { noble: n, deficit, total };
    });
}

function neededColorWeights(state, playerId, level) {
    const p = player(state, playerId);
    const weights = { white: 0, blue: 0, green: 0, red: 0, black: 0 };

    for (const c of allBoardCards(state)) {
        let missing = 0;
        for (const col of Engine.COLORS) {
            const need = Math.max(0, (c.cost[col] || 0) - p.bonuses[col] - p.tokens[col]);
            missing += need;
        }
        if (missing === 0 || missing > 3) continue;
        const closeness = 4 - missing;
        for (const col of Engine.COLORS) {
            const need = Math.max(0, (c.cost[col] || 0) - p.bonuses[col] - p.tokens[col]);
            if (need > 0) weights[col] += closeness * (c.points + 1);
        }
    }

    if (level === 'hard') {
        for (const { noble, deficit } of nobleDeficits(state, playerId)) {
            if (deficit === 0 || deficit > 3) continue;
            for (const [col, need] of Object.entries(noble.requirements)) {
                const have = p.bonuses[col];
                if (have < need) weights[col] += (4 - deficit) * 2;
            }
        }
    }
    return weights;
}

function scoreCard(state, playerId, card, level) {
    let score = card.points * 10;
    if (level === 'hard') {
        for (const { noble, deficit } of nobleDeficits(state, playerId)) {
            const need = noble.requirements[card.color];
            if (need && deficit > 0 && deficit <= 3) score += 6;
        }
        const remaining = allBoardCards(state).filter(c => c.id !== card.id);
        const contested = remaining.some(c => c.tier === card.tier);
        if (contested) score += 1;
    }
    return score;
}

export function chooseDiscard(state, playerId) {
    const p = player(state, playerId);
    const need = state.pendingDiscard[playerId] || 0;
    const discard = { white: 0, blue: 0, green: 0, red: 0, black: 0, gold: 0 };
    let remaining = need;
    const order = [...Engine.COLORS, 'gold'].sort((a, b) => p.tokens[b] - p.tokens[a]);
    while (remaining > 0) {
        let progressed = false;
        for (const c of order) {
            if (remaining <= 0) break;
            if (discard[c] < p.tokens[c]) { discard[c]++; remaining--; progressed = true; }
        }
        if (!progressed) break;
    }
    return discard;
}

export function chooseNoble(state, playerId) {
    const qualifying = Engine.getQualifyingNobles(state, playerId);
    if (!qualifying.length) return null;
    return qualifying[0].id;
}

export function runBotTurn(state, playerId, level) {
    const p = player(state, playerId);

    const options = affordableOptions(state, playerId);
    if (options.length) {
        options.sort((a, b) => scoreCard(state, playerId, b.card, level) - scoreCard(state, playerId, a.card, level));
        const best = options[0];
        Engine.purchaseCard(state, playerId, { source: best.source, cardId: best.card.id });
        return;
    }

    const weights = neededColorWeights(state, playerId, level);

    if (Engine.canReserve(state, playerId)) {
        const candidates = allBoardCards(state).filter(c => c.tier >= 2 || c.points > 0);
        if (candidates.length) {
            candidates.sort((a, b) => scoreCard(state, playerId, b, level) - scoreCard(state, playerId, a, level));
            const target = candidates[0];
            const alreadyClose = Engine.COLORS.every(col => (target.cost[col] || 0) <= p.bonuses[col] + p.tokens[col] + 2);
            const shouldReserve = level === 'hard' ? true : alreadyClose;
            if (shouldReserve && Math.random() < (level === 'hard' ? 0.4 : 0.2)) {
                Engine.reserveCard(state, playerId, { tier: target.tier, cardId: target.id });
                return;
            }
        }
    }

    const availColors = Engine.COLORS.filter(c => state.bank[c] > 0);
    const weighted = [...availColors].sort((a, b) => weights[b] - weights[a]);
    if (weighted.length >= 3) {
        Engine.takeThreeDifferent(state, playerId, weighted.slice(0, 3));
        return;
    }
    const twoSame = Engine.COLORS.filter(c => Engine.canTakeTwoSame(state, c)).sort((a, b) => weights[b] - weights[a]);
    if (twoSame.length) {
        Engine.takeTwoSame(state, playerId, twoSame[0]);
        return;
    }
    if (weighted.length > 0) {
        if (weighted.length === 2) { Engine.takeTwoSame(state, playerId, weighted[0]) || Engine.takeThreeDifferent(state, playerId, weighted); }
        else if (weighted.length === 1) { Engine.canTakeTwoSame(state, weighted[0]) && Engine.takeTwoSame(state, playerId, weighted[0]); }
        return;
    }
    if (Engine.canReserve(state, playerId)) {
        const candidates = allBoardCards(state);
        if (candidates.length) Engine.reserveCard(state, playerId, { tier: candidates[0].tier, cardId: candidates[0].id });
    }
}

export function respondNobleOrDiscardIfNeeded(state, playerId) {
    if (state.pendingDiscard[playerId] != null) {
        Engine.applyDiscard(state, playerId, chooseDiscard(state, playerId));
    }
    if (state.pendingNobleChoice === playerId) {
        const nobleId = chooseNoble(state, playerId);
        if (nobleId) Engine.claimNoble(state, playerId, nobleId);
    }
}
