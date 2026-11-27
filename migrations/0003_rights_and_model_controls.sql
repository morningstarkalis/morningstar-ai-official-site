-- Reproducible rights/provenance schema used by the production D1 database.
-- This migration creates the rights review tables in fresh environments too.
-- It does not approve or clear any asset.

CREATE TABLE IF NOT EXISTS commercial_package_manifests (
 id TEXT PRIMARY KEY,
 product_id TEXT NOT NULL REFERENCES products(id),
 product_version TEXT NOT NULL,
 package_sha256 TEXT NOT NULL,
 file_count INTEGER NOT NULL,
 checksums_manifest_verified INTEGER NOT NULL DEFAULT 0 CHECK(checksums_manifest_verified IN (0,1)),
 manifest_source TEXT NOT NULL,
 created_by TEXT NOT NULL,
 created_at TEXT NOT NULL,
 UNIQUE(product_id, product_version, package_sha256)
);

CREATE TABLE IF NOT EXISTS commercial_rights_assets (
 id TEXT PRIMARY KEY,
 product_id TEXT NOT NULL REFERENCES products(id),
 product_version TEXT NOT NULL,
 asset_path TEXT NOT NULL,
 asset_sha256 TEXT NOT NULL,
 creator TEXT NOT NULL,
 rights_basis TEXT NOT NULL CHECK(rights_basis IN ('pending_determination','original_author','assignment','separate_license','public_domain','open_source')),
 third_party INTEGER NOT NULL DEFAULT 0 CHECK(third_party IN (0,1)),
 third_party_license TEXT,
 commercial_use_allowed INTEGER NOT NULL DEFAULT 0 CHECK(commercial_use_allowed IN (0,1)),
 redistribution_allowed INTEGER NOT NULL DEFAULT 0 CHECK(redistribution_allowed IN (0,1)),
 evidence_reference TEXT NOT NULL,
 included_in_package INTEGER NOT NULL DEFAULT 1 CHECK(included_in_package IN (0,1)),
 status TEXT NOT NULL DEFAULT 'pending_review' CHECK(status IN ('pending_review','approved','rejected','excluded')),
 review_note TEXT,
 reviewed_by TEXT,
 reviewed_at TEXT,
 created_at TEXT NOT NULL,
 UNIQUE(product_id, product_version, asset_path)
);

CREATE TABLE IF NOT EXISTS commercial_rights_reviews (
 id TEXT PRIMARY KEY,
 product_id TEXT NOT NULL REFERENCES products(id),
 product_version TEXT NOT NULL,
 package_sha256 TEXT NOT NULL,
 manifest_file_count INTEGER NOT NULL,
 approved_asset_count INTEGER NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('approved','revoked')),
 reviewer_user_id TEXT NOT NULL,
 review_note TEXT,
 created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_commercial_rights_assets_release
 ON commercial_rights_assets(product_id, product_version, status);
CREATE INDEX IF NOT EXISTS idx_commercial_rights_reviews_release
 ON commercial_rights_reviews(product_id, product_version, created_at);

-- One-use TOTP step tracking prevents replay of the same administrator code.
CREATE TABLE IF NOT EXISTS admin_mfa_state (
 admin_user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 last_step INTEGER NOT NULL DEFAULT -1,
 updated_at TEXT NOT NULL
);

-- Model Series request accounting: a separate ledger from the legacy Skill product.
CREATE TABLE IF NOT EXISTS model_api_usage (
 id TEXT PRIMARY KEY,
 model_api_key_id TEXT NOT NULL REFERENCES model_api_keys(id),
 model_member_id TEXT NOT NULL REFERENCES model_members(id),
 model_product_id TEXT NOT NULL REFERENCES model_products(id),
 request_id TEXT NOT NULL,
 usage_type TEXT NOT NULL CHECK(usage_type IN ('inference','status','artifact_download')),
 input_units INTEGER NOT NULL DEFAULT 0,
 output_units INTEGER NOT NULL DEFAULT 0,
 created_at TEXT NOT NULL,
 UNIQUE(request_id)
);
CREATE INDEX IF NOT EXISTS idx_model_api_usage_member
 ON model_api_usage(model_member_id, created_at);
CREATE INDEX IF NOT EXISTS idx_model_api_usage_product
 ON model_api_usage(model_product_id, created_at);

INSERT OR IGNORE INTO schema_migrations(version,applied_at)
VALUES('0003_rights_and_model_controls',CURRENT_TIMESTAMP);
