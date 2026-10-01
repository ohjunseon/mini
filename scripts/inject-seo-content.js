#!/usr/bin/env node
/**
 * SEO 콘텐츠 주입 스크립트 (#4 콘텐츠 보강 + #5 내부 링크)
 *
 * 각 miniN/index.html 의 back-link 앞에
 *   1) 게임 소개 / 조작법 / 게임 팁  (shared/game-content.json)
 *   2) 같은 카테고리 관련 게임 내부 링크 (games.json)
 * 블록을 주입한다. SEO_CONTENT 마커로 감싸 재실행해도 안전하다(중복 주입 방지).
 *
 * 사용법: node scripts/inject-seo-content.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const START = '<!-- SEO_CONTENT_START (auto-generated: scripts/inject-seo-content.js) -->';
const END = '<!-- SEO_CONTENT_END -->';

const games = JSON.parse(fs.readFileSync(path.join(ROOT, 'games.json'), 'utf8'));
const content = JSON.parse(fs.readFileSync(path.join(ROOT, 'shared', 'game-content.json'), 'utf8'));

// 실제 표시용 제목: 각 게임 페이지의 og:title 이 가장 정확하고 자기일관적이다.
// (game-titles.json 은 실제 게임과 어긋나 있어 사용하지 않는다)
let titles = {};
for (const g of games) {
  const f = path.join(ROOT, g.id, 'index.html');
  let label = g.title;
  try {
    const h = fs.readFileSync(f, 'utf8');
    const og = h.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i);
    const t = h.match(/<title>([^<]*?)(?:\s*\|[^<]*)?<\/title>/i);
    if (og && og[1].trim()) label = og[1].trim();
    else if (t && t[1].trim()) label = t[1].trim();
    // 접미사 정리(" - 미니게임", " 미니게임", 앞뒤 구분자)
    label = label.replace(/\s*[-–|]\s*미니게임\s*모음\s*$/u, '')
                 .replace(/\s*[-–|]\s*미니게임\s*$/u, '')
                 .trim();
  } catch (e) { /* fallback to games.json title */ }
  titles[g.id] = label;
}

const byId = {};
games.forEach((g) => { byId[g.id] = g; });

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function relatedLinks(game) {
  const sameCat = games.filter((g) => g.id !== game.id && g.category === game.category);
  const others = games.filter((g) => g.id !== game.id && g.category !== game.category);
  // 같은 카테고리 우선, 부족하면 다른 카테고리로 채워 최소 4개
  const picked = sameCat.concat(others).slice(0, 4);
  return picked.map((g) => {
    const label = titles[g.id] || g.title;
    return `          <li><a href="../${g.id}/">${esc(label)}</a></li>`;
  }).join('\n');
}

function buildBlock(game) {
  const c = content[game.id];
  if (!c) return null;
  const tips = (c.tips || []).map((t) => `            <li>${esc(t)}</li>`).join('\n');
  return `${START}
        <section class="game-info" style="text-align:left; margin-top:28px;">
          <h2>게임 소개</h2>
          <p>${esc(c.intro)}</p>
          <h3>조작법 &amp; 목표</h3>
          <p>${esc(c.howto)}</p>
          <h3>게임 팁</h3>
          <ul>
${tips}
          </ul>
          <h3>이 게임의 카테고리</h3>
          <p>이 게임은 <strong>${esc(game.category)}</strong> 장르입니다. 설치나 회원가입 없이 무료로 바로 즐길 수 있습니다.</p>
        </section>
        <nav class="related-games" aria-label="비슷한 게임" style="text-align:left; margin-top:24px;">
          <h3>🎮 비슷한 게임 더 즐기기</h3>
          <ul>
${relatedLinks(game)}
          </ul>
        </nav>
        ${END}`;
}

let changed = 0, skipped = 0;
for (const game of games) {
  const file = path.join(ROOT, game.id, 'index.html');
  if (!fs.existsSync(file)) { skipped++; continue; }
  let html = fs.readFileSync(file, 'utf8');
  const block = buildBlock(game);
  if (!block) { console.warn('  content 없음:', game.id); skipped++; continue; }

  // 기존 주입 블록 제거(재실행 안전)
  const re = new RegExp(START.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[\\s\\S]*?' + END.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
  html = html.replace(re, '').replace(/\n[ \t]*\n[ \t]*\n/g, '\n\n');

  // back-link 를 감싼 div 앞에 주입
  const anchorRe = /([ \t]*)(<div[^>]*>\s*<a[^>]*class="back-link"[\s\S]*?<\/a>\s*<\/div>)/;
  if (anchorRe.test(html)) {
    html = html.replace(anchorRe, (m, indent, divBlock) => `${block}\n${indent}${divBlock}`);
  } else {
    // 폴백: back-link 앵커 바로 앞
    const aRe = /([ \t]*)(<a[^>]*class="back-link"[\s\S]*?<\/a>)/;
    if (!aRe.test(html)) { console.warn('  back-link 못 찾음:', game.id); skipped++; continue; }
    html = html.replace(aRe, (m, indent, a) => `${block}\n${indent}${a}`);
  }

  fs.writeFileSync(file, html, 'utf8');
  changed++;
}

console.log(`\n완료: ${changed}개 수정, ${skipped}개 건너뜀 (총 ${games.length})`);
