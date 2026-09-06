# Cloudflare Worker + D1 Ranking Backend

This directory contains the Worker code for the mini-games ranking API.

## Setup

Run these commands **in the repo root** (not in `worker/`):

### 1. Create D1 Database

```bash
npx wrangler d1 create mini-ranking
```

Copy the returned `database_id` and paste it into `wrangler.jsonc` replacing `REPLACE_WITH_YOUR_D1_ID`.

### 2. Initialize Database Schema

```bash
npx wrangler d1 execute mini-ranking --remote --file=schema.sql
```

This creates the `scores` and `visits` tables on your D1 instance.

### 3. Local Development

For local dev with a local D1 (no remote database):

```bash
npx wrangler dev --local
```

Then test endpoints with curl:

```bash
# Record a visit
curl -X POST http://localhost:8787/api/visit/tetris

# Submit a score
curl -X POST http://localhost:8787/api/score \
  -H "Content-Type: application/json" \
  -d '{"gameId":"tetris","name":"Alice","score":1500}'

# Get top scores
curl http://localhost:8787/api/top/tetris?limit=5&order=desc
```

### 4. Deploy

```bash
npx wrangler deploy
```

This deploys the Worker and static assets to Cloudflare.

## Client Integration

The client at `shared/ranking.js` automatically calls `/api/*` endpoints using same-origin requests:
- No client code changes needed
- Works on production domain automatically
- CORS headers are set to `Access-Control-Allow-Origin: *`

## Endpoints

All endpoints return JSON with `Content-Type: application/json; charset=utf-8`. CORS headers allow cross-origin requests.

### `POST /api/visit/:gameId`

Record a visit for a game.

**Response:** `{ "count": 42 }`

### `POST /api/score`

Submit a score.

**Body:** `{ "gameId": "tetris", "name": "Alice", "score": 1500 }`

**Response:** `{ "ok": true }`

**Validation:**
- `gameId` must be a non-empty string
- `score` must be an integer 0–1,000,000,000
- `name` is sanitized (remove `<>`, trim to 12 chars, default to "익명")

### `GET /api/top/:gameId?limit=5&order=desc`

Get top scores for a game.

**Query parameters:**
- `limit` (default: 5, clamped 1–100)
- `order` ('asc' or 'desc', default: 'desc')

**Response:** `{ "rows": [{ "name": "Alice", "score": 1500 }, ...] }`
