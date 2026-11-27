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
    "privacy_requests", "consent_receipts",
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
if "Commercial licensing for the legacy Skill product is disabled" not in worker:
    raise SystemExit("FAIL: legacy Skill commercial endpoint must stay disabled")
print("PASS: static product separation and public release guard checks")
