#!/usr/bin/env python3
"""Offline SQLite migration and release-boundary checks; no production credentials required."""
from pathlib import Path
import sqlite3
import re

ROOT = Path(__file__).resolve().parents[1]
MIGRATIONS = [
    "0001_initial.sql",
    "0002_two_product_lines.sql",
    "0003_rights_and_model_controls.sql",
    "0004_rc7_rights_inventory.sql",
    "0005_release_gates_and_retention.sql",
    "0006_model_api_quotas_and_legal_review.sql",
    "0007_model_artifact_review_evidence.sql",
]

db = sqlite3.connect(":memory:")
db.execute("PRAGMA foreign_keys=ON")
for name in MIGRATIONS:
    path = ROOT / "migrations" / name
    if not path.is_file():
        raise SystemExit(f"FAIL: missing migration {path}")
    try:
        db.executescript(path.read_text(encoding="utf-8"))
    except sqlite3.Error as exc:
        raise SystemExit(f"FAIL: {name}: {exc}") from exc
    print(f"PASS: {name}")

tables = {row[0] for row in db.execute("SELECT name FROM sqlite_master WHERE type='table'")}
required = {
    "schema_migrations", "users", "sessions", "products", "orders", "licenses",
    "skill_releases", "model_members", "model_sessions", "model_products",
    "model_orders", "model_licenses", "model_api_keys", "model_artifacts",
    "model_api_usage", "commercial_rights_assets", "commercial_rights_reviews",
    "admin_mfa_state", "release_gate_records", "retention_policy_records",
    "privacy_requests", "consent_receipts", "model_api_quotas",
}
missing = sorted(required - tables)
if missing:
    raise SystemExit("FAIL: missing tables: " + ", ".join(missing))

rc7 = db.execute("SELECT status,file_path,sha256 FROM skill_releases WHERE version='3.1.2-rc.7'").fetchone()
if not rc7 or rc7[0] != "candidate" or rc7[1] is not None:
    raise SystemExit(f"FAIL: RC7 must remain a non-downloadable candidate, got {rc7!r}")

pending = db.execute("""
 SELECT COUNT(*), SUM(CASE WHEN status='pending_review' THEN 1 ELSE 0 END)
 FROM commercial_rights_assets WHERE product_version='3.1.2-rc.7'
""").fetchone()
if not pending[0] or pending[0] != pending[1]:
    raise SystemExit(f"FAIL: RC7 assets must all remain pending rights review, got {pending!r}")

model = db.execute("SELECT status,commercial_enabled FROM model_products WHERE id='morningstar-ai-model-series'").fetchone()
if model != ("draft", 0):
    raise SystemExit(f"FAIL: Model Series must remain disabled by default, got {model!r}")

# The schema deliberately contains no administrator, member, order, license or consent seed data.
for table in ("users", "model_members", "orders", "model_orders", "licenses", "model_licenses", "consent_receipts"):
    count = db.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
    if count:
        raise SystemExit(f"FAIL: unexpected seed data in {table}: {count}")

# Verify a second application is safe and does not duplicate release or rights records.
before = (
    db.execute("SELECT COUNT(*) FROM skill_releases").fetchone()[0],
    db.execute("SELECT COUNT(*) FROM commercial_rights_assets WHERE product_version='3.1.2-rc.7'").fetchone()[0],
)
for name in MIGRATIONS[:5]:
    db.executescript((ROOT / "migrations" / name).read_text(encoding="utf-8"))
after = (
    db.execute("SELECT COUNT(*) FROM skill_releases").fetchone()[0],
    db.execute("SELECT COUNT(*) FROM commercial_rights_assets WHERE product_version='3.1.2-rc.7'").fetchone()[0],
)
if before != after:
    raise SystemExit(f"FAIL: migrations are not idempotent: before={before}, after={after}")
print("PASS: idempotent base migrations 0001-0005; additive ALTER TABLE migrations 0006-0007 applied once")
print(f"PASS: required tables ({len(required)})")
print(f"PASS: RC7 candidate only; {pending[0]} rights assets pending")
print("PASS: Model Series disabled by default")
print("PASS: no seeded identities, orders, licenses or consent receipts")

html = (ROOT / "public" / "index.html").read_text(encoding="utf-8")
worker = (ROOT / "src" / "worker.js").read_text(encoding="utf-8")
if "MorningStar AI Model Series" not in html or "MorningStar Skill" not in html:
    raise SystemExit("FAIL: both product lines must be represented on the site")
if "fonts.googleapis.com" in html or "fonts.gstatic.com" in html:
    raise SystemExit("FAIL: third-party Google Fonts request still present")
if 'path === "/api/public/skill/releases"' not in worker:
    raise SystemExit("FAIL: public Skill release catalog route missing")
if 'path.startsWith(publicDownloadPrefix)' not in worker:
    raise SystemExit("FAIL: public Skill download route missing")
if 'release.status!=="published"' not in worker:
    raise SystemExit("FAIL: public download must reject non-published releases")
if 'digestBytes(bytes)!==release.sha256' not in worker:
    raise SystemExit("FAIL: public download must verify SHA-256")
if 'path === "/api/orders" && method === "POST") return fail(410' not in worker:
    raise SystemExit("FAIL: legacy Skill order creation must be retired")
if 'path === "/api/auth/register" && method === "POST") return fail(410' not in worker:
    raise SystemExit("FAIL: public Skill must not require member registration")
if "/api/admin/commercial/publish" in worker:
    raise SystemExit("FAIL: legacy Skill commercial publishing endpoint must not exist")
if '<section id="account">' in html or "ms-auth-form" in html:
    raise SystemExit("FAIL: legacy Skill member portal must be removed")
admin = (ROOT / "public" / "admin.html").read_text(encoding="utf-8")
if "X-Admin-TOTP" not in admin or "/api/admin/overview" not in admin:
    raise SystemExit("FAIL: admin console must use MFA-protected admin endpoints")
if "ADMIN_TOTP_SECRET" not in admin or "localStorage" in admin:
    raise SystemExit("FAIL: admin console must explain MFA setup and must not persist credentials")
if "path.startsWith(\"/api/model/\")" not in worker or "is not enabled" not in worker:
    raise SystemExit("FAIL: Model Series API must fail closed while dependencies are absent")
if "skill.release.published" not in worker or "requireAdminMfa" not in worker:
    raise SystemExit("FAIL: release publication must be MFA-gated and audited")
import subprocess
import tempfile
if "<script>" not in admin or "</script>" not in admin:
    raise SystemExit("FAIL: admin console script block not found")
admin_script = admin.split("<script>", 1)[1].split("</script>", 1)[0]
with tempfile.NamedTemporaryFile("w", suffix=".js", encoding="utf-8", delete=False) as tmp:
    tmp.write(admin_script)
    temp_script = tmp.name
try:
    checked = subprocess.run(["node", "--check", temp_script], capture_output=True, text=True)
    if checked.returncode:
        raise SystemExit("FAIL: admin console JavaScript syntax: " + checked.stderr)
finally:
    Path(temp_script).unlink(missing_ok=True)
print("PASS: admin console JavaScript syntax")
print("PASS: static product separation, release guards, admin MFA and Model Series fail-closed checks")
