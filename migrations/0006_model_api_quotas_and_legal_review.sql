-- Model Series legal review evidence and API quota controls.
ALTER TABLE model_legal_documents ADD COLUMN review_evidence_reference TEXT;
ALTER TABLE model_legal_documents ADD COLUMN reviewed_by TEXT;
ALTER TABLE model_legal_documents ADD COLUMN reviewed_at TEXT;

CREATE TABLE IF NOT EXISTS model_api_quotas (
 model_license_id TEXT PRIMARY KEY REFERENCES model_licenses(id) ON DELETE CASCADE,
 daily_request_limit INTEGER NOT NULL DEFAULT 100,
 monthly_input_units_limit INTEGER NOT NULL DEFAULT 100000,
 monthly_output_units_limit INTEGER NOT NULL DEFAULT 100000,
 updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_model_api_quotas_updated ON model_api_quotas(updated_at);

INSERT OR IGNORE INTO schema_migrations(version,applied_at)
VALUES('0006_model_api_quotas_and_legal_review',CURRENT_TIMESTAMP);
