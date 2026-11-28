-- MorningStar official site baseline schema.
-- Reconstructed from the existing D1 schema observed on 2026-11-28.
-- Safe for an existing database: all objects are created IF NOT EXISTS.
-- Does not seed users, products, orders, passwords, secrets or license records.

CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
 id TEXT PRIMARY KEY,
 email TEXT NOT NULL UNIQUE,
 display_name TEXT NOT NULL,
 password_salt TEXT NOT NULL,
 password_hash TEXT NOT NULL,
 password_iterations INTEGER NOT NULL,
 role TEXT NOT NULL DEFAULT 'member' CHECK(role IN ('member','admin')),
 email_verified INTEGER NOT NULL DEFAULT 0,
 status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','suspended')),
 created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
 token_hash TEXT PRIMARY KEY,
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 expires_at TEXT NOT NULL,
 created_at TEXT NOT NULL,
 last_seen_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS products (
 id TEXT PRIMARY KEY,
 title TEXT NOT NULL,
 version TEXT NOT NULL,
 description TEXT NOT NULL,
 original_sha256 TEXT NOT NULL,
 file_name TEXT NOT NULL,
 file_size INTEGER NOT NULL,
 status TEXT NOT NULL DEFAULT 'available' CHECK(status IN ('available','archived')),
 commercial_enabled INTEGER NOT NULL DEFAULT 0,
 created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS orders (
 id TEXT PRIMARY KEY,
 user_id TEXT NOT NULL REFERENCES users(id),
 product_id TEXT NOT NULL REFERENCES products(id),
 requested_license_type TEXT NOT NULL CHECK(requested_license_type IN ('personal_research','commercial')),
 terms_version TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending_review' CHECK(status IN ('pending_review','approved','rejected','cancelled')),
 payment_reference TEXT,
 amount_minor INTEGER,
 currency TEXT NOT NULL DEFAULT 'TWD',
 admin_note TEXT,
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS licenses (
 id TEXT PRIMARY KEY,
 user_id TEXT NOT NULL REFERENCES users(id),
 order_id TEXT NOT NULL UNIQUE REFERENCES orders(id),
 product_id TEXT NOT NULL REFERENCES products(id),
 license_type TEXT NOT NULL CHECK(license_type IN ('personal_research','commercial')),
 license_key_hash TEXT NOT NULL UNIQUE,
 license_key_prefix TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','revoked','expired')),
 seats INTEGER NOT NULL DEFAULT 1,
 issued_at TEXT NOT NULL,
 expires_at TEXT,
 revoked_at TEXT,
 created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS product_artifacts (
 product_id TEXT PRIMARY KEY REFERENCES products(id) ON DELETE CASCADE,
 content_base64 TEXT NOT NULL,
 sha256 TEXT NOT NULL,
 updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS settings (
 key TEXT PRIMARY KEY,
 value TEXT NOT NULL,
 updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS audit_log (
 id TEXT PRIMARY KEY,
 actor_user_id TEXT,
 action TEXT NOT NULL,
 target_type TEXT,
 target_id TEXT,
 detail_json TEXT,
 created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS auth_attempts (
 email_key TEXT NOT NULL,
 attempted_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS legal_documents (
 id TEXT PRIMARY KEY,
 title TEXT NOT NULL,
 version TEXT NOT NULL,
 license_scope TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published','retired')),
 body TEXT NOT NULL,
 created_at TEXT NOT NULL,
 published_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id,created_at);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status,created_at);
CREATE INDEX IF NOT EXISTS idx_licenses_user ON licenses(user_id,status);
CREATE INDEX IF NOT EXISTS idx_auth_attempts ON auth_attempts(email_key,attempted_at);

INSERT OR IGNORE INTO schema_migrations(version,applied_at)
VALUES('0001_initial','baseline');
