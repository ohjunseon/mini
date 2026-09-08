#!/usr/bin/env node
/**
 * 설명문 ↔ 실제 조작 코드 자동 대조.
 * 설명이 약속한 조작이 코드에 구현돼 있지 않은 경우를 FLAG.
 */
const fs = require("fs");
const path = require("path");

const dirs = fs.readdirSync(__dirname)
  .filter((d) => /^mini\d+$/.test(d) && fs.existsSync(path.join(__dirname, d, "index.html")))
  .sort((a, b) => parseInt(a.slice(4)) - parseInt(b.slice(4)));

const rows = [];
for (const d of dirs) {
  let html = fs.readFileSync(path.join(__dirname, d, "index.html"), "utf8");
  // 외부 game.js 도 포함해 코드 검사
  const gj = path.join(__dirname, d, "game.js");
  const code = html + (fs.existsSync(gj) ? "\n" + fs.readFileSync(gj, "utf8") : "");

  // 설명문: header 안의 <p> 들 (스크립트/스타일 제외 위해 body 앞부분)
  const ps = [...html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)].map((m) => m[1].replace(/<[^>]*>/g, "").trim());
  const desc = ps.slice(0, 3).join(" ");

  // 코드가 실제 지원하는 입력
  const impl = {
    arrows: /Arrow(Up|Down|Left|Right)/.test(code),
    wasd: /keysPressed\[|keys\[|e\.key/.test(code) && /['"][wasdWASD]['"]/.test(code),
    space: /(===?\s*['"] ['"]|=== ?'Space'|code\s*===?\s*['"]Space['"]|keyCode\s*===?\s*32|e\.key\s*===?\s*['"] ['"])/.test(code),
    touch: /touchstart|touchmove|touchend/.test(code),
    mouse: /mousemove|mousedown|pointerdown|pointermove/.test(code),
    click: /addEventListener\(\s*['"]click|onclick=|Juice\.bindTap|\.onclick/.test(code),
    dpad: /[▲◀▶▼]|move\(\s*['"]?(up|down|left|right)/.test(code),
    keyboardAny: /keydown|e\.key|keysPressed|keys\[/.test(code),
  };

  // 설명문이 언급하는 조작
  const men = {
    arrows: /화살표|방향키|←|→|↑|↓|➡|⬅|⬆|⬇/.test(desc),
    wasd: /WASD|wasd/.test(desc),
    space: /스페이스|스페이스바|space/i.test(desc),
    swipe: /스와이프|밀어|쓸어/.test(desc),
    drag: /드래그|끌어/.test(desc),
    touch: /터치|탭하|눌러|누르/.test(desc),
    click: /클릭|클릭하|탭/.test(desc),
    mouse: /마우스/.test(desc),
  };

  const flags = [];
  if (men.arrows && !impl.arrows && !impl.dpad) flags.push("설명:화살표 but 코드에없음");
  if (men.wasd && !impl.wasd) flags.push("설명:WASD but 코드에없음");
  if (men.space && !impl.space) flags.push("설명:스페이스 but 코드에없음");
  if (men.swipe && !impl.touch) flags.push("설명:스와이프 but 터치없음");
  if (men.drag && !impl.touch && !impl.mouse) flags.push("설명:드래그 but 마우스/터치없음");
  if (men.mouse && !impl.mouse && !impl.click) flags.push("설명:마우스 but 없음");
  // 모바일 조작 공백: 방향입력 필요한데 터치/디패드/클릭 전무
  const needsDir = impl.arrows || impl.wasd;
  if (needsDir && !impl.touch && !impl.dpad && !impl.click && !impl.mouse) flags.push("모바일조작 전무(키보드전용)");

  rows.push({ game: d, desc: desc.slice(0, 44), flags, impl, men });
}

const bad = rows.filter((r) => r.flags.length);
console.log("=== 불일치 FLAG 게임 ===");
bad.forEach((r) => console.log(`${r.game.padEnd(8)} | ${r.flags.join("; ")}\n         desc: ${r.desc}`));
console.log(`\n총 ${rows.length}개 중 FLAG ${bad.length}개`);
fs.writeFileSync(path.join(__dirname, "qa-desc-result.json"), JSON.stringify(rows, null, 2));
