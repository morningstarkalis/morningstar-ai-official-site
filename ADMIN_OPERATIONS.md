# MorningStar 管理員操作與發布流程

**適用版本：** two-product-lines branch / Worker API vNext  
**狀態：** 操作說明草案；正式啟用前必須完成 staging、正式環境遷移及部署驗收。

## 1. 管理控制台

正式部署後，管理入口為：

- `/admin.html`

此頁只提供管理介面。它不代表後端已部署，也不代表管理員已完成 MFA。所有敏感 API 均在 Worker 端驗證管理員 Session 與 TOTP。

## 2. 首次建立唯一管理員

1. 在 Cloudflare Dashboard 開啟 Workers & Pages，選擇 `morningstar-ai-official-site`。
2. 在 Settings → Variables and Secrets，新增 Secret：`ADMIN_BOOTSTRAP_TOKEN`。使用密碼管理器產生高熵隨機值，不要放進 GitHub、網站 HTML、聊天紀錄或一般環境變數。
3. 確認正式 D1 已完成核准的 schema migration，且管理員初始化流程已部署。
4. 開啟 `/admin.html`，使用一次性 Bootstrap Token 建立唯一管理員帳戶。
5. 管理員建立成功後，立即移除 `ADMIN_BOOTSTRAP_TOKEN` Secret。初始化端點本身也只允許在尚無管理員時成功。
6. 產生一組 Base32 TOTP secret，加入可信任的驗證器 App；將同一組 secret 作為 Cloudflare Worker Secret `ADMIN_TOTP_SECRET` 設定。不要把密鑰傳給任何人或提交到儲存庫。
7. 重新載入管理頁，使用管理員帳密登入，再用驗證器的 6 位數代碼執行 MFA 驗證。

**注意：** 更新 Worker Secret 可能建立並部署新的 Worker 版本。請先確認目標是 staging 還是 production；不要在尚未完成測試時修改正式 Worker。

## 3. MFA 行為

- TOTP 採 6 位數、30 秒時間步長。
- Worker 接受目前時間步及前後各一個時間步，以容許有限時鐘偏差。
- 每個管理員時間步只能成功使用一次；重播會被拒絕。
- 管理頁每次敏感操作都要求輸入新的 TOTP。不要重複使用上一個代碼。
- 若管理員遺失驗證器，需依正式復原流程輪替 `ADMIN_TOTP_SECRET`；不可在程式碼中加入繞過 MFA 的後門。

## 4. MorningStar Skill 發布順序

1. 建立候選版本並固定 ZIP SHA-256。
2. 逐一審查每個套件成員檔案的作者、來源、原始授權、衍生關係、AI 協作情況及再散布權利。
3. 對無法清權的檔案，從套件排除；排除後必須重新建置 ZIP、重新計算 SHA-256，並更新 manifest 及 rights register。
4. 取得真實且可追溯的外部法律審查證據；不得以管理員自行勾選代替法律清權。
5. 在管理控制台逐項記錄資產審查，建立與精確 package SHA-256 綁定的整體權利審查紀錄。
6. 完成資安測試及乾淨環境安裝測試，保存可重現的報告。
7. 將精確 ZIP 放入 Worker 靜態資產的 `/releases/skill/` 路徑；管理控制台會重新計算 SHA-256，只有完全相符才接受。
8. 記錄 rights、security、installation 三道閘門。
9. 最後才執行發布。Worker 會再次核對檔案、雜湊、權利審查與所有閘門。

RC7 目前所有 18 筆資產仍是 pending review，沒有 rights/security/installation gate，也沒有掛載正式下載檔案；因此不得發布。

## 5. Model Series 狀態

目前 Model Series API 明確 fail-closed。正式開放前至少必須具備：

- 獨立會員註冊、驗證、登入、復原、停權與刪除流程；
- 已經法律審查並發布的隱私告知、服務條款、商業模型授權及 API 條款；
- 獨立商業授權、API key scope、期限、撤銷、配額與用量計量；
- 已啟用且經匿名存取測試的私有 R2 bucket；
- 真正可運作的模型推論服務與已核准的模型版本；
- 私有下載的伺服器端 entitlement 檢查、檔案完整性與存取稽核；
- 支付、稅務／發票、取消／退款、客服及消費者權益流程（如採收費模式）。

不能把只有資料表、管理頁或 API 路由當作已完成的 AI 模型產品。

## 6. 不可做的事

- 不要把 RC7 候選 ZIP 放入公開網站或 GitHub Release，直到權利、資安、安裝三道閘門完成。
- 不要把私人模型權重、資料集、訓練管線、客戶資料或生產憑證放進公開儲存庫。
- 不要把舊版 CC BY 4.0 或其他歷史授權追溯改成 RC7 的 NC 授權。
- 不要在未備份及未完成 staging 驗證前，將 schema migration 套用至 production D1。
- 不要宣稱完成法律認證、滲透測試、國際合規或安全認證，除非存在對應第三方證據。
