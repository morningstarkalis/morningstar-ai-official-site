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
