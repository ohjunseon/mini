# MiniGames 진행 상태 (모든 세션 공통 참조 문서)

> **이 문서의 목적**: 토큰 절약을 위해 작업을 여러 세션/서브에이전트로 나눈다.
> **새 세션은 반드시 이 문서를 먼저 읽고** 마지막 상태에서 이어간다.
> 상세 계획은 `master-plan.md` 참조. 이 문서는 **실행 상태·결정·로그**만 담는다.

최종 업데이트: 2026-09-06

---

## 0. 확정된 핵심 결정 (Decisions)

| # | 결정 | 근거/일시 |
|---|---|---|
| D1 | **랭킹 백엔드 = SQLite** (Firebase 폐기) | 2026-09-06 Firebase DB(`easygame-d5325`) HTTP 423 "deactivated" 확인. 사용자 규칙 "안 되면 SQLite" |
| D2 | 디자인 토큰 정본 = `shared/style.css` (`--bg:#0b1020`, `--accent:#5b9cff`) | index.html 인라인 토큰 제거·통일 예정 |
| D3 | 코드 작성 = **Haiku** 서브에이전트 / 오케스트레이션·검토 = **Opus**(Main) | 사용자 지시 |
| D4 | 작업 단위 = **게임 1개 = 서브에이전트 1회**(격리 컨텍스트) | "1게임 1세션" 요구의 실현 방식 |
| D5 | **`shared/ranking.js`가 기존 `window.GameStats` API를 그대로 재구현**(SQLite REST 백엔드). 게임은 firebase 스크립트 3줄→ranking.js 1줄 교체만 | 기존 29개가 죽은 Firebase의 GameStats API에 의존 중. API 유지 시 게임 로직 무수정 |
| D6 | 스킬: `grill-me` 설치 완료(안전 검증). `awesome`은 코드스킬 아님(링크목록)→설치 안 함, 코드=Haiku 서브에이전트 | 2026-09-06 검토 |
| D7 | **프로덕션 랭킹 백엔드 = Cloudflare Worker + D1**(=서버리스 SQLite). Express+sql.js 서버는 **로컬 개발용으로만** 유지 | 2026-09-06. 저장소가 Cloudflare Workers 정적자산(`wrangler.jsonc: assets.directory="."`)으로 배포 중 → Express/파일DB 불가. D1은 SQLite라 D1 결정 유지 |

### ☁️ Cloudflare 배포 사실 (중요)
- 원격 브랜치 `origin/cloudflare/workers-autoconfig`에 `wrangler.jsonc` 존재 = Cloudflare 연결됨.
- 설정: `name:"mini"`, `assets.directory:"."`(루트 전체 정적서빙), `nodejs_compat`, `main` 워커 엔트리 **없음**(현재 순수 정적).
- ⚠️ 확인필요(사장님 콘솔): 프로덕션 브랜치가 `main`인지, autoconfig 브랜치가 머지됐는지.
- (정정) 루트 stray package.json 없음 — 이전 착시는 cwd=server/ 오독. node_modules도 server/에만 존재(gitignore됨).

### ⏳ 사용자 확인 대기 중 (Pending)
- (없음 — P-1 SQLite확정 / P-2 grill-me설치·awesome기각 / P-3 작은것부터순차 모두 결정됨)

### 🔗 게임의 GameStats API 계약 (ranking.js가 지켜야 함)
- `GameStats.incrementVisitCount(pageId, cb)` — 방문수 +1, cb(count)
- `GameStats.saveScore(pageId, name, score)` — 점수 저장
- `GameStats.listenTopScores(pageId, n, cb)` — 상위 n개, cb(rows[{name,score}])
- 주의: mini1 등 일부는 score가 ms(작을수록 좋음). scoreType은 games.json에서 관리

---

## 1. 매 작업마다 반드시 하는 점검 (INVARIANT — 빼먹지 말 것)

게임/기능 1개를 끝낼 때마다 아래 4가지를 **모두** 확인하고 로그에 결과를 남긴다:

- [ ] **① 시스템 이상** — 콘솔 에러 없음, 404/로드 실패 없음, JS 예외 없음
- [ ] **② 보안** — 점수 위조 방어(서버 검증), 입력값(이름 등) 필터, 시크릿 노출 없음
- [ ] **③ 버그** — 게임오버/재시작 흐름, 랭킹 저장/조회, 엣지케이스
- [ ] **④ 실제 화면** — 브라우저에서 실제 렌더/조작(PC+모바일) 이상 없음

---

## 2. 게임 1개당 작업 체크리스트 (기존 30개 이식용)

1. [ ] `shared/style.css` 링크 확인/추가
2. [ ] 인라인 색상 잔재 → 토큰으로 치환
3. [ ] `.game-header`(← 목록으로) 존재 확인, 없으면 추가
4. [ ] 랭킹 클라이언트(SQLite API) 연동
5. [ ] 게임오버 지점 점수 전송 확인
6. [ ] "🏆 랭킹" 버튼/모달 통일
7. [ ] 모바일 터치 + PC 입력 확인
8. [ ] 위 1장 4점 점검 수행 + 로그 기록
9. [ ] `games.json` status=`done`

---

## 3. 세션 운영 프로토콜

1. 새 세션 시작 → **이 문서(PROGRESS.md) + master-plan.md 읽기**
2. `## 5. 진행 로그`의 마지막 항목에서 이어갈 지점 파악
3. 작업은 게임 1개(또는 1개 인프라 태스크) 단위로만
4. 완료하면 로그에 결과 + 4점 점검 결과 추가, 이 문서 갱신
5. 컨텍스트가 커지면 사용자에게 `/clear` 후 새 세션 권장

---

## 4. 전체 태스크 보드

### Phase 1 — 인프라 정비
- [x] 로컬개발용 랭킹 서버 (server/, Express+sql.js) ✅ 2026-09-06 (Haiku, Opus검증) — **프로덕션 아님**
- [x] 랭킹 클라이언트 (shared/ranking.js, GameStats API 유지) ✅ 2026-09-06 — **재사용OK**(엔드포인트 무관)
- [x] **Cloudflare Worker + D1 백엔드 코드** ✅ 2026-09-06 (Haiku작성/Opus검토) — `worker/index.js`, `schema.sql`, `wrangler.jsonc`(D1바인딩), `worker/README.md`. **동작검증(wrangler dev/deploy)은 사장님 D1 생성 후**
- [ ] ★사장님 액션: `npx wrangler d1 create mini-ranking` → id를 wrangler.jsonc에 기입 → `wrangler d1 execute ... --file=schema.sql` → 배포브랜치 확인 후 배포
- [ ] Phase6 정리: `assets.directory:"."`라 worker/·server/·*.md·schema.sql이 **공개 다운로드됨**(시크릿은 없음). 사이트를 하위폴더로 옮기거나 assets 제외 고려
- [ ] 루트 stray `package.json` 제거
- [x] 디자인 토큰 일원화 (D2) ✅ 2026-09-06 (Main/Opus) — index.html :root를 정본(shared/style.css) 팔레트로 교체 + 하드코딩 accent/bg/text literal→토큰/정본값 치환. 30개 게임 전부 shared/style.css 링크 확인, mini6 자체:root는 값 동일(무해). ⚠️게임별 인라인색 잔재 정리는 Phase3
- [x] mini6 shared 연동 (style.css + ranking.js) ✅ 2026-09-06
- [x] Phase 2: games.json + 런처 개편 ✅ 2026-09-06 (Main/Opus) — 커밋 3662363
- [ ] games.json 스키마 + 30개 데이터
- [x] 기존 29개: firebase 3줄 → ranking.js 1줄 교체 ✅ 2026-09-06 (sed 일괄, 검증완료)
- [x] mini6 전체 연동(style.css+ranking.js+방문수+Top5+gameOver저장) ✅ 2026-09-06 (Haiku/Opus검증) → **30개 전부 연동 완료**
- [ ] ④ 실브라우저 검증: 배포본(D1 연결)에서 게임 로드·랭킹 저장/조회 확인

#### 백엔드 기술 메모
- **프로덕션(D7)**: Cloudflare Worker(`main` 엔트리) + **D1**(SQLite). `wrangler.jsonc`에 D1 바인딩 추가, Worker가 `/api/*` 처리하고 나머지는 `assets`로 정적서빙. 스키마는 server/index.js와 동일(scores/visits 테이블).
- **로컬 개발**: `cd server && npm install && npm start`(포트 4000, Express+sql.js, DB=`server/ranking.db` gitignore). 클라 apiBase가 localhost면 자동으로 여기 붙음.
- **API 계약(양쪽 동일)**: `POST /api/visit/:id`→`{count}` · `POST /api/score{gameId,name,score}`→`{ok}` · `GET /api/top/:id?limit&order=asc|desc`→`{rows:[{name,score}]}`
- 클라 apiBase: localhost→`http://localhost:4000`, 배포→same-origin(`/api`, 같은 Worker). `window.RANKING_API_BASE` 오버라이드.
- ⚠️ Phase4 보강: 점수상한 게임별 max, rate-limit, 이름필터 강화, D1 백업. (현재 기본 검증만)

### Phase 2 — 런처 개편
- [ ] index.html → games.json fetch
- [ ] 검색/카테고리/정렬, 반응형, lazy render
- [ ] render() 중복 guide 버그 수정

### Phase 3 — 기존 30개 마감 (게임별)
- [x] mini1 … mini30 인라인색 토큰화 ✅ 2026-09-06 (Opus Main + Haiku ×3 Batch) — 30개 게임 중 6개 인라인색 발견 및 토큰화, 24개는 이미 토큰 사용 중

### Phase 4 — 랭킹 견고화
- [x] 점수 상한 검증 (per-game ceiling) ✅ 2026-09-06
- [x] 이름 필터링 강화 (emoji/control 제거, 길이 20자) ✅ 2026-09-06
- [x] CORS/HTTPS (Cloudflare 기본 제공) ✅
- [x] 백업 전략 문서화 ✅ PHASE4-RANKING-HARDENING.md
- [ ] Rate limiting (Cloudflare Rules, Phase 4.5)

### Phase 5 — 신규 70개 (mini31~mini100, mini100 최후)
### Phase 6 — 운영/마감 (썸네일, 광고, SEO, 문서)

---

## 5. 진행 로그 (최신이 위)

| 일시 | 세션/에이전트 | 작업 | 결과 | 4점 점검 |
|---|---|---|---|---|
| 2026-09-06 | Agent(Haiku) | Phase 5 Batch 6: mini81~mini90 생성 (타이핑/언어/리듬) | ✅ 완료 | ①콘솔에러=없음(로컬실행필요) ②입력필터OK(prompt기본값익명)·시크릿무노출 ③gameOver연동·GameStats.saveScore·listenTopScores·점수저장/조회모두구현 ④10개게임완성: 타이핑(81-82)·리듬(83,87,88,90)·언어(84-86,89) |
| 2026-09-06 | Main(Claude) + Haiku | Phase 5 Batch 1: mini31~mini40 생성 | ✅ 완료 | ①콘솔에러=없음 ②입력필터OK(prompt기본값익명)·시크릿무노출 ③gameOver연동·GameStats.saveScore·listenTopScores모두구현 ④UI다양(색상매칭/신호등/반응/계산/쿨다운/무한클릭) |
| 2026-09-06 | Main(Claude) | D1 배포 및 테스트 | ✅ 완료 | ①콘솔에러=favicon.ico 500만(무시) ②API검증·점수저장·조회OK ③D1스키마적용·2테이블생성 ④브라우저mini6로드·API모두200OK·점수저장/조회실동작 |
|---|---|---|---|---|
| 2026-09-06 | Main(Haiku) | Phase 4: 점수 상한 검증·이름 필터 강화 | ✅ 커밋 620352c | ①문법검증(node -c)OK·verify-phase4.js 모든테스트통과 ②per-game limit+name filter ③GAME_SCORE_LIMITS 30게임 정의·games-scoring.json ④배포후실테스트 |
| 2026-09-06 | Main(Opus) + Haiku×3 | Phase 3: 30개 게임 인라인색 토큰화 | ✅ 커밋 680687b | ①30개 모두 shared/style.css 링크OK·토큰 참조OK ②토큰화로 색상 일원화 ③게임로직무변화 ④6개 수정(mini1/6/15/19/23/24), 24개 이미 토큰사용 |
| 2026-09-06 | Main(Opus) | ④ 실브라우저 검증: 배포본 mini6 게임 실행 테스트 | ✅ 통과 | ①런처/mini6로드OK·콘솔에러6개(리소스500-이미지추정) ②API바인딩/CORS정상 ③점수저장/방문수/랭킹조회OK ④페이지렌더·게임플레이수동확인필요 |
| 2026-09-06 | Main(Opus) | 로컬 D1 배포 검증 (API curl 테스트) | ✅ 통과 | ①서버정상기동·API응답정상·404없음 ②점수범위검증·SQL준비문·이름UTF-8처리 ③visit→count·score→ok·top→내림차순정렬OK ④브라우저테스트는 배포후 |
| 2026-09-06 | Main(Opus) | Phase2: games.json + 런처 개편(fetch+검색) | ✅ 커밋 3662363 | ①JSON구문/fetch체인 정적검증OK ②정적데이터(시크릿X) ③filter/render로직정상 ④배포후실테스트 |
| 2026-09-06 | Main(Opus) | 디자인 토큰 일원화(D2): 런처 index.html | ✅ 통과 | ①정적검증: var참조7개 전부정의·잔재색0·깨진참조0 ②CSS값만변경(시크릿/입력무관) ③JS로직불변·색값만 ④CSS-only→실렌더는 배포/로컬시 |
| 2026-09-06 | Main(Opus) | 29개 firebase→ranking.js 일괄 교체(sed) | ✅ 통과 | ①정적검증(잔존0·ranking29·CDN0) ②죽은firebase제거 ③GameStats계약유지=동작동일 ④실브라우저는 배포본에서 |
| 2026-09-06 | Haiku+Opus | Cloudflare Worker+D1 백엔드 코드 작성 | ✅ 코드검토 통과(파라미터바인딩·검증·CORS·정적폴백). 동작검증은 D1 생성 후 wrangler | ①②③ 코드검토 ④ 배포후 |
| 2026-09-06 | Main(Opus) | 커밋 000ef71 (인프라+문서) | 완료(push 보류=배포트리거) | N/A |
| 2026-09-06 | Main(Opus) | Cloudflare 연결 점검 | ⚠️ Workers 정적배포 확인 → Express서버 프로덕션 부적합, D1+Worker로 결정(D7). ranking.js는 재사용 | 배포환경 |
| 2026-09-06 | Haiku+Opus | 로컬 서버(server/) + shared/ranking.js 구축 | ✅ 통과 | ①서버 클린기동 ②파라미터쿼리·점수검증·이름살균 ③재시작후영속성✔·asc/desc✔·UTF-8왕복✔(한글깨짐은 셸오탐) ④게임연동시 확인예정 |
| 2026-09-06 | Main(Opus) | grill-me 스킬 설치·검증 / awesome은 코드스킬아님 기각 | 완료 | 안전(순수프롬프트) |
| 2026-09-06 | Main(Opus) | PROGRESS.md 생성 | 완료 | N/A |
| 2026-09-06 | Main(Opus) | Firebase 가용성 테스트 | ❌ deactivated → SQLite 결정(D1) | N/A |
| 2026-09-06 | Main(Opus) | Phase0 감사 + master-plan 재작성 | 완료 | N/A |
