# Phase 7 실행 런북 (세션별 자동 진행)

> **이 문서는 "읽으면 바로 실행되는" 실행서다.**
> 전략·설계 배경은 `PHASE7-GAME-POLISH.md`, 전체 이력은 `PROGRESS.md`.
> 작성일: 2026-09-07

---

# 📌 새 세션 시작 프로토콜 (필독)

새 세션(`/clear` 직후)에서 할 일은 **딱 3가지**다.

```
1. 이 문서(PHASE7-EXECUTION.md)를 읽는다
2. 아래 "현재 상태 블록"에서 ▶ NEXT 로 표시된 Step을 찾는다
3. 그 Step 섹션으로 가서 적힌 대로 실행한다
```

사용자는 새 세션에서 이것만 입력하면 된다:

```
PHASE7-EXECUTION.md 읽고 NEXT 스텝 진행해줘
```

Step이 끝나면 **반드시** 이 문서의 상태 블록을 갱신하고 커밋한다. 그래야 다음 세션이 이어받는다.

---

# 🔴 현재 상태 블록 (매 세션 종료 시 갱신 필수)

| Step | 작업 | 상태 | 커밋 | 비고 |
|---|---|---|---|---|
| S0 | 계획·스킬 작성 | ✅ 완료 | `5bbde77` | PHASE7 문서 2종 |
| S1 | `shared/juice.js` 제작 | **▶ NEXT** | - | 이 문서 S1 섹션 참조 |
| S2 | juice 자동 주입 (100개) | ⬜ 대기 | - | S1 완료 후 |
| S3 | `prompt()` 73곳 제거 | ⬜ 대기 | - | S2 완료 후 |
| S4 | 배포 + 모바일 실기기 검증 | ⬜ 대기 | - | S3 완료 후 |
| S5 | 폴리싱 B1 (mini1~10) | ⬜ 대기 | - | S4 완료 후 |
| S6 | 폴리싱 B2 (mini11~20) | ⬜ 대기 | - | |
| S7 | 폴리싱 B3 (mini21~30) | ⬜ 대기 | - | |
| S8 | 폴리싱 B4 (mini31~40) | ⬜ 대기 | - | |
| S9 | 폴리싱 B5 (mini41~50) | ⬜ 대기 | - | |
| S10 | 폴리싱 B6 (mini51~60) | ⬜ 대기 | - | |
| S11 | 폴리싱 B7 (mini61~70) | ⬜ 대기 | - | |
| S12 | 폴리싱 B8 (mini71~80) | ⬜ 대기 | - | |
| S13 | 폴리싱 B9 (mini81~90) | ⬜ 대기 | - | |
| S14 | 폴리싱 B10 (mini91~100) | ⬜ 대기 | - | |
| S15 | 최종 배포 + DoD 검증 | ⬜ 대기 | - | |

**상태 기호**: ⬜ 대기 / ▶ NEXT / 🔄 진행중 / ✅ 완료 / ⚠️ 부분완료(비고 필수)

---

# 🧭 세션 운영 규칙 (전 Step 공통)

1. **1세션 = 1 Step.** Step 하나 끝나면 문서 갱신·커밋 후 `/clear` 권장.
2. **Step 시작 전 반드시 `git status`가 clean인지 확인.** 더러우면 먼저 정리.
3. **작업 전 커밋 해시를 기록**해둔다 (롤백 지점).
4. **검증 없이 완료 처리 금지.** 각 Step의 "완료 조건"을 전부 충족해야 ✅.
5. **막히면 ⚠️ 부분완료로 남기고 비고에 정확한 실패 지점을 적는다.** 거짓 완료 금지.
6. 실행은 PowerShell 기준 (`python -m http.server`, `npm start`).

---

# S1 — `shared/juice.js` 제작

### 목표
도파민·터치 공용 모듈을 만들고 단독 검증한다. **이 파일 하나가 100개 게임의 품질을 결정한다.**

### 사전 조건
- `git status` clean
- `shared/` 에 `ranking.js`, `style.css` 존재 확인

### 작업 내용

`shared/juice.js` 생성. 아래 API를 **전부** 구현한다. 외부 라이브러리·에셋 파일 금지 (WebAudio 합성음, CSS/Canvas 파티클).

```js
window.Juice = {
  // ── 입력 ──────────────────────────────
  bindTap(el, fn),      // click+touchstart 동시 바인딩. preventDefault로 고스트클릭 차단.
                        // 같은 탭이 2번 발화하지 않게 200ms 디바운스.

  // ── 피드백 ────────────────────────────
  sfx(type),            // 'hit'|'good'|'bad'|'levelup'|'gameover'|'tick'
                        // WebAudio 오실레이터 합성. 파일 0개.
                        // 최초 사용자 입력에서 ctx.resume() (모바일 자동재생 정책)
  buzz(ms),             // navigator.vibrate 래퍼. 미지원(iOS)이면 조용히 무시.
  pop(x, y, opts),      // 파티클 터짐. opts:{count=12, color, spread}
                        // position:fixed div를 body에 뿌리고 애니메이션 후 자동 제거
  shake(el, power=8),   // CSS transform 흔들림 300ms
  flash(color),         // 화면 전체 짧은 색 플래시 (피격/성공)

  // ── 진행/보상 ─────────────────────────
  combo: {
    hit(),              // 콤보 +1, 3연속부터 배너 표시, 배수 반환
    reset(),            // 콤보 0
    get count()         // 현재 콤보
  },
  best(gameId, score, isLow),  // localStorage 개인최고 비교.
                               // 갱신이면 true + "🎉 신기록!" 연출 자동 실행
  countdown(n, cb),     // 3-2-1-START 오버레이 후 cb()

  // ── UI ────────────────────────────────
  toast(msg, type),     // 비차단 알림 2초. type:'info'|'good'|'bad'
  askName(),            // 닉네임: localStorage 있으면 즉시 반환(팝업 없음),
                        // 없을 때만 인라인 모달 1회. Promise<string> 반환

  // ── 통합 ──────────────────────────────
  submit(gameId, score, opts)  // opts:{isLow:false}
                               // ① best() 판정 → 신기록이면 연출+사운드
                               // ② askName() → ③ GameStats.saveScore()
                               // 게임오버 처리 원샷. prompt() 완전 대체.
};
```

**구현 시 주의**
- `window.GameStats` 없을 때도 죽지 않게 (옵셔널 체이닝)
- 모든 DOM 삽입물은 `pointer-events:none`, `z-index` 최상위, 자동 제거
- 색상은 `shared/style.css` 토큰 사용 (`--accent`, `--good`, `--bad`)
- 총 용량 목표 15KB 이하

### 검증
`juice-test.html` 생성 후 로컬에서 전 API 수동 확인:
```powershell
python -m http.server 8000
# http://localhost:8000/juice-test.html
```
- 버튼 11개로 각 API 발화 확인
- DevTools 모바일 에뮬레이션에서 `bindTap` 터치 동작 확인
- 콘솔 에러 0

### 완료 조건
- [ ] 11개 API 전부 구현
- [ ] `juice-test.html`에서 전부 육안 확인
- [ ] 콘솔 에러 0
- [ ] 모바일 에뮬레이션 터치 동작
- [ ] 15KB 이하

### 커밋
```
S1: shared/juice.js 제작 (도파민·터치 공용 모듈)
```

### 세션 종료 처리
1. 상태 블록 S1 → ✅ + 커밋 해시 기입
2. S2 → ▶ NEXT
3. `PROGRESS.md` 로그 1줄 추가
4. 커밋

---

# S2 — juice 자동 주입 (100개 게임)

### 목표
100개 게임에 `juice.js`를 링크하고, **터치 미지원 68개**의 이벤트 바인딩을 `Juice.bindTap`으로 교체한다.

### 사전 조건
- S1 완료 (`shared/juice.js` 존재)
- `git status` clean ← **롤백 지점 확보용, 필수**

### 작업 내용

`add-juice.js` 스크립트 작성 후 실행 (`add-seo-meta.js` 패턴 재사용).

**작업 1: 스크립트 링크 주입 (100개)**
```html
<script src="../shared/ranking.js"></script>
<script src="../shared/juice.js"></script>   <!-- 이 줄 추가 -->
```
- 이미 있으면 skip (멱등성)
- `ranking.js` 바로 다음 줄에 삽입

**작업 2: 터치 바인딩 교체 (68개)**

⚠️ **정규식 일괄 치환은 위험하다.** 게임마다 이벤트 패턴이 다르다. 다음 순서로 한다:

```
1. 스크립트로 각 게임의 addEventListener 패턴을 추출해 리포트 출력
2. 안전 패턴(단순 mousedown/click 1~2개)만 자동 치환
3. 복잡 패턴(mousemove 드래그, keydown 조합 등)은 목록만 뽑아 S5~S14 배치에서 수동 처리
4. 자동 치환한 게임은 즉시 로드 테스트
```

**자동 치환 대상 (안전)**
```js
el.addEventListener('click', fn)      → Juice.bindTap(el, fn)
el.addEventListener('mousedown', fn)  → Juice.bindTap(el, fn)
el.onclick = fn                       → Juice.bindTap(el, fn)
```

**자동 치환 제외 (수동)**
- `mousemove` / `mouseup` (드래그 조작)
- 캔버스 좌표 계산이 들어간 핸들러
- `keydown` 단독 (키보드 전용 → 별도 가상패드 필요, S5~S14에서 처리)

### 검증
```powershell
# 1. 링크 주입 개수
100개 전부 juice.js 링크 존재하는지 grep

# 2. 자동 치환 후 문법 검증
각 수정 파일 <script> 블록에 문법 오류 없는지 확인

# 3. 로컬 로드 테스트 (샘플 10개)
python -m http.server 8000
mini1, mini10, mini25, mini45, mini60, mini75, mini90, mini100 등 로드
→ 콘솔 에러 0 확인
```

### 완료 조건
- [ ] 100/100 `juice.js` 링크
- [ ] 자동 치환 게임 목록 + 개수 기록
- [ ] 수동 처리 필요 게임 목록 기록 (S5~S14로 이월)
- [ ] 샘플 10개 로드 시 콘솔 에러 0
- [ ] 모바일 에뮬레이션에서 샘플 3개 실제 터치 조작 성공

### 커밋
```
S2: 100개 게임 juice.js 주입 + 터치 바인딩 N개 자동 교체
(수동 처리 필요: miniX, miniY ... → S5~S14 이월)
```

### 세션 종료 처리
- 상태 블록 갱신, S3 → ▶ NEXT
- **수동 처리 목록을 상태 블록 비고에 반드시 남긴다**

---

# S3 — `prompt()` 73곳 제거

### 목표
게임오버마다 뜨는 브라우저 팝업을 없애 몰입 흐름을 복구한다.

### 사전 조건
- S2 완료, `git status` clean

### 작업 내용

현재 패턴 (73개 게임 공통):
```js
const nick = localStorage.getItem('nickname') || prompt("닉네임:") || "익명";
localStorage.setItem('nickname', nick);
if (window.GameStats) GameStats.saveScore(PAGE_ID, nick, score);
```

교체:
```js
Juice.submit(PAGE_ID, score);               // scoreType=high
Juice.submit(PAGE_ID, score, {isLow:true}); // scoreType=low (mini1 등 ms 기록)
```

**`isLow` 판정은 `games.json`의 `scoreType`으로 자동 결정한다.** 스크립트가 games.json을 읽어 게임별로 올바른 옵션을 넣는다.

### 검증
```powershell
# prompt 잔존 0 확인
전체 mini*/index.html 에서 prompt( 검색 → 0건이어야 함

# 점수 저장 실동작 (로컬 서버 필요)
cd server && npm start
python -m http.server 8000
샘플 5개 게임 플레이 → 게임오버 → 팝업 없이 저장되는지 확인
→ curl로 /api/top/miniN 조회해 실제 기록 확인
```

### 완료 조건
- [ ] `prompt(` 잔존 0건
- [ ] `alert(` 잔존 0건 (있으면 `Juice.toast`로 교체)
- [ ] scoreType=low 게임에 `isLow:true` 정확히 적용 (games.json 대조)
- [ ] 샘플 5개 게임 점수 저장 실동작 확인 (API 조회로 검증)
- [ ] 최초 1회만 닉네임 모달, 2회차부터 무팝업

### 커밋
```
S3: prompt() 73곳 제거 → Juice.submit() 통합
```

---

# S4 — 배포 + 모바일 실기기 검증

### 목표
**여기까지가 Phase 7의 최대 효과 구간.** 배포해서 실제 폰으로 확인한다.

### 사전 조건
- S1~S3 완료

### 작업 내용
```powershell
cd D:\game_\mini
npx wrangler deploy
```

배포 후 **실제 스마트폰**으로 `https://mini.npig82.workers.dev` 접속.

### 검증 (실기기 필수 — 에뮬레이션만으로 완료 처리 금지)

| 확인 | 대상 | 기준 |
|---|---|---|
| 런처 로드 | 메인 | 100개 카드 표시, 스크롤 부드러움 |
| 터치 조작 | mini1, mini10, mini45, mini90 | 탭이 실제로 먹히는가 |
| 사운드 | 아무 게임 | 첫 탭 이후 소리 남 |
| 진동 | 안드로이드 | 게임오버 시 진동 (iOS는 미지원, 정상) |
| 닉네임 | 첫 게임오버 | 인라인 모달 1회, 이후 무팝업 |
| 랭킹 저장 | 게임오버 후 | Top 목록에 내 기록 반영 |
| 신기록 연출 | 2회차 더 좋은 점수 | "신기록!" 표시 |

### 완료 조건
- [ ] 실기기(안드로이드 또는 iOS)에서 위 7항목 확인
- [ ] 콘솔 에러 없음 (원격 디버깅 또는 데스크톱 병행 확인)
- [ ] 실패 항목이 있으면 ⚠️ 로 기록하고 원인 명시

### 커밋
```
S4: Phase7 1차 배포 (터치·사운드·팝업제거) + 실기기 검증
```

> **🎯 마일스톤**: 여기까지 완료하면 100개 게임이 모바일에서 제대로 플레이된다.
> 이후 S5~S14는 "더 재미있게" 단계이므로, 급하지 않으면 여기서 끊어도 서비스는 정상이다.

---

# S5 ~ S14 — 게임별 폴리싱 (10개 × 10배치)

> **모든 배치가 동일한 절차를 따른다.** 아래 템플릿을 그대로 쓴다.

| Step | 배치 | 대상 |
|---|---|---|
| S5 | B1 | mini1 ~ mini10 |
| S6 | B2 | mini11 ~ mini20 |
| S7 | B3 | mini21 ~ mini30 |
| S8 | B4 | mini31 ~ mini40 |
| S9 | B5 | mini41 ~ mini50 |
| S10 | B6 | mini51 ~ mini60 |
| S11 | B7 | mini61 ~ mini70 |
| S12 | B8 | mini71 ~ mini80 |
| S13 | B9 | mini81 ~ mini90 |
| S14 | B10 | mini91 ~ mini100 |

### 배치 실행 절차 (공통)

```
1. 배치 대상 10개를 games.json에서 조회 (title/category/scoreType)
2. 각 게임마다 /game-polish 스킬 절차 수행:
     버그 6항목 → 밸런스 5항목 → 도파민 2~4개 선별
3. S2에서 이월된 "수동 터치 처리" 게임이 이 배치에 있으면 여기서 처리
4. 10개 완료 후 로컬 실플레이 검증
5. 커밋 + 상태 블록 갱신 + PROGRESS.md 로그
```

### 게임 1개당 체크 (스킬 `/game-polish` 상세)

**버그 6**: 터치 / 재시작 초기화 / 타이머 누수 / 점수 1회 저장 / 경계값 / 탭 이탈
**밸런스 5**: 첫 10초 생존 / 난이도 곡선 / 1판 30초~2분 / 점수상한 정합 / 실력 반영
**도파민**: 즉각 피드백 + 최고기록 **(필수 2)** + 게임 성격에 맞는 2개 선별

### 배치 완료 조건
- [ ] 10개 전부 버그 6항목 점검 완료
- [ ] 10개 전부 밸런스 5항목 점검 완료
- [ ] 10개 전부 `Juice.sfx` + `Juice.submit` 적용
- [ ] 10개 전부 로컬에서 실제 플레이 (PC + 모바일 에뮬레이션)
- [ ] 밸런스 수정한 게임은 **수정 근거를 커밋 메시지에 기재**
- [ ] 콘솔 에러 0

### 배치 커밋 템플릿
```
S{n}: Phase7 폴리싱 B{m} (miniA~miniB)

버그 수정:
- miniX: 재시작 시 타이머 중복 등록 → clearInterval 추가
- miniY: 터치 미지원 → Juice.bindTap 적용

밸런스:
- miniZ: 초기 낙하속도 5→3 (10초 내 사망률 과다)

도파민:
- 10개 전부 sfx+submit 적용
- miniX/miniY: 콤보 시스템 추가
- miniZ: 파티클 + 화면흔들림
```

### 배치 종료 처리
- 상태 블록 해당 Step → ✅, 다음 Step → ▶ NEXT
- `PROGRESS.md`에 4점 점검 로그 1줄
- 2배치마다 배포 권장 (S6, S8, S10, S12, S14 후)

---

# S15 — 최종 배포 + DoD 검증

### 작업 내용
```powershell
npx wrangler deploy
./test-deployment.ps1 -BaseUrl 'https://mini.npig82.workers.dev'
```

### DoD (Definition of Done) 전수 검증

```
자동 스캔 항목
1. 터치 지원:     100/100 이어야 함
2. prompt() 잔존:   0건
3. juice.js 링크: 100/100
4. Juice.submit:  100/100
```

- [ ] 위 4개 자동 스캔 통과
- [ ] 실기기에서 무작위 10개 게임 플레이
- [ ] 랭킹 저장/조회 정상
- [ ] `PROGRESS.md` 전 배치 로그 완비
- [ ] Phase 7 완료 선언 커밋

---

# 🔧 세션 프롬프트 템플릿

새 세션에서 복사해 쓸 문장.

**기본 (권장)**
```
PHASE7-EXECUTION.md 읽고 NEXT 스텝 진행해줘
```

**특정 Step 지정**
```
PHASE7-EXECUTION.md 의 S5 진행해줘
```

**배치 폴리싱 세밀 지정**
```
PHASE7-EXECUTION.md 읽고 S5 진행. mini1~5 먼저 하고 보고해줘
```

**이어받기 (중단된 세션 복구)**
```
PHASE7-EXECUTION.md 상태 블록 확인하고, ⚠️ 표시된 항목부터 처리해줘
```

---

# 🚨 롤백 / 장애 대응

| 상황 | 대응 |
|---|---|
| 자동 치환이 게임을 깨뜨림 | `git checkout <직전커밋> -- miniN/index.html` (해당 게임만 복구) |
| Step 전체 실패 | `git reset --hard <Step 시작 전 해시>` → 상태 블록 ⬜로 되돌림 |
| juice.js 버그로 100개 동시 이상 | `shared/juice.js`만 이전 버전으로 복구 → 게임 무수정 |
| 배포 후 문제 발견 | `npx wrangler rollback` |
| 세션이 중간에 끊김 | 상태 블록에 🔄 로 남아있음 → 해당 Step 처음부터 재실행 (멱등 설계) |

**모든 자동화 스크립트는 멱등(idempotent)해야 한다.** 두 번 돌려도 중복 삽입되지 않게 "이미 있으면 skip" 처리 필수.

---

# 📊 예상 일정

| 구간 | Step | 세션 수 | 효과 |
|---|---|---|---|
| **긴급** | S1~S4 | 4~5 | 🔴 **모바일 100개 플레이 가능** (최대 효과) |
| 폴리싱 | S5~S14 | 10 | 🟡 재미·중독성 향상 |
| 마감 | S15 | 1 | 🟢 검증·선언 |
| **합계** | | **15~16세션** | |

> S4까지가 전체 효과의 대부분이다. S5 이후는 점진 개선이므로 언제 멈춰도 서비스는 정상 동작한다.

---

# 📎 참고 파일 맵

| 파일 | 역할 |
|---|---|
| `PHASE7-EXECUTION.md` | **← 이 문서.** 세션별 실행 절차 + 상태 추적 |
| `PHASE7-GAME-POLISH.md` | 전략, 실측 스캔, Juice API 설계 배경 |
| `.claude/skills/game-polish/SKILL.md` | 게임 1개 폴리싱 스킬 (`/game-polish`) |
| `PROGRESS.md` | 전체 프로젝트 이력 (Phase 0~7) |
| `shared/juice.js` | S1 산출물. 도파민·터치 공용 모듈 |
| `games.json` | 게임 메타 (scoreType으로 isLow 판정) |
| `worker/index.js` | `GAME_SCORE_LIMITS` 점수 상한 |
| `add-seo-meta.js` | 자동화 스크립트 참고 패턴 |
