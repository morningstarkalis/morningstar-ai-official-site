# MorningStar AI Official Website

Official bilingual portal for the MorningStar ecosystem. This repository contains the public website and its Cloudflare Workers backend; it is not the private model-development repository.

## Product-line separation

### 1. MorningStar Skill — public distribution
- Public-facing, free-to-access Skill releases; no member login is required.
- Source-available, non-commercial distribution under the exact license and notices shipped with each release. This is not OSI-defined Open Source because commercial use is restricted.
- Release archives, checksums, provenance, third-party notices, and historical license records must remain version-specific.
- Do not silently replace historical licenses or imply that a later release retroactively changes earlier grants.
- A public release must pass rights review, secret scanning, package integrity checks, and installation testing before being advertised as stable.

### 2. MorningStar AI Model Series — independently managed commercial products
- A separate commercial product line managed by the rights holder.
- Model weights, private datasets, training/fine-tuning/distillation pipelines, private orchestration code, production credentials, API infrastructure, customer data, and deployment configuration are excluded from this public repository.
- Commercial products require their own product documentation, security controls, and separately reviewed license or customer agreements.
- The public Skill license does not itself grant rights to private model assets or commercial services.

## Rights boundary

The public Skill license applies only to identified material the rights holder owns or is authorized to license. Third-party works, inherited modules, historical releases, trademarks, and AI-assisted contributions must retain their applicable notices and be reviewed individually. A license cannot create exclusivity over abstract ideas, methods, systems, or independently developed implementations.

## Public publication

- Book record: [邏輯無間：晨星起源](public/book.html)
- Source/evidence record: [BOOK_CATALOG.md](BOOK_CATALOG.md)
- The book page reproduces only the visible title, ebook format, synopsis excerpt and account-level review notice from a publisher-console screenshot supplied on 2026-11-28.
- The screenshot does **not** prove that the book itself passed review or is publicly available in Google Play Books. No public store URL, ISBN, author display record, publication date, pricing or territory setting has been verified.
- A low-resolution cover thumbnail is visible in the screenshot; the site does not upscale it as a final cover asset. Obtain the original cover file before publishing a high-resolution cover.

## Website architecture

- Cloudflare Workers + Static Assets
- Cloudflare D1 database: `morningstar-membership`
- Worker API routes: `/api/*`
- Public book information page: `/book.html` (publisher-console facts only; public store availability not yet verified)
- Public Model Series portal: `/model.html` (separate identity and commercial entitlements)
- Administrator console: `/admin.html` (MFA required for privileged operations)
- Static assets: `public/`
- Configuration: `wrangler.jsonc`

## Deployment

Cloudflare Workers Builds:
- Git repository: `morningstarkalis/morningstar-ai-official-site`
- Production branch: `main`
- Build/deploy command: `npx wrangler deploy`
- Root directory: `/`

Changes in feature branches are not live until reviewed, merged, and deployed. The current two-product-line work is in a draft pull request and has not been deployed to production.

## Current release status

- MorningStar Skill RC7 remains a release candidate; its 18 registered package assets are still pending file-level rights review.
- No RC7 public download is enabled. Historical releases retain their own license terms.
- The Model Series portal and backend routes are implemented as a controlled architecture, but registration/order feature flags remain off until reviewed legal documents are published and Cloudflare R2 plus the model inference service are configured.
- Production D1 migrations and production Worker deployment have not been performed.
- A successful staging migration and CI run do not constitute legal clearance, penetration testing, or production readiness.

## Security and release gate

Do not commit API keys, bootstrap tokens, private model assets, private datasets, customer data, or production secrets. The membership backend is an operational mechanism, not proof of legal rights ownership or a substitute for independent security review. Before public commercial launch, complete independent security testing, privacy and terms review, identity/email hardening, payment/contract and consumer-rights review, and end-to-end API authorization testing.

## Governance documents

- [Compliance control matrix](COMPLIANCE_CONTROL_MATRIX.md)
- [Rights and provenance audit](RIGHTS_AND_PROVENANCE_AUDIT.md)
- [Security audit report](SECURITY_AUDIT_REPORT.md)
- [Data flow and retention register](DATA_FLOW_AND_RETENTION.md)
- [Release blockers and acceptance gates](RELEASE_BLOCKERS.md)
- [Administrator operations](ADMIN_OPERATIONS.md)
- [Commercial core boundary](COMMERCIAL_CORE_BOUNDARY.md)
- [Model Series production activation checklist](MODEL_SERIES_PRODUCTION_CHECKLIST.md)
- [Staging deployment runbook](STAGING_DEPLOYMENT_RUNBOOK.md)
- [Production D1 migration runbook](PRODUCTION_MIGRATION_RUNBOOK.md)
- [Repository source notice](REPOSITORY_SOURCE_NOTICE.md)
- [Security policy](SECURITY.md)
- [GitHub release governance](GITHUB_RELEASE_GOVERNANCE.md)
- [Rights and licenses](RIGHTS_AND_LICENSES.md)

## Repository

https://github.com/morningstarkalis/morningstar-ai-official-site
