#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const gamesJson = JSON.parse(fs.readFileSync('./games.json', 'utf8'));

let modifiedCount = 0;
let gamesSummary = [];

console.log('📌 S3: prompt() 제거 → Juice.submit() 교체\n');

function processGameFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  const originalContent = content;

  // 패턴 1: const nick = localStorage.getItem(...) || prompt(...) || "익명"
  // 이 라인을 completely 제거하고, GameStats.saveScore만 Juice.submit으로 변경
  content = content.replace(
    /\s*const\s+nick\s*=\s*localStorage\.getItem\s*\(\s*['"]nickname['"]\s*\)\s*\|\|\s*prompt\s*\([^)]*\)\s*\|\|\s*["']익명["'];?\n/g,
    '\n'
  );

  // 패턴 2: localStorage.setItem('nickname', nick) 제거
  content = content.replace(
    /\s*localStorage\.setItem\s*\(\s*['"]nickname['"]\s*,\s*nick\s*\);?\n/g,
    '\n'
  );

  // 패턴 3: if (window.GameStats) GameStats.saveScore(PAGE_ID, nick, ...)
  // → Juice.submit(PAGE_ID, ...)
  content = content.replace(
    /if\s*\(\s*window\.GameStats\s*\)\s*GameStats\.saveScore\s*\(\s*PAGE_ID\s*,\s*nick\s*,\s*([^)]+)\s*\);?/g,
    'Juice.submit(PAGE_ID, $1);'
  );

  // 패턴 4: alert() → Juice.toast()
  content = content.replace(
    /alert\s*\(\s*["']([^"']+)["']\s*\);?/g,
    'Juice.toast("$1", "info");'
  );

  // 패턴 5: 간단한 prompt 제거
  content = content.replace(
    /\s*const\s+\w+\s*=\s*prompt\s*\([^)]*\)\s*\|\|\s*["']익명["'];?\n/g,
    '\n'
  );

  // 패턴 6: prompt 라인 완전 제거 (다른 형태)
  content = content.replace(
    /\s*const\s+(\w+)\s*=\s*localStorage\.getItem\s*\(\s*['"]nickname['"]\s*\)\s*\|\|\s*prompt\s*\([^)]*\)\s*\|\|\s*["']익명["'];?/g,
    'const $1 = localStorage.getItem("nickname") || "익명";'
  );

  if (content !== originalContent) {
    modified = true;
  }

  return { content, modified };
}

gamesJson.forEach(game => {
  const gameId = game.id;
  const gamePath = path.join('.', gameId, 'index.html');

  if (!fs.existsSync(gamePath)) {
    console.log(`⏭️  ${gameId}: 파일 없음`);
    return;
  }

  let htmlContent = fs.readFileSync(gamePath, 'utf8');
  let modified = false;

  // HTML 인라인 처리
  const htmlResult = processGameFile(gamePath);
  if (htmlResult.modified) {
    fs.writeFileSync(gamePath, htmlResult.content, 'utf8');
    modified = true;
  }

  // JS 파일 처리
  const jsPath = path.join('.', gameId, 'game.js');
  if (fs.existsSync(jsPath)) {
    const jsResult = processGameFile(jsPath);
    if (jsResult.modified) {
      fs.writeFileSync(jsPath, jsResult.content, 'utf8');
      modified = true;
    }
  }

  if (modified) {
    console.log(`✨ ${gameId}`);
    gamesSummary.push(gameId);
    modifiedCount++;
  }
});

console.log('\n' + '='.repeat(60));
console.log(`✅ 수정 완료: ${modifiedCount}개 게임`);
if (modifiedCount > 0) {
  console.log(`게임: ${gamesSummary.join(', ')}`);
}
console.log('='.repeat(60));
