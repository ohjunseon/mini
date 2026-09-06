# Mini Ranking Server

SQLite-backed ranking backend for mini-games.

## Installation

```bash
npm install
```

This installs:
- `express` - web framework
- `better-sqlite3` - SQLite database
- `cors` - cross-origin request handling

## Running

```bash
npm start
```

The server will start on `http://localhost:4000` (or the port specified in `PORT` environment variable).

## API Endpoints

All endpoints return JSON responses.

### POST /api/visit/:gameId

Increment the visit count for a game.

**Request:**
```bash
curl -X POST http://localhost:4000/api/visit/mini1
```

**Response:**
```json
{
  "count": 1
}
```

### POST /api/score

Save a score for a game.

**Request:**
```bash
curl -X POST http://localhost:4000/api/score \
  -H "Content-Type: application/json" \
  -d '{"gameId":"mini1","name":"Player","score":1234}'
```

**Parameters:**
- `gameId` (string, required): Non-empty identifier for the game
- `name` (string, optional): Player name. Sanitized: `<` and `>` removed, trimmed, max 12 chars. Defaults to "익명" if empty.
- `score` (integer, required): Score value. Must be finite, between 0 and 1000000000.

**Response:**
```json
{
  "ok": true
}
```

**Error (400 Bad Request):**
```json
{
  "error": "score must be a finite integer between 0 and 1000000000"
}
```

### GET /api/top/:gameId

Get top scores for a game.

**Request:**
```bash
curl "http://localhost:4000/api/top/mini1?limit=5&order=desc"
```

**Query Parameters:**
- `limit` (number, optional): Number of scores to return. Default: 5, max: 100.
- `order` (string, optional): Sort order. "asc" for ascending (lower is better), "desc" for descending (higher is better). Default: "desc".

**Response:**
```json
{
  "rows": [
    {"name":"Player1","score":5000},
    {"name":"Player2","score":4500}
  ]
}
```

## Database

The server creates `ranking.db` (SQLite) with two tables:

- `scores` - Stores game scores
  - `id` - Auto-increment primary key
  - `game_id` - Game identifier
  - `name` - Player name
  - `score` - Score value
  - `ts` - Timestamp (milliseconds since epoch)

- `visits` - Tracks game visit counts
  - `game_id` - Game identifier (primary key)
  - `count` - Number of visits
