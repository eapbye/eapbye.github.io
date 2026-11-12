# 政大教政一點通

國立政治大學教育行政與政策研究所「申請學位論文計畫口試／學位論文考試」流程指引網站（純靜態網頁）。

- 網站內容：`index.html`（流程、畢業專區）、`course-registration.html`（預選登記）、`documents/`（下載表單）、`graduation/`（畢業專區封面圖）
- 發佈：推送到 `main` 後由 `.github/workflows/pages.yml` 自動發佈到 GitHub Pages
- 檢查：`tests/`（用法見 `tests/README.md`），上線前先跑 `python3 -B -I tests/check_consistency.py`
