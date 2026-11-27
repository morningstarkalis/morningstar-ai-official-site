# MorningStar Security Audit — Source-Based Preliminary Report

**As-of:** 2026-11-28  
**Status:** PARTIAL REVIEW — NOT A PENETRATION TEST OR SECURITY CERTIFICATION  
**Scope:** GitHub source for official site, Cloudflare Workers/D1 metadata, branch changes, and visible integration state.

## Findings verified

### Critical release blockers

1. **No separate model backend is live.** The current production Worker is still the original membership/licensing backend. The branch migration files have not been applied to the production D1 database.
2. **R2 is not enabled in the connected Cloudflare account.** Cloudflare R2 bucket-list returned API error 10042: “Please enable R2 through the Cloudflare Dashboard.” No private artifact bucket or R2 binding was confirmed.
3. **Model Series API is not connected to an inference provider.** No verified inference URL, token, endpoint, usage quota, billing meter, model registry or runtime has been confirmed.
4. **Email delivery and payment processing are not configured**, according to the repository README; email verification remains manual and payment orders are manually reviewed.
5. **Administrator MFA is not proven operational.** The branch contains TOTP helper code, but this review did not verify a configured TOTP secret, UI enrollment, recovery codes, replay protection, rate limiting, or end-to-end MFA. A helper function is not an operational MFA control.
6. **Existing rights review tables are not wired into the production Worker.** The DB has 26 pending v3.0.0 asset rows and zero approval review rows; current source does not implement a rights-review workflow.

### Authentication/session issues

- Production main-branch source uses PBKDF2-HMAC-SHA256 with 31,000 iterations and a 30-day session lifetime.
- The feature branch changes the configured iteration count to 600,000 and reduces the session lifetime to one day. This is an unvalidated change: benchmark on the actual Workers plan before deployment. Cloudflare Workers Free has a per-invocation CPU limit, and a stronger password KDF may exceed it. A managed identity provider or an appropriate paid plan may be safer than simply increasing work factor.
- Current login throttling is keyed on a hashed email over a 15-minute window. It is not sufficient by itself against distributed credential stuffing. Add edge rate limits / Turnstile as appropriate and consider IP/device abuse controls while minimizing extra personal data.
- No verified member MFA, password reset, recovery process, breached-password controls, session revocation UI, or periodic session reauthentication.
- Admin MFA must be mandatory for every sensitive admin read/write; implement TOTP replay protection with a stored last-accepted time-step, rate limiting, secure enrollment, recovery codes and audit logging.

### Application security / privacy

- Current source includes session cookies marked Secure, HttpOnly and SameSite=Lax.
- Feature-branch code adds baseline security headers, but they are unverified against all page functionality and external dependencies. Test CSP and remove unnecessary external origins before enforcing it.
- Website currently imports Google Fonts from Google Fonts endpoints. This creates direct browser requests to a third party and must be disclosed / assessed. A branch-only change should use system fonts to reduce this data flow.
- No verified Turnstile integration, vulnerability scan, dependency/SCA report, SAST, DAST, penetration test, account deletion flow, privacy request workflow, backup restore test, or breach tabletop exercise.
- D1 metadata reports running_in_region=APAC and jurisdiction=null. This is not proof of Taiwan-only data residency. Obtain Cloudflare DPA, current subprocessor list, transfer locations, support access details, and contract terms before deciding what must be disclosed.
- Current Worker logs server-side errors, but structured security event coverage, log redaction, retention, access review and incident response still need testing.
- No secrets were read or changed in this review. No production DB writes, migrations or deployments were performed.

## Architecture controls required before production

### Public MorningStar Skill
- Read-only release catalog and anonymous download are allowed only for a published release.
- Candidate releases must never be downloadable through the public endpoint.
- Verify archive SHA-256 against a signed/controlled release manifest before serving.
- Separate public static assets from private Model Series storage.
- Do not require Skill member accounts or sell access to this public non-commercial product.
- Preserve the historical v3.1.0 license and older release notices.

### Private MorningStar AI Model Series
- Separate identities, sessions, orders, license table, API keys, scopes, quotas, usage records, artifact metadata and audit trail.
- API keys are generated once, stored hashed, scope-limited, revocable and time-limited; never log raw keys.
- Require server-side authorization on every API and private download request; check member state, active license, product, scope, expiry, quota and abuse status.
- Store model artifacts in a private R2 bucket only after R2 is enabled, with public bucket access disabled, upload quarantine, malware/content checks, SHA-256 verification and controlled publication.
- Do not expose presigned URLs or object keys before a server-side entitlement check; set private/no-store headers.
- Inference gateway must be configured through Worker secrets/bindings, have request/response size controls, timeout/retry controls, rate limits, usage metering, output policy and incident logs.
- No Model Series signup or commercial order flow should be activated until reviewed Privacy Notice, Terms of Service, commercial license and required processor agreements are published.

### Administrator
- MFA enrollment must be proven end-to-end, not merely represented by helper code.
- Require MFA for member export, rights review approval, release publication, commercial terms, model product enablement, license issue/revocation, artifact upload/publication and credential rotation.
- Separate creator approval from independent legal/security review references where possible.
- Use an immutable audit trail for privileged changes and avoid storing secrets or full sensitive content in audit JSON.

## Feature-branch implementation update (2026-11-28)

The draft feature branch now contains:
- a dedicated Model Series portal and separate member/session handlers;
- consent receipts, manual member verification, commercial order requests and administrator license issuance/revocation;
- API key generation with hash-only storage, one-time display, license-bounded scopes, expiry and per-license usage quota checks;
- a service-binding inference gateway that fails closed when the actual inference service or secret is missing;
- R2 quarantine/upload/download code with SHA-256 checks and entitlement enforcement, but no R2 bucket is currently enabled;
- TOTP replay prevention and an administrator console;
- file-level Skill rights review, exact-package rights review, security/installation gates and checksum-gated publication.

These are source-code observations, not proof that the controls are live. No production deployment, R2 bucket, inference service, member signup, paid order, API key, model artifact or end-to-end Model Series transaction has been verified. The model feature flags and governance flags must remain disabled until the production-equivalent tests and legal prerequisites are closed.

The code currently records external evidence references for legal review, malware scan and rights review. It cannot independently authenticate the truth of a reference string; an actual external report/contract must be inspected and retained. The administrator must not use self-attested text as a substitute for an independent reviewer.

## Validation still required

- Build and static analysis using the repository's pinned toolchain.
- D1 migrations tested on a staging database, not production.
- Worker unit/integration tests for every role and scope; negative tests for anonymous, expired, revoked, wrong-product and wrong-scope access.
- TOTP replay, lockout and recovery tests.
- Password-hash benchmark on target Workers plan.
- R2 private bucket ACL and anonymous-access tests.
- API quota / abuse / CORS / CSRF / SSRF / IDOR / file upload / ZIP path traversal tests.
- Dependency scan, secret scan including Git history and build artifacts, SAST/DAST, penetration test.
- Backup and restore, incident response, log retention and access control reviews.
- Privacy notice and data deletion workflow verified from user request to downstream deletion/retention exception.

**Conclusion:** This is a source-based preliminary security review. Do not advertise the site or Model Series as security-audited or production-ready until the listed gates have evidence.
