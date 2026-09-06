export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const pathname = url.pathname;

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

          // Validate score
          if (typeof score !== 'number' || !Number.isInteger(score) || score < 0 || score > 1000000000) {
            return new Response(JSON.stringify({ error: 'score must be integer 0-1000000000' }), {
              status: 400,
              headers: corsHeaders,
            });
          }

          // Sanitize name
          let sanitized = String(name || '').replace(/[<>]/g, '').trim();
          if (sanitized.length === 0) {
            sanitized = '익명';
          } else if (sanitized.length > 12) {
            sanitized = sanitized.slice(0, 12);
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
