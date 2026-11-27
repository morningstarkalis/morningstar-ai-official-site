-- RC7 file-level rights/provenance register.
-- Every file is deliberately seeded as pending_review; this migration does not grant rights,
-- approve an asset, or authorize public distribution. Package integrity is a separate fact.
-- Apply only after the migration chain is reconciled with the live D1 schema and backed up.

INSERT OR IGNORE INTO products
(id,title,version,description,original_sha256,file_name,file_size,status,commercial_enabled,created_at)
VALUES
('morningstar-skill-public-rc7',
 'MorningStar Skill Public Non-Commercial Candidate',
 '3.1.2-rc.7',
 'Release candidate only. File-level legal rights and security reviews remain open; not eligible for stable public release.',
 '6e9adf7af1ca161ff225d7367ce5e41f402aeb9ebdf0530970db19607d466771',
 'MorningStar-Skill-v3.1.2-rc.7-Public-NC-Installable.zip',
 37661,'archived',0,'2026-11-28T00:00:00.000Z');

INSERT OR IGNORE INTO commercial_package_manifests
(id,product_id,product_version,package_sha256,file_count,checksums_manifest_verified,manifest_source,created_by,created_at)
VALUES
('rc7-integrity-6e9adf7af1ca',
 'morningstar-skill-public-rc7','3.1.2-rc.7',
 '6e9adf7af1ca161ff225d7367ce5e41f402aeb9ebdf0530970db19607d466771',
 18,1,
 'Local integrity check: ZIP CRC passed; all 17 entries listed in SHA256SUMS.txt matched; SHA256SUMS.txt separately hashed. This proves package integrity only, not copyright ownership, derivative rights, license scope or commercial authorization.',
 'release-integrity-check','2026-11-28T00:00:00.000Z');

INSERT OR IGNORE INTO commercial_rights_assets
(id,product_id,product_version,asset_path,asset_sha256,creator,rights_basis,third_party,third_party_license,commercial_use_allowed,redistribution_allowed,evidence_reference,included_in_package,status,created_at)
VALUES
('rc7-ac01-compatibility-adapter-md','morningstar-skill-public-rc7','3.1.2-rc.7','AC01_COMPATIBILITY_ADAPTER.md','17939e7a824785187679950ae6408e4dc5e2d267ae033153b36bdea71eccc568',
 'Project attribution names Chenxing Chen; file-level authorship, source history and any AI-assisted contributions require evidence review.','pending_determination',0,NULL,0,0,
 'RC7 package SHA-256: 6e9adf7af1ca161ff225d7367ce5e41f402aeb9ebdf0530970db19607d466771; archive member: AC01_COMPATIBILITY_ADAPTER.md; member SHA-256: 17939e7a824785187679950ae6408e4dc5e2d267ae033153b36bdea71eccc568. File integrity is verified by the package checksum list (or separately hashed for SHA256SUMS.txt); this does not prove authorship, ownership, adaptation permission, redistribution permission or commercial rights. Source/provenance and license scope must be assessed against the original book, historical releases, source drafts and any third-party/AI-assisted contributions.',1,'pending_review','2026-11-28T00:00:00.000Z');

INSERT OR IGNORE INTO commercial_rights_assets
(id,product_id,product_version,asset_path,asset_sha256,creator,rights_basis,third_party,third_party_license,commercial_use_allowed,redistribution_allowed,evidence_reference,included_in_package,status,created_at)
VALUES
('rc7-changelog-md','morningstar-skill-public-rc7','3.1.2-rc.7','CHANGELOG.md','e62c2574d5d328579fec2dee677f08c7d51abf380208caa29c7fe36af59083f8',
 'Project attribution names Chenxing Chen; file-level authorship, source history and any AI-assisted contributions require evidence review.','pending_determination',0,NULL,0,0,
 'RC7 package SHA-256: 6e9adf7af1ca161ff225d7367ce5e41f402aeb9ebdf0530970db19607d466771; archive member: CHANGELOG.md; member SHA-256: e62c2574d5d328579fec2dee677f08c7d51abf380208caa29c7fe36af59083f8. File integrity is verified by the package checksum list (or separately hashed for SHA256SUMS.txt); this does not prove authorship, ownership, adaptation permission, redistribution permission or commercial rights. Source/provenance and license scope must be assessed against the original book, historical releases, source drafts and any third-party/AI-assisted contributions.',1,'pending_review','2026-11-28T00:00:00.000Z');

INSERT OR IGNORE INTO commercial_rights_assets
(id,product_id,product_version,asset_path,asset_sha256,creator,rights_basis,third_party,third_party_license,commercial_use_allowed,redistribution_allowed,evidence_reference,included_in_package,status,created_at)
VALUES
('rc7-commercial-core-boundary-md','morningstar-skill-public-rc7','3.1.2-rc.7','COMMERCIAL_CORE_BOUNDARY.md','6c68d3059a82b44b57f5811582b1878d414227921dead92760d5464abc645ac3',
 'Project attribution names Chenxing Chen; file-level authorship, source history and any AI-assisted contributions require evidence review.','pending_determination',0,NULL,0,0,
 'RC7 package SHA-256: 6e9adf7af1ca161ff225d7367ce5e41f402aeb9ebdf0530970db19607d466771; archive member: COMMERCIAL_CORE_BOUNDARY.md; member SHA-256: 6c68d3059a82b44b57f5811582b1878d414227921dead92760d5464abc645ac3. File integrity is verified by the package checksum list (or separately hashed for SHA256SUMS.txt); this does not prove authorship, ownership, adaptation permission, redistribution permission or commercial rights. Source/provenance and license scope must be assessed against the original book, historical releases, source drafts and any third-party/AI-assisted contributions.',1,'pending_review','2026-11-28T00:00:00.000Z');

INSERT OR IGNORE INTO commercial_rights_assets
(id,product_id,product_version,asset_path,asset_sha256,creator,rights_basis,third_party,third_party_license,commercial_use_allowed,redistribution_allowed,evidence_reference,included_in_package,status,created_at)
VALUES
('rc7-license','morningstar-skill-public-rc7','3.1.2-rc.7','LICENSE','583df3f958d2763a5cf328d7b404db9f729e3c8606ae03f7fafeeeecb3e4e932',
 'Project attribution names Chenxing Chen; file-level authorship, source history and any AI-assisted contributions require evidence review.','pending_determination',0,NULL,0,0,
 'RC7 package SHA-256: 6e9adf7af1ca161ff225d7367ce5e41f402aeb9ebdf0530970db19607d466771; archive member: LICENSE; member SHA-256: 583df3f958d2763a5cf328d7b404db9f729e3c8606ae03f7fafeeeecb3e4e932. File integrity is verified by the package checksum list (or separately hashed for SHA256SUMS.txt); this does not prove authorship, ownership, adaptation permission, redistribution permission or commercial rights. Source/provenance and license scope must be assessed against the original book, historical releases, source drafts and any third-party/AI-assisted contributions.',1,'pending_review','2026-11-28T00:00:00.000Z');

INSERT OR IGNORE INTO commercial_rights_assets
(id,product_id,product_version,asset_path,asset_sha256,creator,rights_basis,third_party,third_party_license,commercial_use_allowed,redistribution_allowed,evidence_reference,included_in_package,status,created_at)
VALUES
('rc7-notice-md','morningstar-skill-public-rc7','3.1.2-rc.7','NOTICE.md','1f1f0443f634dc8ce9819c55f3f31149c3284f027158c8606b2678b37a50f29b',
 'Project attribution names Chenxing Chen; file-level authorship, source history and any AI-assisted contributions require evidence review.','pending_determination',0,NULL,0,0,
 'RC7 package SHA-256: 6e9adf7af1ca161ff225d7367ce5e41f402aeb9ebdf0530970db19607d466771; archive member: NOTICE.md; member SHA-256: 1f1f0443f634dc8ce9819c55f3f31149c3284f027158c8606b2678b37a50f29b. File integrity is verified by the package checksum list (or separately hashed for SHA256SUMS.txt); this does not prove authorship, ownership, adaptation permission, redistribution permission or commercial rights. Source/provenance and license scope must be assessed against the original book, historical releases, source drafts and any third-party/AI-assisted contributions.',1,'pending_review','2026-11-28T00:00:00.000Z');

INSERT OR IGNORE INTO commercial_rights_assets
(id,product_id,product_version,asset_path,asset_sha256,creator,rights_basis,third_party,third_party_license,commercial_use_allowed,redistribution_allowed,evidence_reference,included_in_package,status,created_at)
VALUES
('rc7-pending-source-register-md','morningstar-skill-public-rc7','3.1.2-rc.7','PENDING_SOURCE_REGISTER.md','e3639fcd1085cb4258af280b588f9cfd29f9b972b9c3f9123efefbf8b5d444bd',
 'Project attribution names Chenxing Chen; file-level authorship, source history and any AI-assisted contributions require evidence review.','pending_determination',0,NULL,0,0,
 'RC7 package SHA-256: 6e9adf7af1ca161ff225d7367ce5e41f402aeb9ebdf0530970db19607d466771; archive member: PENDING_SOURCE_REGISTER.md; member SHA-256: e3639fcd1085cb4258af280b588f9cfd29f9b972b9c3f9123efefbf8b5d444bd. File integrity is verified by the package checksum list (or separately hashed for SHA256SUMS.txt); this does not prove authorship, ownership, adaptation permission, redistribution permission or commercial rights. Source/provenance and license scope must be assessed against the original book, historical releases, source drafts and any third-party/AI-assisted contributions.',1,'pending_review','2026-11-28T00:00:00.000Z');

INSERT OR IGNORE INTO commercial_rights_assets
(id,product_id,product_version,asset_path,asset_sha256,creator,rights_basis,third_party,third_party_license,commercial_use_allowed,redistribution_allowed,evidence_reference,included_in_package,status,created_at)
VALUES
('rc7-public-release-decision-md','morningstar-skill-public-rc7','3.1.2-rc.7','PUBLIC_RELEASE_DECISION.md','8c3e4959b0323ba791f8faca380f53825f3903fa763c03c7d79d51c120dd23c5',
 'Project attribution names Chenxing Chen; file-level authorship, source history and any AI-assisted contributions require evidence review.','pending_determination',0,NULL,0,0,
 'RC7 package SHA-256: 6e9adf7af1ca161ff225d7367ce5e41f402aeb9ebdf0530970db19607d466771; archive member: PUBLIC_RELEASE_DECISION.md; member SHA-256: 8c3e4959b0323ba791f8faca380f53825f3903fa763c03c7d79d51c120dd23c5. File integrity is verified by the package checksum list (or separately hashed for SHA256SUMS.txt); this does not prove authorship, ownership, adaptation permission, redistribution permission or commercial rights. Source/provenance and license scope must be assessed against the original book, historical releases, source drafts and any third-party/AI-assisted contributions.',1,'pending_review','2026-11-28T00:00:00.000Z');

INSERT OR IGNORE INTO commercial_rights_assets
(id,product_id,product_version,asset_path,asset_sha256,creator,rights_basis,third_party,third_party_license,commercial_use_allowed,redistribution_allowed,evidence_reference,included_in_package,status,created_at)
VALUES
('rc7-readme-md','morningstar-skill-public-rc7','3.1.2-rc.7','README.md','66f1a74021c2188cb5b811804041d8f6085211314b1c1eff3777af9671a8fcde',
 'Project attribution names Chenxing Chen; file-level authorship, source history and any AI-assisted contributions require evidence review.','pending_determination',0,NULL,0,0,
 'RC7 package SHA-256: 6e9adf7af1ca161ff225d7367ce5e41f402aeb9ebdf0530970db19607d466771; archive member: README.md; member SHA-256: 66f1a74021c2188cb5b811804041d8f6085211314b1c1eff3777af9671a8fcde. File integrity is verified by the package checksum list (or separately hashed for SHA256SUMS.txt); this does not prove authorship, ownership, adaptation permission, redistribution permission or commercial rights. Source/provenance and license scope must be assessed against the original book, historical releases, source drafts and any third-party/AI-assisted contributions.',1,'pending_review','2026-11-28T00:00:00.000Z');

INSERT OR IGNORE INTO commercial_rights_assets
(id,product_id,product_version,asset_path,asset_sha256,creator,rights_basis,third_party,third_party_license,commercial_use_allowed,redistribution_allowed,evidence_reference,included_in_package,status,created_at)
VALUES
('rc7-rights-and-licenses-md','morningstar-skill-public-rc7','3.1.2-rc.7','RIGHTS_AND_LICENSES.md','985947c5c15698147d8d5f0bc17d7d9583ed112f6c7b609ab47af471387bfcd1',
 'Project attribution names Chenxing Chen; file-level authorship, source history and any AI-assisted contributions require evidence review.','pending_determination',0,NULL,0,0,
 'RC7 package SHA-256: 6e9adf7af1ca161ff225d7367ce5e41f402aeb9ebdf0530970db19607d466771; archive member: RIGHTS_AND_LICENSES.md; member SHA-256: 985947c5c15698147d8d5f0bc17d7d9583ed112f6c7b609ab47af471387bfcd1. File integrity is verified by the package checksum list (or separately hashed for SHA256SUMS.txt); this does not prove authorship, ownership, adaptation permission, redistribution permission or commercial rights. Source/provenance and license scope must be assessed against the original book, historical releases, source drafts and any third-party/AI-assisted contributions.',1,'pending_review','2026-11-28T00:00:00.000Z');

INSERT OR IGNORE INTO commercial_rights_assets
(id,product_id,product_version,asset_path,asset_sha256,creator,rights_basis,third_party,third_party_license,commercial_use_allowed,redistribution_allowed,evidence_reference,included_in_package,status,created_at)
VALUES
('rc7-sha256sums-txt','morningstar-skill-public-rc7','3.1.2-rc.7','SHA256SUMS.txt','8bb045f3cb3564ea9bd62131ca3c05c33c7acbf8715f2454e4c3083427976652',
 'Project attribution names Chenxing Chen; file-level authorship, source history and any AI-assisted contributions require evidence review.','pending_determination',0,NULL,0,0,
 'RC7 package SHA-256: 6e9adf7af1ca161ff225d7367ce5e41f402aeb9ebdf0530970db19607d466771; archive member: SHA256SUMS.txt; member SHA-256: 8bb045f3cb3564ea9bd62131ca3c05c33c7acbf8715f2454e4c3083427976652. File integrity is verified by the package checksum list (or separately hashed for SHA256SUMS.txt); this does not prove authorship, ownership, adaptation permission, redistribution permission or commercial rights. Source/provenance and license scope must be assessed against the original book, historical releases, source drafts and any third-party/AI-assisted contributions.',1,'pending_review','2026-11-28T00:00:00.000Z');

INSERT OR IGNORE INTO commercial_rights_assets
(id,product_id,product_version,asset_path,asset_sha256,creator,rights_basis,third_party,third_party_license,commercial_use_allowed,redistribution_allowed,evidence_reference,included_in_package,status,created_at)
VALUES
('rc7-skill-md','morningstar-skill-public-rc7','3.1.2-rc.7','SKILL.md','81cbebb664ceda1bbe03f878a6205da96000888daaf02be04d6fcc72f1ec7baa',
 'Project attribution names Chenxing Chen; file-level authorship, source history and any AI-assisted contributions require evidence review.','pending_determination',0,NULL,0,0,
 'RC7 package SHA-256: 6e9adf7af1ca161ff225d7367ce5e41f402aeb9ebdf0530970db19607d466771; archive member: SKILL.md; member SHA-256: 81cbebb664ceda1bbe03f878a6205da96000888daaf02be04d6fcc72f1ec7baa. File integrity is verified by the package checksum list (or separately hashed for SHA256SUMS.txt); this does not prove authorship, ownership, adaptation permission, redistribution permission or commercial rights. Source/provenance and license scope must be assessed against the original book, historical releases, source drafts and any third-party/AI-assisted contributions.',1,'pending_review','2026-11-28T00:00:00.000Z');

INSERT OR IGNORE INTO commercial_rights_assets
(id,product_id,product_version,asset_path,asset_sha256,creator,rights_basis,third_party,third_party_license,commercial_use_allowed,redistribution_allowed,evidence_reference,included_in_package,status,created_at)
VALUES
('rc7-workflow-11-steps-md','morningstar-skill-public-rc7','3.1.2-rc.7','WORKFLOW_11_STEPS.md','1b2a59796ba0b448689c0adecaadb452e8fb84e52bfe393a140b2e5d7edff351',
 'Project attribution names Chenxing Chen; file-level authorship, source history and any AI-assisted contributions require evidence review.','pending_determination',0,NULL,0,0,
 'RC7 package SHA-256: 6e9adf7af1ca161ff225d7367ce5e41f402aeb9ebdf0530970db19607d466771; archive member: WORKFLOW_11_STEPS.md; member SHA-256: 1b2a59796ba0b448689c0adecaadb452e8fb84e52bfe393a140b2e5d7edff351. File integrity is verified by the package checksum list (or separately hashed for SHA256SUMS.txt); this does not prove authorship, ownership, adaptation permission, redistribution permission or commercial rights. Source/provenance and license scope must be assessed against the original book, historical releases, source drafts and any third-party/AI-assisted contributions.',1,'pending_review','2026-11-28T00:00:00.000Z');

INSERT OR IGNORE INTO commercial_rights_assets
(id,product_id,product_version,asset_path,asset_sha256,creator,rights_basis,third_party,third_party_license,commercial_use_allowed,redistribution_allowed,evidence_reference,included_in_package,status,created_at)
VALUES
('rc7-workflow-decision-record-md','morningstar-skill-public-rc7','3.1.2-rc.7','WORKFLOW_DECISION_RECORD.md','1d7a90df3e171577522938f604cb1729b145fcea91a38bd07b5d1d5377965020',
 'Project attribution names Chenxing Chen; file-level authorship, source history and any AI-assisted contributions require evidence review.','pending_determination',0,NULL,0,0,
 'RC7 package SHA-256: 6e9adf7af1ca161ff225d7367ce5e41f402aeb9ebdf0530970db19607d466771; archive member: WORKFLOW_DECISION_RECORD.md; member SHA-256: 1d7a90df3e171577522938f604cb1729b145fcea91a38bd07b5d1d5377965020. File integrity is verified by the package checksum list (or separately hashed for SHA256SUMS.txt); this does not prove authorship, ownership, adaptation permission, redistribution permission or commercial rights. Source/provenance and license scope must be assessed against the original book, historical releases, source drafts and any third-party/AI-assisted contributions.',1,'pending_review','2026-11-28T00:00:00.000Z');

INSERT OR IGNORE INTO commercial_rights_assets
(id,product_id,product_version,asset_path,asset_sha256,creator,rights_basis,third_party,third_party_license,commercial_use_allowed,redistribution_allowed,evidence_reference,included_in_package,status,created_at)
VALUES
('rc7-agents-openai-yaml','morningstar-skill-public-rc7','3.1.2-rc.7','agents/openai.yaml','ec22dd8d4967a4ac18372e684c660928e7d347bf54b3f07f2fc978db6abe350b',
 'Project attribution names Chenxing Chen; file-level authorship, source history and any AI-assisted contributions require evidence review.','pending_determination',0,NULL,0,0,
 'RC7 package SHA-256: 6e9adf7af1ca161ff225d7367ce5e41f402aeb9ebdf0530970db19607d466771; archive member: agents/openai.yaml; member SHA-256: ec22dd8d4967a4ac18372e684c660928e7d347bf54b3f07f2fc978db6abe350b. File integrity is verified by the package checksum list (or separately hashed for SHA256SUMS.txt); this does not prove authorship, ownership, adaptation permission, redistribution permission or commercial rights. Source/provenance and license scope must be assessed against the original book, historical releases, source drafts and any third-party/AI-assisted contributions.',1,'pending_review','2026-11-28T00:00:00.000Z');

INSERT OR IGNORE INTO commercial_rights_assets
(id,product_id,product_version,asset_path,asset_sha256,creator,rights_basis,third_party,third_party_license,commercial_use_allowed,redistribution_allowed,evidence_reference,included_in_package,status,created_at)
VALUES
('rc7-references-ac-01-group-amplification-module-v1-1-md','morningstar-skill-public-rc7','3.1.2-rc.7','references/AC-01_Group_Amplification_Module_v1_1.md','d67ce7b2e022c83a361abd43779babfe2867cb35071b5efb59daccf611872e38',
 'Attribution in inherited file names Chenxing Chen; author/authority statement is not independently established by this registry.','pending_determination',1,'Inherited AC-01 module; preserves its own CC BY-NC-ND 4.0 terms. Contains external source references and explicitly records AI-assisted collaboration; these source and contribution boundaries remain to be separately reviewed.',0,0,
 'RC7 package SHA-256: 6e9adf7af1ca161ff225d7367ce5e41f402aeb9ebdf0530970db19607d466771; archive member: references/AC-01_Group_Amplification_Module_v1_1.md; member SHA-256: d67ce7b2e022c83a361abd43779babfe2867cb35071b5efb59daccf611872e38. File integrity is verified by the package checksum list (or separately hashed for SHA256SUMS.txt); this does not prove authorship, ownership, adaptation permission, redistribution permission or commercial rights. Inherited AC-01 module; preserves its own CC BY-NC-ND 4.0 terms. Contains external source references and explicitly records AI-assisted collaboration; these source and contribution boundaries remain to be separately reviewed.',1,'pending_review','2026-11-28T00:00:00.000Z');

INSERT OR IGNORE INTO commercial_rights_assets
(id,product_id,product_version,asset_path,asset_sha256,creator,rights_basis,third_party,third_party_license,commercial_use_allowed,redistribution_allowed,evidence_reference,included_in_package,status,created_at)
VALUES
('rc7-references-ac-01-license-notice-cc-by-nc-nd-4-0-txt','morningstar-skill-public-rc7','3.1.2-rc.7','references/AC-01_LICENSE_NOTICE_CC-BY-NC-ND-4.0.txt','855246d2e4df0996366aa137c179a31fd0699457b0f92f703b954086794d62a0',
 'Attribution in the inherited notice names Chenxing Chen; separate source/license layer.','pending_determination',0,'Separate inherited AC-01 license notice; retained byte-for-byte from RC6. Do not merge this license layer into the general RC7 license grant.',0,0,
 'RC7 package SHA-256: 6e9adf7af1ca161ff225d7367ce5e41f402aeb9ebdf0530970db19607d466771; archive member: references/AC-01_LICENSE_NOTICE_CC-BY-NC-ND-4.0.txt; member SHA-256: 855246d2e4df0996366aa137c179a31fd0699457b0f92f703b954086794d62a0. File integrity is verified by the package checksum list (or separately hashed for SHA256SUMS.txt); this does not prove authorship, ownership, adaptation permission, redistribution permission or commercial rights. Separate inherited AC-01 license notice; retained byte-for-byte from RC6. Do not merge this license layer into the general RC7 license grant.',1,'pending_review','2026-11-28T00:00:00.000Z');

INSERT OR IGNORE INTO commercial_rights_assets
(id,product_id,product_version,asset_path,asset_sha256,creator,rights_basis,third_party,third_party_license,commercial_use_allowed,redistribution_allowed,evidence_reference,included_in_package,status,created_at)
VALUES
('rc7-references-axioms-original-vs-operational-md','morningstar-skill-public-rc7','3.1.2-rc.7','references/AXIOMS_ORIGINAL_VS_OPERATIONAL.md','5c1d1827197ceacc2b5524ee9f1defd291ba7ee9b8a3f1374b364d2a81eca0af',
 'Project attribution names Chenxing Chen; file-level authorship, source history and any AI-assisted contributions require evidence review.','pending_determination',0,'Compares original theory statements with operational wording; cross-check against the original book and all prior releases before commercial reuse.',0,0,
 'RC7 package SHA-256: 6e9adf7af1ca161ff225d7367ce5e41f402aeb9ebdf0530970db19607d466771; archive member: references/AXIOMS_ORIGINAL_VS_OPERATIONAL.md; member SHA-256: 5c1d1827197ceacc2b5524ee9f1defd291ba7ee9b8a3f1374b364d2a81eca0af. File integrity is verified by the package checksum list (or separately hashed for SHA256SUMS.txt); this does not prove authorship, ownership, adaptation permission, redistribution permission or commercial rights. Compares original theory statements with operational wording; cross-check against the original book and all prior releases before commercial reuse.',1,'pending_review','2026-11-28T00:00:00.000Z');

INSERT OR IGNORE INTO commercial_rights_assets
(id,product_id,product_version,asset_path,asset_sha256,creator,rights_basis,third_party,third_party_license,commercial_use_allowed,redistribution_allowed,evidence_reference,included_in_package,status,created_at)
VALUES
('rc7-references-workflow-source-boundary-md','morningstar-skill-public-rc7','3.1.2-rc.7','references/WORKFLOW_SOURCE_BOUNDARY.md','18e00c203a454d2b6ea68c785aa98099b97252dfff5fd145ee131dbc91a439d7',
 'Project attribution names Chenxing Chen; file-level authorship, source history and any AI-assisted contributions require evidence review.','pending_determination',0,'Describes historical source boundaries; source provenance is documented but ownership of every incorporated expression remains to be confirmed.',0,0,
 'RC7 package SHA-256: 6e9adf7af1ca161ff225d7367ce5e41f402aeb9ebdf0530970db19607d466771; archive member: references/WORKFLOW_SOURCE_BOUNDARY.md; member SHA-256: 18e00c203a454d2b6ea68c785aa98099b97252dfff5fd145ee131dbc91a439d7. File integrity is verified by the package checksum list (or separately hashed for SHA256SUMS.txt); this does not prove authorship, ownership, adaptation permission, redistribution permission or commercial rights. Describes historical source boundaries; source provenance is documented but ownership of every incorporated expression remains to be confirmed.',1,'pending_review','2026-11-28T00:00:00.000Z');

-- Intentionally no row is inserted into commercial_rights_reviews.
-- A review can be recorded only after each file's source, rights basis and applicable
-- license have been checked and the reviewer has documented evidence and exceptions.
