-- 毛毛书房 D1 数据库 Schema
-- 执行: npx wrangler d1 execute maomao-library --file=schema.sql

-- 用户表
CREATE TABLE IF NOT EXISTS users (
  id              TEXT PRIMARY KEY,
  email           TEXT UNIQUE,
  display_name    TEXT NOT NULL DEFAULT '',
  avatar_url      TEXT DEFAULT '',

  -- 密码认证（仅平台账号）
  password_hash   TEXT,
  password_salt   TEXT,
  hash_iterations INTEGER DEFAULT 100000,

  -- Google OAuth
  google_sub      TEXT UNIQUE,
  google_email    TEXT,

  -- 状态
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
  last_login_at   TEXT,
  is_active       INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_google_sub ON users(google_sub);

-- 书籍表
CREATE TABLE IF NOT EXISTS books (
  id               TEXT NOT NULL,
  user_id          TEXT NOT NULL,
  isbn             TEXT DEFAULT '',
  title            TEXT NOT NULL DEFAULT '',
  author           TEXT DEFAULT '',
  category         TEXT DEFAULT '',
  reading_status   TEXT DEFAULT 'want',
  reading_progress INTEGER DEFAULT 0,
  published_year   TEXT DEFAULT '',
  location         TEXT DEFAULT '',
  description      TEXT DEFAULT '',
  notes            TEXT DEFAULT '',
  book_lang        TEXT DEFAULT '',
  cover_url        TEXT DEFAULT '',
  metadata_sources TEXT DEFAULT '[]',
  status           TEXT DEFAULT 'to_be_sorted',
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL,
  is_deleted       INTEGER DEFAULT 0,

  PRIMARY KEY (id, user_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_books_user ON books(user_id);
CREATE INDEX IF NOT EXISTS idx_books_user_updated ON books(user_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_books_isbn ON books(user_id, isbn);

-- 位置预设表
CREATE TABLE IF NOT EXISTS location_presets (
  user_id    TEXT NOT NULL,
  value      TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),

  PRIMARY KEY (user_id, value),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 速率限制表（简易实现）
CREATE TABLE IF NOT EXISTS rate_limits (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  key        TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_key ON rate_limits(key, created_at);

-- 同步元数据表
CREATE TABLE IF NOT EXISTS sync_meta (
  user_id        TEXT PRIMARY KEY,
  schema_version INTEGER DEFAULT 1,
  last_sync_at   TEXT,
  device_count   INTEGER DEFAULT 1,

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
