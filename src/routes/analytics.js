const { Router } = require('express');
const db = require('../db');

const router = Router();

function requireAnalyticsAuth(req, res, next) {
  const key = req.headers['x-api-key'] || req.query.apiKey;
  const valid = process.env.ANALYTICS_KEY || process.env.API_KEY;
  if (!valid || key !== valid) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

router.use(requireAnalyticsAuth);

// GET /analytics/summary — aggregate stats
router.get('/summary', (req, res) => {
  const since = req.query.since || '24 hours';

  const totalCalls = db.prepare(
    "SELECT COUNT(*) as count FROM api_events WHERE created_at >= datetime('now', ?)"
  ).get(`-${since}`);

  const byEndpoint = db.prepare(`
    SELECT endpoint, COUNT(*) as calls, AVG(response_time_ms) as avg_ms, AVG(result_count) as avg_results
    FROM api_events WHERE created_at >= datetime('now', ?)
    GROUP BY endpoint ORDER BY calls DESC
  `).all(`-${since}`);

  const errorRate = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END) as errors
    FROM api_events WHERE created_at >= datetime('now', ?)
  `).get(`-${since}`);

  const topKeys = db.prepare(`
    SELECT api_key, COUNT(*) as calls FROM api_events
    WHERE api_key IS NOT NULL AND created_at >= datetime('now', ?)
    GROUP BY api_key ORDER BY calls DESC LIMIT 10
  `).all(`-${since}`);

  const limitHits = db.prepare(
    "SELECT COUNT(*) as count FROM api_events WHERE status_code = 429 AND created_at >= datetime('now', ?)"
  ).get(`-${since}`);

  res.json({
    period: since,
    total_calls: totalCalls.count,
    error_rate: errorRate.total > 0 ? (errorRate.errors / errorRate.total * 100).toFixed(1) + '%' : '0%',
    limit_hits: limitHits.count,
    by_endpoint: byEndpoint,
    top_api_keys: topKeys,
  });
});

// GET /analytics/events — raw recent events
router.get('/events', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 100, 1000);
  const events = db.prepare(
    'SELECT * FROM api_events ORDER BY created_at DESC LIMIT ?'
  ).all(limit);
  res.json({ events, count: events.length });
});

module.exports = router;
