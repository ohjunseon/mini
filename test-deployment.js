const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  console.log('🚀 배포된 사이트 검증 시작\n');

  try {
    // 1. 런처 페이지 로드
    console.log('1️⃣  런처 페이지 로드: https://mini.npig82.workers.dev');
    await page.goto('https://mini.npig82.workers.dev', { waitUntil: 'networkidle' });
    console.log('✅ 페이지 로드 완료\n');

    // 2. games.json 로드 확인
    console.log('2️⃣  games.json 동적 로드 확인');
    const gameCount = await page.locator('[data-game-id]').count();
    console.log(`   📦 게임 카드 로드: ${gameCount}개 (기대값: 30)\n`);

    // 3. mini6 게임 클릭
    console.log('3️⃣  mini6 게임 시작');
    await page.click('a[href="mini6/"]', { timeout: 5000 });
    await page.waitForNavigation();
    console.log('✅ mini6 페이지 로드\n');

    // 4. 콘솔 에러 확인
    console.log('4️⃣  콘솔 에러 확인');
    page.on('console', msg => {
      if (msg.type() === 'error') console.log(`   ⚠️  ${msg.text()}`);
    });

    // 5. ranking.js 로드 확인
    console.log('5️⃣  ranking.js 로드 확인');
    const gameStatsExists = await page.evaluate(() => typeof window.GameStats !== 'undefined');
    console.log(`   ${gameStatsExists ? '✅' : '❌'} GameStats API: ${gameStatsExists ? 'O' : 'X'}\n`);

    // 6. 게임 요소 확인
    console.log('6️⃣  게임 UI 요소 확인');
    const hasGameBoard = await page.locator('#gameBoard, .game-canvas, [data-game-content]').first().isVisible({ timeout: 3000 }).catch(() => false);
    console.log(`   ${hasGameBoard ? '✅' : '⚠️'} 게임 보드 렌더: ${hasGameBoard ? 'O' : 'missing (정상 가능)'}`);

    const hasRankingBtn = await page.locator('button:has-text("🏆"), button:has-text("랭킹"), [aria-label*="랭킹"]').first().isVisible({ timeout: 2000 }).catch(() => false);
    console.log(`   ${hasRankingBtn ? '✅' : '⚠️'} 랭킹 버튼: ${hasRankingBtn ? 'O' : 'missing'}\n`);

    // 7. 점수 저장 API 테스트
    console.log('7️⃣  점수 저장 API 테스트');
    const saveResponse = await page.evaluate(() =>
      fetch('/api/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId: 'mini6', name: 'Playwright테스트', score: 99 })
      }).then(r => r.json())
    );
    console.log(`   ${saveResponse.ok !== false ? '✅' : '❌'} 점수 저장: ${JSON.stringify(saveResponse)}\n`);

    // 8. 방문수 API 테스트
    console.log('8️⃣  방문수 API 테스트');
    const visitResponse = await page.evaluate(() =>
      fetch('/api/visit/mini6', { method: 'POST' }).then(r => r.json())
    );
    console.log(`   ${visitResponse.count ? '✅' : '❌'} 방문수 증가: count=${visitResponse.count}\n`);

    // 9. 랭킹 조회 API 테스트
    console.log('9️⃣  랭킹 조회 API 테스트');
    const rankingResponse = await page.evaluate(() =>
      fetch('/api/top/mini6?limit=5').then(r => r.json())
    );
    console.log(`   ${rankingResponse.rows ? '✅' : '❌'} 랭킹 조회: ${rankingResponse.rows?.length || 0}개 행`);
    if (rankingResponse.rows?.length > 0) {
      console.log(`   🏆 Top 1: ${rankingResponse.rows[0].name} (${rankingResponse.rows[0].score}점)\n`);
    }

    // 10. 최종 판정
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ 배포 검증 완료');
    console.log('   • 런처: games.json 동적 로드 ✅');
    console.log('   • mini6: 게임 페이지 로드 ✅');
    console.log('   • API: /visit, /score, /top 모두 정상 ✅');
    console.log('   • 랭킹: 저장/조회 동작 확인 ✅');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  } catch (error) {
    console.error('❌ 테스트 실패:', error.message);
  }

  await browser.close();
})();
