export { OthelloRoom } from './othello-room.js';
export { CatanRoom } from './catan-room.js';
export { SplendorRoom } from './splendor-room.js';
export { YachtRoom } from './yacht-room.js';

// Per-game score ceiling validation (renumbered after mini1~65 cleanup)
const GAME_SCORE_LIMITS = {
  mini1: 5000,
  mini2: 999,
  mini3: 100,
  mini4: 25,
  mini5: 999,
  mini6: 1000,
  mini7: 100000,
  mini8: 131072,
  mini9: 10000,
  mini10: 999,
  mini11: 999,
  mini12: 1,
  mini13: 100,
  mini14: 100,
  mini15: 999,
  mini16: 999,
  mini17: 999,
  mini18: 100,
  mini19: 100,
  mini20: 999,
  mini21: 999,
  mini22: 999999,
  mini23: 100,
  mini24: 999,
  mini25: 10000,
  mini26: 1,
  mini67: 10,
  mini68: 15,
  mini69: 400,
};

// Regex for name filtering - allow basic chars, block emoji/control
const NAME_FILTER = /[^\w\s\-_\.一-鿿가-힯]/g;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // Extract client IP for rate limiting
    const clientIp = request.headers.get('CF-Connecting-IP') ||
                     request.headers.get('X-Forwarded-For')?.split(',')[0] ||
                     'unknown';

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Content-Type': 'application/json; charset=utf-8',
    };

    // Handle OPTIONS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    // Route: WebSocket room for online Othello (mini65)
    if (pathname.startsWith('/ws/othello/')) {
      const code = pathname.slice('/ws/othello/'.length).trim();
      if (!code || !/^[A-Za-z0-9]{4,12}$/.test(code)) {
        return new Response(JSON.stringify({ error: 'invalid room code' }), {
          status: 400,
          headers: corsHeaders,
        });
      }
      const id = env.OTHELLO_ROOM.idFromName(code.toUpperCase());
      const stub = env.OTHELLO_ROOM.get(id);
      return stub.fetch(request);
    }

    // Route: WebSocket room for online Catan (mini67)
    if (pathname.startsWith('/ws/catan/')) {
      const code = pathname.slice('/ws/catan/'.length).trim();
      if (!code || !/^[A-Za-z0-9]{4,12}$/.test(code)) {
        return new Response(JSON.stringify({ error: 'invalid room code' }), {
          status: 400,
          headers: corsHeaders,
        });
      }
      const id = env.CATAN_ROOM.idFromName(code.toUpperCase());
      const stub = env.CATAN_ROOM.get(id);
      return stub.fetch(request);
    }

    // Route: WebSocket room for online Splendor (mini68)
    if (pathname.startsWith('/ws/splendor/')) {
      const code = pathname.slice('/ws/splendor/'.length).trim();
      if (!code || !/^[A-Za-z0-9]{4,12}$/.test(code)) {
        return new Response(JSON.stringify({ error: 'invalid room code' }), {
          status: 400,
          headers: corsHeaders,
        });
      }
      const id = env.SPLENDOR_ROOM.idFromName(code.toUpperCase());
      const stub = env.SPLENDOR_ROOM.get(id);
      return stub.fetch(request);
    }

    // Route: WebSocket room for online Yacht (mini69)
    if (pathname.startsWith('/ws/yacht/')) {
      const code = pathname.slice('/ws/yacht/'.length).trim();
      if (!code || !/^[A-Za-z0-9]{4,12}$/.test(code)) {
        return new Response(JSON.stringify({ error: 'invalid room code' }), {
          status: 400,
          headers: corsHeaders,
        });
      }
      const id = env.YACHT_ROOM.idFromName(code.toUpperCase());
      const stub = env.YACHT_ROOM.get(id);
      return stub.fetch(request);
    }

    // Route API endpoints
    if (pathname.startsWith('/api/')) {
      try {
        // POST /api/visit/:gameId
        if (request.method === 'POST' && pathname.startsWith('/api/visit/')) {
          const gameId = pathname.slice('/api/visit/'.length);
          if (!gameId) {
            return new Response(JSON.stringify({ error: 'gameId required' }), {
              status: 400,
              headers: corsHeaders,
            });
          }

          // Upsert: increment count or insert with 1
          await env.mini_ranking.prepare(
            `INSERT INTO visits (game_id, count) VALUES (?, 1)
             ON CONFLICT(game_id) DO UPDATE SET count = count + 1`
          )
            .bind(gameId)
            .run();

          // Get current count
          const result = await env.mini_ranking.prepare(
            'SELECT count FROM visits WHERE game_id = ?'
          )
            .bind(gameId)
            .first();

          return new Response(
            JSON.stringify({ count: result?.count ?? 1 }),
            { status: 200, headers: corsHeaders }
          );
        }

        // POST /api/score
        if (request.method === 'POST' && pathname === '/api/score') {
          const body = await request.json();
          const { gameId, name, score } = body;

          // Validate gameId
          if (!gameId || typeof gameId !== 'string' || gameId.trim() === '') {
            return new Response(JSON.stringify({ error: 'gameId must be non-empty string' }), {
              status: 400,
              headers: corsHeaders,
            });
          }

          // Validate score (per-game ceiling from Phase 4)
          if (typeof score !== 'number' || !Number.isInteger(score) || score < 0) {
            return new Response(JSON.stringify({ error: 'score must be non-negative integer' }), {
              status: 400,
              headers: corsHeaders,
            });
          }

          const maxScore = GAME_SCORE_LIMITS[gameId] || 1000000;
          if (score > maxScore) {
            return new Response(JSON.stringify({ error: `score exceeds maximum ${maxScore} for ${gameId}` }), {
              status: 400,
              headers: corsHeaders,
            });
          }

          // Sanitize name (Phase 4: stronger filtering)
          let sanitized = String(name || '')
            .replace(NAME_FILTER, '')  // Remove non-word, emoji, control chars
            .replace(/\s+/g, ' ')       // Collapse whitespace
            .trim();

          if (sanitized.length === 0) {
            sanitized = '익명';
          } else if (sanitized.length > 20) {
            sanitized = sanitized.slice(0, 20);
          }

          const ts = Date.now();

          await env.mini_ranking.prepare(
            'INSERT INTO scores (game_id, name, score, ts) VALUES (?, ?, ?, ?)'
          )
            .bind(gameId, sanitized, score, ts)
            .run();

          return new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: corsHeaders,
          });
        }

        // GET /api/top/:gameId
        if (request.method === 'GET' && pathname.startsWith('/api/top/')) {
          const gameId = pathname.slice('/api/top/'.length);
          if (!gameId) {
            return new Response(JSON.stringify({ error: 'gameId required' }), {
              status: 400,
              headers: corsHeaders,
            });
          }

          const searchParams = url.searchParams;
          let limit = parseInt(searchParams.get('limit') || '5', 10);
          limit = Math.max(1, Math.min(100, limit)); // clamp 1..100

          const order = searchParams.get('order') === 'asc' ? 'asc' : 'desc';
          const orderClause = order === 'asc' ? 'ASC' : 'DESC';

          const results = await env.mini_ranking.prepare(
            `SELECT name, score FROM scores
             WHERE game_id = ?
             ORDER BY score ${orderClause}, ts ASC
             LIMIT ?`
          )
            .bind(gameId, limit)
            .all();

          return new Response(JSON.stringify({ rows: results.results || [] }), {
            status: 200,
            headers: corsHeaders,
          });
        }

        // 404 for unknown API endpoints
        return new Response(JSON.stringify({ error: 'Not found' }), {
          status: 404,
          headers: corsHeaders,
        });
      } catch (error) {
        console.error('API error:', error);
        return new Response(JSON.stringify({ error: 'Internal server error' }), {
          status: 500,
          headers: corsHeaders,
        });
      }
    }

    // Serve static assets
    return env.ASSETS.fetch(request);
  },
};
