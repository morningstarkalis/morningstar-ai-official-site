# Staging Worker Deployment Runbook

**Purpose:** Deploy and test the current feature branch against the isolated staging D1 database.  
**Worker name:** morningstar-ai-official-site-staging  
**D1:** morningstar-membership-staging-v311  
**Production isolation:** The staging config binds only to the staging D1 ID.

## Important staging migration note

The original migrations 0001–0008 were applied to this staging D1 through the Cloudflare D1 API and verified. The database has the project-level `schema_migrations` table, but it was not initialized through Wrangler's own `d1_migrations` tracking table.

The security-audit remediation branch adds migration `0009_security_audit_indexes.sql`. **That migration is pending and has not been applied to Staging or Production.** It adds only an index to the existing `audit_log` table. Apply and verify it against the Staging D1 through the approved Cloudflare D1 API procedure before deploying the revised Worker.

**Do not run `wrangler d1 migrations apply` against this existing staging D1.** Wrangler may consider all files unapplied and re-run non-idempotent ALTER TABLE migrations 0006 and 0007. Do not apply any migration to Production as part of this Staging work. A future fresh staging database should be initialized through Wrangler migrations from the start.

## Local prerequisites

- Node.js LTS and npm.
- Cloudflare account access for the Worker and staging D1.
- A local clone of this public repository and the feature branch.
- Never place production secrets in staging.

## 1. Deploy the isolated staging Worker

From the repository root:

```powershell
npx wrangler deploy --config .\wrangler.staging.jsonc
```

This deploys the Worker and static assets under the separate staging Worker name. It does not change the production Worker.

## 2. Staging administrator secrets — already configured

The Staging administrator already exists. `ADMIN_BOOTSTRAP_TOKEN` has been removed and `ADMIN_TOTP_SECRET` remains configured on the Staging Worker.

Do not generate or upload another Bootstrap Token, and do not rotate the existing TOTP secret as part of this audit remediation. Production secrets must never be copied into Staging.

## Password hashing compatibility — previously validated

- New credentials use versioned scrypt hashes with profile N=2^14, r=8, p=5. The implementation is in `src/password.mjs`.
- The real Staging Worker passed the hash and verify preflight before the one-time administrator Bootstrap; the preflight performed no D1 writes.
- The administrator now exists and `ADMIN_BOOTSTRAP_TOKEN` has been removed. Do not rerun the bootstrap preflight: its guard is intentionally unavailable after initialization.
- CI continues to run `node scripts/test_password_kdf.mjs` for hash creation, verification, legacy PBKDF2 compatibility and fail-closed cases.

## 3. Existing staging administrator state

The Staging administrator has already been initialized and the one-time `ADMIN_BOOTSTRAP_TOKEN` has been removed from the Staging Worker. The live `/api/setup-status` response was verified as `needs_admin=false` and `bootstrap_configured=false`; the Staging TOTP secret remains configured.

Do not run Bootstrap again, do not recreate `ADMIN_BOOTSTRAP_TOKEN`, and do not rotate `ADMIN_TOTP_SECRET` as part of routine testing. Use the existing administrator credentials and a fresh TOTP for every privileged operation.

The staging D1 already contains the initialized administrator and MFA state. Do not rely on older baseline notes that describe an empty staging database; verify live counts read-only before any fixture setup.

## 4. Verify

- Open `/`, `/model.html` and `/admin.html`.
- Public Skill content must load without member sign-in.
- Model Series catalog may be empty; registration, order requests and inference must remain disabled.
- Admin overview must require a fresh TOTP.
- Reusing the same TOTP time-step must fail with HTTP 409 and create a bounded `admin.totp.replay_rejected` audit event.
- Failed admin login, throttled login, non-admin role denial, invalid/replayed TOTP, accepted MFA and admin logout must use the new security audit actions.
- A non-admin Session must receive HTTP 403 from an admin route; a dedicated non-admin test identity is required before claiming this dynamic test passed.
- No Model Series member can be registered while required flags and legal/processor/retention controls remain false.
- No private download is possible without R2, an active license and the download scope.
- No inference call is possible without the private service binding and secret.

## 5. What this staging deployment cannot prove

R2 and the inference service are not configured. Therefore private artifact upload/download and real AI inference cannot pass end-to-end tests yet. Do not change the staging feature flags to true to bypass missing dependencies.
