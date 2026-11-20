-- MorningStar membership and licensing schema v1
-- Applied to Cloudflare D1 database morningstar-membership.
CREATE TABLE IF NOT EXISTS users (
 id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, display_name TEXT NOT NULL,
 password_salt TEXT NOT NULL, password_hash TEXT NOT NULL, password_iterations INTEGER NOT NULL,
 role TEXT NOT NULL DEFAULT 'member' CHECK(role IN ('member','admin')),
 email_verified INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','suspended')),
 created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
 token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 expires_at TEXT NOT NULL, created_at TEXT NOT NULL, last_seen_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE TABLE IF NOT EXISTS products (
 id TEXT PRIMARY KEY, title TEXT NOT NULL, version TEXT NOT NULL, description TEXT NOT NULL,
 original_sha256 TEXT NOT NULL, file_name TEXT NOT NULL, file_size INTEGER NOT NULL,
 status TEXT NOT NULL DEFAULT 'available' CHECK(status IN ('available','archived')),
 commercial_enabled INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS product_artifacts (
 product_id TEXT PRIMARY KEY REFERENCES products(id) ON DELETE CASCADE,
 content_base64 TEXT NOT NULL, sha256 TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS legal_documents (
 id TEXT PRIMARY KEY, title TEXT NOT NULL, version TEXT NOT NULL, license_scope TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published','retired')),
 body TEXT NOT NULL, created_at TEXT NOT NULL, published_at TEXT
);
CREATE TABLE IF NOT EXISTS orders (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), product_id TEXT NOT NULL REFERENCES products(id),
 requested_license_type TEXT NOT NULL CHECK(requested_license_type IN ('personal_research','commercial')),
 terms_version TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending_review' CHECK(status IN ('pending_review','approved','rejected','cancelled')),
 payment_reference TEXT, amount_minor INTEGER, currency TEXT NOT NULL DEFAULT 'TWD',
 admin_note TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id,created_at);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status,created_at);
CREATE TABLE IF NOT EXISTS licenses (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), order_id TEXT NOT NULL UNIQUE REFERENCES orders(id),
 product_id TEXT NOT NULL REFERENCES products(id), license_type TEXT NOT NULL CHECK(license_type IN ('personal_research','commercial')),
 license_key_hash TEXT NOT NULL UNIQUE, license_key_prefix TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','revoked','expired')),
 seats INTEGER NOT NULL DEFAULT 1, issued_at TEXT NOT NULL, expires_at TEXT, revoked_at TEXT, created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_licenses_user ON licenses(user_id,status);
CREATE TABLE IF NOT EXISTS auth_attempts (email_key TEXT NOT NULL, attempted_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS idx_auth_attempts ON auth_attempts(email_key,attempted_at);
CREATE TABLE IF NOT EXISTS audit_log (
 id TEXT PRIMARY KEY, actor_user_id TEXT, action TEXT NOT NULL, target_type TEXT,
 target_id TEXT, detail_json TEXT, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL);
INSERT OR IGNORE INTO products (id,title,version,description,original_sha256,file_name,file_size,status,commercial_enabled,created_at)
VALUES ('morningstar-skill-v3','MorningStar Skill Commercial Edition','3.0.0',
'Claude Code and Codex installable package. Commercial license rights remain disabled pending scope confirmation.',
'e1739adbbdf6ecc5f9fe6a176118bca9adcb0164e62e048a901dff049633a038',
'MorningStar-Skill-v3.0.0-Commercial.zip',38242,'available',0,'2026-11-20T00:00:00.000Z');
INSERT OR IGNORE INTO legal_documents (id,title,version,license_scope,status,body,created_at)
VALUES ('ms-original-license-v3','Original Framework License Notice','CC-BY-NC-ND-4.0','original_work','published',
'《邏輯無間：晨星起源》及原始框架維持 CC BY-NC-ND 4.0 權利聲明。不得商用或改作。https://creativecommons.org/licenses/by-nc-nd/4.0/',
'2026-11-20T00:00:00.000Z');
INSERT OR IGNORE INTO legal_documents (id,title,version,license_scope,status,body,created_at)
VALUES ('ms-commercial-terms-v0.1','MorningStar Skill Commercial License Terms','0.1-DRAFT','commercial_additions','draft',
'草稿，尚未生效。原始作品除非另有權利人書面授權，不包含於商業授權。正式販售前須完成權利審核與條款簽署。',
'2026-11-20T00:00:00.000Z');
