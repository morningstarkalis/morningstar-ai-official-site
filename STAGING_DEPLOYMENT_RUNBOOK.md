# Staging Worker Deployment Runbook

**Purpose:** Deploy and test the current feature branch against the isolated staging D1 database.  
**Worker name:** morningstar-ai-official-site-staging  
**D1:** morningstar-membership-staging-v311  
**Production isolation:** The staging config binds only to the staging D1 ID.

## Important staging migration note

The eight SQL migrations were already applied to this staging D1 through the Cloudflare D1 API and verified. The database has the project-level `schema_migrations` table, but it was not initialized through Wrangler's own `d1_migrations` tracking table.

**Do not run `wrangler d1 migrations apply` against this existing staging D1.** Wrangler may consider all files unapplied and re-run non-idempotent ALTER TABLE migrations 0006 and 0007. Use this database only for Worker deployment and API testing. A future fresh staging database should be initialized through Wrangler migrations from the start.

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

## 2. Configure staging administrator secrets

Generate separate staging-only secrets. Do not reuse production secrets.

Bootstrap token:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

TOTP secret (Base32, 160-bit):

```powershell
node -e "const b=require('crypto').randomBytes(20),a='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';let bits='';for(const x of b)bits+=x.toString(2).padStart(8,'0');let o='';for(let i=0;i<bits.length;i+=5)o+=a[parseInt(bits.slice(i,i+5).padEnd(5,'0'),2)];console.log(o)"
```

Set secrets for the staging Worker only:

```powershell
npx wrangler secret put ADMIN_BOOTSTRAP_TOKEN --config .\wrangler.staging.jsonc
npx wrangler secret put ADMIN_TOTP_SECRET --config .\wrangler.staging.jsonc
```

When prompted, paste the generated values. Add the same TOTP Base32 secret to a trusted authenticator application. Never paste either secret into GitHub, this conversation, or source files.

## Password hashing compatibility (before Bootstrap)

- New credentials use versioned scrypt hashes with the OWASP profile N=2^14, r=8, p=5.
- The scheme is implemented through `node:crypto`; this Worker uses compatibility date 2026-11-20, which enables Node.js compatibility by default.
- Existing unprefixed PBKDF2-SHA-256 hashes with a supported iteration count are verified on successful login, then transparently re-hashed with scrypt. No D1 schema change or migration is required.
- New scrypt rows set the legacy `password_iterations` column to `0`; the algorithm and parameters are carried by the `password_hash` version prefix.
- Run `node scripts/test_password_kdf.mjs` before deployment. Do not perform Bootstrap until the deployed Staging Worker returns a successful hash/authentication smoke test.

## 3. Bootstrap staging administrator

1. Open the staging Worker URL followed by `/admin.html`.
2. Enter the one-time bootstrap token, staging admin email, display name and a strong unique password.
3. After the administrator is created, remove the bootstrap secret:

```powershell
npx wrangler secret delete ADMIN_BOOTSTRAP_TOKEN --config .\wrangler.staging.jsonc
```

4. Log in again and use a fresh TOTP for every privileged action.

The staging D1 currently contains zero users, zero admins and zero sessions, so first-admin bootstrap is expected.

## 4. Verify

- Open `/`, `/model.html` and `/admin.html`.
- Public Skill content must load without member sign-in.
- Model Series catalog may be empty; registration, order requests and inference must remain disabled.
- Admin overview must require a fresh TOTP.
- Reusing the same TOTP time-step must fail.
- No Model Series member can be registered while required flags and legal/processor/retention controls remain false.
- No private download is possible without R2, an active license and the download scope.
- No inference call is possible without the private service binding and secret.

## 5. What this staging deployment cannot prove

R2 and the inference service are not configured. Therefore private artifact upload/download and real AI inference cannot pass end-to-end tests yet. Do not change the staging feature flags to true to bypass missing dependencies.
