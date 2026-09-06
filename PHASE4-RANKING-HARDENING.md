# Phase 4: 랭킹 견고화 (Ranking Hardening)

## 완료된 항목

### 1. ✅ 점수 상한 검증 (Score Ceiling Validation)
- **구현 위치**: `worker/index.js`, `server/index.js`
- **설정 파일**: `games-scoring.json` (참고용, 설정값은 코드에 하드코딩)
- **작동 원리**:
  - 각 게임별 `GAME_SCORE_LIMITS` 맵에 최대값 정의
  - `POST /api/score` 수신 시 점수가 게임의 최대값을 초과하면 거절 (400 Bad Request)
  - mini1(반응속도) 최대 5000ms, mini5(벽돌) 최대 25개 등
- **예시 에러 응답**:
  ```json
  { "error": "score exceeds maximum 5000 for mini1" }
  ```

### 2. ✅ 이름 필터링 강화 (Name Filtering)
- **구현 위치**: `worker/index.js`, `server/index.js` (동일)
- **규칙**:
  - HTML 특수문자 제거: `< > ` 제거
  - Emoji, 제어문자 제거: `/[^\w\s\-_\.一-鿿가-힯]/g`
  - 공백 정규화: 연속 공백 → 단일 공백
  - 길이 제한: 최대 20자 (기존 12자 → 20자로 완화)
  - 빈 문자열: 기본값 "익명"
- **지원 언어**:
  - 영문, 숫자, 기호: `_`, `-`, `.`
  - 중문, 일문, 한글
- **필터 제외 사항**:
  - 과도한 길이 제한은 없음 (20자면 충분)
  - 유니코드 권장명 지원 (한글 깨짐 방지)

### 3. ❌ Rate Limiting (미구현, 권고)
- **기술**: Cloudflare Workers의 Rate Limiting Rules 또는 Durable Objects 권장
- **대안 (현재)**:
  - CF-Connecting-IP 헤더로 클라이언트 IP 추출
  - 로컬 dev는 IP 추적만 함 (제한 없음)
  - 프로덕션 배포 시 Cloudflare Console에서 Rate Limiting Rules 설정 권장
- **권고 설정**:
  ```
  - IP당 1분에 최대 100번 /api/score 요청
  - IP당 1시간에 최대 1000번 /api/visit 요청
  - 초과 시 429 Too Many Requests
  ```

### 4. ⚠️ 백업 전략 (Backup Strategy)

#### D1 자동 백업 (Cloudflare 관리)
- D1 무료 플랜에서 자동 백업 제공 (정책 확인 필요)
- Cloudflare Dashboard → D1 콘솔에서 백업 정책 확인

#### 정기 수동 내보내기 (권장)
```bash
cd server && npm start
sqlite3 ranking.db ".dump" > ../backups/ranking-$(date +%Y%m%d-%H%M%S).sql
```

#### 복구 절차
```bash
sqlite3 ranking.db < backups/ranking-YYYYMMDD-HHMMSS.sql
```

---

## 🔒 보안 체크리스트 (Security Checklist)

| 항목 | 상태 | 비고 |
|------|------|------|
| SQL Injection | ✅ | Prepared statements 사용 |
| XSS | ✅ | HTML 특수문자 필터 |
| CORS | ✅ | Cloudflare 기본 설정 |
| HTTPS | ✅ | Cloudflare 자동 |
| Rate Limiting | ⚠️ | Cloudflare Rules 설정 필요 |
| 점수 검증 | ✅ | 게임별 상한값 검증 |

---

마지막 업데이트: 2026-09-06 | Phase 4 진행 중
