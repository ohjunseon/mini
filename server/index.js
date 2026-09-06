const express = require('express');
const cors = require('cors');
const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const app = express();
const dbPath = path.join(__dirname, 'ranking.db');
let db = null;

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

  // Validate score
  if (!Number.isInteger(score) || !isFinite(score) || score < 0 || score > 1000000000) {
    return res.status(400).json({ error: 'score must be a finite integer between 0 and 1000000000' });
  }

  // Sanitize name
  let sanitizedName = String(name || '').replace(/[<>]/g, '').trim();
  if (sanitizedName.length > 12) {
    sanitizedName = sanitizedName.substring(0, 12);
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
