/**
 * SQLite-backed ranking client for mini-games.
 * Drop-in replacement for shared/firebase.js.
 *
 * Usage: Include this script and use window.GameStats as before.
 * Configure with: GameStats.configure({ apiBase: "..." })
 */

window.GameStats = (() => {
  let apiBase = '';

  /**
   * Determine default API base URL
   */
  function getDefaultApiBase() {
    if (typeof window.RANKING_API_BASE !== 'undefined') {
      return window.RANKING_API_BASE;
    }

    // Check if localhost
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1' || window.location.protocol === 'file:') {
      return 'http://localhost:4000';
    }

    // Same-origin requests (relative path)
    return '';
  }

  return {
    /**
     * Configure the API base URL.
     * @param {Object} config - Configuration object
     * @param {string} config.apiBase - Base URL for API (e.g., "http://localhost:4000")
     */
    configure(config) {
      if (config && config.apiBase) {
        apiBase = config.apiBase;
      } else {
        apiBase = getDefaultApiBase();
      }
    },

    /**
     * Increment visit count for a game.
     * @param {string} pageId - Game identifier
     * @param {Function} cb - Callback function(count) called with visit count or null on error
     */
    incrementVisitCount(pageId, cb) {
      if (!cb) cb = () => {};

      try {
        const url = `${apiBase}/api/visit/${encodeURIComponent(pageId)}`;
        fetch(url, { method: 'POST' })
          .then(res => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res.json();
          })
          .then(data => cb(data.count))
          .catch(err => {
            console.warn('GameStats.incrementVisitCount error:', err);
            cb(null);
          });
      } catch (err) {
        console.warn('GameStats.incrementVisitCount error:', err);
        cb(null);
      }
    },

    /**
     * Save a score for a game.
     * @param {string} pageId - Game identifier
     * @param {string} name - Player name
     * @param {number} score - Score value
     */
    saveScore(pageId, name, score) {
      try {
        const url = `${apiBase}/api/score`;
        fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            gameId: pageId,
            name,
            score
          })
        }).catch(err => {
          console.warn('GameStats.saveScore error:', err);
        });
      } catch (err) {
        console.warn('GameStats.saveScore error:', err);
      }
    },

    /**
     * Listen for top scores and call callback with updates.
     * Polls every 10 seconds to emulate realtime behavior.
     * @param {string} pageId - Game identifier
     * @param {number} n - Number of top scores to fetch
     * @param {Function} cb - Callback function(rows) where rows is [{name, score}, ...]
     * @returns {Function} - Function to stop polling (call to unsubscribe)
     */
    listenTopScores(pageId, n, cb) {
      if (!cb) cb = () => {};

      const fetchScores = () => {
        try {
          const url = `${apiBase}/api/top/${encodeURIComponent(pageId)}?limit=${encodeURIComponent(n)}`;
          fetch(url)
            .then(res => {
              if (!res.ok) throw new Error(`HTTP ${res.status}`);
              return res.json();
            })
            .then(data => cb(data.rows || []))
            .catch(err => {
              console.warn('GameStats.listenTopScores error:', err);
              cb([]);
            });
        } catch (err) {
          console.warn('GameStats.listenTopScores error:', err);
          cb([]);
        }
      };

      // Initial fetch
      fetchScores();

      // Poll every 10 seconds
      const intervalId = setInterval(fetchScores, 10000);

      // Return unsubscribe function
      return () => clearInterval(intervalId);
    }
  };
})();

// Auto-configure with defaults if not already configured
if (!window.RANKING_API_CONFIGURED) {
  window.GameStats.configure({});
  window.RANKING_API_CONFIGURED = true;
}
