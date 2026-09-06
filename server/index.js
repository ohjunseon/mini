const express = require('express');
const cors = require('cors');
const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const app = express();
const dbPath = path.join(__dirname, 'ranking.db');
let db = null;

// Phase 4: Per-game score ceiling validation (must match worker/index.js)
const GAME_SCORE_LIMITS = {
  mini1: 5000, mini2: 999, mini3: 100, mini4: 100, mini5: 25,
  mini6: 999, mini7: 1000, mini8: 100000, mini9: 131072, mini10: 10000,
  mini11: 999, mini12: 999, mini13: 1, mini14: 100, mini15: 100,
  mini16: 999, mini17: 999, mini18: 999, mini19: 999, mini20: 100,
  mini21: 100, mini22: 999, mini23: 999, mini24: 999, mini25: 999999,
  mini26: 100, mini27: 999, mini28: 10000, mini29: 1, mini30: 9999,
};

const NAME_FILTER = /[^\w\s\-_\.一-鿿가-힯]/g;

// Initialize SQL.js and database
async function initializeDatabase() {
  const SQL = await initSqlJs();

  let filebuffer = null;
  if (fs.existsSync(dbPath)) {
    filebuffer = fs.readFileSync(dbPath);
  }

  if (filebuffer) {
    db = new SQL.Database(filebuffer);
  } else {
    db = new SQL.Database();
    // Initialize tables
    db.run(`
      CREATE TABLE IF NOT EXISTS scores (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        game_id TEXT NOT NULL,
        name TEXT NOT NULL,
        score INTEGER NOT NULL,
        ts INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS visits (
        game_id TEXT PRIMARY KEY,
        count INTEGER NOT NULL DEFAULT 0
      );
    `);
    saveDatabase();
  }
}

function saveDatabase() {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbPath, buffer);
}

function runQuery(sql, params = []) {
  try {
    db.run(sql, params);
    saveDatabase();
    return { success: true };
  } catch (error) {
    console.error('Query error:', error);
    return { success: false, error };
  }
}

function getQuery(sql, params = []) {
  try {
    const stmt = db.prepare(sql);
    stmt.bind(params);
    if (stmt.step()) {
      const result = stmt.getAsObject();
      stmt.free();
      return result;
    }
    stmt.free();
    return null;
  } catch (error) {
    console.error('Query error:', error);
    return null;
  }
}

function allQuery(sql, params = []) {
  try {
    const stmt = db.prepare(sql);
    stmt.bind(params);
    const results = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject());
    }
    stmt.free();
    return results;
  } catch (error) {
    console.error('Query error:', error);
    return [];
  }
}

// Middleware
app.use(express.json());
app.use(cors());

// POST /api/visit/:gameId - Upsert visit count
app.post('/api/visit/:gameId', (req, res) => {
  if (!db) {
    return res.status(500).json({ error: 'Database not initialized' });
  }

  const { gameId } = req.params;

  try {
    // Check if exists
    const existing = getQuery('SELECT count FROM visits WHERE game_id = ?', [gameId]);

    if (existing) {
      runQuery('UPDATE visits SET count = count + 1 WHERE game_id = ?', [gameId]);
    } else {
      runQuery('INSERT INTO visits (game_id, count) VALUES (?, 1)', [gameId]);
    }

    const row = getQuery('SELECT count FROM visits WHERE game_id = ?', [gameId]);
    res.json({ count: row ? row.count : 1 });
  } catch (error) {
    console.error('Error incrementing visit count:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/score - Save a score
app.post('/api/score', (req, res) => {
  if (!db) {
    return res.status(500).json({ error: 'Database not initialized' });
  }

  const { gameId, name, score } = req.body;

  // Validate gameId
  if (typeof gameId !== 'string' || gameId.trim() === '') {
    return res.status(400).json({ error: 'gameId is required and must be a non-empty string' });
  }

  // Validate score (per-game ceiling from Phase 4)
  if (!Number.isInteger(score) || !isFinite(score) || score < 0) {
    return res.status(400).json({ error: 'score must be a non-negative integer' });
  }

  const maxScore = GAME_SCORE_LIMITS[gameId] || 1000000;
  if (score > maxScore) {
    return res.status(400).json({ error: `score exceeds maximum ${maxScore} for ${gameId}` });
  }

  // Sanitize name (Phase 4: stronger filtering)
  let sanitizedName = String(name || '')
    .replace(NAME_FILTER, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (sanitizedName.length > 20) {
    sanitizedName = sanitizedName.substring(0, 20);
  }
  if (sanitizedName === '') {
    sanitizedName = '익명';
  }

  try {
    runQuery(
      'INSERT INTO scores (game_id, name, score, ts) VALUES (?, ?, ?, ?)',
      [gameId, sanitizedName, score, Date.now()]
    );
    res.json({ ok: true });
  } catch (error) {
    console.error('Error saving score:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/top/:gameId - Get top scores
app.get('/api/top/:gameId', (req, res) => {
  if (!db) {
    return res.status(500).json({ error: 'Database not initialized' });
  }

  const { gameId } = req.params;
  let { limit, order } = req.query;

  // Parse and validate limit
  limit = Math.min(Math.max(parseInt(limit) || 5, 1), 100);

  // Validate order
  const isAsc = order === 'asc';
  const orderClause = isAsc ? 'ASC' : 'DESC';

  try {
    const rows = allQuery(
      `SELECT name, score FROM scores
       WHERE game_id = ?
       ORDER BY score ${orderClause}, ts ASC
       LIMIT ?`,
      [gameId, limit]
    );

    res.json({ rows });
  } catch (error) {
    console.error('Error fetching top scores:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Start server
async function start() {
  await initializeDatabase();

  const PORT = process.env.PORT || 4000;
  app.listen(PORT, () => {
    console.log(`Ranking server running at http://localhost:${PORT}`);
  });
}

start().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
