#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const gamesJson = JSON.parse(fs.readFileSync('./games.json', 'utf8'));
const titlesJson = JSON.parse(fs.readFileSync('./game-titles.json', 'utf8'));

// 제목 맵 생성
const titlesMap = {};
titlesJson.forEach(t => {
  titlesMap[t.id] = t.actualTitle;
});

function generateSeoMeta(gameId, actualTitle, desc, category) {
  const encodedDesc = desc
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  const encodedTitle = actualTitle
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  return `  <meta name="description" content="${encodedDesc} - 미니게임">
  <meta name="keywords" content="${category}, 미니게임, 게임">
  <meta name="theme-color" content="#5b9cff">
  <meta property="og:title" content="${encodedTitle}">
  <meta property="og:description" content="${encodedDesc}">
  <meta property="og:type" content="website">
  <meta property="og:image" content="/${gameId}/cover.png">
  <meta property="twitter:card" content="summary">
  <meta property="twitter:title" content="${encodedTitle}">
  <meta property="twitter:description" content="${encodedDesc}">`;
}

let updatedCount = 0;
let skippedCount = 0;

gamesJson.forEach(game => {
  const gameId = game.id;
  const gamePath = path.join('.', gameId, 'index.html');

  if (!fs.existsSync(gamePath)) {
    console.log(`⏭️  ${gameId}: 파일 없음`);
    skippedCount++;
    return;
  }

  const actualTitle = titlesMap[gameId] || game.title;
  let content = fs.readFileSync(gamePath, 'utf8');

  // 이미 메타 태그가 있는지 확인
  if (content.includes('og:title')) {
    console.log(`✅ ${gameId}: 이미 SEO 메타 있음`);
    updatedCount++;
    return;
  }

  // </head> 위치 찾기
  const headEndIndex = content.indexOf('</head>');
  if (headEndIndex === -1) {
    console.log(`⚠️  ${gameId}: </head> 없음`);
    skippedCount++;
    return;
  }

  // 메타 태그 생성 및 삽입
  const seoMeta = generateSeoMeta(gameId, actualTitle, game.desc, game.category);
  const newContent = content.slice(0, headEndIndex) + seoMeta + '\n' + content.slice(headEndIndex);

  fs.writeFileSync(gamePath, newContent, 'utf8');
  console.log(`✨ ${gameId}: SEO 메타 추가`);
  updatedCount++;
});

console.log(`\n완료: ${updatedCount}개 수정, ${skippedCount}개 스킵`);
