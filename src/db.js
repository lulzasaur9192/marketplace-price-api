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
`);

// Add call_count column to api_keys if it doesn't exist
try {
  db.prepare('SELECT call_count FROM api_keys LIMIT 1').get();
} catch (e) {
  db.exec('ALTER TABLE api_keys ADD COLUMN call_count INTEGER DEFAULT 0');
}

module.exports = db;
