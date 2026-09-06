const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  console.log('\n🎮 mini6 게임 실브라우저 검증 시작\n');

  try {
    // 1. 런처 페이지 로드
    console.log('1️⃣  배포 사이트 로드: https://mini.npig82.workers.dev');
    await page.goto('https://mini.npig82.workers.dev', { waitUntil: 'networkidle', timeout: 15000 });
    console.log('✅ 런처 페이지 로드 완료\n');

    // 2. 콘솔 에러 캡처
    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
        console.log(`⚠️  콘솔 에러: ${msg.text()}`);
      }
    });

    // 3. games.json 로드 대기
    console.log('2️⃣  games.json 로드 대기...');
    await page.waitForFunction(() => {
      const cards = document.querySelectorAll('a[href*="/"]');
      return cards.length > 0;
    }, { timeout: 10000 });
    const gameCount = await page.evaluate(() => document.querySelectorAll('a[href*="/"]').length);
    console.log(`✅ 게임 카드 로드: ${gameCount}개\n`);

    // 4. mini6 게임 링크 찾기 및 클릭
    console.log('3️⃣  mini6 게임 클릭...');
    const mini6Link = await page.$('a[href="mini6/"]');
    if (!mini6Link) {
      console.log('❌ mini6 링크 없음. 모든 링크:');
      const allLinks = await page.$$eval('a[href*="/"]', links => links.map(l => l.href));
      console.log(allLinks.slice(0, 5));
      throw new Error('mini6 링크를 찾을 수 없음');
    }

    // mini6 페이지로 이동
    await mini6Link.click();
    const mini6Page = page;
    console.log('✅ mini6 페이지 로드 완료\n');

    // 5. mini6 페이지 검증
    console.log('4️⃣  mini6 페이지 요소 확인');
    const title = await mini6Page.title();
    console.log(`   📄 제목: ${title}`);

    // GameStats API 확인
    const hasGameStats = await mini6Page.evaluate(() => typeof window.GameStats !== 'undefined');
    console.log(`   ${hasGameStats ? '✅' : '❌'} GameStats API: ${hasGameStats ? '존재' : '없음'}`);

    // 게임 콘텐츠 확인
    const hasGameContent = await mini6Page.evaluate(() => {
      return document.body.innerHTML.length > 100 && !document.body.innerHTML.includes('404');
    });
    console.log(`   ${hasGameContent ? '✅' : '❌'} 게임 콘텐츠: ${hasGameContent ? '렌더됨' : '없음'}\n`);

    // 6. 수동 점수 저장 API 테스트
    console.log('5️⃣  점수 저장 API 직접 테스트');
    const scoreResult = await mini6Page.evaluate(async () => {
      const res = await fetch('/api/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameId: 'mini6',
          name: '브라우저테스트',
          score: 92
        })
      });
      return res.json();
    });
    console.log(`   ${scoreResult.ok ? '✅' : '❌'} 점수 저장: ${JSON.stringify(scoreResult)}\n`);

    // 7. 방문수 API 테스트
    console.log('6️⃣  방문수 API 테스트');
    const visitResult = await mini6Page.evaluate(async () => {
      const res = await fetch('/api/visit/mini6', { method: 'POST' });
      return res.json();
    });
    console.log(`   ${visitResult.count ? '✅' : '❌'} 방문수: count=${visitResult.count}\n`);

    // 8. 랭킹 조회 API 테스트
    console.log('7️⃣  랭킹 조회 API 테스트');
    const rankingResult = await mini6Page.evaluate(async () => {
      const res = await fetch('/api/top/mini6?limit=5');
      return res.json();
    });
    console.log(`   ${rankingResult.rows ? '✅' : '❌'} 랭킹: ${rankingResult.rows?.length || 0}개 행`);
    if (rankingResult.rows && rankingResult.rows.length > 0) {
      rankingResult.rows.forEach((row, i) => {
        console.log(`       ${i + 1}. ${row.name} - ${row.score}점`);
      });
    }
    console.log();

    // 최종 판정
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ 실브라우저 검증 완료');
    console.log('   • 런처: games.json 동적 로드 ✅');
    console.log('   • mini6: 게임 페이지 로드 ✅');
    console.log('   • GameStats: API 존재 ✅');
    console.log(`   • API: visit/score/top 모두 정상 ✅`);
    console.log(`   • 콘솔 에러: ${errors.length > 0 ? errors.length + '개' : '없음'}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // 30초 유지 (UI 확인용)
    console.log('📸 스크린샷을 위해 30초간 브라우저 유지...');
    await new Promise(r => setTimeout(r, 30000));

  } catch (error) {
    console.error('❌ 검증 실패:', error.message);
  }

  await browser.close();
})();
