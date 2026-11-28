# Staging Worker Deployment Runbook

**Purpose:** Deploy and verify the feature branch only against the isolated Staging Worker and Staging D1.  
**Last verified:** 2026-11-28 (UTC)  
**Worker:** `morningstar-ai-official-site-staging`  
**D1:** `morningstar-membership-staging-v311`  
**Current acceptance record:** [MorningStar Staging Integration Acceptance Report v1.0](STAGING_INTEGRATION_ACCEPTANCE_REPORT_v1.0.md)  
**Production boundary:** No Production deployment or D1 migration is authorized by this runbook.

## 1. Current verified Staging state

As of 2026-11-28:

| Item | Verified state |
|---|---|
| Worker URL | https://morningstar-ai-official-site-staging.morningstarkalis.workers.dev |
| Active Worker Version ID | `2e6a3c62-261e-433b-8cb0-5a4e48fe11ec` |
| Deployment ID | `e10bcba6-5f0e-4b25-ba3a-c8f9aa36a8a5` |
| Traffic | 100% to the version above |
| Staging D1 name | `morningstar-membership-staging-v311` |
| Staging D1 ID | `74cd1491-8d8b-4e56-8ab8-69839ccc60e8` |
| Model Series flags | `MODEL_SERIES_ENABLED=false`; `MODEL_ORDER_REQUESTS_ENABLED=false` |
| Setup status | `needs_admin=false`; `bootstrap_configured=false` |

The Staging Worker deployment was created at 2026-11-28 02:24:57.602281 UTC using the Staging configuration. Cloudflare deployment metadata confirms that 100% of Staging Worker traffic points to the version shown above.

The administrator was already initialized before this deployment. Do not run Bootstrap again, do not create another administrator, and do not rotate the existing Staging TOTP secret as part of routine verification.

## 2. Staging migration state and mandatory safeguards

Migrations 0001–0008 had previously been applied to this Staging D1. The security-audit index migration, `0009_security_audit_indexes.sql`, was subsequently applied to **Staging only** through the Cloudflare D1 API using:

```sql
CREATE INDEX IF NOT EXISTS idx_audit_log_security_dedupe
ON audit_log (actor_user_id, action, target_type, target_id, created_at);
```

Read-only verification confirmed that `sqlite_master` contains `idx_audit_log_security_dedupe` and `PRAGMA index_info` returns these columns in order:

1. `actor_user_id`
2. `action`
3. `target_type`
4. `target_id`
5. `created_at`

**Migration 0009 is already applied to Staging. Do not apply it again as a new operation. Production has not received migration 0009.**

### Critical Wrangler migration warning

The existing Staging D1 has the project-level `schema_migrations` table, but Wrangler's own `d1_migrations` tracking table was not initialized through Wrangler. Therefore:

- **Never run `wrangler d1 migrations apply` against this existing Staging D1.**
- Do not attempt to initialize Wrangler's migration history by replaying all migration files.
- In particular, migrations 0006 and 0007 contain additive ALTER operations that must not be blindly replayed.
- Do not run a Production migration as part of Staging verification.
- For any future Staging schema change, inspect the exact SQL and live schema first; use the approved, reviewed Cloudflare D1 API operation for this existing database, then verify with read-only SQL.
- A newly created database may use Wrangler migrations from the beginning, after a separate initialization plan is approved.

## 3. Local prerequisites and environment isolation

- Node.js and npm installed.
- Cloudflare account access limited to the required Worker and Staging D1 operations.
- Repository checked out at the intended feature branch and reviewed commit.
- Use `wrangler.staging.jsonc` for Staging deployment.
- Confirm the Worker name and D1 ID in the Staging config before every deploy.
- Never copy Production secrets into Staging or print secret values.
- Do not commit local-only configuration changes or credentials.

The Staging Worker must bind to the Staging D1 ID shown above. Never substitute the Production Worker name, Production D1 name, or Production D1 ID.

## 4. Staging deployment

The current verified deployment is already active. For a future, separately reviewed Staging code update, run from the repository root:

```powershell
npx.cmd wrangler deploy --config .\wrangler.staging.jsonc
```

After deployment, capture the new Worker Version ID and Deployment ID from the command output and verify through Cloudflare deployments metadata that:

- the script is `morningstar-ai-official-site-staging`;
- the D1 binding points to the Staging D1 ID;
- the expected version receives 100% of Staging traffic;
- the feature flags remain false unless a separately approved activation plan proves all dependencies are ready.

Do not infer successful deployment from a local command alone; verify the Cloudflare deployment record and live HTTP behavior.

## 5. Staging administrator and secret handling

- The Staging administrator already exists.
- `ADMIN_BOOTSTRAP_TOKEN` has been removed; `/api/setup-status` returned `bootstrap_configured=false`.
- `ADMIN_TOTP_SECRET` is configured as a Staging Worker secret binding. Never display, paste into chat, commit, or include its value in evidence.
- Do not run Bootstrap again, recreate a Bootstrap Token, create another administrator, or rotate the existing TOTP secret during routine testing.
- Use the existing administrator account and a fresh TOTP time-step for each privileged operation.
- Logout tests must verify that the current Session is revoked. Do not revoke unrelated administrator Sessions.

## 6. Verified code and HTTP checks

The acceptance baseline code commit was `536fc8a85aa4759a7f42314752fdfe0721c193be`. The following local checks passed:

```powershell
node --check .\src\worker.js
node .\scripts\test_password_kdf.mjs
node .\scripts\test_auth_audit.mjs
python .\scripts\validate_release.py
```

The GitHub Actions `validate` job for this commit passed in [workflow run 46097236610](https://github.com/morningstarkalis/morningstar-ai-official-site/actions/runs/46097236610).

The following live Staging tests were also completed:

| Test | Observed result |
|---|---|
| `GET /api/health` | HTTP 200; database connected |
| `GET /api/setup-status` | HTTP 200; admin initialized; Bootstrap not configured |
| Invalid login attempts 1–8 | HTTP 401 each |
| Invalid login attempt 9 | HTTP 429 |
| Administrator login | HTTP 200 |
| Invalid TOTP | HTTP 401 |
| Valid TOTP | HTTP 200 |
| Replayed TOTP time-step | HTTP 409 |
| Administrator logout | HTTP 200 |
| Stale Session after logout | HTTP 401 |
| Authenticated member on `GET /api/admin/overview` | HTTP 403 |

For the login rate-limit test, supply the correct same-origin `Origin` header. A request failing the Origin check is a separate HTTP 403 and must not be counted as an invalid-password attempt.

### CI exception requiring follow-up

The Cloudflare `Workers Builds: morningstar-ai-official-site` Check Run on commit `536fc8a` concluded `failure` (Check Run ID `140831508571`). The GitHub Check Run response did not provide diagnostic annotations or a root cause. Track and resolve this build failure before PR #2 is merged. Do not report every CI/build system as green merely because the GitHub Actions `validate` job passed.

## 7. Database audit counts and fixture cleanup

A read-only Staging D1 query confirmed these audit action totals at the time of acceptance:

| Audit action | Count |
|---|---:|
| `admin.login.failed` | 8 |
| `admin.login.rate_limited` | 1 |
| `admin.login.succeeded` | 2 |
| `admin.totp.invalid` | 1 |
| `admin.mfa.accepted` | 1 |
| `admin.totp.replay_rejected` | 1 |
| `admin.logout` | 2 |
| `admin.access.denied` | 1 |

The temporary normal-member fixture and its Session were deleted after the HTTP 403 test. Post-cleanup read-only checks returned:

- temporary member rows: 0;
- temporary Session rows: 0;
- retained `admin.access.denied` audit record for `GET /api/admin/overview`: 1;
- active Staging administrators: 1;
- rate-limit test `auth_attempts` residue: 0.

The audit evidence is intentionally retained. Do not delete it as part of fixture cleanup. The read-only verification queries returned `changed_db=false` and `rows_written=0`.

Refer to [MorningStar Staging Integration Acceptance Report v1.0](STAGING_INTEGRATION_ACCEPTANCE_REPORT_v1.0.md) for the full three-layer evidence record, including deployment IDs, HTTP response results, index verification, audit counts and Production boundary.

## 8. Production isolation status

The Production Worker remains `morningstar-ai-official-site`. A read-only Cloudflare deployments query after the Staging deployment showed the latest Production deployment still at:

- Active Version ID: `96ea2857-9ab1-4d69-b518-63a325b07cec`
- Deployment ID: `d62bb0de-82ee-4b92-b191-5209f54d5e18`
- Traffic: 100%
- Created: 2026-11-27 18:11:22.583465 UTC

No Production Worker deployment, Production D1 migration, Production D1 write, or Production Secret modification was performed for this Staging acceptance. Re-check the Production active deployment before and after any future Production change; do not treat Staging acceptance as Production approval.

## 9. Remaining feature and release restrictions

The following are intentionally not enabled or not yet accepted:

- Model Series registration, order requests and inference remain disabled.
- R2 private artifact storage and a real model inference service are not configured; private artifact delivery and live inference cannot pass end-to-end verification.
- MorningStar Skill RC7 remains a candidate; its 18 rights assets are pending rights review.
- Production migration, deployment and website cutover have not occurred.
- This acceptance is not an independent penetration test, legal opinion, certification or public-release approval.

Keep PR #2 Draft and unmerged until the separate merge and release blockers, including the Cloudflare Workers Builds failure, have been reviewed and resolved.
