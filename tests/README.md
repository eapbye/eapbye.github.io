# 教政一點通 自動檢查（tests/）

這個資料夾只放檢查用的檔案，不會被部署到網站（.github/workflows/pages.yml 只複製指定的檔案）。
每次改 index.html、css／js／data 的檔案、course-registration.html 或 documents／graduation 的檔案後，先跑下面兩項，再更新首頁「最後更新日」。

## 網站的檔案結構

首頁 index.html 只留頁面骨架，樣式、程式、流程資料分開放：

- css/tokens.css：配色與陰影變數（:root）。要調視覺先改這份。
- css/style.css：其餘樣式。
- data/flow.js：流程步驟與文件資料（baseFlow、flowModes）。
- js/app.js：其餘程式。
- js/odtfill.js、js/fillform.js：自動填表（ODT 在瀏覽器內填姓名、學號等）。
- js/booking.js：預約教室訊息草稿。js/bundle.js：送件清單與全部表單 ZIP。
- js/guard.js：防被嵌進別人網頁。js/course-registration.js：預選登記頁的程式與課程資料（換學期改這支）。
- css/fill.css、booking.css、bundle.css：各功能的樣式。

index.html 依 `<link>`、`<script src>` 的順序載入（tokens.css 在 style.css 前，flow.js 在 app.js 前）。靜態檢查會把 index.html 和它引用的 css／js 串成一份全文再檢查，訊息裡的位置是「檔名＋該檔行號」。course-registration.html 的程式已搬到 js/course-registration.js（CSP 不允許行內程式）。animation-preview.html 是沒有連結的預覽頁，已不部署。

## 1. 靜態一致性檢查（只要 Python 3，不用安裝任何東西）

    python3 tests/check_consistency.py

檢查內容：
- 程式裡引用的下載檔、圖片、css、js 是否真的存在，且在 .github/workflows/pages.yml 的部署清單內（FAIL）；新增資料夾要記得在 pages.yml 加 `cp -r`
- 畢業專區封面圖是否齊全（FAIL）
- localStorage 的 key 有沒有被改名（FAIL；改名會讓用過網站的人進度消失）
- 畢業專區勾選項 index 有沒有重複或消失（FAIL；不可位移）
- Turnitin 名稱是否完整、AIGC 是否用全名、「成績單」前是否有「歷年」（FAIL／WARN）
- 首頁「（最後更新日：YYYY-MM-DD）」格式是否正確，以及有沒有比它更新的檔案（FAIL／WARN）
- 預選登記每門課的 time 是否與 day／start／span 對得上、課程 id 是否重複、學期是否一致（FAIL）
- 安全：每個頁面都有 CSP meta，script-src 不得含 'unsafe-inline'／'unsafe-eval'、不得允許外部網域；不得有行內 <script>、onclick／onerror 等行內事件屬性（js 裡產生的也算）、javascript: 連結、eval；
  vendor/jszip.min.js 的雜湊要等於已核對的官方 3.10.1（刻意升級時改 JSZIP_SHA256）；頁面要載入 js/guard.js；Actions 不得用 @main／@master；pages.yml 要先跑本檢查（FAIL）
- documents 裡沒被連結的檔案（WARN／INFO，舊 DOCX 只列 INFO）

結果有 FAIL 時結束碼為 1。檢查腳本本身的自我測試：

    python3 -B tests/selftest_consistency.py

## 2. 功能測試（Playwright）

    npm i playwright        # 第一次
    npx playwright install chromium
    node tests/e2e.js

測試內容：首頁與彈窗；畢業專區（13 項勾滿才出彩蛋、取消任一項即消失、舊使用者的勾選依 index 對應）；
計畫口試三種資格類型、學位論文考試各走完整個流程到完成彈窗；學位論文考試申請須含 AIGC 與 Turnitin 全文電子檔、畢業專區不得再有 Turnitin/AIGC；
預選登記的必填、衝堂擋會修、考慮中提醒、手機截圖版；
自動填表、預約教室、送件小幫手 ZIP、續辦首頁、防嵌入。要看失敗的完整訊息時加環境變數 `E2E_VERBOSE=1`。

沒有 documents／graduation 的環境（例如只複製了兩個 html）請加 `E2E_STUB=1`，缺的檔案以空檔回應；
檔案是否真的存在由第 1 項負責。功能測試的自我測試：

    node tests/e2e_selftest.js

## 改規則時
- 故意改名稱、key、index 時，同步改 check_consistency.py 最上方的基準（BASELINE_KEYS、BASELINE_GRAD_INDEXES）。
- 兩支自我測試的「改壞」清單寫 index.html 時，會自動到 index.html 與 css／js／data 裡找含該文字的檔案來改；新增檔案資料夾時，把它加進兩支自我測試的 SITE_FILES。
- 新增流程文件或勾選項後，確認 e2e.js 的「走完整個流程」仍通過；它會自動點到完成彈窗，數量變動不用改測試。
- 預選登記換學期：改 registrationData 與頁面標題，跑第 1 項確認 time 與節次一致。

## 3. 填表排版檢查（需要 LibreOffice）

    node tests/fill_check.js

把表單用最壞情況（超長姓名與題目、全部留空）填過，再用 LibreOffice 轉 PDF，確認頁數與原檔一致，避免填完表格被撐到下一頁。

## 畫面比對（改視覺時用）

改配色、版面之後，想確認「只有想改的地方變了」：

```
bash tests/visual_compare.sh            # 以 main 為基準，與目前工作目錄比
bash tests/visual_compare.sh a258612    # 也可指定任一 git 版本當基準
node tests/visual_compare.js <基準資料夾> <修改版資料夾> [輸出資料夾]
```

- 會在電腦寬度（1440）與手機寬度（390）各截 11 個畫面（首頁、兩個流程、畢業專區、常見問題、期限提醒、填表視窗等），逐像素比對。
- 輸出資料夾內有 `base/`、`new/`、`diff/` 三組圖；`diff/` 裡紅色處就是不同的地方。終端機也會列出每個畫面的差異像素數與範圍。
- 比對前會先收掉改版公告、停掉頭像動畫、固定時間，所以「頁尾日期」等與改版無關的差異以外，不會有雜訊。
- 結束碼 0＝完全一致、1＝有差異（或修改版出現主控台錯誤）。
- 這支工具已用兩種方式自我測試：同版本比自己，全部一致；故意改一個配色變數，11 個畫面都被抓出差異。
