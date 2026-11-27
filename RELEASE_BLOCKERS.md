# MorningStar Release Blockers & Acceptance Gates

**As-of:** 2026-11-28  
**Current state:** Draft PR only. No production migrations or deployment have been performed.

## P0 — Must close before public stable Skill release

- [ ] Verify every RC7 file's authorship, source provenance, original license, derivative-work status, third-party terms and human / AI contribution.
- [ ] AC-01 source citations [1]–[6] verified and referenced works assessed for quote/adaptation rights; keep AC-01 license notice separate.
- [ ] Review WordPress historical pages and embedded assets individually; preserve CC BY-NC-SA 4.0 / other historical terms where they apply.
- [ ] Ensure all included files are approved; excluded files removed from the exact ZIP.
- [ ] Record rights review against the exact package SHA-256; no release if any included file is pending or rejected.
- [ ] Secret scanning of source tree, Git history, build output and ZIP.
- [ ] Malware/archive traversal checks and reproducible ZIP verification.
- [ ] Clean installation tests on supported platforms.
- [ ] Publish a precise license scope, third-party notices, source references, checksum and release notes.
- [ ] Static security checks and operational incident contact.

## Engineering implementation in the feature branch (not production acceptance)

The following code paths and interfaces now exist in the draft branch. These are implementation facts only; they are not yet production-tested controls:

- [x] Separate Model Series member/session tables and registration/login/logout endpoints, gated by feature flags and published privacy/terms.
- [x] Consent receipts for the current privacy notice and terms versions.
- [x] Manual administrator verification for pending Model Series members.
- [x] Commercial order requests, exact terms-version binding, and manual order approval requiring settlement and signed-contract references.
- [x] One-time API key display, hash-only storage, key expiry/revocation, license-bounded scopes and per-license usage quotas.
- [x] Inference gateway interface using a private Worker Service Binding and internal secret; no model runtime is currently configured.
- [x] Private R2 artifact upload to quarantine, evidence references, SHA-256 verification, entitlement-checked download and audit records; R2 itself is not enabled.
- [x] MFA-gated admin console, TOTP time-step replay prevention, rights-review routes and Skill release gates.
- [x] Model Series portal at /model.html and admin console at /admin.html.
- [x] Privacy request submission and admin case-record workflow; actual downstream deletion, backup expiry and processor deletion are still manual and not yet evidenced.
- [x] Seven migration files and CI checks for Worker syntax, admin/member portal scripts, SQLite schema chain and release-boundary assertions.

The following remain blockers despite the branch implementation:
- [ ] Deploy a separate staging Worker with staging-only bindings and run end-to-end browser/API tests.
- [ ] Configure and prove admin TOTP secret enrollment and recovery on the actual Cloudflare Worker.
- [ ] Enable R2, bind a private bucket, and test anonymous access denial.
- [ ] Build and deploy the real MorningStar inference service and model version; the gateway alone is not an AI model.
- [ ] Run negative authorization tests for every role, scope, expiry, revocation, quota and wrong-product combination.
- [ ] Benchmark PBKDF2 at 600,000 iterations on the target Workers plan.
- [ ] Implement password reset/recovery and a fully evidenced privacy-request/deletion lifecycle.
- [ ] Complete independent security review, SAST/SCA/DAST, penetration testing and backup restoration.
- [ ] Obtain qualified legal review and approve actual terms, data map, processor contracts, retention schedule and consumer transaction policy.

## P0 — Must close before enabling public signup or commercial Model Series

- [ ] Publish Taiwanese PDPA privacy notice with controller identity, purposes, data categories, lawful basis, use area/recipients/method, rights and request channels.
- [ ] Map processors, subprocessors, cross-border locations, DPA and security measures.
- [ ] Set data retention/deletion schedule; implement data access/export, correction, deletion/stop processing workflow.
- [ ] Add email verification provider only after vendor/privacy review, or define secure manual verification policy with records.
- [ ] Configure and prove administrator MFA enrollment, recovery, replay prevention and enforcement for sensitive operations.
- [ ] Replace current membership architecture with isolated Model Series identities, sessions, license and API permissions; test all negative authorization cases.
- [ ] Enable R2 and create private bucket; verify public access disabled and test unauthorized downloads fail.
- [ ] Validate password storage on the target Cloudflare Workers plan; benchmark 600k PBKDF2 on production-equivalent plan or adopt managed identity/Argon2id-capable service.
- [ ] Add rate limiting / anti-automation, password reset, account suspension and session revocation.
- [ ] Complete API key generation, one-time display, hash storage, scope enforcement, expiry, revocation, quotas and metering.
- [ ] Add private artifact quarantine, malware scan, checksum, release approval and download audit.
- [ ] Publish commercial Terms, API Terms, acceptable use, support / SLA, refund/cancellation and consumer withdrawal flows as applicable.
- [ ] Confirm payment provider, tax/invoice obligations and customer support process.
- [ ] Conduct independent code review, SAST, dependency/SCA, DAST, penetration testing, backup restore and incident tabletop.

## P1 — International / product-specific applicability

- [ ] GDPR territorial scope and controller/processor roles assessment before actively offering to or monitoring people in the EU.
- [ ] EU representative / DPO / DPIA assessment where applicable.
- [ ] EU transfer mechanism and Article 28 processor contract review where applicable.
- [ ] AI Act role classification (GPAI provider, downstream provider, deployer, provider of AI system) based on actual model architecture and market placement.
- [ ] If a GPAI model provider, satisfy technical documentation, copyright policy and training-content summary, and systemic-risk duties if applicable.
- [ ] Other country-specific product, privacy, consumer, security, accessibility, export-control and tax obligations based on target markets.

## Go / No-Go rule

A product may be released only after every applicable P0 item is closed with evidence. P1 items become P0 where the product or market makes them applicable. No administrator self-attestation may substitute for independent rights evidence, penetration testing or qualified legal review.

RC7 remains a Release Candidate; Model Series remains a private product concept until its runtime, storage, identity, contracts and release gates are verified.
