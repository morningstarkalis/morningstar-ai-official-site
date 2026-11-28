-- Add a covering index for security-event lookups and bounded duplicate suppression.
-- Additive and safe for existing audit history; does not rewrite or delete audit records.
CREATE INDEX IF NOT EXISTS idx_audit_log_security_dedupe
ON audit_log (actor_user_id, action, target_type, target_id, created_at);
