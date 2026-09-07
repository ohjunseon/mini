#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const gamesJson = JSON.parse(fs.readFileSync('./games.json', 'utf8'));

let injectedCount = 0;
let skippedCount = 0;
const autoReplaced = [];
const needsManual = [];

// ─────────────── 작업 1: juice.js 링크 주입 ────────────────
console.log('📌 작업 1: juice.js 링크 주입 (100개)...\n');

gamesJson.forEach(game => {
  const gameId = game.id;
  const gamePath = path.join('.', gameId, 'index.html');

  if (!fs.existsSync(gamePath)) {
    console.log(`⏭️  ${gameId}: 파일 없음`);
    skippedCount++;
    return;
  }

  let content = fs.readFileSync(gamePath, 'utf8');

  // 이미 juice.js가 있는지 확인
  if (content.includes('shared/juice.js')) {
    console.log(`✅ ${gameId}: 이미 juice.js 링크 있음`);
    injectedCount++;
    return;
  }

  // ranking.js 찾기
  const rankingMatch = content.match(/<script[^>]*src="\.\.\/shared\/ranking\.js"[^>]*><\/script>/);
  if (!rankingMatch) {
    console.log(`⚠️  ${gameId}: ranking.js 링크 없음`);
    skippedCount++;
    return;
  }

  // ranking.js 바로 다음에 juice.js 삽입
  const rankingScript = rankingMatch[0];
  const juiceScript = '<script src="../shared/juice.js"></script>';
  const newContent = content.replace(rankingScript, rankingScript + '\n    ' + juiceScript);

  fs.writeFileSync(gamePath, newContent, 'utf8');
  console.log(`✨ ${gameId}: juice.js 링크 추가`);
  injectedCount++;
});

console.log(`\n링크 주입 완료: ${injectedCount}개 수정\n`);

// ─────────────── 작업 2: addEventListener 패턴 분석 ────────────────
console.log('📌 작업 2: addEventListener 패턴 분석...\n');

const patterns = {
  click: /\.addEventListener\s*\(\s*['"]click['"]\s*,\s*(\w+)\s*\)/g,
  mousedown: /\.addEventListener\s*\(\s*['"]mousedown['"]\s*,\s*(\w+)\s*\)/g,
  onclick: /\.onclick\s*=\s*(\w+)/g,
  mousemove: /\.addEventListener\s*\(\s*['"]mousemove['"]/g,
  mouseup: /\.addEventListener\s*\(\s*['"]mouseup['"]/g,
  keydown: /\.addEventListener\s*\(\s*['"]keydown['"]/g,
  touchstart: /\.addEventListener\s*\(\s*['"]touchstart['"]/g,
};

gamesJson.forEach(game => {
  const gameId = game.id;
  const gamePath = path.join('.', gameId, 'index.html');

  if (!fs.existsSync(gamePath)) return;

  let content = fs.readFileSync(gamePath, 'utf8');
  const scriptMatch = content.match(/<script[^>]*>\s*([\s\S]*?)\s*<\/script>/);
  if (!scriptMatch) return;

  const scriptContent = scriptMatch[1];

  // 안전 패턴 찾기
  let hasClickOrMousedown = patterns.click.test(scriptContent) || patterns.mousedown.test(scriptContent) || patterns.onclick.test(scriptContent);
  let hasComplex = patterns.mousemove.test(scriptContent) || patterns.mouseup.test(scriptContent) || patterns.keydown.test(scriptContent);

  // 테스트를 위해 정규식 리셋
  patterns.click.lastIndex = 0;
  patterns.mousedown.lastIndex = 0;
  patterns.onclick.lastIndex = 0;
  patterns.mousemove.lastIndex = 0;
  patterns.mouseup.lastIndex = 0;
  patterns.keydown.lastIndex = 0;

  if (hasComplex) {
    needsManual.push(gameId);
    console.log(`⚠️  ${gameId}: 복잡한 패턴 (mousemove/mouseup/keydown) → 수동 처리`);
  } else if (hasClickOrMousedown) {
    autoReplaced.push(gameId);
    console.log(`✨ ${gameId}: 안전 패턴 → 자동 교체 대상`);
  }
});

// ─────────────── 작업 3: 안전 패턴 자동 교체 ────────────────
console.log(`\n📌 작업 3: 안전 패턴 자동 교체 (${autoReplaced.length}개)...\n`);

const replacedGames = [];

autoReplaced.forEach(gameId => {
  const gamePath = path.join('.', gameId, 'index.html');
  let content = fs.readFileSync(gamePath, 'utf8');

  // 이미 Juice.bindTap이 있으면 skip
  if (content.includes('Juice.bindTap')) {
    console.log(`✅ ${gameId}: 이미 Juice.bindTap 있음`);
    return;
  }

  let modified = false;

  // addEventListener('click', fn) → Juice.bindTap(el, fn)
  let newContent = content.replace(
    /(\w+)\.addEventListener\s*\(\s*['"]click['"]\s*,\s*(\w+)\s*\)/g,
    (match, el, fn) => {
      modified = true;
      return `Juice.bindTap(${el}, ${fn})`;
    }
  );

  // addEventListener('mousedown', fn) → Juice.bindTap(el, fn)
  newContent = newContent.replace(
    /(\w+)\.addEventListener\s*\(\s*['"]mousedown['"]\s*,\s*(\w+)\s*\)/g,
    (match, el, fn) => {
      modified = true;
      return `Juice.bindTap(${el}, ${fn})`;
    }
  );

  // el.onclick = fn → Juice.bindTap(el, fn)
  newContent = newContent.replace(
    /(\w+)\.onclick\s*=\s*(\w+)/g,
    (match, el, fn) => {
      modified = true;
      return `Juice.bindTap(${el}, ${fn})`;
    }
  );

  if (modified) {
    fs.writeFileSync(gamePath, newContent, 'utf8');
    console.log(`✨ ${gameId}: bindTap 교체 완료`);
    replacedGames.push(gameId);
  } else {
    console.log(`ℹ️  ${gameId}: 패턴 없음`);
  }
});

// ─────────────── 요약 ────────────────
console.log('\n' + '='.repeat(60));
console.log('📊 S2 작업 완료 요약\n');
console.log(`✅ juice.js 링크: ${injectedCount}/100 주입`);
console.log(`✨ 자동 교체: ${replacedGames.length}개 게임`);
console.log(`⚠️  수동 처리: ${needsManual.length}개 게임\n`);

if (autoReplaced.length > 0) {
  console.log('🔄 자동 교체 게임 목록:');
  console.log(autoReplaced.join(', '));
}

if (needsManual.length > 0) {
  console.log('\n📝 수동 처리 필요 게임 (S5~S14 이월):');
  console.log(needsManual.join(', '));
}

console.log('\n' + '='.repeat(60));
console.log('✅ 다음: 샘플 10개 로드 테스트 + 모바일 에뮬레이션 터치 확인');
