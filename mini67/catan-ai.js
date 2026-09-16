import * as Engine from './catan-engine.js';

const PIP = { 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 8: 5, 9: 4, 10: 3, 11: 2, 12: 1 };

function vertexScore(state, vertexId) {
    const v = state.board.vertices[vertexId];
    let score = 0;
    const resSeen = new Set();
    for (const tid of v.tileIds) {
        const t = state.board.tiles[tid];
        if (t.resource === 'desert') continue;
        score += PIP[t.number] || 0;
        resSeen.add(t.resource);
    }
    score += resSeen.size * 0.5;
    if (v.port) score += 0.75;
    return score;
}

function playerResourceProduction(state, playerId) {
    const prod = { wood: 0, brick: 0, wool: 0, grain: 0, ore: 0 };
    const p = state.players.find(x => x.id === playerId);
    const owned = [...p.settlements.map(v => ({ v, mult: 1 })), ...p.cities.map(v => ({ v, mult: 2 }))];
    for (const { v: vid, mult } of owned) {
        const v = state.board.vertices[vid];
        for (const tid of v.tileIds) {
            const t = state.board.tiles[tid];
            if (t.resource === 'desert' || t.id === state.board.robberTileId) continue;
            prod[t.resource] += (PIP[t.number] || 0) * mult;
        }
    }
    return prod;
}

function leaderPlayerId(state, excludeId) {
    let best = null, bestVp = -1;
    for (const p of state.players) {
        if (p.id === excludeId) continue;
        const vp = Engine.getVictoryPoints(state, p.id, { includeHidden: false });
        if (vp > bestVp) { bestVp = vp; best = p.id; }
    }
    return best;
}

export function chooseSetupPick(state, playerId, level) {
    let candidates = Object.keys(state.board.vertices)
        .filter(vid => Engine.canBuildSettlement(state, playerId, vid, true));
    candidates.sort((a, b) => vertexScore(state, b) - vertexScore(state, a));

    const isSecondRound = state.setupIndex >= state.players.length;
    if (isSecondRound && level === 'hard') {
        const p = state.players.find(x => x.id === playerId);
        const haveRes = new Set();
        for (const vid of p.settlements) {
            const v = state.board.vertices[vid];
            for (const tid of v.tileIds) {
                const t = state.board.tiles[tid];
                if (t.resource !== 'desert') haveRes.add(t.resource);
            }
        }
        const top = candidates.slice(0, 8);
        top.sort((a, b) => {
            const scoreA = vertexScore(state, a) + newResourceBonus(state, a, haveRes);
            const scoreB = vertexScore(state, b) + newResourceBonus(state, b, haveRes);
            return scoreB - scoreA;
        });
        candidates = top;
    }

    const best = candidates[0];
    const v = state.board.vertices[best];
    let bestEdge = null, bestScore = -Infinity;
    for (const eid of v.edgeIds) {
        const e = state.board.edges[eid];
        const other = e.v1 === best ? e.v2 : e.v1;
        const s = vertexScore(state, other);
        if (s > bestScore) { bestScore = s; bestEdge = eid; }
    }
    return { vertexId: best, edgeId: bestEdge };
}

function newResourceBonus(state, vertexId, haveRes) {
    const v = state.board.vertices[vertexId];
    let bonus = 0;
    for (const tid of v.tileIds) {
        const t = state.board.tiles[tid];
        if (t.resource !== 'desert' && !haveRes.has(t.resource)) bonus += 1;
    }
    return bonus;
}

export function chooseDiscard(state, playerId) {
    const p = state.players.find(x => x.id === playerId);
    const need = state.pendingDiscards[playerId] || 0;
    const discard = { wood: 0, brick: 0, wool: 0, grain: 0, ore: 0 };
    let remaining = need;
    const order = [...Engine.RESOURCES].sort((a, b) => p.resources[b] - p.resources[a]);
    while (remaining > 0) {
        let progressed = false;
        for (const r of order) {
            if (remaining <= 0) break;
            if (discard[r] < p.resources[r]) { discard[r]++; remaining--; progressed = true; }
        }
        if (!progressed) break;
    }
    return discard;
}

export function chooseRobberPlacement(state, playerId, level) {
    const target = level === 'hard' ? leaderPlayerId(state, playerId) : null;
    let bestTile = null, bestScore = -Infinity, bestVictim = null;

    for (const t of state.board.tiles) {
        if (t.id === state.board.robberTileId) continue;
        const candidates = Engine.getStealCandidates(state, t.id, playerId);
        if (t.resource === 'desert' && candidates.length === 0) continue;

        let score = 0;
        for (const vid of t.vertexIds) {
            const v = state.board.vertices[vid];
            if (v.building && v.building.owner !== playerId) {
                score += (PIP[t.number] || 0) * (v.building.type === 'city' ? 2 : 1);
                if (v.building.owner === target) score += 5;
            }
        }
        if (score > bestScore) {
            bestScore = score;
            bestTile = t.id;
            bestVictim = candidates.includes(target) ? target : (candidates[0] || null);
        }
    }
    if (bestTile === null) {
        const others = state.board.tiles.filter(t => t.id !== state.board.robberTileId);
        bestTile = others[Math.floor(Math.random() * others.length)].id;
    }
    return { tileId: bestTile, victimId: bestVictim };
}

function bestAffordableSettlementSpot(state, playerId) {
    const spots = Object.keys(state.board.vertices)
        .filter(vid => Engine.canBuildSettlement(state, playerId, vid, false));
    if (!spots.length) return null;
    spots.sort((a, b) => vertexScore(state, b) - vertexScore(state, a));
    return spots[0];
}

function bestRoadTowardExpansion(state, playerId) {
    const p = state.players.find(x => x.id === playerId);
    const edgeIds = Object.keys(state.board.edges)
        .filter(eid => Engine.canBuildRoad(state, playerId, eid, false));
    if (!edgeIds.length) return null;
    let best = null, bestScore = -Infinity;
    for (const eid of edgeIds) {
        const e = state.board.edges[eid];
        const s = Math.max(vertexScore(state, e.v1), vertexScore(state, e.v2));
        if (s > bestScore) { bestScore = s; best = eid; }
    }
    return best;
}

function tryBankTradeToward(state, playerId, neededCost) {
    const p = state.players.find(x => x.id === playerId);
    const missing = Object.entries(neededCost).filter(([r, n]) => p.resources[r] < n);
    if (!missing.length) return false;
    const [wantRes] = missing[0];
    const surplus = [...Engine.RESOURCES]
        .filter(r => !(r in neededCost) || p.resources[r] > neededCost[r])
        .sort((a, b) => p.resources[b] - p.resources[a]);
    for (const giveRes of surplus) {
        if (giveRes === wantRes) continue;
        const ratio = Engine.getTradeRatio(state, playerId, giveRes);
        if (p.resources[giveRes] >= ratio) {
            return Engine.bankTrade(state, playerId, giveRes, wantRes);
        }
    }
    return false;
}

export function runBuildPhase(state, playerId, level) {
    const p = state.players.find(x => x.id === playerId);
    const maxSteps = 25;

    const playableCard = (type) => p.devCards.findIndex(c => c.type === type && !c.played && c.boughtTurn !== state.turnNumber);

    if (!state.devCardPlayedThisTurn) {
        const knightIdx = playableCard('knight');
        if (knightIdx >= 0) {
            const robberOnMine = p.settlements.concat(p.cities).some(vid =>
                state.board.vertices[vid].tileIds.includes(state.board.robberTileId)
            );
            const leader = leaderPlayerId(state, playerId);
            const leaderVp = leader ? Engine.getVictoryPoints(state, leader, { includeHidden: false }) : 0;
            const shouldPlay = robberOnMine || (level === 'hard' && leaderVp >= 7) || (level === 'easy' && Math.random() < 0.3);
            if (shouldPlay) {
                const res = Engine.playDevCard(state, playerId, knightIdx);
                if (res.needsRobber) {
                    const { tileId, victimId } = chooseRobberPlacement(state, playerId, level);
                    Engine.moveRobberAndSteal(state, tileId, playerId, victimId);
                    state.phase = 'main';
                }
            }
        }
    }

    if (!state.devCardPlayedThisTurn) {
        const rbIdx = playableCard('roadbuilding');
        if (rbIdx >= 0 && bestRoadTowardExpansion(state, playerId) && p.roads.length < Engine.MAX_PIECES.road) {
            Engine.playDevCard(state, playerId, rbIdx);
        }
    }

    if (!state.devCardPlayedThisTurn) {
        const yopIdx = playableCard('yearofplenty');
        if (yopIdx >= 0) {
            const goal = p.settlements.some(vid => Engine.canBuildCity(state, playerId, vid))
                ? Engine.COSTS.city : Engine.COSTS.settlement;
            const missing = Object.entries(goal).filter(([r, n]) => p.resources[r] < n);
            if (missing.length >= 1) {
                const picks = missing.length >= 2
                    ? [missing[0][0], missing[1][0]]
                    : [missing[0][0], missing[0][0]];
                Engine.playDevCard(state, playerId, yopIdx, { resource1: picks[0], resource2: picks[1] });
            }
        }
    }

    if (!state.devCardPlayedThisTurn && level === 'hard') {
        const monoIdx = playableCard('monopoly');
        if (monoIdx >= 0) {
            let bestRes = null, bestTotal = 3;
            for (const r of Engine.RESOURCES) {
                const total = state.players.filter(x => x.id !== playerId).reduce((s, x) => s + x.resources[r], 0);
                if (total > bestTotal) { bestTotal = total; bestRes = r; }
            }
            if (bestRes) Engine.playDevCard(state, playerId, monoIdx, { resource: bestRes });
        }
    }

    for (let step = 0; step < maxSteps; step++) {
        let acted = false;

        const cityCandidates = p.settlements.filter(vid => Engine.canBuildCity(state, playerId, vid));
        if (cityCandidates.length && canAfford(p, Engine.COSTS.city)) {
            cityCandidates.sort((a, b) => vertexScore(state, b) - vertexScore(state, a));
            Engine.buildCity(state, playerId, cityCandidates[0]);
            acted = true;
        } else if (canAfford(p, Engine.COSTS.settlement)) {
            const spot = bestAffordableSettlementSpot(state, playerId);
            if (spot) { Engine.buildSettlement(state, playerId, spot); acted = true; }
        }

        if (!acted && p.pendingFreeRoads > 0) {
            const road = bestRoadTowardExpansion(state, playerId);
            if (road) { Engine.buildRoad(state, playerId, road, { free: true }); p.pendingFreeRoads--; acted = true; }
            else p.pendingFreeRoads = 0;
        }

        if (!acted && canAfford(p, Engine.COSTS.road)) {
            const wantsMoreSettlements = p.settlements.length < Engine.MAX_PIECES.settlement;
            if (wantsMoreSettlements) {
                const road = bestRoadTowardExpansion(state, playerId);
                if (road) { Engine.buildRoad(state, playerId, road); acted = true; }
            }
        }

        if (!acted && canAfford(p, Engine.COSTS.devcard) && state.devDeck.length > 0) {
            Engine.buyDevCard(state, playerId);
            acted = true;
        }

        if (!acted) {
            const goals = [Engine.COSTS.settlement, Engine.COSTS.city, Engine.COSTS.devcard];
            for (const g of goals) {
                if (tryBankTradeToward(state, playerId, g)) { acted = true; break; }
            }
        }

        if (!acted) break;
        if (Engine.checkVictory(state)) break;
    }
}

function canAfford(p, cost) {
    return Object.entries(cost).every(([res, n]) => p.resources[res] >= n);
}

export function respondToTrade(state, playerId, offer, level) {
    const p = state.players.find(x => x.id === playerId);
    for (const [r, n] of Object.entries(offer.receive || {})) {
        if ((p.resources[r] || 0) < n) return false;
    }
    const prod = playerResourceProduction(state, playerId);
    let giveValue = 0, wantValue = 0;
    for (const [r, n] of Object.entries(offer.give || {})) wantValue += n * (1 + (10 - (prod[r] || 0)) * 0.05);
    for (const [r, n] of Object.entries(offer.receive || {})) giveValue += n * (1 + (10 - (prod[r] || 0)) * 0.05);
    const threshold = level === 'hard' ? 1.0 : 0.75;
    return wantValue >= giveValue * threshold;
}
