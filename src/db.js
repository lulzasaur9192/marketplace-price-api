const Database = require('better-sqlite3');
const path = require('path');

const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'alerts.db');
const fs = require('fs');
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS alerts (
    id TEXT PRIMARY KEY,
    query TEXT NOT NULL,
    marketplace TEXT NOT NULL CHECK(marketplace IN ('reverb', 'tcg')),
    max_price REAL NOT NULL,
    webhook_url TEXT NOT NULL,
    email TEXT,
    api_key TEXT NOT NULL,
    active INTEGER DEFAULT 1,
    last_checked TEXT,
    last_triggered TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS api_keys (
    key TEXT PRIMARY KEY,
    name TEXT,
    tier TEXT DEFAULT 'free' CHECK(tier IN ('free', 'pro')),
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS api_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    endpoint TEXT NOT NULL,
    method TEXT NOT NULL,
    params TEXT,
    api_key TEXT,
    status_code INTEGER,
    response_time_ms INTEGER,
    result_count INTEGER,
    ip_hash TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_api_events_endpoint ON api_events(endpoint);
  CREATE INDEX IF NOT EXISTS idx_api_events_created_at ON api_events(created_at);
  CREATE INDEX IF NOT EXISTS idx_api_events_api_key ON api_events(api_key);

  CREATE TABLE IF NOT EXISTS search_cache (
    cache_key TEXT PRIMARY KEY,
    marketplace TEXT NOT NULL,
    query TEXT NOT NULL,
    results TEXT NOT NULL,
    result_count INTEGER,
    cached_at TEXT DEFAULT (datetime('now')),
    expires_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_cache_expires ON search_cache(expires_at);
`);

// Add call_count column to api_keys if it doesn't exist
try {
  db.prepare('SELECT call_count FROM api_keys LIMIT 1').get();
} catch (e) {
  db.exec('ALTER TABLE api_keys ADD COLUMN call_count INTEGER DEFAULT 0');
}

const getCache = db.prepare('SELECT results FROM search_cache WHERE cache_key = ? AND expires_at > datetime(\'now\')');
const setCache = db.prepare(`
  INSERT OR REPLACE INTO search_cache (cache_key, marketplace, query, results, result_count, expires_at)
  VALUES (?, ?, ?, ?, ?, datetime('now', '+' || ? || ' seconds'))
`);
const purgeExpiredCache = db.prepare("DELETE FROM search_cache WHERE expires_at < datetime('now')");

module.exports = db;
module.exports.getCache = (key) => {
  const row = getCache.get(key);
  return row ? JSON.parse(row.results) : null;
};
module.exports.setCache = (key, marketplace, query, results, ttlSeconds) => {
  setCache.run(key, marketplace, query, JSON.stringify(results), results.length, ttlSeconds);
};
module.exports.purgeExpiredCache = () => purgeExpiredCache.run();
