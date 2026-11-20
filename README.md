# MorningStar AI Official Website

Bilingual Traditional Chinese / English website and Cloudflare Workers backend.

## Stack
- Cloudflare Workers + Static Assets
- Cloudflare D1 database: `morningstar-membership`
- GitHub Workers Builds on `main`
- Private package bytes stored in D1 for the current 38 KB package; migrate to a private R2 bucket when package size or downloads warrant it.

## Modules
- Public theory, research, and bilingual landing page
- Member registration and sign-in
- HttpOnly, Secure, SameSite=Lax session cookies; server-side session hashes
- Manual email verification by administrator (email delivery provider not configured)
- Personal/research license request, manual order review, license issuance
- Authenticated package download with SHA-256 verification
- Admin bootstrap, member verification, order review, package upload, audit log
- Commercial terms publication is gated and disabled by default pending rights review

## Deploy
Cloudflare Workers Builds settings:
- Git repository: `morningstarkalis/morningstar-ai-official-site`
- Production branch: `main`
- Deploy command: `npx wrangler deploy`
- Root directory: `/`
- Config: `wrangler.jsonc`
- Static assets: `public/`
- Worker API routes: `/api/*`
- D1 binding: `DB`

## First administrator setup
1. In Cloudflare Dashboard, open Worker `morningstar-ai-official-site`.
2. Settings → Variables and Secrets → Production → Add secret.
3. Name: `ADMIN_BOOTSTRAP_TOKEN`. Value: generate at least 32 random bytes (64+ hex characters). Never commit it to GitHub.
4. Deploy the new version.
5. Open the site, create an account only if desired, then use **First administrator setup**. The bootstrap token can be used exactly once. Bootstrap creates the initial admin account and signs it in.
6. Delete or rotate the bootstrap secret after successful initialization.

## Customer workflow
1. Customer registers and signs in.
2. Administrator verifies the customer email (manual; email sending is not yet configured).
3. Customer accepts the original-work license notice and submits a personal/research request.
4. Administrator reviews payment/reference separately and approves/rejects the order.
5. On approval a license is issued. The license key is displayed once to the administrator; the member account has the entitlement and authenticated download.
6. Download requests require a valid session, verified email, and active license. Files are not publicly linked.

## Commercial licensing
Commercial licensing is **disabled by default**. The original work notice is CC BY-NC-ND 4.0 and is not automatically relicensed for commercial use. Before enabling commercial requests, the rights holder must confirm ownership/authorization for commercial additions, exclude non-commercial original content and third-party material, and publish final terms in the administrator console. This workflow is an operational gate, not legal advice. Obtain qualified legal review before taking money.

## Payment and email
- No payment provider is connected. Orders are manual-review requests only; this site does not collect card data or claim that payment is completed.
- No transactional email provider is connected. Email verification is currently performed manually by an administrator.
- Do not enter card numbers, passwords, or secrets into the optional order reference field.

## Security notes / production gate
- Passwords are PBKDF2-HMAC-SHA256 hashes with unique random salts (31,000 iterations); this is a starter configuration optimized for the Workers Free CPU budget, not a substitute for an independent security audit or a dedicated identity provider.
- Sessions are random 256-bit opaque tokens; only SHA-256 hashes are stored in D1.
- Same-origin JSON POST requests, parameterized D1 queries, upload size limits, SHA-256 validation, no-store protected downloads, and admin audit logs are implemented.
- Add managed email verification, password reset, MFA/passkeys, stronger rate limiting, payment-provider webhooks, privacy policy, terms, and security testing before public commercial launch.
- D1 Free plan current limits apply; package storage is capped at 1 MiB per upload in this starter implementation. Move artifacts to private R2 for larger files. R2 is not enabled in the current Cloudflare account connection.

## Repository
https://github.com/morningstarkalis/morningstar-ai-official-site
