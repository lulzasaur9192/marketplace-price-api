const { Router } = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');

const router = Router();

// Endpoint metadata for instrumentation & GTM tagging
const endpoints = {
  create: {
    group: 'alerts',
    description: 'Create a price alert on a marketplace item',
    costCategorization: 'alert_creation'
  },
  list: {
    group: 'alerts',
    description: 'List all price alerts for the authenticated user',
    costCategorization: 'read_operation'
  },
  delete: {
    group: 'alerts',
    description: 'Delete a price alert',
    costCategorization: 'write_operation'
  }
};

// Auth middleware — requires API_KEY header
function requireAuth(req, res, next) {
  const key = req.headers['x-api-key'] || req.query.apiKey;
  const masterKey = process.env.API_KEY;
  if (!key) return res.status(401).json({ error: 'x-api-key header required' });

  // Accept master key or any key in the api_keys table
  if (key === masterKey) {
    req.apiKey = key;
    return next();
  }

  const row = db.prepare('SELECT key FROM api_keys WHERE key = ?').get(key);
  if (!row) return res.status(403).json({ error: 'Invalid API key' });
  req.apiKey = key;
  next();
}

router.use(requireAuth);

// POST /alerts — create a price alert
router.post('/', (req, res) => {
  const { query, marketplace, maxPrice, webhookUrl, email } = req.body;

  if (!query || !marketplace || !maxPrice || !webhookUrl) {
    return res.status(400).json({ error: 'Required: query, marketplace, maxPrice, webhookUrl' });
  }
  if (!['reverb', 'tcg'].includes(marketplace)) {
    return res.status(400).json({ error: 'marketplace must be "reverb" or "tcg"' });
  }

  const id = uuidv4();
  db.prepare(`
    INSERT INTO alerts (id, query, marketplace, max_price, webhook_url, email, api_key)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, query, marketplace, Number(maxPrice), webhookUrl, email || null, req.apiKey);

  res.status(201).json({
    id,
    query,
    marketplace,
    endpoint_group: endpoints.create.group,
    maxPrice: Number(maxPrice),
    webhookUrl,
    email,
    active: true
  });
});

// GET /alerts — list all alerts for this API key
router.get('/', (req, res) => {
  const masterKey = process.env.API_KEY;
  let alerts;
  if (req.apiKey === masterKey) {
    alerts = db.prepare('SELECT * FROM alerts ORDER BY created_at DESC').all();
  } else {
    alerts = db.prepare('SELECT * FROM alerts WHERE api_key = ? ORDER BY created_at DESC').all(req.apiKey);
  }
  res.json({
    endpoint_group: endpoints.list.group,
    count: alerts.length,
    alerts
  });
});

// GET /alerts/:id
router.get('/:id', (req, res) => {
  const alert = db.prepare('SELECT * FROM alerts WHERE id = ?').get(req.params.id);
  if (!alert) return res.status(404).json({ error: 'Alert not found' });
  res.json({
    ...alert,
    endpoint_group: endpoints.list.group
  });
});

// DELETE /alerts/:id
router.delete('/:id', (req, res) => {
  const result = db.prepare('DELETE FROM alerts WHERE id = ? AND (api_key = ? OR ? = ?)').run(
    req.params.id, req.apiKey, req.apiKey, process.env.API_KEY
  );
  if (result.changes === 0) return res.status(404).json({ error: 'Alert not found' });
  res.json({
    deleted: true,
    endpoint_group: endpoints.delete.group
  });
});

// Export endpoint metadata for API documentation
router.getEndpointMetadata = () => endpoints;

module.exports = router;
