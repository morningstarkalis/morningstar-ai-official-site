-- Artifact review evidence for private Model Series downloads.
ALTER TABLE model_artifacts ADD COLUMN security_scan_reference TEXT;
ALTER TABLE model_artifacts ADD COLUMN rights_review_reference TEXT;
ALTER TABLE model_artifacts ADD COLUMN reviewed_by TEXT;
ALTER TABLE model_artifacts ADD COLUMN reviewed_at TEXT;

INSERT OR IGNORE INTO schema_migrations(version,applied_at)
VALUES('0007_model_artifact_review_evidence',CURRENT_TIMESTAMP);
