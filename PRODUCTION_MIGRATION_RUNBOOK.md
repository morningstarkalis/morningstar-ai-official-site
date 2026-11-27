# Production D1 Migration Runbook

**Target database:** morningstar-membership  
**Target Worker:** morningstar-ai-official-site  
**Status:** NOT EXECUTED — requires a durable backup and explicit operator approval.

## Preflight facts verified on 2026-11-28

- Production database currently contains 1 administrator, 1 session, 0 ordinary members, 0 orders and 0 licenses.
- The legacy v3.0.0 product row is present with commercial use disabled.
- New tables such as `schema_migrations`, `skill_releases`, `model_members`, `model_api_quotas` and `release_gate_records` are absent.
- Production does not currently have `model_legal_documents` or `model_artifacts`, so migrations 0006 and 0007 have no existing target tables to conflict with.
- The seven migrations were applied to staging only.

## 1. Make and verify a durable backup

Run locally from the repository root:

```powershell
New-Item -ItemType Directory -Force .\backups | Out-Null
npx wrangler d1 export morningstar-membership --remote --output .\backups\MorningStar-Production-D1-before-vNext.sql
Get-FileHash .\backups\MorningStar-Production-D1-before-vNext.sql -Algorithm SHA256
Get-Item .\backups\MorningStar-Production-D1-before-vNext.sql | Select-Object FullName,Length,LastWriteTime
```

Store the SQL backup and its SHA-256 in a private, access-controlled location. The export contains personal and authentication metadata. Do not commit it to GitHub or upload it to a public file host.

Cloudflare documents that a running D1 export blocks other database requests. Perform it during a low-traffic window and wait for it to finish before proceeding.

## 2. Confirm migration files and target

```powershell
npx wrangler d1 migrations list morningstar-membership --remote
```

Confirm the target database name and ID in `wrangler.jsonc` before any write. Do not use `wrangler.staging.jsonc` for production.

## 3. Apply the migrations

Only after the backup file exists and its hash is recorded:

```powershell
npx wrangler d1 migrations apply morningstar-membership --remote
```

Read every migration name in the confirmation prompt. Abort if the target is not the production database or if the migration list differs from 0001–0007.

Wrangler's D1 migration command records its own migration history and captures a backup after applying migrations. The project also records its version rows in `schema_migrations`.

## 4. Verify read-only

```powershell
npx wrangler d1 execute morningstar-membership --remote --command "SELECT version FROM schema_migrations ORDER BY version;"
npx wrangler d1 execute morningstar-membership --remote --command "SELECT version,status,sha256,file_path FROM skill_releases;"
npx wrangler d1 execute morningstar-membership --remote --command "SELECT product_version,status,COUNT(*) AS count FROM commercial_rights_assets GROUP BY product_version,status;"
npx wrangler d1 execute morningstar-membership --remote --command "SELECT id,status,commercial_enabled FROM model_products;"
```

Expected initial state after migrations:
- RC7 exists only as a candidate and has no public file path.
- RC7 rights assets remain pending review.
- Model Series product remains draft and commercially disabled.
- No model members, orders, licenses, API keys, quotas, or consent receipts are created.
- No release gate is passed.

## 5. Deployment is a separate decision

Do not deploy the new Worker until:
- the production `ADMIN_TOTP_SECRET` is configured and verified without sharing the secret;
- CI passes on the exact merge commit;
- the staging Worker has been deployed and its public pages and admin MFA flow tested;
- the production Worker rollback version is recorded;
- production bindings and secret names have been reviewed.

The current production Worker has an existing administrator account. Do not re-run first-admin bootstrap in production. Set a unique production TOTP secret, sign in with the existing administrator credentials, and test MFA before using the admin console.

Model Series feature flags must remain false until R2, inference, legal documents, privacy/retention, cross-border and consumer transaction gates have been completed.

## Rollback

Do not reverse schema changes by dropping tables or columns. If the Worker deployment fails, roll back the Worker version while preserving the additive D1 schema. Restore the D1 backup only if data corruption is established and after reviewing the impact on writes made since the backup.
