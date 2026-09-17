export const UPPER_CATEGORIES = ['ones', 'twos', 'threes', 'fours', 'fives', 'sixes'];
export const LOWER_CATEGORIES = ['threeKind', 'fourKind', 'fullHouse', 'smallStraight', 'largeStraight', 'yacht', 'chance'];
export const CATEGORIES = [...UPPER_CATEGORIES, ...LOWER_CATEGORIES];

const UPPER_FACE = { ones: 1, twos: 2, threes: 3, fours: 4, fives: 5, sixes: 6 };
const UPPER_BONUS_THRESHOLD = 63;
const UPPER_BONUS = 35;
const TOTAL_ROUNDS = 13;

export function diceCounts(dice) {
  const c = [0, 0, 0, 0, 0, 0, 0]; // index 1..6 used
  for (const d of dice) c[d]++;
  return c;
}

export function computeCategoryScore(dice, category) {
  const sum = dice.reduce((a, b) => a + b, 0);
  const c = diceCounts(dice);

  if (category in UPPER_FACE) {
    const face = UPPER_FACE[category];
    return c[face] * face;
  }

  switch (category) {
    case 'threeKind':
      return Math.max(...c.slice(1)) >= 3 ? sum : 0;
    case 'fourKind':
      return Math.max(...c.slice(1)) >= 4 ? sum : 0;
    case 'fullHouse': {
      const nz = c.slice(1).filter(x => x > 0).sort((a, b) => a - b);
      return (nz.length === 2 && nz[0] === 2 && nz[1] === 3) ? 25 : 0;
    }
    case 'smallStraight': {
      const present = new Set(dice);
      const runs = [[1, 2, 3, 4], [2, 3, 4, 5], [3, 4, 5, 6]];
      return runs.some(run => run.every(v => present.has(v))) ? 30 : 0;
    }
    case 'largeStraight': {
      const present = new Set(dice);
      const runs = [[1, 2, 3, 4, 5], [2, 3, 4, 5, 6]];
      return runs.some(run => run.every(v => present.has(v))) ? 40 : 0;
    }
    case 'yacht':
      return Math.max(...c.slice(1)) === 5 ? 50 : 0;
    case 'chance':
      return sum;
    default:
      return 0;
  }
}

function emptyScorecard() {
  const sc = {};
  for (const c of CATEGORIES) sc[c] = null;
  return sc;
}

function rollFace() {
  return 1 + Math.floor(Math.random() * 6);
}

export function createGame(playerIds) {
  return {
    players: playerIds.map(id => ({ id, scorecard: emptyScorecard() })),
    order: playerIds.slice(),
    turnIndex: 0,
    turn: playerIds[0],
    round: 1,
    dice: [1, 1, 1, 1, 1],
    held: [false, false, false, false, false],
    rollsLeft: 3,
    hasRolledThisTurn: false,
    phase: 'main',
    winners: null,
  };
}

export function availableCategories(player) {
  return CATEGORIES.filter(c => player.scorecard[c] == null);
}

export function rollDice(state, playerId, keepMask) {
  if (state.phase !== 'main') return false;
  if (state.turn !== playerId) return false;
  if (state.rollsLeft <= 0) return false;

  const hold = Array.isArray(keepMask) && keepMask.length === 5 ? keepMask : [false, false, false, false, false];
  for (let i = 0; i < 5; i++) {
    if (!hold[i]) state.dice[i] = rollFace();
  }
  state.held = hold.slice();
  state.rollsLeft -= 1;
  state.hasRolledThisTurn = true;
  return true;
}

export function getTotal(player) {
  let upperSum = 0;
  for (const c of UPPER_CATEGORIES) upperSum += player.scorecard[c] || 0;
  const bonus = upperSum >= UPPER_BONUS_THRESHOLD ? UPPER_BONUS : 0;
  let lowerSum = 0;
  for (const c of LOWER_CATEGORIES) lowerSum += player.scorecard[c] || 0;
  return { upperSum, bonus, lowerSum, total: upperSum + bonus + lowerSum };
}

function advanceTurn(state) {
  const n = state.order.length;
  const wasLast = state.turnIndex === n - 1;
  state.turnIndex = (state.turnIndex + 1) % n;
  state.turn = state.order[state.turnIndex];
  if (wasLast) state.round += 1;

  if (state.round > TOTAL_ROUNDS) {
    state.phase = 'gameover';
    let best = -1;
    for (const p of state.players) best = Math.max(best, getTotal(p).total);
    state.winners = state.players.filter(p => getTotal(p).total === best).map(p => p.id);
    return;
  }

  state.dice = [1, 1, 1, 1, 1];
  state.held = [false, false, false, false, false];
  state.rollsLeft = 3;
  state.hasRolledThisTurn = false;
}

export function scoreCategory(state, playerId, category) {
  if (state.phase !== 'main') return false;
  if (state.turn !== playerId) return false;
  if (!CATEGORIES.includes(category)) return false;
  if (!state.hasRolledThisTurn) return false;
  const player = state.players.find(p => p.id === playerId);
  if (!player || player.scorecard[category] != null) return false;

  player.scorecard[category] = computeCategoryScore(state.dice, category);
  advanceTurn(state);
  return true;
}
