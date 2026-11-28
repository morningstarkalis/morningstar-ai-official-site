# GitHub Release and Repository Governance

**Maintainer:** @morningstarkalis  
**Current state:** repository is public; the two-product-line PR is still draft. Branch protection and stable GitHub Releases are not yet configured.

## Repository control

Recommended GitHub repository settings for the default branch `main`:

- Require pull requests before merging.
- Require the `MorningStar validation / validate` status check.
- Require CODEOWNER review.
- Require conversation resolution.
- Block force pushes and branch deletion.
- Restrict direct pushes to the repository owner.
- Protect release tags matching `v*`; do not allow tag updates or deletion.
- Enable private vulnerability reporting if available.
- Keep GitHub Actions permissions read-only by default; grant write permissions only to a dedicated release workflow.

The repository includes `.github/CODEOWNERS` assigning all paths to `@morningstarkalis`. This alone does not enforce review until the GitHub branch rules are enabled in repository settings.

## MorningStar Skill release

A GitHub Release may be created only after:
1. Every file in the exact Skill ZIP has an approved rights/provenance record.
2. Historical and third-party license notices are preserved.
3. The package SHA-256 matches the rights review and release manifest.
4. Independent security and clean-installation evidence is recorded.
5. The exact release version is marked stable/published in the Worker release registry.
6. The public website download route returns the same ZIP and verifies its SHA-256.

Attach:
- the exact installable ZIP;
- SHA-256 checksum file;
- version-specific license and third-party notices;
- release notes and supported platform instructions.

Do not attach RC7 while any rights asset is pending or any release gate is missing.

## Model Series separation

Never attach private model weights, training/fine-tuning/distillation datasets, runtime secrets, customer data, private deployment configuration or paid API credentials to this public repository or a public GitHub Release.

Model Series releases must use private storage and server-side entitlement checks. The public repository may contain the gateway contract, public API documentation and non-secret client examples only after rights/security review.

## Historical releases

Do not overwrite, delete or retroactively relabel historical release assets to impose a later non-commercial license. Preserve each version's original notices and immutable checksums.
