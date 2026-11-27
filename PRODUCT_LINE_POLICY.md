# MorningStar Product-Line and Rights Boundary

**Document status:** Governance draft for review  
**Owner:** MorningStarKaLis / 陳晨星

## 1. Strategic objective

MorningStar operates two independent product lines. Public distribution is intended to increase access, adoption, feedback, and visibility. Commercial model development remains separately controlled by the rights holder.

## 2. Product Line A — MorningStar Skill

- Public distribution; free access.
- Non-commercial use only, subject to the exact license accompanying each release.
- Each release must identify its version, checksum, release status, included files, third-party materials, inherited modules, and applicable license notices.
- Do not label a non-commercial source-available release as OSI Open Source.
- Do not imply that historical releases are retroactively relicensed.

## 3. Product Line B — MorningStar AI Model Series

Separately controlled commercial products. The public Skill repository must not contain:
- private model weights or checkpoints;
- private training, fine-tuning, or distillation pipelines;
- private datasets, evaluation answer keys, or customer data;
- proprietary orchestration and deployment code;
- API credentials, signing keys, production configuration, or infrastructure secrets;
- unreleased commercial prompts, internal benchmarks, or confidential roadmaps.

Commercial products must have independent repositories, access controls, release procedures, terms, and customer licensing.

## 4. Rights and license scope

A license applies only to identified materials that the licensor owns or is authorized to license. Third-party materials, inherited modules, historical versions, trademarks, and AI-assisted contributions require separate provenance and rights review. The public license does not grant access to private model assets and does not establish exclusive rights over abstract ideas, methods, systems, or independently developed implementations.

## 5. Website information architecture

The official website should provide:
1. A prominent two-product-line overview.
2. A public Skill page with current stable release, candidate status, installation guide, license, notices, and checksum.
3. A separate Model Series page describing only verified public product information and a contact/licensing path when ready.
4. A visible statement that the public Skill is not the commercial model product.
5. Historical release records that preserve their original license notices.

## 6. Publication gates

A Skill release is not stable until package integrity, checksum, secret scan, rights/provenance review, installation testing, and release notes are complete. RC7 remains a release candidate until its remaining security and rights gates are closed.

A commercial model product is not launch-ready until ownership/authorization, model and data security, deployment controls, privacy, customer terms, and operational support are reviewed.

## 7. Non-goals and limitations

This policy is an operational boundary, not a legal opinion. It cannot by itself prevent independent development of similar ideas or methods. Trade-secret protection depends on maintaining secrecy and reasonable safeguards. Obtain qualified legal review for final license and commercial terms.


## 7. Separate publication record

《邏輯無間：晨星起源》 is presented as a separate publication record at `/book.html`. Its publisher-console metadata and visible synopsis are not the MorningStar Skill software license and do not constitute Model Series commercial entitlements.

Public book status must be stated from evidence:
- A publisher-console edit screen may establish that a book record exists in the account.
- An account-level initial policy review notice does not prove that the individual book has passed review.
- A public Google Play Books listing, purchase availability, author/contributor details, ISBN, price and territories must be verified from the actual public listing or corresponding publisher metadata before being claimed.
- Do not publish internal publisher-console identifiers or account data.
- Use the original high-resolution cover only after it is supplied or exported from the platform; do not upscale a low-resolution dashboard thumbnail and represent it as the original.
