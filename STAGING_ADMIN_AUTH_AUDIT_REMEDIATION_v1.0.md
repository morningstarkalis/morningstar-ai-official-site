# MorningStar Staging｜稽核紀錄與權限邊界修正 v1.0

**文件狀態：** 原始修正紀錄；部署後驗收已於 2026-11-28 完成，現況以本文件開頭的更新附記及 [Staging Integration Acceptance Report v1.0](STAGING_INTEGRATION_ACCEPTANCE_REPORT_v1.0.md) 為準。  
**適用 Worker：** `morningstar-ai-official-site-staging`  
**適用 D1：** `morningstar-membership-staging-v311`  
**開發分支：** `feature/two-product-lines-public-nc`  
**PR：** [#2 — Build separated MorningStar products and sourced publication record](https://github.com/morningstarkalis/morningstar-ai-official-site/pull/2)  
**Production：** 不在本次執行範圍內。

> **部署後狀態更新｜2026-11-28（UTC）**
>
> 本文件第 4、6、8、9 節的「0009 尚未套用」、「Staging Worker 尚未部署」及「非管理員 HTTP 403 尚未完成」等敘述，是部署前的歷史狀態快照，已由後續驗收結果取代，不再代表目前狀態。
>
> - Migration 0009 的索引 DDL 已透過 Cloudflare D1 API 套用至 Staging D1，並以 `sqlite_master` 與 `PRAGMA index_info` 唯讀確認索引及欄位順序。Production 未套用。
> - Staging Worker `morningstar-ai-official-site-staging` 已部署，Version ID 為 `2e6a3c62-261e-433b-8cb0-5a4e48fe11ec`，Deployment ID 為 `e10bcba6-5f0e-4b25-ba3a-c8f9aa36a8a5`，100% Staging 流量指向該版本。
> - 登入限流、管理員登入、無效／有效／重播 TOTP、登出後 Session 失效及一般會員管理路由 HTTP 403 均已完成線上測試。
> - 測試會員與 Session 清理後均為 0；非管理員拒絕稽核事件保留 1 筆；Staging active admin 數量仍為 1。
> - Production Worker active Version 仍為 `96ea2857-9ab1-4d69-b518-63a325b07cec`；本次沒有執行 Production Worker 部署、D1 migration 或 D1 寫入。
> - GitHub Actions `validate` job 在驗收 commit 通過，但 Cloudflare Workers Builds Check Run `140831508571` 為 failure，必須在 PR 合併前另行調查。不得將其記為通過。
>
> 完整命令結果、HTTP 回應、D1 action 數量、索引證據、Fixture 清理及 Production 隔離資料，均以 [MorningStar Staging Integration Acceptance Report v1.0](STAGING_INTEGRATION_ACCEPTANCE_REPORT_v1.0.md) 為正式驗收依據。

## 1. 修正目的

補齊管理員認證、MFA、權限拒絕與 Session 終止的持久稽核事件，同時限制重複事件造成的資料庫寫入量。既有帳密驗證、TOTP 時間步階重播防護、角色檢查、Session Cookie 屬性及產品功能旗標維持 fail-closed。

本次不建立測試管理員、不新增繞過 MFA 的端點、不修改任何 Secret，也不將一般會員升權。

## 2. 稽核事件矩陣

| 事件 | Action | 觸發條件 | 保存內容 |
|---|---|---|---|
| 登入密碼失敗 | `admin.login.failed` | 帳密錯誤或帳戶非 active | 雜湊身分參照、嘗試序號及統一失敗原因 |
| 登入限流 | `admin.login.rate_limited` | 15 分鐘內已有 8 次失敗 | 雜湊身分參照、門檻及時間窗；每身分每窗最多一筆 |
| 一般會員嘗試管理員登入 | `admin.login.denied_role` | 密碼正確但 role 不是 admin | 使用者 ID 與角色，不建立管理員 Session |
| 管理員登入成功 | `admin.login.succeeded` | 管理員密碼驗證成功 | 管理員 ID 與 Session 期限，不記錄憑證 |
| 管理路由角色拒絕 | `admin.access.denied` | 有效 Session 的非管理員呼叫管理 API | 使用者 ID、正規化路由及 HTTP method；同一使用者／路由 60 秒內去重 |
| TOTP 無效或缺少 | `admin.totp.invalid` | 管理員 Session 存在但 TOTP 不正確或未提供 | 管理員 ID、路由、錯誤類別；60 秒內去重 |
| TOTP 重播拒絕 | `admin.totp.replay_rejected` | 已用過或不再遞增的時間步階 | 管理員 ID、時間步階及路由；同一時間步階去重 |
| MFA 成功 | `admin.mfa.accepted` | 新的 TOTP 時間步階被接受 | 管理員 ID、路由及時間步階，不保存六位數代碼 |
| 管理員登出 | `admin.logout` | 有效管理員 Session 主動登出 | 管理員 ID 與 Session 已撤銷狀態 |

既有稽核列不會被改名或刪除。新成功登入使用 `admin.login.succeeded`，不再使用容易誤導的 `member.login` action 名稱。

## 3. 敏感資料最小化

- 不記錄明文密碼、原始電子郵件、TOTP 代碼、Cookie、Session Token 或 Session Token Hash。
- 登入失敗與限流以既有 SHA-256 email key 作為 `target_id`。這是**假名化識別碼，不是匿名資料**；仍應依內部安全日誌保存期限控管。
- TOTP 稽核只保存時間步階整數及正規化路由，不保存提交的驗證碼。
- 登出事件不記錄 Session Token Hash。
- HTTP 500 對外仍使用通用錯誤訊息；不把內部資料庫錯誤或憑證資訊回傳給呼叫端。

## 4. 重複事件去重與資料庫索引

`auditOnceWithin()` 使用單一 SQLite `INSERT ... SELECT ... WHERE NOT EXISTS` statement 原子化去重，避免先查後寫的併發競態。

去重窗口：
- 登入限流：相同身分參照 15 分鐘內最多一筆。
- 非管理員權限拒絕：相同使用者／路由 60 秒內最多一筆。
- TOTP 無效：相同使用者／路由 60 秒內最多一筆。
- TOTP 重播：相同管理員／時間步階最多一筆。

新增 `migrations/0009_security_audit_indexes.sql`，建立下列非唯一索引：

```sql
CREATE INDEX IF NOT EXISTS idx_audit_log_security_dedupe
ON audit_log (actor_user_id, action, target_type, target_id, created_at);
```

**遷移狀態：** 0001–0008 已先前套用至 Staging；0009 目前只提交在開發分支，尚未套用 Staging 或 Production。既有 Staging D1 的 Wrangler migration tracking 未初始化，因此不可對此資料庫執行 `wrangler d1 migrations apply`，避免重跑舊的非冪等遷移。

## 5. Session 登出一致性

`/api/auth/logout` 在辨識到有效使用者 Session 時，使用 D1 `batch()` 將稽核事件寫入與該 Session 的刪除一併提交。若批次失敗，資料庫不應只完成其中一項。

本路由只撤銷目前瀏覽器所持有的 Session，不會撤銷該管理員在其他裝置或瀏覽器的 Session。逾期或無效 Token 仍會嘗試刪除其對應 Session 列，但不會為無法識別的使用者建立管理員登出事件。

## 6. 權限邊界

- `requireUser()`：無有效 Session 時回傳 HTTP 401。
- `requireAdmin()`：有效 Session 但角色不是 `admin` 時，記錄 `admin.access.denied`，再回傳 HTTP 403。
- `requireAdminMfa()`：先通過管理員角色，再要求有效且尚未使用過的 TOTP 時間步階。
- 管理員敏感 API 仍要求 `X-Admin-TOTP`；未新增任何免 MFA 路徑。
- 登出不要求 MFA，以確保使用者任何時候均可撤銷自己的目前 Session。

**動態測試缺口：** 目前沒有可安全使用的非管理員 legacy Session。原始碼角色拒絕分支及 CI 契約檢查存在，但 HTTP 403 的非管理員端對端測試尚未完成。不可將這項測試記為通過。

## 7. 程式與 CI 驗證

本分支新增：
- `scripts/test_auth_audit.mjs`：檢查安全事件、資料最小化、管理員路由拒絕及 Session 登出批次契約。
- `scripts/validate_release.py`：將 0009 納入 SQLite migration chain，驗證索引存在，並實際執行一次去重 SQL 測試，確認第一次新增一列、重複事件新增零列。
- `.github/workflows/validate.yml`：在 CI 執行上述管理員認證稽核測試。

CI 通過只證明分支程式、靜態契約及離線 SQLite 測試通過，不代表新 Worker 已部署或 Staging 的 HTTP 動態回歸已完成。

## 8. Staging 部署前檢查清單

- [ ] 確認 GitHub PR #2 仍為 Draft，且目標分支為 `main`。
- [ ] 確認本文件所對應的最新 branch head CI 全部成功。
- [ ] 只在 Staging D1 套用 0009，並以唯讀查詢確認索引存在。
- [ ] 保留本機 `wrangler.staging.jsonc` 的既有設定；不得用 Production 設定覆蓋。
- [ ] 只部署至 `morningstar-ai-official-site-staging`。
- [ ] 確認 Staging Worker 的 100% 流量指向新版本。
- [ ] 重新執行登入失敗／429、TOTP invalid／replay／success、Session logout、安全標頭測試。
- [ ] 使用受控的一般會員 Session 補做管理 API HTTP 403 測試；測完清除測試身分與 Session。
- [ ] 以唯讀方式確認新增稽核 action，且事件中不存在密碼、TOTP、Cookie 或 Session Token。
- [ ] Production Worker、Production D1、Production Secrets 均保持不變。

## 9. 本次完成狀態

| 項目 | 狀態 |
|---|---|
| Worker 稽核邏輯修正 | 已提交開發分支 |
| 0009 索引遷移 | 已提交；Staging 尚未套用 |
| CI 稽核契約測試 | 已加入 workflow；需以最新 head CI 結果為準 |
| SQLite 去重語句驗證 | 已加入 release validator |
| Staging Worker 新版本部署 | 尚未執行 |
| Staging 新版本 HTTP 回歸 | 尚未執行 |
| 非管理員 HTTP 403 動態測試 | 尚未完成 |
| Production 遷移／部署 | 未執行；不屬於本次範圍 |

**驗收結論：** 稽核紀錄與權限邊界的程式修正已完成開發分支提交。只有在 0009 套用、Staging 新版本部署、HTTP 回歸及非管理員 403 測試完成後，才能宣告 Staging 本階段驗收通過。
