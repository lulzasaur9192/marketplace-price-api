const crypto = require('crypto');
const db = require('../db');

function hashIp(ip) {
  return ip ? crypto.createHash('sha256').update(ip).digest('hex').slice(0, 16) : null;
}

function createEventLogger() {
  return function logEvent(req, res, next) {
    const start = Date.now();

    // Capture response data
    const originalJson = res.json.bind(res);
    let resultCount = null;
    res.json = function(data) {
      if (data && Array.isArray(data.results)) resultCount = data.results.length;
      else if (data && Array.isArray(data.items)) resultCount = data.items.length;
      else if (data && Array.isArray(data)) resultCount = data.length;
      return originalJson(data);
    };

    res.on('finish', () => {
      try {
        const responseTimeMs = Date.now() - start;
        const apiKey = req.headers['x-api-key'] || req.query.apiKey || req.apiKey || null;
        const ipHash = hashIp(req.ip || req.headers['x-forwarded-for']);

        const params = JSON.stringify({
          query: req.query.query || req.body?.query,
          marketplace: req.query.marketplace || req.body?.marketplace,
          limit: req.query.limit || req.body?.limit,
        });

        db.prepare(`
          INSERT INTO api_events (endpoint, method, params, api_key, status_code, response_time_ms, result_count, ip_hash)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(req.path, req.method, params, apiKey, res.statusCode, responseTimeMs, resultCount, ipHash);

        // Increment call_count on api_keys if key exists
        if (apiKey) {
          try {
            db.prepare('UPDATE api_keys SET call_count = call_count + 1 WHERE key = ?').run(apiKey);
          } catch (e) { /* ignore if column doesn't exist yet */ }
        }
      } catch (err) {
        console.error('[event-logger] Error:', err.message);
      }
    });

    next();
  };
}

module.exports = { createEventLogger };
