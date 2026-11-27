# MorningStar Rights & Provenance Audit

**As-of:** 2026-11-28  
**Status:** OPEN — NO RELEASE CLEARANCE GRANTED  
**Scope:** Existing public website, sampled WordPress archive, live D1 rights registry, RC7 installable ZIP, inherited modules and AI-assisted material.

## Executive result

No complete legal rights clearance has been established. The current evidence supports archive integrity and an initial provenance register, but does not establish ownership or authorization for every expression, third-party work, derivative work, or AI-assisted contribution.

### Live Cloudflare D1 read-only evidence

Read-only production queries on 2026-11-28 found:

| Item | Observed result |
|---|---:|
| v3.0.0 file-level rights assets | 26 |
| v3.0.0 assets with status pending_review | 26 |
| Approved rights review rows | 0 |
| Package integrity manifest rows | 1 |
| Registered product editions | v3.0.0 Commercial Edition; v3.1.0 free public edition |
| Existing product orders | 0 |
| Existing product licenses | 0 |

The v3.0.0 manifest records 26 files and confirms all 25 entries in SHA256SUMS.txt matched, with the checksum file separately hashed. This proves integrity, not authorship or legal permission.

### RC7 archive integrity evidence

- File: MorningStar-Skill-v3.1.2-rc.7-Public-NC-Installable.zip
- SHA-256: 6e9adf7af1ca161ff225d7367ce5e41f402aeb9ebdf0530970db19607d466771
- ZIP CRC: passed in local check.
- ZIP members: 18.
- SHA256SUMS entries: 17/17 matched; the manifest itself was separately hashed.
- AC-01 group amplification module and its separate license notice were byte-identical to the RC6 source archive.
- The 11-step workflow block was byte-identical to RC6.
- These checks establish package identity and continuity only. They do not prove copyright title, derivative-work permission, commercial use, redistribution, or sublicense rights.

The branch's migrations/0004_rc7_rights_inventory.sql registers 18 package members as pending_review; it intentionally records no approved rights review. This migration has not been applied to production D1.

## File-by-file review priorities

1. SKILL.md: compare every retained paragraph against the original source book, earlier versions, and the 11-step workflow source. Distinguish original expression, newly written operational text, and AI-assisted text.
2. references/AC-01_Group_Amplification_Module_v1_1.md: preserve its own CC BY-NC-ND 4.0 notice. Check all cited source materials, derivative expression, author/contributor statements and whether any third-party material is quoted or adapted.
3. references/AC-01_LICENSE_NOTICE_CC-BY-NC-ND-4.0.txt: separate inherited license notice; do not merge it into the general release grant.
4. benchmark/cases.json and rubrics/templates: identify who wrote each question, whether any case text derives from a third party, and whether AI generated or substantially contributed to wording.
5. Scripts and code: preserve source drafts, commit history, AI assistance records and third-party dependencies; run code provenance and license scans.
6. README, NOTICE, LICENSE, CHANGELOG, and source boundary files: distinguish factual metadata from protected expression and verify the origin of every license notice.
7. Every third-party quotation, academic source, image, font, icon, dataset, model output or benchmark: record source URL/DOI, author, date, exact portion used, license, attribution, modifications, commercial-use permission and redistribution permission.

## Historical releases and website archive

- The official website database records v3.1.0 as a public release whose new material was described as CC BY 4.0 to the extent rights are controlled by the publisher, with inherited and third-party material retaining their own terms. Do not retroactively impose RC7's non-commercial license on v3.1.0.
- Sampled WordPress historic posts contain CC BY-NC-SA 4.0 statements. This is a sample, not a completed archive inventory. Each page and embedded asset must be classified separately. CC BY-NC-SA content cannot simply be relabeled with a new CC BY-NC-ND grant.
- AC-01 has its own CC BY-NC-ND 4.0 notice and must remain a separate licensing layer.
- Do not delete historic release records or replace old public license notices to make the current product strategy appear uniform.

## AI-assisted content and source originality

Taiwan Intellectual Property Office guidance distinguishes human creative contribution using AI as a tool from output generated solely by AI computation. It also warns that AI output may be substantially similar to source works and that provider terms / sublicensing scope matter. For each AI-assisted file, retain:
- human instructions, outlines and draft text;
- human selection, arrangement, revision and final editorial decisions;
- model/provider, terms applicable at the time, and prompt/output records where lawful to retain;
- source similarity review and third-party rights decision;
- the precise text or code portions for which human authorship is claimed.

A model response or file hash alone is not proof of copyright ownership.

## Required evidence per asset

Every record must contain:
- exact version, archive path and SHA-256;
- creator/contributor and relationship to the work;
- source repository, original manuscript or dated source evidence;
- rights basis: original author, assignment, separate license, public domain, or open-source license;
- if third-party: publisher, license URL/version, attribution, modifications and commercial/redistribution rights;
- AI assistance disclosure and human contribution evidence, where relevant;
- inclusion decision (included / excluded / replaced);
- reviewer, date, evidence, exceptions and revocation reason if later changed.

## Release rule

A package is not rights-cleared until every included file is approved, every excluded file is removed from the package, all required notices are present, and a reviewer records a rights review for the exact package SHA-256. Do not approve based solely on a creator checkbox or a global README assertion.

**Current release decision:** RC7 remains a candidate. No stable release download is authorized by this report.
