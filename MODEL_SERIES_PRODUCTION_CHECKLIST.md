# Model Series Production Activation Checklist

**Status:** Not ready for production activation  
**Applies to:** /model.html, /api/model/*, /api/admin/model/*  
**Current feature flags:** Must remain disabled until every applicable gate is complete.

## Required Cloudflare resources

1. Enable Cloudflare R2 for the account.
2. Create a private bucket dedicated to Model Series artifacts (suggested name: `morningstar-model-artifacts`).
3. Add the Worker R2 binding named `MODEL_ARTIFACTS`; do not enable public bucket access or public object URLs.
4. Deploy a separate inference Worker/service named `morningstar-model-inference` only after the actual MorningStar model runtime and model artifacts exist.
5. Add a Worker Service Binding named `MODEL_INFERENCE` to that inference service.
6. Set a high-entropy Worker Secret `MODEL_INFERENCE_SECRET` on both the gateway and inference service. Never commit it.
7. Configure staging bindings first. Production must use production D1 and a production private bucket only after the staging end-to-end tests pass.

## Required secrets and flags

| Name | Purpose | Current requirement |
|---|---|---|
| `ADMIN_TOTP_SECRET` | One-use TOTP for administrator actions | Required before admin controls can be used |
| `ADMIN_BOOTSTRAP_TOKEN` | One-time first-admin bootstrap | Remove immediately after successful bootstrap |
| `MODEL_INFERENCE_SECRET` | Authenticate internal Worker-to-Worker inference calls | Required |
| `MODEL_SERIES_ENABLED` | Allow member registration and sign-in | Keep unset/false until legal and security gates pass |
| `MODEL_ORDER_REQUESTS_ENABLED` | Allow commercial license requests | Keep unset/false until commercial terms and manual payment/contract process are approved |

The current repository does not configure these production bindings or secrets. Do not infer they exist because route code references their names.

## Legal and operational prerequisites

- Publish a reviewed privacy notice, terms of service, commercial model license and API terms through the admin workflow.
- Record a real external legal-review evidence reference for each document. The reference field is an audit pointer, not an automatic legal verification.
- Complete the data map, processor/subprocessor contracts, cross-border transfer assessment, retention/deletion schedule and privacy request workflow.
- Establish the legal entity/operator identity, customer support contact, tax/invoice treatment, commercial pricing, payment/settlement and cancellation/refund policy.
- Define the exact model product version, capabilities, limitations, permitted use, prohibited use, support and service-level commitments.
- Confirm model weights, datasets, training/fine-tuning/distillation sources and every artifact have distribution/deployment rights for the intended territory and commercial use.

## Security and runtime prerequisites

- Verify private R2 bucket access is denied anonymously and no public custom domain exposes objects.
- Run malware scanning and archive safety checks before changing any artifact from quarantined to available.
- Confirm object SHA-256 on upload, approval, publication and download.
- Test entitlement checks for wrong member, wrong product, expired/revoked license, wrong API scope, quota exceeded, suspended member and withdrawn artifact.
- Confirm API keys are displayed once, stored hashed, scope-limited, expiring and revocable.
- Test rate limiting and abuse controls against distributed credential stuffing and API-key abuse.
- Benchmark PBKDF2 at 600,000 iterations on the actual Workers plan. If CPU limits are exceeded, move authentication to a suitable managed identity service rather than silently weakening password storage.
- Confirm inference worker authenticates the service binding secret, enforces request/output limits, does not retain prompts by default, and reports auditable usage units.
- Run SAST, dependency/SCA, DAST, independent penetration test, backup restore and incident-response tabletop.

## End-to-end test sequence

1. Register a test member with current privacy/terms consent.
2. Confirm member remains pending until manual verification evidence is recorded.
3. Verify member; sign in; test session expiry/logout.
4. Create a test commercial order request; approve only after test contract and settlement evidence.
5. Confirm a license is created with the intended scopes and quota.
6. Create two API keys with different scopes; confirm one cannot use the other's scopes.
7. Call inference through the internal service binding; confirm usage accounting and quota enforcement.
8. Upload a harmless test ZIP into quarantine; verify SHA; record malware and rights evidence; approve.
9. Confirm anonymous artifact download is denied; active download license succeeds; revoked/expired license fails.
10. Revoke the license and API key; confirm all protected endpoints immediately deny access.
11. Submit privacy access and deletion requests; verify the operational response and deletion/retention exception behavior.
12. Confirm all logs redact raw API keys, passwords, prompt content and personal data not needed for audit.

## Go / No-Go

Until the above resources, legal documents, runtime and tests exist, Model Series remains a private development product and the portal must display its disabled state. A code path or schema alone does not make the commercial AI model operational.
