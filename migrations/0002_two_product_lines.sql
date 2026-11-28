-- MorningStar two-product-line architecture and privacy governance v2
-- This migration is additive. It preserves historical Skill orders/licenses/audit rows.
-- Apply to a staging D1 database first; do NOT apply to production until backup + review.

-- Legacy Skill licensing is frozen. Existing historical rows remain for audit purposes.
UPDATE products SET status='archived', commercial_enabled=0
WHERE id='morningstar-skill-v3';

CREATE TABLE IF NOT EXISTS skill_releases (
  version TEXT PRIMARY KEY,
  status TEXT NOT NULL CHECK(status IN ('candidate','published','withdrawn','archived')),
  file_path TEXT,
  sha256 TEXT NOT NULL,
  license_scope TEXT NOT NULL,
  source_manifest_path TEXT,
  release_notes TEXT,
  rights_reviewed_at TEXT,
  security_reviewed_at TEXT,
  installation_tested_at TEXT,
  published_at TEXT,
  created_at TEXT NOT NULL
);
INSERT OR IGNORE INTO skill_releases
(version,status,file_path,sha256,license_scope,source_manifest_path,release_notes,created_at)
VALUES
('3.1.2-rc.7','candidate',NULL,
 '6e9adf7af1ca161ff225d7367ce5e41f402aeb9ebdf0530970db19607d466771',
 'public-non-commercial-source-available',
 'RIGHTS_AND_LICENSES.md',
 'Release candidate only. Not eligible for public stable download until all legal, provenance, security and installation gates are independently closed.',
 '2026-11-28T00:00:00.000Z');

-- Model Series has completely separate member identities and sessions.
CREATE TABLE IF NOT EXISTS model_members (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  password_iterations INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending_verification' CHECK(status IN ('pending_verification','active','suspended','closed')),
  email_verified INTEGER NOT NULL DEFAULT 0,
  privacy_notice_version TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS model_sessions (
  token_hash TEXT PRIMARY KEY,
  model_member_id TEXT NOT NULL REFERENCES model_members(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_model_sessions_member ON model_sessions(model_member_id);
CREATE INDEX IF NOT EXISTS idx_model_members_status ON model_members(status,created_at);

CREATE TABLE IF NOT EXISTS model_products (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  version TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','available','archived')),
  commercial_enabled INTEGER NOT NULL DEFAULT 0 CHECK(commercial_enabled IN (0,1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
INSERT OR IGNORE INTO model_products
(id,title,version,description,status,commercial_enabled,created_at,updated_at)
VALUES
('morningstar-ai-model-series','MorningStar AI Model Series','0.0.0',
 'Commercial model product family. Product details, terms, technical documentation and model artifacts are not published until individually reviewed.',
 'draft',0,'2026-11-28T00:00:00.000Z','2026-11-28T00:00:00.000Z');

CREATE TABLE IF NOT EXISTS model_legal_documents (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  version TEXT NOT NULL,
  scope TEXT NOT NULL CHECK(scope IN ('privacy_notice','terms_of_service','commercial_model_license','api_terms','dpa')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published','retired')),
  body TEXT NOT NULL,
  created_at TEXT NOT NULL,
  published_at TEXT
);
-- Intentionally no published privacy notice or commercial license is seeded.
-- Public signup, order placement, and license issuance remain blocked until reviewed terms are published.

CREATE TABLE IF NOT EXISTS model_orders (
  id TEXT PRIMARY KEY,
  model_member_id TEXT NOT NULL REFERENCES model_members(id),
  model_product_id TEXT NOT NULL REFERENCES model_products(id),
  requested_license_type TEXT NOT NULL CHECK(requested_license_type IN ('commercial_api','commercial_deployment')),
  terms_version TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending_review' CHECK(status IN ('pending_review','approved','rejected','cancelled')),
  payment_reference TEXT,
  amount_minor INTEGER,
  currency TEXT NOT NULL DEFAULT 'TWD',
  admin_note TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_model_orders_member ON model_orders(model_member_id,created_at);
CREATE INDEX IF NOT EXISTS idx_model_orders_status ON model_orders(status,created_at);

CREATE TABLE IF NOT EXISTS model_licenses (
  id TEXT PRIMARY KEY,
  model_member_id TEXT NOT NULL REFERENCES model_members(id),
  model_order_id TEXT NOT NULL UNIQUE REFERENCES model_orders(id),
  model_product_id TEXT NOT NULL REFERENCES model_products(id),
  license_type TEXT NOT NULL CHECK(license_type IN ('commercial_api','commercial_deployment')),
  license_key_hash TEXT NOT NULL UNIQUE,
  license_key_prefix TEXT NOT NULL,
  scopes_json TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','revoked','expired')),
  issued_at TEXT NOT NULL,
  expires_at TEXT,
  revoked_at TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_model_licenses_member ON model_licenses(model_member_id,status);
CREATE INDEX IF NOT EXISTS idx_model_licenses_product ON model_licenses(model_product_id,status);

CREATE TABLE IF NOT EXISTS model_api_keys (
  id TEXT PRIMARY KEY,
  model_member_id TEXT NOT NULL REFERENCES model_members(id),
  model_license_id TEXT NOT NULL REFERENCES model_licenses(id),
  key_prefix TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  scopes_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT,
  last_used_at TEXT,
  revoked_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_model_api_keys_member ON model_api_keys(model_member_id,revoked_at);
CREATE INDEX IF NOT EXISTS idx_model_api_keys_license ON model_api_keys(model_license_id,revoked_at);

-- Private artifact bytes live in a private R2 bucket; D1 stores only metadata and object keys.
CREATE TABLE IF NOT EXISTS model_artifacts (
  id TEXT PRIMARY KEY,
  model_product_id TEXT NOT NULL REFERENCES model_products(id),
  version TEXT NOT NULL,
  object_key TEXT NOT NULL UNIQUE,
  file_name TEXT NOT NULL,
  content_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  sha256 TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'quarantined' CHECK(status IN ('quarantined','available','withdrawn')),
  uploaded_by TEXT,
  uploaded_at TEXT NOT NULL,
  approved_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_model_artifacts_product ON model_artifacts(model_product_id,version,status);

CREATE TABLE IF NOT EXISTS model_auth_attempts (
  email_key TEXT NOT NULL,
  attempted_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_model_auth_attempts ON model_auth_attempts(email_key,attempted_at);

CREATE TABLE IF NOT EXISTS registration_attempts (
  email_key TEXT NOT NULL,
  attempted_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_registration_attempts ON registration_attempts(email_key,attempted_at);

CREATE TABLE IF NOT EXISTS privacy_requests (
  id TEXT PRIMARY KEY,
  subject_type TEXT NOT NULL CHECK(subject_type IN ('member','model_member')),
  subject_id TEXT NOT NULL,
  request_type TEXT NOT NULL CHECK(request_type IN ('access','copy','correction','stop_processing','deletion','restriction','objection','portability')),
  details TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','in_progress','completed','partially_refused','refused')),
  response_note TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  closed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_privacy_requests_status ON privacy_requests(status,created_at);
CREATE INDEX IF NOT EXISTS idx_privacy_requests_subject ON privacy_requests(subject_type,subject_id);

CREATE TABLE IF NOT EXISTS consent_receipts (
  id TEXT PRIMARY KEY,
  subject_type TEXT NOT NULL CHECK(subject_type IN ('member','model_member')),
  subject_id TEXT NOT NULL,
  document_id TEXT NOT NULL,
  document_version TEXT NOT NULL,
  purpose TEXT NOT NULL,
  accepted_at TEXT NOT NULL,
  withdrawn_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_consent_subject ON consent_receipts(subject_type,subject_id,accepted_at);

-- Explicitly disable all legacy commercial enablement on Skill product records.
UPDATE products SET commercial_enabled=0 WHERE id='morningstar-skill-v3';

INSERT OR IGNORE INTO schema_migrations(version,applied_at)
VALUES('0002_two_product_lines',CURRENT_TIMESTAMP);
