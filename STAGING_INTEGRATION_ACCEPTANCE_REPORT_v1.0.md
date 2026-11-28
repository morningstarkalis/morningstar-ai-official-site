# MorningStar Staging Integration Acceptance Report v1.0

**文件狀態：** 已完成本次限定範圍的 Staging Integration 驗收  
**驗收日期：** 2026-11-28（時間均以 UTC 表示）  
**Repository：** `morningstarkalis/morningstar-ai-official-site`  
**Branch：** `feature/two-product-lines-public-nc`  
**PR：** [#2 — Build separated MorningStar products and sourced publication record](https://github.com/morningstarkalis/morningstar-ai-official-site/pull/2)（維持 Draft、未合併）  
**驗收程式碼基準：** `536fc8a85aa4759a7f42314752fdfe0721c193be`  
**驗收環境：** Staging only；不構成 Production 發布核准。

## 1. 驗收結論

本次 Staging 整合驗收的指定項目均已取得相互對應的證據：

1. **程式碼驗證：** Worker 語法、密碼 KDF、認證稽核契約與 Release Validator 通過；GitHub Actions 的 `validate` job 在驗收程式碼基準上成功。
2. **線上行為驗證：** Staging Worker 健康狀態、初始化狀態、登入限流、管理員 MFA、TOTP 重播拒絕、登出後 Session 失效，以及一般會員管理路由 403 均完成實測。
3. **資料庫稽核驗證：** Migration 0009 的索引存在且欄位順序正確；D1 稽核事件數量與 HTTP 測試相符；測試會員與 Session 已清理，拒絕事件仍保留。

**限定結論：Staging Integration Acceptance = PASS（限本文件列出的測試範圍）。**  
**Production Release Approval = NOT GRANTED。** 本文件不代表 Production 遷移、部署、切換或公開發行已獲批准。

## 2. Staging 部署證據

| 項目 | 驗證值 |
|---|---|
| Worker | `morningstar-ai-official-site-staging` |
| Staging URL | https://morningstar-ai-official-site-staging.morningstarkalis.workers.dev |
| Worker Version ID | `2e6a3c62-261e-433b-8cb0-5a4e48fe11ec` |
| Deployment ID | `e10bcba6-5f0e-4b25-ba3a-c8f9aa36a8a5` |
| 流量比例 | 100% 指向上述版本 |
| Deployment 建立時間 | 2026-11-28 02:24:57.602281 UTC |
| 綁定 D1 | `morningstar-membership-staging-v311` |
| Staging D1 ID | `74cd1491-8d8b-4e56-8ab8-69839ccc60e8` |
| Feature flags | `MODEL_SERIES_ENABLED=false`、`MODEL_ORDER_REQUESTS_ENABLED=false` |

Cloudflare Staging deployments 清單確認最新部署的來源為 Wrangler，且 100% 流量指向本文件所列版本。部署版本的 D1 binding 指向 Staging D1；本次沒有啟用 Model Series。

## 3. Migration 0009 驗收

Migration 檔案：`migrations/0009_security_audit_indexes.sql`

本次已透過 Cloudflare D1 API 對 **Staging D1** 執行下列 DDL：

```sql
CREATE INDEX IF NOT EXISTS idx_audit_log_security_dedupe
ON audit_log (actor_user_id, action, target_type, target_id, created_at);
```

唯讀驗證結果：

- `sqlite_master` 找到 `idx_audit_log_security_dedupe`。
- `PRAGMA index_info` 確認欄位依序為 `actor_user_id`、`action`、`target_type`、`target_id`、`created_at`。
- 驗證查詢回報 `changed_db=false`、`rows_written=0`。

**遷移執行方式說明：** 0009 的索引 DDL 已在 Staging 完成；這不是透過 Wrangler migration runner 執行。既有 Staging D1 的 Wrangler migration tracking 未初始化，因此嚴禁對此資料庫執行 `wrangler d1 migrations apply`，避免重跑 0006／0007 等既有非冪等遷移。Production 未套用 0009。

## 4. 程式碼與 CI 驗證

在驗收程式碼基準 `536fc8a85aa4759a7f42314752fdfe0721c193be`，本機執行結果如下：

| 驗證命令 | 結果 |
|---|---|
| `node --check .\src\worker.js` | PASS |
| `node .\scripts\test_password_kdf.mjs` | PASS |
| `node .\scripts\test_auth_audit.mjs` | PASS |
| `python .\scripts\validate_release.py` | PASS |

Release Validator 涵蓋 migrations 0001–0009、稽核索引、原子化事件去重、必要資料表、產品線隔離及預設關閉的 Model Series 等檢查。

GitHub Actions 的 `validate` job 在同一程式碼基準成功：  
[Workflow run 46097236610](https://github.com/morningstarkalis/morningstar-ai-official-site/actions/runs/46097236610)

**需獨立追蹤的 CI 例外：** 同一 commit 的 Cloudflare `Workers Builds: morningstar-ai-official-site` Check Run 結論為 `failure`（Check Run ID `140831508571`）。GitHub Check Run 回傳內容沒有錯誤註解或可供判定根因的細節，因此本報告不推測失敗原因，也不將此項寫成成功。該失敗狀態必須在 PR 合併前調查並處理。它與本次已部署的 Staging Worker HTTP 驗收分開記錄，不得將任一項的結果代替另一項。

## 5. Staging HTTP 線上行為驗收

測試目標：上述 Staging Worker URL。登入請求使用正確同源 `Origin`。所有回應碼均為實際 HTTP 測試結果。

| 測試 | 預期／實際結果 | 結果 |
|---|---|---|
| `GET /api/health` | HTTP 200；`ok=true`、`database=connected` | PASS |
| `GET /api/setup-status` | HTTP 200；`needs_admin=false`、`bootstrap_configured=false` | PASS |
| 錯誤登入第 1–8 次 | 每次 HTTP 401 | PASS |
| 同一測試識別第 9 次登入 | HTTP 429 | PASS |
| 管理員帳密登入 | HTTP 200 | PASS |
| 無效 TOTP | HTTP 401 | PASS |
| 有效 TOTP | HTTP 200，管理 API 可用 | PASS |
| 同一 TOTP 時間步階重播 | HTTP 409 | PASS |
| 管理員登出 | HTTP 200 | PASS |
| 使用已登出 Session 再呼叫受保護管理路由 | HTTP 401 | PASS |
| 一般會員 Session 呼叫 `GET /api/admin/overview` | HTTP 403 | PASS |

### HTTP 測試補充

- 登入限流測試先前曾因測試請求缺少同源 `Origin` 而得到 HTTP 403；該次不是登入失敗測試，不列入上述 8 次失敗與第 9 次限流計數。正式重測已補上正確 `Origin`。
- 管理員登入、MFA、重播拒絕與登出使用既有 Staging 管理員；未建立第二個管理員，也未旋轉或輸出 TOTP Secret。
- 非管理員測試使用短期 Staging member fixture；HTTP 403 已由實際有效會員 Session 觸發，不是只靠原始碼或離線單元測試推定。

## 6. D1 稽核驗證結果

以下為 Staging D1 對指定稽核 action 的唯讀統計結果：

| Audit action | 記錄數 |
|---|---:|
| `admin.login.failed` | 8 |
| `admin.login.rate_limited` | 1 |
| `admin.login.succeeded` | 2 |
| `admin.totp.invalid` | 1 |
| `admin.mfa.accepted` | 1 |
| `admin.totp.replay_rejected` | 1 |
| `admin.logout` | 2 |
| `admin.access.denied` | 1 |

這是驗收查詢當下對上述 action 的 D1 記錄總數；登入成功與登出各 2 筆包含本次測試前後兩次安全登出流程，不應解讀為只有一組登入／登出請求。

一般會員拒絕事件的資料庫證據為：`admin.access.denied` 一筆，`target_type=admin_route`，目標路由為 `/api/admin/overview`，HTTP method 為 `GET`。這筆事件在測試身分清理後仍保留。

本次稽核查詢均為唯讀：`changed_db=false`、`rows_written=0`。稽核欄位不包含原始密碼、TOTP 驗證碼、Cookie、Session Token 或 Session Token Hash。

## 7. Fixture 清理與資料完整性

測試結束後，以精確條件刪除本次建立的一般會員 fixture 與其 Session；沒有刪除或修改稽核證據。

| 清理後唯讀檢查 | 數量 | 結果 |
|---|---:|---|
| 測試會員殘留 | 0 | PASS |
| 測試 Session 殘留 | 0 | PASS |
| 保留的非管理員拒絕稽核事件 | 1 | PASS |
| Staging active admin 數量 | 1 | PASS |
| 登入限流測試識別的 `auth_attempts` 殘留 | 0 | PASS |

因此，測試會員與 Session 均已清理，正式 Staging 管理員數量仍為 1，且非管理員存取拒絕的稽核證據未被清除。未建立額外管理員。

## 8. Production 隔離證據

本次操作範圍只有 Staging Worker 與 Staging D1。沒有對 Production 執行 Worker 部署、D1 migration、D1 寫入或 Secret 修改。

Cloudflare Production deployments 唯讀清單確認最新 active deployment 仍為：

| 項目 | Production 唯讀觀察值 |
|---|---|
| Worker | `morningstar-ai-official-site` |
| Active Version ID | `96ea2857-9ab1-4d69-b518-63a325b07cec` |
| Deployment ID | `d62bb0de-82ee-4b92-b191-5209f54d5e18` |
| 流量比例 | 100% |
| 建立時間 | 2026-11-27 18:11:22.583465 UTC |

Production 版本與 Staging 新版本不同；Production 最新部署時間早於本次 Staging 部署。這份證據確認本次驗收沒有以 Staging Worker 版本替換 Production active deployment。Production D1 migration 仍未執行。

## 9. 未完成事項與發布限制

本次 Staging Integration 驗收通過，不代表產品可正式公開發行。下列事項仍維持阻擋：

- Cloudflare Workers Builds Check Run 在驗收 commit 上為 failure；須先查明並處理，不能以 GitHub Actions `validate` job 成功取代。
- Model Series 的會員註冊與訂單申請旗標仍關閉；不得為了測試而打開。
- R2 私有儲存與實際模型推論服務尚未配置，因此私人模型檔案交付及真實推論尚未完成端對端驗收。
- MorningStar Skill RC7 的 18 項權利資產仍待權利審查；本報告不授予發行許可。
- Production D1 migration、Production Worker deployment、正式切換及公開發行均未執行。
- 本報告不宣稱獨立滲透測試、法律意見或第三方安全認證已完成。

## 10. 驗收證據索引

1. 本報告所列 Staging Worker deployment metadata 與 100% active traffic。
2. Staging D1 中 Migration 0009 索引的 `sqlite_master` 與 `PRAGMA index_info` 唯讀結果。
3. GitHub Actions `validate` job： [46097236610](https://github.com/morningstarkalis/morningstar-ai-official-site/actions/runs/46097236610)。
4. Cloudflare Workers Builds Check Run： [140831508571](https://github.com/morningstarkalis/morningstar-ai-official-site/runs/140831508571)，狀態為 failure，待調查。
5. Staging HTTP smoke／authentication／MFA／role-denial 測試結果。
6. Staging D1 稽核 action 計數及 fixture 清理後的唯讀查詢結果。
7. Production Worker deployments 清單的唯讀觀察結果。
8. [Staging Deployment Runbook](STAGING_DEPLOYMENT_RUNBOOK.md)。

**最終聲明：** 本文件確認 MorningStar 在指定 Staging 範圍內已形成「程式碼驗證、線上行為驗證、資料庫稽核驗證」三層可交叉核對的驗收紀錄。這項結論只對應本文件列出的版本、環境、時間與測試案例；不得延伸解讀為 Production 已驗收或正式發行已核准。
