-- Atomic quota counters for the Model Series inference gateway.
ALTER TABLE model_api_quotas ADD COLUMN daily_window TEXT;
ALTER TABLE model_api_quotas ADD COLUMN daily_requests_used INTEGER NOT NULL DEFAULT 0;
ALTER TABLE model_api_quotas ADD COLUMN monthly_window TEXT;
ALTER TABLE model_api_quotas ADD COLUMN monthly_input_units_used INTEGER NOT NULL DEFAULT 0;
ALTER TABLE model_api_quotas ADD COLUMN monthly_output_units_used INTEGER NOT NULL DEFAULT 0;

INSERT OR IGNORE INTO schema_migrations(version,applied_at)
VALUES('0008_atomic_model_api_quota_counters',CURRENT_TIMESTAMP);
