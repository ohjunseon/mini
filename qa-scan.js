#!/usr/bin/env node
/**
 * 100개 미니게임 헤드리스 실행 검사.
 * - 페이지 로드 시 콘솔 error / 미처리 예외 수집
 * - "게임 시작" 계열 버튼 자동 클릭 후 추가 에러 수집
 * - 캔버스/시작버튼 등 핵심 요소 존재 여부 확인
 * 네트워크(랭킹 API)는 오프라인이라 실패가 정상 → 관련 경고는 무시.
 */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const http = require("http");

const ROOT = __dirname;
const PORT = 4321;

// 무시할(정상적인) 에러 패턴 — 랭킹 API 오프라인 등
const IGNORE = [
  /Failed to load resource/i,
  /net::ERR/i,
  /GameStats\./i,
  /api\/(score|top|visit)/i,
  /favicon/i,
  /the server responded with a status/i,
];

function serve() {
  return new Promise((resolve) => {
    const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".json": "application/json" };
    const srv = http.createServer((req, res) => {
      let p = decodeURIComponent(req.url.split("?")[0]);
      if (p.endsWith("/")) p += "index.html";
      const fp = path.join(ROOT, p);
      if (!fp.startsWith(ROOT) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) {
        res.writeHead(404); res.end("404"); return;
      }
      res.writeHead(200, { "Content-Type": types[path.extname(fp)] || "application/octet-stream" });
      fs.createReadStream(fp).pipe(res);
    });
    srv.listen(PORT, () => resolve(srv));
  });
}

(async () => {
  const srv = await serve();
  const browser = await chromium.launch();
  const dirs = fs.readdirSync(ROOT)
    .filter((d) => /^mini\d+$/.test(d) && fs.existsSync(path.join(ROOT, d, "index.html")))
    .sort((a, b) => parseInt(a.slice(4)) - parseInt(b.slice(4)));

  const results = [];
  for (const d of dirs) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errors = [];
    page.on("console", (m) => { if (m.type() === "error") { const t = m.text(); if (!IGNORE.some((r) => r.test(t))) errors.push("console: " + t); } });
    page.on("pageerror", (e) => errors.push("throw: " + e.message));

    let info = { canvas: false, startBtn: false, clicked: false };
    try {
      await page.goto(`http://localhost:${PORT}/${d}/index.html`, { waitUntil: "load", timeout: 15000 });
      await page.waitForTimeout(400);
      info.canvas = (await page.locator("canvas").count()) > 0;
      // 시작 버튼 후보 클릭
      const btn = page.locator("button", { hasText: /시작|start|플레이|play|게임/i }).first();
      if (await btn.count()) {
        info.startBtn = true;
        try { await btn.click({ timeout: 2000 }); info.clicked = true; } catch (e) {}
      }
      await page.waitForTimeout(600);
    } catch (e) {
      errors.push("load: " + e.message);
    }
    await page.close();
    const status = errors.length ? "ERR" : "ok";
    results.push({ game: d, status, errors, ...info });
    console.log(`${d.padEnd(8)} ${status.padEnd(4)} canvas=${info.canvas?1:0} btn=${info.startBtn?1:0}${errors.length ? "  | " + errors.slice(0,2).join(" || ") : ""}`);
  }

  await browser.close();
  srv.close();

  const bad = results.filter((r) => r.status === "ERR");
  fs.writeFileSync(path.join(ROOT, "qa-scan-result.json"), JSON.stringify(results, null, 2));
  console.log(`\n=== 요약: 정상 ${results.length - bad.length} / 에러 ${bad.length} ===`);
  if (bad.length) console.log("에러 게임: " + bad.map((b) => b.game).join(", "));
})();
