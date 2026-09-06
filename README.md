# 🎮 MiniGames - 100개의 미니게임 모음

> 액션, 퍼즐, 리듬, 반응 속도 테스트 등 **100가지 다양한 장르**의 미니게임을 한 곳에서 즐겨보세요!

## ✨ 주요 기능

### 🎯 100개의 다양한 게임
- **액션**: 반응속도 테스트, 플래피 버드, 점프 런 등
- **퍼즐**: 2048, 미로 탈출, 지뢰찾기 등
- **리듬**: 사이먼 게임, 탭 타이밍, 두더지 잡기 등
- **블록**: 테트리스, 스네이크, 벽돌 깨기 등
- **스포츠**: 농구, 골프, 탁구, 복싱 등
- **반응**: 색상 매칭, 신호등 게임, 번개 타격 등
- **캐주얼**: 슬롯, 로또, 가위바위보 등

### 📊 게임 랭킹 시스템
- 각 게임별 **Top 100 플레이어 랭킹**
- 게임별 **최고 점수 저장**
- **방문 횟수** 자동 기록
- **명예의전당** (Hall of Fame) 페이지

### 🔍 쉬운 탐색
- 게임 **검색/카테고리 필터링**
- **정렬 기능** (인기순, 카테고리별)
- **반응형 디자인** (PC + 모바일)
- **Lazy load** 최적화

### 🎨 세련된 UI
- **카테고리별 색상** 구분
- **다크 테마** 디자인
- **이모지 아이콘** 표시
- **부드러운 애니메이션**

---

## 🚀 빠른 시작

### 로컬 개발
```bash
# 1. 저장소 클론
git clone https://github.com/your-repo/mini-games.git
cd mini-games

# 2. HTTP 서버 실행 (Python)
python -m http.server 8000

# 3. 브라우저에서 접속
# http://localhost:8000
```

### 서버 셋업 (선택사항)
```bash
# 로컬 개발용 랭킹 서버
cd server
npm install
npm start
# 포트 4000에서 실행됨
```

---

## 📁 프로젝트 구조

```
mini-games/
├── index.html                 # 런처 (메인 페이지)
├── games.json                 # 게임 메타데이터
├── shared/
│   ├── style.css              # 공통 스타일
│   └── ranking.js             # 랭킹 클라이언트 API
├── mini1/ ... mini100/        # 각 게임 폴더
│   └── index.html             # 게임 페이지
├── server/                    # 로컬 개발용 서버
│   ├── index.js
│   └── ranking.db
└── worker/                    # Cloudflare Worker
    ├── index.js
    └── schema.sql
```

---

## 🛠️ 기술 스택

| 영역 | 기술 |
|---|---|
| **프론트엔드** | HTML5, CSS3, JavaScript |
| **게임** | Canvas API |
| **데이터** | SQLite (D1) |
| **로컬** | Express + sql.js |
| **프로덕션** | Cloudflare Workers + D1 |

---

## 📊 API (랭킹 백엔드)

```
POST /api/visit/:id          → { count }
POST /api/score              → { ok }
GET  /api/top/:id?limit=100  → { rows }
```

---

## 🔒 보안

- 점수 상한 검증
- 입력값 살균 (XSS 방지)
- CORS 설정
- HTTPS 강제 (프로덕션)

---

## 📝 라이센스

MIT License - 자유롭게 사용, 수정, 배포 가능

---

## 📮 배포 가이드

1. Cloudflare D1 데이터베이스 생성
2. wrangler.jsonc에 DB ID 기입
3. `wrangler d1 execute` 로 스키마 적용
4. `wrangler deploy` 로 배포

자세한 내용은 ADSENSE-SETUP.md 참고.

---

**Made with ❤️ using Vanilla JavaScript**

마지막 업데이트: 2026-09-07
