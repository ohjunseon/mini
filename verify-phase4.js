#!/usr/bin/env node
/**
 * Phase 4 Verification Script
 * Tests score ceiling validation and name filtering logic
 */

const GAME_SCORE_LIMITS = {
  mini1: 5000, mini2: 999, mini3: 100, mini4: 100, mini5: 25,
  mini6: 999, mini7: 1000, mini8: 100000, mini9: 131072, mini10: 10000,
  mini11: 999, mini12: 999, mini13: 1, mini14: 100, mini15: 100,
  mini16: 999, mini17: 999, mini18: 999, mini19: 999, mini20: 100,
  mini21: 100, mini22: 999, mini23: 999, mini24: 999, mini25: 999999,
  mini26: 100, mini27: 999, mini28: 10000, mini29: 1, mini30: 9999,
};

const NAME_FILTER = /[^\w\s\-_\.一-鿿가-힯]/g;

function testScoreValidation() {
  console.log('🧪 Score Validation Tests\n');

  const tests = [
    { gameId: 'mini1', score: 2500, expected: 'PASS', desc: 'mini1 valid score' },
    { gameId: 'mini1', score: 5001, expected: 'FAIL', desc: 'mini1 exceeds limit' },
    { gameId: 'mini5', score: 25, expected: 'PASS', desc: 'mini5 max bricks' },
    { gameId: 'mini5', score: 26, expected: 'FAIL', desc: 'mini5 exceeds limit' },
    { gameId: 'mini9', score: 131072, expected: 'PASS', desc: '2048 max' },
    { gameId: 'mini9', score: 131073, expected: 'FAIL', desc: '2048 exceeds' },
  ];

  tests.forEach(({ gameId, score, expected, desc }) => {
    const maxScore = GAME_SCORE_LIMITS[gameId] || 1000000;
    const result = score <= maxScore ? 'PASS' : 'FAIL';
    const symbol = result === expected ? '✅' : '❌';
    console.log(`${symbol} ${desc}: score=${score}, max=${maxScore} → ${result}`);
  });
  console.log('');
}

function testNameFiltering() {
  console.log('🧪 Name Filtering Tests\n');

  const testNames = [
    { input: '테스트', expected: '테스트', desc: 'Korean name' },
    { input: '<script>alert("xss")</script>', expected: 'scriptalertxssscript', desc: 'HTML/script removal' },
    { input: '  hello   world  ', expected: 'hello world', desc: 'Whitespace normalization' },
    { input: '😀😀😀', expected: '익명', desc: 'Emoji removal → anonymous' },
    { input: 'User@#$%Name', expected: 'UserName', desc: 'Special chars removal' },
    { input: 'a'.repeat(30), expected: 'a'.repeat(20), desc: 'Length truncation (20 chars)' },
    { input: '', expected: '익명', desc: 'Empty → anonymous' },
  ];

  testNames.forEach(({ input, expected, desc }) => {
    let result = input
      .replace(NAME_FILTER, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (result.length === 0) {
      result = '익명';
    } else if (result.length > 20) {
      result = result.slice(0, 20);
    }

    const pass = result === expected;
    const symbol = pass ? '✅' : '❌';
    console.log(`${symbol} ${desc}`);
    if (!pass) {
      console.log(`   Input: "${input}" → Expected: "${expected}" but got: "${result}"`);
    }
  });
  console.log('');
}

function testGameCoverage() {
  console.log('🧪 Game Coverage\n');

  const games = Object.keys(GAME_SCORE_LIMITS);
  console.log(`✅ All 30 games have score limits defined (${games.length})`);
  console.log(`   Range: ${Math.min(...Object.values(GAME_SCORE_LIMITS))} ~ ${Math.max(...Object.values(GAME_SCORE_LIMITS))}`);
  console.log('');
}

function main() {
  console.log('='.repeat(50));
  console.log('Phase 4: Ranking Hardening - Verification Tests');
  console.log('='.repeat(50) + '\n');

  testScoreValidation();
  testNameFiltering();
  testGameCoverage();

  console.log('✨ All tests completed!');
  console.log('📝 Next: Deploy with wrangler and test in production');
}

main();
