# MorningStar Data Flow, Retention & Processor Register

**As-of:** 2026-11-28  
**Status:** DRAFT — data owner and legal review required.

## 1. Current environment evidence

- Official site source uses Cloudflare Workers + Static Assets and Cloudflare D1.
- Live D1 metadata reports region APAC, replication disabled, and jurisdiction null. Do not state that this is Taiwan-only hosting or that all personal data remains inside Taiwan.
- Cloudflare R2 is not yet enabled in the connected account (R2 API returned error 10042). Private Model Series artifact delivery cannot be represented as currently operational.
- Repository README states transactional email delivery and payment processing are not connected.
- Website HTML currently imports Google Fonts; browser requests can therefore be made to Google Fonts endpoints. The feature branch should remove this import or list it in the third-party processor/recipient disclosure if retained.
- No verified model inference provider, external analytics provider, payment provider or email processor has been identified in the current repository review. This is not proof that no services are used outside the inspected code.

## 1A. Feature-branch staging migration verification (2026-11-28)

The seven schema migrations were applied to the isolated D1 database `morningstar-membership-staging-v311`. Read-only verification returned:
- 7 migration records;
- 1 Skill release row (RC7 candidate);
- 18 RC7 rights assets, all 18 still pending review;
- 0 Model Series members, orders, licenses or API quotas;
- 0 release gates;
- 0 approved retention policy records.

A read-only check of the production D1 database found none of the new tables `schema_migrations`, `skill_releases`, `model_members`, `model_api_quotas` or `release_gate_records`. Production migrations have not been applied.

The new Model Series routes and portal exist in the feature branch, but no actual member records or customer data were created. Registration and order flags remain off; R2 and inference service bindings are not configured.

## 2. Data categories and purposes to inventory

| Data category | Product | Purpose to justify | Current status |
|---|---|---|---|
| Email, display name, password hash | Legacy member account | Account / manual verification | Existing code |
| Session token hash, expiry, timestamps | Website account | Authentication and session control | Existing code |
| Orders and license metadata | Legacy product | Order review and license administration | Schema exists; no recorded orders/licenses found |
| Payment reference text | Legacy product | Manual order reconciliation | Existing field; do not collect card details |
| Model account and session | Model Series | Separate commercial account | Migration drafted; not production |
| Model API key hash, scope, use timestamp | Model Series | Authenticate and meter API access | Migration drafted; no live model API |
| Model prompt/output and usage units | Model Series | Inference and usage accounting | Retention / content processing must be designed; avoid content retention by default |
| Security logs | Both | Abuse prevention, incident response, legal audit | Existing partial audit log; coverage/retention unverified |
| Privacy requests and consent receipts | Both | Handle rights requests and record notice versions | Migration drafted; routes and procedures not yet verified |

Do not request health, biometric, financial-account, national-ID, or other sensitive data unless a documented lawful purpose and specific controls justify it.

## 3. Processors and transfers requiring contract verification

1. **Cloudflare** — hosting, Worker runtime, D1 database, logs and possibly R2 after activation. Obtain the current Data Processing Addendum, subprocessor list, support access, processing locations, transfer mechanisms and security documentation. Cloudflare D1 metadata alone cannot establish the complete data transfer map.
2. **Google Fonts** — currently referenced by the HTML. Prefer removing it to reduce third-party browser calls.
3. **Email provider** — not configured according to repository README. If added, assess role, transfer, security and retention before release.
4. **Payment provider** — not connected. If added, do not store card data in MorningStar D1; use hosted payment components and the provider's compliance documentation.
5. **AI inference provider** — not yet confirmed. Before integrating, compare data retention, training opt-out, abuse monitoring, regional processing, subprocessors, API terms, deletion and DPA. Treat prompts/responses as potentially personal/confidential data.
6. **GitHub** — source code and issue/PR metadata may include contributor identity, email or other personal data. Keep secrets and customer data out of repository contents, issues and CI logs.

## 4. Retention schedule — decisions not yet set

A retention schedule must be created and approved before commercial signup. The table below is a required policy template, not a claim that these periods are currently configured.

| Data | Retention rule to decide | Deletion / exception |
|---|---|---|
| Unverified registrations | Short expiry window | Delete or anonymize after expiry |
| Active account | While active + defined closure period | Subject request subject to legal claims |
| Sessions | Short absolute lifetime; revoke on logout/password reset | Expired sessions purged |
| Password reset tokens | Single-use, very short expiry | Purge on use/expiry |
| Orders and invoices | Statutory tax/accounting period after jurisdiction review | Legal hold / dispute exception |
| License and entitlement records | Contract period + limitation / proof period | Retain minimal evidence |
| API keys | Until revoked/expired | Hash remains only if needed for audit |
| Prompts and outputs | Default not retained for content training; define limited operational retention only if needed | Support ticket / user request / legal hold |
| Usage metadata | Define period for invoicing, abuse and service analytics | Aggregate or anonymize after expiry |
| Security logs | Risk-based fixed period | Restrict access; redact secrets |
| Backups | Rotation and expiry policy | Deletion propagated after backup expiry |
| Privacy request evidence | Legal compliance/audit period | Minimize retained details |

Never invent a legal retention period. The retention period must be linked to a real purpose, governing law, contracts and system deletion behavior.

## 5. Required data-flow diagram

Before launch, map the complete path:
Browser → Cloudflare edge/Worker → D1 / R2 → email/payment/inference processors → support/admin access → logs/backups.

For every edge, identify data fields, purpose, country/region, controller/processor role, contract, retention, encryption, access roles and deletion behavior.
