# Security Policy

## Scope

This repository includes a public website, Cloudflare Worker code, D1 schema migrations and administrative interfaces. The commercial Model Series runtime and customer data are not included in this repository.

## Reporting a vulnerability

Please do not publish exploitable vulnerability details, credentials, personal data or customer information in public issues or pull requests.

Use GitHub's private vulnerability reporting feature for this repository if it is enabled. If private reporting is unavailable, do not post exploit details publicly; request a private reporting channel from the repository maintainer.

No security bounty or guaranteed response time is offered unless separately announced.

## Testing boundaries

- Do not test against the production website, Worker, D1 database, member accounts, API keys or customer data without written authorization.
- Use the isolated staging Worker and staging D1 configuration for authorized tests.
- Do not upload malware, destructive payloads, real credentials or private customer content.
- Do not attempt denial-of-service, credential stuffing or data exfiltration tests against production.
- Remove test accounts and test artifacts after authorized staging tests.

## Supported state

The current two-product-line branch is a draft candidate. It is not a production security certification. Reported issues must be evaluated against the exact deployed version and environment.
