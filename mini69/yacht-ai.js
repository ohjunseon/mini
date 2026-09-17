import * as Engine from './yacht-engine.js';

const SACRIFICE_ORDER = [
  'ones', 'twos', 'threes', 'fours', 'fives', 'sixes',
  'chance', 'fullHouse', 'threeKind', 'smallStraight', 'fourKind', 'largeStraight', 'yacht',
];

export function chooseHold(state, playerId, level) {
  if (!state.hasRolledThisTurn) return [false, false, false, false, false];
  const dice = state.dice;
  const counts = Engine.diceCounts(dice);
  let bestFace = 1, bestCount = 0;
  for (let f = 1; f <= 6; f++) {
    if (counts[f] > bestCount) { bestCount = counts[f]; bestFace = f; }
  }
  const majorityMask = dice.map(d => d === bestFace);

  if (level !== 'hard') return majorityMask;
  if (bestCount >= 3) return majorityMask; // pursue kind / full house / yacht

  const present = new Set(dice);
  const runs = [[1, 2, 3, 4, 5], [2, 3, 4, 5, 6], [1, 2, 3, 4], [2, 3, 4, 5], [3, 4, 5, 6]];
  let bestRun = null, bestMatch = 0;
  for (const run of runs) {
    const m = run.filter(v => present.has(v)).length;
    if (m > bestMatch) { bestMatch = m; bestRun = run; }
  }
  if (bestRun && bestMatch >= 3) {
    const need = new Set(bestRun);
    const mask = [false, false, false, false, false];
    const claimed = new Set();
    dice.forEach((d, i) => { if (need.has(d) && !claimed.has(d)) { mask[i] = true; claimed.add(d); } });
    return mask;
  }
  return majorityMask;
}

export function chooseCategory(state, playerId) {
  const player = state.players.find(p => p.id === playerId);
  const avail = Engine.availableCategories(player);
  let best = null, bestScore = -1;
  for (const c of avail) {
    const s = Engine.computeCategoryScore(state.dice, c);
    if (s > bestScore) { bestScore = s; best = c; }
  }
  if (bestScore > 0) return best;
  for (const c of SACRIFICE_ORDER) if (avail.includes(c)) return c;
  return avail[0];
}

export function runBotTurn(state, playerId, level) {
  while (state.turn === playerId && state.phase === 'main' && state.rollsLeft > 0) {
    const hold = chooseHold(state, playerId, level);
    if (!Engine.rollDice(state, playerId, hold)) break;
  }
  if (state.turn === playerId && state.phase === 'main') {
    const category = chooseCategory(state, playerId, level);
    Engine.scoreCategory(state, playerId, category);
  }
}
