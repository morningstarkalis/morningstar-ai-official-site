# MorningStar AI Official Website

Version: 0.1.0  
Status: initial public website shell

A bilingual (Traditional Chinese / English), responsive, static website for the MorningStar AI research and product platform.

## Modules
- Theory and technical architecture
- Experiments and validation center
- MorningStar Skill commercial center
- Research papers and release history
- Interactive logic-test demonstration
- Membership and licensing information architecture

## Design
- Black + gold default theme
- Optional blue + black theme
- Matrix-inspired rings, grid, and technical labels
- Responsive navigation and bilingual content toggle

## Deploy to Cloudflare Pages (no build required)
This repository is a pure static site. Connect it using **Workers & Pages → Create application → Pages → Connect to Git**.

Use these settings:
- Framework preset: None
- Production branch: main
- Build command: leave blank (or use `exit 0` if the dashboard requires a command)
- Build output directory: `.` (repository root)
- Root directory (advanced): leave blank/default so Pages uses the repository root

Cloudflare Pages will serve the top-level `index.html` on the free `*.pages.dev` address. No custom domain is needed. Git integration automatically deploys new commits to the connected production branch.

## Local preview
Open `index.html` directly in a browser, or serve this directory with any static file server.

## Important status and integrity notes
- The online logic test is a deterministic rule-based frontend demo, not the MorningStar model API and not a benchmark.
- Experimental records are shown as pending until source data, test protocol, rubric, model/version identifiers, and analysis are published.
- MorningStar Skill package download is not enabled until the real package and license terms are attached.
- Membership UI is informational only. No login, payment processing, license issuance, or protected access is implemented.
- Do not place credentials, API keys, private license keys, payment data, or signing secrets in frontend code or this repository.
- Before collecting personal information or selling products, implement a secure backend, privacy policy, terms, support and refund policy.

## Repository
https://github.com/morningstarkalis/morningstar-ai-official-site
