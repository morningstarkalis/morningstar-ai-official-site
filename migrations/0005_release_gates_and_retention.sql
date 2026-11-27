-- Release gate evidence records. This does not itself certify the evidence.
CREATE TABLE IF NOT EXISTS release_gate_records (
 id TEXT PRIMARY KEY,
 skill_release_version TEXT NOT NULL REFERENCES skill_releases(version),
 gate_type TEXT NOT NULL CHECK(gate_type IN ('rights','security','installation')),
 status TEXT NOT NULL CHECK(status IN ('passed','failed','revoked')),
 evidence_reference TEXT NOT NULL,
 reviewer_user_id TEXT NOT NULL REFERENCES users(id),
 review_note TEXT NOT NULL,
 created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_release_gates_version ON release_gate_records(skill_release_version,gate_type,status,created_at);

-- A retention decision must be explicitly approved before it is applied.
CREATE TABLE IF NOT EXISTS retention_policy_records (
 id TEXT PRIMARY KEY,
 data_category TEXT NOT NULL,
 purpose TEXT NOT NULL,
 retention_rule TEXT NOT NULL,
 deletion_method TEXT NOT NULL,
 legal_basis_reference TEXT NOT NULL,
 approved_by TEXT NOT NULL REFERENCES users(id),
 effective_at TEXT NOT NULL,
 review_due_at TEXT,
 status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','approved','retired')),
 created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_retention_policy_status ON retention_policy_records(status,data_category);
