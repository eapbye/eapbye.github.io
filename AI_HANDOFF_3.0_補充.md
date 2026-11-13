# 教政一點通 3.0：AI 交接補充（2026-11-13）

這份補充蓋過桌面舊版 `AI_HANDOFF_CURRENT.md` 的第 1、13、14 節（位置、測試、託管）。其他節（流程邏輯、配色、下載檔位置）仍以舊檔為準，內容改了的地方以這份為準。

## 位置與分支
- 倉庫：https://github.com/eapbye/eapbye.github.io ；網站：https://eapbye.github.io/
- `main` 是上線版（推上去就由 `.github/workflows/pages.yml` 發佈）。**未經使用者說「上線 …」不得推 main。**
- 3.0 開發在分支 `v3-dev`。桌面「教政一點通_工作版」是舊的單檔版，已落後；請直接用 git 取 `v3-dev`（或下載該分支的 ZIP）後再改。
- 分工：Claude 負責測試與把關，視覺（Opus）改 `css/tokens.css`、`css/style.css` 與各功能的 css。

## 檔案結構（已拆檔）
- `index.html`：骨架。`css/tokens.css` 配色；`css/style.css` 主樣式；`css/fill.css`、`booking.css` 各功能樣式。
- `data/flow.js`：流程與文件資料。`js/app.js`：主程式。
- `js/odtfill.js`、`js/fillform.js`：自動填表（姓名、學號、電話、e-mail、論文題目；8 份 ODT 可填）。
- `js/booking.js`：預約教室訊息草稿（不含 e-mail，純文字可貼 LINE）。
- `js/guard.js`：被嵌進別人網頁時隱藏內容。`js/course-registration.js`：預選登記頁（換學期改這支）。
- `vendor/jszip.min.js`：3.10.1，雜湊寫在 `tests/check_consistency.py` 的 `JSZIP_SHA256`。
- `animation-preview.html`：沒有連結的預覽頁，已不部署。

## 安全規則（改程式時要守）
- CSP 的 `script-src` 只有 `'self'`：**不可寫行內 `<script>`、`onclick`／`onerror` 等行內事件，也不可在 js 裡用字串產生這些屬性**；一律用 `addEventListener`。不可 `eval`／`new Function`。
- 新增外部網域（CDN、字型、統計）一律不行；需要的檔案放 `vendor/` 並把雜湊加進檢查。
- `style-src` 仍含 `'unsafe-inline'`（行內 style 很多），這是已知的剩餘風險，風險低（沒有登入、沒有後端）。
- 使用者資料只存在瀏覽器 localStorage（`eapFillProfile_v1` 填表資料、`thesisChecklistProgressV3` 進度），不上傳。

## 3.0 新增與調整
自動填表強化（○ 變多、留空更醒目、依欄寬自動縮字）；預約教室草稿；續辦首頁（流程卡片顯示「繼續上次進度（完成 / 總數）」，改選另一流程前先確認會清除進度）；送件清單複製；安全加固。B2 公告橫幅、慶祝畫面、3.0 標章、倒推申請日＋.ics、首次進流程的 5 秒顏色說明視窗，都已決定不要；114 級開通、站內搜尋暫不做。

## 測試（改完一定要跑）
    python3 -B -I tests/check_consistency.py      # 靜態與安全檢查，pages.yml 部署前也會跑
    python3 -B -I tests/selftest_consistency.py   # 檢查腳本的自我測試
    NODE_PATH=<playwright 所在 node_modules> PW_CHROMIUM=<chrome 路徑> node tests/e2e.js   # 21 項功能測試；失敗要看全文加 E2E_VERBOSE=1
    node tests/e2e_selftest.js                    # 功能測試的自我測試
    node tests/fill_check.js                      # 需要 LibreOffice：填表後頁數不得變
改了 `index.html` 內容或任何程式後，記得更新首頁「（最後更新日：YYYY-MM-DD）」。
