# Browser acceptance — v3.1.1 RC

Date: 2026-11-23 (Asia/Taipei)

Official hostname: https://morningstar-ai-official-site.morningstarkalis.workers.dev/?utm_source=chatgpt.com#account

## Production (current version 19, 100% traffic)
- Homepage title and account anchor: PASS
- Membership section: PASS
- `/api/health`: HTTP 200; D1 connected: PASS
- `/api/products`: HTTP 200; v3.0.0 and v3.1.0 rows returned: PASS
- `/api/setup-status`: HTTP 200: PASS
- Homepage v3.1.0 free product card: FAIL (missing)
- Anonymous v3.1.0 public download API: FAIL (HTTP 404)
- Production acceptance: NOT PASSED

## Preview (Worker version 22)
- Version ID: `5ec2a86d-fe1d-4506-a4bb-79faa76550d8`
- `/api/health`: HTTP 200: PASS
- `/api/products`: both products returned and file_ready=1: PASS
- Anonymous v3.1.0 download: HTTP 200: PASS
- File size: 10,211 bytes: PASS
- SHA-256: `d5405cb7e55a7ff99e67089b3da52f24d7dea27df7513d8bba9cc7a7adeb3e3e`: PASS
- Preview homepage free card: FAIL (missing)

Production remains on version 19. Version 22 is not the production deployment. No member, order or license test records were created.


---

## Isolated RC candidate — integrated browser acceptance (2026-11-23)

Status: **PASS for the two requested browser acceptance targets on one isolated Worker version.**

- Candidate Worker script: `morningstar-ai-official-site-rc-candidate`
- Candidate version: `68f5c705-13ff-4b31-9912-841c31e4fda1` (version number 3)
- Preview URL: https://68f5c705-morningstar-ai-official-site-rc-candidate.morningstarkalis.workers.dev/
- Candidate deployment is isolated from the official Worker service. It is not the production hostname and is not a traffic cutover.
- Homepage source: exact `public/index.html` from branch `release/morningstar-skill-v3.1.1-rc.1`, served from the same candidate Worker version. The HTML is self-contained (inline CSS/JS); this candidate does not use a static-assets upload or an ASSETS binding. The Worker has a D1 binding for the public download route.

### Browser results on the candidate URL

1. Homepage navigation: HTTP 200. Response headers identify `X-MorningStar-RC-Candidate: v3.1.1-rc.1` and `X-Homepage-Source: GitHub RC branch public/index.html`.
2. `#membership`: found.
3. `#ms-free-v310`: found inside the membership section; title and free-edition label rendered.
4. Free download anchor: found at `/api/public-download/morningstar-skill-v3-1-0-free` on the same candidate origin.
5. Browser-origin `fetch()` to the anonymous download endpoint: HTTP 200.
6. Downloaded bytes: 10,211.
7. SHA-256 computed by the browser: `d5405cb7e55a7ff99e67089b3da52f24d7dea27df7513d8bba9cc7a7adeb3e3`.
8. `X-Content-SHA256` response header: same value; exact match.
9. `X-MorningStar-Version`: `3.1.0`.
10. `Content-Disposition`: attachment filename `MorningStar-Skill-v3.1.0-SKILL.md`.
11. Content type: `text/markdown; charset=utf-8`; first three bytes decode to `---`.

### Important implementation boundary

This passing candidate is an **asset-upload bypass for isolated acceptance**, not proof that Cloudflare's static asset upload endpoint has been repaired. The self-contained homepage HTML is embedded in the candidate Worker source to avoid the blocked asset uploader. It demonstrates that the homepage card and anonymous D1-backed download work together in one candidate version. It does not yet prove that the same integrated result is deployed through the official Worker static-assets pipeline.

### Production protection

- Official hostname remains on Worker version 19 (`8ecbbd14-a850-4c64-ba84-6a94e79335f5`) at 100% traffic, rechecked after creating the isolated candidate.
- PR #1 remains open, draft, and unmerged.
- No member, order, payment, or license test records were created.
- The earlier production, v22, and v23 failure records above are retained as historical results; they are not overwritten by this isolated candidate pass.


### Reproducibility artifact

The exact deployed isolated candidate Worker module was also committed to this RC branch at `release-candidate/v3.1.1/rc-acceptance-worker.js`. It embeds the homepage HTML and contains the D1-backed anonymous download handler used by candidate version 3. This source snapshot is an acceptance harness, not the production static-assets build.


---

## Native Workers Static Assets repair — official Worker version 24

Date: 2026-11-23 (UTC; Taipei local date 2026-11-23)

Status: **PASS — real static asset upload, attachment and browser validation completed on a non-production preview version.**

### Upload path diagnosis and repair

- Creating an upload session through the official account API succeeded and returned the short-lived upload JWT plus a one-file bucket.
- The documented account API gateway upload path `/client/v4/accounts/{account_id}/workers/assets/upload?base64=true` returned HTTP 401 with `WWW-Authenticate: Bearer realm="https://api.workers.cloudflare.com/assets/public/upload?base64=true", error="invalid_token"`.
- The successful upload request was then sent from an isolated Cloudflare Worker to the exact Workers Assets Upload service realm: `https://api.workers.cloudflare.com/assets/public/upload?base64=true`, using the session JWT as a Bearer token and multipart Base64 content. The API returned HTTP **201** with a completion JWT.
- The manifest entry was `/index.html`; raw file size was **56,262 bytes**. Hash followed Cloudflare's direct-upload manifest convention: first 32 hex characters of SHA-256 over the Base64 content plus the `html` extension. Hash: `6059501ba7d18634bf5719f0e50ddd94`.
- The completion JWT was attached to an official Worker version upload. The temporary upload-proxy Worker was deleted after use.

### Candidate version 24

- Worker: `morningstar-ai-official-site`
- Version number: **24**
- Version ID: `033aa827-7ae0-42da-abe8-2d8082527cdf`
- Preview URL: https://033aa827-morningstar-ai-official-site.morningstarkalis.workers.dev/
- Version metadata confirms the attached static assets configuration: `html_handling=auto-trailing-slash`, `run_worker_first=["/api/*"]`, `serve_directly=true`, root base path.
- Bindings confirmed: `ASSETS` and D1 `DB` (`028ea21c-486b-47af-8fec-b929d81f7045`).
- The version uses the branch `src/worker.js` and `public/index.html`; it does not embed the homepage HTML in the Worker source.

### Browser acceptance

- Homepage: HTTP 200; title `MorningStar AI — Logic Beyond Learning`.
- `#membership`: found.
- `#ms-free-v310`: found and rendered as the v3.1.0 free public edition card.
- Same-origin download anchor: found at `/api/public-download/morningstar-skill-v3-1-0-free`.
- Browser-origin anonymous fetch: HTTP **200**.
- Download bytes: **10,211**.
- Browser-computed SHA-256: `d5405cb7e55a7ff99e67089b3da52f24d7dea27df7513d8bba9cc7a7adeb3e3e`.
- `X-Content-SHA256`: exact match.
- `X-MorningStar-Version`: `3.1.0`.
- Content-Disposition: `attachment; filename="MorningStar-Skill-v3.1.0-SKILL.md"`.
- Content type: `text/markdown; charset=utf-8`.
- Download begins with Markdown front matter `---`.

### Deployment safeguard

- Version 24 was created as a previewable version only; no deployment was created for it.
- The official Worker deployment remained at version `8ecbbd14-a850-4c64-ba84-6a94e79335f5` with **100%** traffic in the post-upload deployment check.
- PR #1 remains draft/open/unmerged.
- This repair establishes that the native Cloudflare static asset upload pipeline can work via its Workers Assets service endpoint from a Worker runtime. It does not change production traffic or merge the source PR.
