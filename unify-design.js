#!/usr/bin/env node
/**
 * 100개 미니게임 디자인 일치화
 *  1) viewport meta 표준화 (모바일 화면 크기 통일)
 *  2) 뒤로가기(메인으로) 링크 카드 하단에 통일 추가
 */
const fs = require("fs");
const path = require("path");

const VIEWPORT = '<meta name="viewport" content="width=device-width, initial-scale=1.0" />';
const BACK_TEXT = "← 메인으로 돌아가기";

const dirs = fs
  .readdirSync(__dirname)
  .filter((d) => /^mini\d+$/.test(d) && fs.existsSync(path.join(__dirname, d, "index.html")))
  .sort((a, b) => parseInt(a.slice(4)) - parseInt(b.slice(4)));

let vpAdded = 0, vpFixed = 0, blAdded = 0, blFixed = 0, blSkip = 0;

for (const d of dirs) {
  const file = path.join(__dirname, d, "index.html");
  let html = fs.readFileSync(file, "utf8");
  const orig = html;

  // ---- 1) viewport ----
  if (/<meta[^>]*name=["']viewport["'][^>]*>/i.test(html)) {
    const before = html;
    html = html.replace(/<meta[^>]*name=["']viewport["'][^>]*\/?>/i, VIEWPORT);
    if (html !== before) vpFixed++;
  } else {
    // charset meta 바로 뒤에 삽입 (없으면 <head> 뒤)
    if (/<meta[^>]*charset[^>]*>/i.test(html)) {
      html = html.replace(/(<meta[^>]*charset[^>]*>)/i, `$1\n    ${VIEWPORT}`);
    } else {
      html = html.replace(/<head>/i, `<head>\n    ${VIEWPORT}`);
    }
    vpAdded++;
  }

  // ---- 2) back-link ----
  if (/class=["']back-link["']/.test(html)) {
    // 문구/href 정규화
    const before = html;
    html = html.replace(
      /<a([^>]*?)class=(["'])back-link\2([^>]*?)>[^<]*<\/a>/g,
      `<a href="../index.html" class="back-link">${BACK_TEXT}</a>`
    );
    if (html !== before) blFixed++;
    else blSkip++;
  } else {
    // card 여는 태그의 들여쓰기(W)를 찾아, 같은 들여쓰기의 첫 </div>(=card 닫힘) 앞에 삽입
    const openRe = /^([ \t]*)<div class=["']card["']>/m;
    const m = openRe.exec(html);
    if (m) {
      const W = m[1];
      const closeRe = new RegExp(`^${W}</div>`, "m");
      // card open 이후 구간에서 첫 번째 동일 들여쓰기 </div> 탐색
      const afterOpen = m.index + m[0].length;
      const rest = html.slice(afterOpen);
      const cm = closeRe.exec(rest);
      if (cm) {
        const insertAt = afterOpen + cm.index;
        const snippet =
          `${W}  <div class="mt-4">\n` +
          `${W}    <a href="../index.html" class="back-link">${BACK_TEXT}</a>\n` +
          `${W}  </div>\n`;
        html = html.slice(0, insertAt) + snippet + html.slice(insertAt);
        blAdded++;
      } else {
        console.warn(`[WARN] ${d}: card 닫힘 </div> 못 찾음 — 뒤로가기 미삽입`);
      }
    } else {
      console.warn(`[WARN] ${d}: card open 못 찾음 — 뒤로가기 미삽입`);
    }
  }

  if (html !== orig) fs.writeFileSync(file, html, "utf8");
}

console.log(
  `완료: viewport(추가 ${vpAdded}, 표준화 ${vpFixed}) / 뒤로가기(추가 ${blAdded}, 문구통일 ${blFixed}, 이미표준 ${blSkip})`
);
