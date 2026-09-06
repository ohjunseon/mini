# MiniGames 마스터 플랜 (실측 확정본)
## 30개 → 100개 확장 · 디자인 통일 · 게임별 Top100 랭킹

> **개정 이력**: 초판은 GitHub 원격에서 개별 파일을 못 읽어 "미확인=가정"으로 작성됨.
> 본 개정판(2026-09-06)은 **로컬 저장소를 직접 감사(Phase 0)한 실측 결과**로 재작성했습니다.
> 초판의 근본 전제(랭킹 없음 / shared 충돌 우려 / SQLite 서버 신규 구축) 상당수가 **사실과 달랐습니다.**

---

# 0. 감사(Phase 0) 실측 결과 — 초판이 틀린 것

로컬 clone 저장소를 직접 읽었습니다. 초판의 "가정"과 실제를 대조합니다.

## 🔴 전제가 붕괴된 항목

| 초판 주장 | 실측 결과 |
|---|---|
| "랭킹 없음. 플레이 횟수만 셈" | ❌ **틀림.** `shared/firebase.js`(364줄)에 Firebase Realtime DB 랭킹이 **이미 구현**됨. `window.GameStats`가 `saveScore` / `listenTopScores` / `incrementVisitCount` 제공 |
| "`shared/`에 새 파일 만들면 기존과 충돌(최대 리스크)" | ❌ **틀림.** `shared/` 실제 내용 = `firebase.js` + `style.css`. 만들려던 걸 **이미 다른 이름으로 보유.** 신규 제작이 아니라 **기존 확장**이 맞음 |
| "`seed.json` 용도 불명" | ✅ **판명.** `{visits, scores:{게임id:{키:{name,score,ts}}}}` = 방문수/랭킹 데이터 스키마 (Firebase 구조와 동일) |
| "Phase 4에서 OCI + SQLite 랭킹 서버를 신규 구축" | ❌ **대부분 불필요.** Firebase 백엔드가 이미 살아있음. high/low 방향 문제도 firebase.js 주석에서 페이지별 처리하도록 이미 설계 |

## ✅ 초판이 맞은 항목
- **P1** 게임 목록 하드코딩 — 맞음 (`index.html`에 30개 `{id:'miniN'...}` 배열)
- **P3** 미등록 폴더 — 맞음 (`binggo/`, `min2/`, `2026_sum/`가 index.html에 없음)
- **P5** cover.png 부재 — 맞음 (실제로 하나도 없음, 폴백 SVG만)
- **P4** `t.html`/`t2.html` 루트 잔존 — 맞음

## ⚠️ 감사로 새로 드러난 실제 리스크 (초판에 없던 것)

| # | 발견 | 심각도 |
|---|---|---|
| A1 | **Firebase DB 보안 규칙(Rules)/Auth 미설정** — `firebase.js` 주석이 직접 명시. 즉 **누구나 클라이언트에서 DB에 임의 점수 쓰기 가능.** 초판의 어뷰징 우려(E4)는 SQLite가 아니라 **여기서 실제로 발생 중** | **높음** |
| A2 | **디자인 토큰 이중 존재.** `shared/style.css`: `--bg:#0b1020`, `--accent:#5b9cff`. `index.html` 인라인: `#0b1220`, `#60a5fa`. **두 소스가 미묘하게 다름** → "디자인 통일" 목표와 이미 어긋남 | 중 |
| A3 | **firebase 미연동 게임 = `mini6` 단 1개.** 30개 중 29개는 `firebase.js` + `style.css` 모두 이미 링크됨 | 낮음 |
| A4 | Firebase config(apiKey 등)가 저장소에 커밋됨. 클라이언트 키라 노출 자체는 정상이나, A1과 결합 시 무방비 | 중 |

---

# 1. 현행 구조 (실측)

## 1-1. 인프라 현황
| 항목 | 실제 현황 |
|---|---|
| 게임 목록 | `index.html` `games` 배열 하드코딩 (30개) |
| 게임 경로 | `miniN/index.html` |
| 썸네일 | `miniN/cover.png` 참조하나 **실파일 전무** → 폴백 SVG(`makeFallbackThumb`)만 동작 |
| **랭킹** | ✅ **Firebase Realtime DB (`shared/firebase.js`, `window.GameStats`) — 29/30 게임 연동 완료** |
| **공통 CSS** | ✅ `shared/style.css` (233줄, `:root` 디자인 토큰 포함) — 29/30 게임 링크 |
| 로컬 데이터 | `seed.json` = visits/scores 시드 |
| 미연동 | **`mini6`** (firebase/style.css 미링크) |
| 미등록 폴더 | `binggo/`, `min2/`, `2026_sum/` (런처에서 접근 불가) |

## 1-2. 남아있는 실제 과제 (재정의)
| # | 과제 | 우선순위 |
|---|---|---|
| P1 | 게임 목록 하드코딩 → `games.json` 단일 소스화 (100개 대응) | 높음 |
| **A1** | **Firebase 보안 규칙 설정 (어뷰징 무방비 해소)** | **높음** |
| P7 | 100개 탐색 UX (카테고리/검색/정렬) 부재 | 높음 |
| **A2** | **토큰 이중 소스 일원화 (`style.css`로 통일, index 인라인 제거)** | 중 |
| A3 | `mini6` shared 연동 | 중 |
| P3 | 미등록 폴더 3개 살릴지/버릴지 결정 | 중 |
| P5 | cover.png 부재 → 카테고리 자동 SVG 고도화 | 중 |
| P4 | `t.html`/`t2.html` 정리, README/LICENSE | 낮음 |

## 1-3. render() 중복 guide 버그 (초판 지적 유효, 재확인 필요)
`render()`가 `grid.innerHTML=''`로 grid 내부만 비우고 `guide`는 `grid.before()`로 바깥에 삽입 → 재호출 시 이전 guide가 안 지워지고 누적. **수정안**: guide에 고정 id 부여 후 render 시작 시 `getElementById(...).remove()`.
*(index.html 해당 라인 재실측 후 확정.)*

---

# 2. 재정의된 로드맵

> 초판의 "인프라를 처음부터 만든다"를 폐기. **이미 있는 Firebase + style.css를 확장·정비**하는 방향.

```
Phase 0  감사            ✅ 완료 (본 문서 0장)
Phase 1  인프라 정비      → 토큰 일원화 + mini6 연동 + Firebase 보안규칙  (1일)
Phase 2  런처 개편        → games.json + 검색/카테고리/정렬             (1일)
Phase 3  기존 30개 마감    → 미연동/미정비 게임만 (대부분 완료 상태)      (1~2일)
Phase 4  랭킹 견고화      → Firebase Rules·검증·백업 (SQLite 서버 폐기)  (0.5일)
Phase 5  신규 70개        → 7배치 × 10개 (처음부터 shared 적용)         (지속)
Phase 6  운영/마감        → 썸네일, 광고, SEO, 문서화                    (지속)
```

---

# Phase 1 — 인프라 정비 (신규 제작 아님, 정비)

## 1-1. 게임 메타 규격 (`games.json`)
```json
{
  "id": "mini7",
  "title": "스네이크",
  "desc": "꼬리 늘리기",
  "category": "action",
  "tags": ["클래식", "캔버스"],
  "scoreType": "high",     // high=클수록 좋음, low=작을수록 좋음(시간/ms)
  "scoreUnit": "점",
  "hasRanking": true,
  "difficulty": 2,
  "status": "done"
}
```
> `scoreType`은 **firebase.js가 이미 인지하는 개념**(주석: "mini1은 ms 단위 작을수록 빠름"). 서버 재작성 없이 각 페이지 출력 단에서 방향 처리 중. games.json으로 이 값을 **중앙 관리**만 하면 됨.

## 1-2. 디자인 토큰 일원화 (A2 해소)
- **단일 소스 = `shared/style.css`의 `:root`.**
- `index.html`의 인라인 토큰(`#0b1220`/`#60a5fa`) 제거하고 `style.css` 링크로 교체.
- 두 값 중 어느 팔레트를 정본으로 삼을지 **1개 결정** 후 전체 통일. (권장: 더 널리 쓰이는 `style.css` 값 `#0b1020`/`#5b9cff`)

## 1-3. `mini6` shared 연동 (A3)
다른 29개와 동일하게 `shared/style.css` + `shared/firebase.js`(+CDN) 링크, `GameStats` 연동.

## 1-4. 파일 구조 (실제 기준)
```
shared/
  firebase.js      ← 랭킹/방문수 (기존, 확장)
  style.css        ← 디자인 토큰+컴포넌트 (기존, 정본화)
  gamekit.js       ← (신규, 선택) 캔버스 루프·타이머·충돌 공용 유틸
games.json         ← 100개 메타 (신규, 단일 소스)
index.html         ← 런처 (games.json fetch로 개편)
seed.json          ← 로컬 시드 (유지)
```

---

# Phase 2 — 런처 개편 (100개 대응)

- [ ] `games` 하드코딩 제거 → `fetch('games.json')`
- [ ] 카테고리 탭 (전체/액션/퍼즐/두뇌/반응/카드/스포츠/타이핑)
- [ ] 검색창 (제목·태그 실시간 필터)
- [ ] 정렬 (인기순=Firebase visits / 최신순 / 이름순)
- [ ] 최근 플레이 섹션 (카드 가로 스크롤)
- [ ] `render()` 중복 guide 버그 수정 (1-3)
- [ ] 반응형: `<520 1열 / 520~900 2열 / >900 3~4열`
- [ ] 카드 lazy render (IntersectionObserver)
- [ ] 미등록 폴더 결정 반영 (binggo/min2/2026_sum)

---

# Phase 3 — 기존 30개 마감

> 대부분 이미 shared 연동됨. **남은 잔여 작업만.**

## 게임별 잔여 체크
1. [ ] `mini6` 연동 (Phase 1-3)
2. [ ] 토큰 일원화 후 각 게임 인라인 색상 잔재 제거
3. [ ] `.game-header`(← 목록으로) 존재 여부 실측 후 없으면 삽입 — **사용자 갇힘 방지**
4. [ ] `GameStats.saveScore` 게임오버 지점 호출 여부 실측
5. [ ] "🏆 랭킹" 버튼/모달 UI 통일 여부 실측
6. [ ] 모바일 터치 조작 확인
7. [ ] `games.json` status = `done`

## 랭킹 제외 후보 (`hasRanking:false`)
- 틱택토/가위바위보 → "최다 연승"으로 대체 가능
- 로또/운 게임 → 랭킹 부적합

---

# Phase 4 — 랭킹 견고화 (Firebase, SQLite 서버 폐기)

> 초판의 OCI+SQLite 신규 서버 계획 **폐기.** 이미 Firebase가 있으므로 **보안·검증·백업만** 보강.

| # | 조치 |
|---|---|
| A1 | **Realtime Database Rules 작성** — 익명 Auth 도입, 점수 상한값(게임별 max) 검증, 쓰기 형태(name/score/ts 스키마) 강제 |
| S2 | rate limit / 동일 사용자 연속 등록 제한 (Rules + 익명 uid 기반) |
| S3 | 이름 검증 — 길이 제한, HTML/욕설 필터 (클라 + Rules) |
| S4 | 개인 최고기록 테이블 분리 (100위 밖 삭제 시에도 개인기록 보존) |
| S5 | Firebase 자동 백업 / 정기 export |
| A4 | API 키 노출 자체는 정상이나 **반드시 A1 Rules와 세트로** 운영 |

---

# Phase 5 — 신규 70개 제작

10개씩 7배치. 처음부터 `style.css` + `GameStats` 적용, 모바일+PC 동시 지원.

| 배치 | 테마 | 재사용 자산 |
|---|---|---|
| 1 | 반응속도/클릭 | 타이머·판정 컴포넌트 |
| 2 | 낙하/캐치 | 캔버스루프+충돌판정 |
| 3 | 러너/이동 | 스크롤/스폰 로직 |
| 4 | 두뇌/퍼즐 | 그리드 상태관리 |
| 5 | 카드/확률/보드 | 카드덱·AI 판정 |
| 6 | 타이핑/언어/리듬 | 단어사전·타이밍 판정 |
| 7 | 스포츠/피지컬/마감 | 각도/파워 물리 + **mini100 명예의전당(최후)** |

## 신규 1개당 완성 기준
- [ ] `style.css` 적용 · `GameStats` 연동 · 모바일+PC · 게임오버/재시작 명확 · `games.json` 등록

---

# Phase 6 — 운영/마감
- [ ] 썸네일: 카테고리별 색상+아이콘 자동 SVG (폴백 로직 고도화)
- [ ] AdSense 실제 스니펫 (현재 자리표시자)
- [ ] SEO: 게임별 title/description/OG
- [ ] `t.html`/`t2.html` 정리, README/LICENSE
- [ ] 100개 카드 lazy load 성능 검증

---

# 3. 리스크 (재정의)
| 리스크 | 확률 | 대응 |
|---|---|---|
| **Firebase 무방비 어뷰징 (A1)** | **높음** | Phase 4 Rules+Auth 최우선 |
| 토큰 이중 소스로 디자인 불일치 (A2) | 중 | Phase 1 정본화 |
| 100개 탐색 불가 UX | 중 | Phase 2를 Phase 3보다 먼저 |
| 점수 방향 혼선 | 낮음 | games.json scoreType 중앙관리 (인프라는 이미 인지) |
| 70개 제작 동력 상실 | 중 | 10개 배치마다 배포 |

---

# 4. 지금 바로 할 일 (우선순위)
```
1. Firebase Rules + 익명 Auth 설정        (A1, 최우선 — 현재 무방비)
2. 디자인 토큰 style.css로 일원화          (A2)
3. mini6 shared 연동                       (A3)
4. games.json 만들고 index.html fetch화    (P1+P7)
5. 미등록 폴더 3개 처리 결정               (P3)
```

> 초판 대비 **작업량이 크게 줄었습니다.** 랭킹/공통CSS 인프라가 이미 존재하고 29개에 적용돼 있으므로, "구축"이 아니라 **"정비 + 확장 + 보안"**이 실제 과제입니다.
