# MorningStar AI Official Website

Official bilingual portal for the MorningStar ecosystem. This repository contains the public website and its Cloudflare Workers backend; it is not the private model-development repository.

## Product-line separation

### 1. MorningStar Skill — public distribution
- Public-facing, free-to-access Skill releases.
- Non-commercial use only under the exact license and notices shipped with each release.
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

## Website architecture

- Cloudflare Workers + Static Assets
- Cloudflare D1 database: `morningstar-membership`
- Worker API routes: `/api/*`
- Static assets: `public/`
- Configuration: `wrangler.jsonc`

## Deployment

Cloudflare Workers Builds:
- Git repository: `morningstarkalis/morningstar-ai-official-site`
- Production branch: `main`
- Build/deploy command: `npx wrangler deploy`
- Root directory: `/`

Changes in feature branches are not live until reviewed, merged, and deployed.

## Security and release gate

Do not commit API keys, bootstrap tokens, private model assets, private datasets, customer data, or production secrets. The membership backend is an operational mechanism, not proof of legal rights ownership or a substitute for security review. Before public commercial launch, complete independent security testing, privacy and terms review, identity/email hardening, and payment integration review.

## Repository

https://github.com/morningstarkalis/morningstar-ai-official-site
