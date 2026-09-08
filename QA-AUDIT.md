# 100개 미니게임 전면 QA 점검 (2026-09-08 시작)

사용자 보고: (1) 실행 안 되는 게임, (2) 조작 방향 안 맞음, (3) 설명 부정확.

## Phase 0 — 정적 트리아지 결과
- 뷰포트/뒤로가기: 이전 커밋(b9b3bdf)에서 100/100 통일 완료.
- **[확정 버그] mini31~60 (30개)**: `GameStats.saveScore(PAGE_ID, name, score, ...)` 에서
  `name` 미선언 → `window.name`(빈문자)로 저장됨.
  - mini31~50 (20개): 4번째 콜백 인자에 **게임 리셋 로직**을 넘기지만 `saveScore`가 무시 →
    라운드 종료 후 리셋 안 됨 = "실행 안 됨" 체감.
  - mini51~60 (10개): 콜백 없음. 빈 이름 저장 문제만.

## Phase 1 — 공유 모듈 수정 (30개 일괄 해결)
- [x] `shared/ranking.js` `saveScore`에 콜백 지원 + 이름 기본값 처리 추가.

## Phase 2 — 브라우저 실행 테스트 (100개) — Playwright 헤드리스 (qa-scan.js)
1차 결과: 정상 94 / **실행불가 6** → 전부 원인 확정 후 수정 완료:
- [x] mini2  — game.js `displayGameOver` 미정의 → 정의 추가 + 초기화면 분리
- [x] mini3  — `Juice.submit(..., Math.floor(score);)` 잉여 세미콜론 → 제거
- [x] mini62 — `ctx.fillStyle = var('--accent')` (CSS문법을 JS에) → `'#5b9cff'`
- [x] mini65 — `ctx.strokeStyle = var('--accent')` → `'#5b9cff'`
- [x] mini71 — `getElementById('visitsView') = val` (없는 요소에 대입) → 콜백 제거
- [x] mini75 — `ctx.fillStyle = var(--good)` → `'#2ecc71'`
- [ ] 2차 재검사로 0 에러 확인

## Phase 3 — 조작/설명 불일치 개별 수정
- [ ] 방향키/터치 방향 반대인 게임
- [ ] 안내문과 실제 게임 불일치

## 게임별 상태표
(테스트하며 채움: OK / 실행오류 / 조작오류 / 설명오류)
