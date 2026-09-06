# 🚀 배포 체크리스트 (D1 배포 가이드)

> **현재 상태**: ✅ Phase 6 완료, 로컬 테스트 통과
> **다음 단계**: D1 생성 → 배포 → 모니터링

---

## ✅ 완료된 항목

### Phase 5: 100개 게임
- [x] mini1~100 생성 완료
- [x] mini100 = 명예의전당
- [x] games.json 등록
- [x] GameStats API 연동

### Phase 6: 최적화
- [x] SEO 강화 (메타 태그)
- [x] 썸네일 고도화 (카테고리 색상)
- [x] AdSense 준비 (기본 구조)
- [x] 문서화 (README, LICENSE, PERFORMANCE)
- [x] 로컬 테스트 (API 통과)

### 인프라
- [x] Express 서버 (로컬)
- [x] Cloudflare Worker 코드
- [x] D1 스키마
- [x] ranking.js 클라이언트
- [x] shared/style.css

---

## 🚀 D1 배포 단계

### 1단계: Wrangler 설치
```bash
npm install -g wrangler
wrangler version
```

### 2단계: D1 데이터베이스 생성
```bash
cd D:\game_\mini\worker
npx wrangler d1 create mini-ranking
```
**출력**: Database ID 복사해두기 (ca-pub-XXXX 형태)

### 3단계: wrangler.jsonc 수정
```json
"database_id": "복사한_ID_여기"
```

### 4단계: 스키마 적용
```bash
npx wrangler d1 execute mini-ranking --file=schema.sql
```

### 5단계: 배포
```bash
npx wrangler deploy
```

### 6단계: URL 확인
```bash
npx wrangler deployments list
# https://mini-XXXXX.workers.dev
```

---

## 🧪 배포 후 테스트

### API 테스트
```bash
$URL = "https://mini-XXXXX.workers.dev"

# 방문수
curl -X POST "$URL/api/visit/mini1"

# 점수 저장
curl -X POST "$URL/api/score" \
  -H "Content-Type: application/json" \
  -d '{"gameId":"mini1","name":"테스트","score":100}'

# 랭킹 조회
curl "$URL/api/top/mini1"
```

### 웹사이트 테스트
1. https://mini-XXXXX.workers.dev 접속
2. 게임 클릭 (mini1, mini50, mini100)
3. 콘솔 에러 확인 (F12)
4. 랭킹 저장/조회 테스트

---

## 📊 모니터링

- Cloudflare Dashboard → Analytics
- Google Search Console → Core Web Vitals
- AdSense → 수익 모니터링

---

## 📝 체크리스트

- [ ] Wrangler 설치
- [ ] D1 생성 및 ID 복사
- [ ] wrangler.jsonc 수정
- [ ] 스키마 적용
- [ ] 배포 실행
- [ ] API 테스트
- [ ] 웹 게임 테스트
- [ ] AdSense 활성화

---

**준비 완료! 배포 진행하세요! 🎉**

마지막 업데이트: 2026-09-07
