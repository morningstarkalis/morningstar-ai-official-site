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
