#!/usr/bin/env node
// 功能測試的自我測試：在暫存副本裡故意弄壞網站，確認 e2e.js 對應的測試會失敗。
// 用法：node tests/e2e_selftest.js [網站根目錄]    （環境變數同 e2e.js）
const fs = require('fs');
const os = require('os');
const path = require('path');
const { runSuite } = require('./e2e');

const ROOT = path.resolve(process.argv[2] || path.join(__dirname, '..'));
const STUB = process.env.E2E_STUB === '1';

// [說明, 檔案, 要換掉的文字, 換成什麼, 第幾個出現處(1 起算), 預期會失敗的測試名稱關鍵字]
const FAULTS = [
  ['畢業專區：全勾後不再標示完成', 'index.html', 'if (modal) modal.classList.toggle("is-graduation-complete", complete);', 'if (modal) modal.classList.toggle("is-graduation-complete", false);', 1, '勾滿 13 項'],
  ['畢業專區：勾選項 index 位移', 'index.html', 'return `graduation:${item.folder}:${index}`;', 'return `graduation:${item.folder}:${Number(index) + 1}`;', 1, '沒有位移'],
  ['學位考試最後確認漏列 AIGC', 'index.html', '        inventoryItem("學位論文原創比對（Turnitin）全文電子檔", "office"),\n        inventoryItem("學位論文AIGC檢測報告書", "office"),\n', '        inventoryItem("學位論文原創比對（Turnitin）全文電子檔", "office"),\n', 1, '流程資料'],
  ['畢業專區又出現 Turnitin', 'index.html', '<strong>完成論文修訂</strong>', '<strong>完成論文修訂與 Turnitin</strong>', 1, '流程資料'],
  ['文件下載後不再標記完成', 'index.html', 'state.done[id] = true;\n      state.done["submission-check"] = false;', 'state.done[id] = false;\n      state.done["submission-check"] = false;', 1, '走完整個流程'],
  ['預選登記：衝堂不再擋會修', 'course-registration.html', 'if (conflictCourse) {', 'if (false) {', 1, '衝堂擋會修'],
  ['預選登記：手機不再切到截圖版', 'course-registration.html', '"compact" : "detail"', '"detail" : "detail"', 1, '手機結果頁'],
  ['預選登記：沒排課時不顯示說明', 'course-registration.html', '目前沒有排入會修或考慮中的課程。', '', 1, '沒有排入'],
];

// index.html 拆檔後，首頁的內容分散在這幾個檔案；FAULTS 寫 'index.html' 時，到這幾個檔案裡找含有目標文字的那一個來改
const SITE_FILES = ['index.html', 'css/tokens.css', 'css/style.css', 'data/flow.js', 'js/app.js'];

function nth(s, sub, n) { let i = -1; for (let k = 0; k < n; k++) { i = s.indexOf(sub, i + 1); if (i < 0) return -1; } return i; }

(async () => {
  let ok = true;
  const base = await runSuite(ROOT, { stub: STUB, only: /首頁|預選登記：必填/ });
  if (base.some((r) => !r.ok)) { console.log('現況的基準測試就失敗，無法做自我測試：', base.filter((r) => !r.ok).map((r) => r.name)); process.exit(1); }
  console.log('基準（首頁、預選登記必填）：通過');
  for (const [name, file, old, neu, nthOcc, key] of FAULTS) {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'eap_e2e_'));
    for (const f of ['index.html', 'course-registration.html']) fs.copyFileSync(path.join(ROOT, f), path.join(tmp, f));
    for (const d of ['css', 'js', 'data']) if (fs.existsSync(path.join(ROOT, d))) fs.cpSync(path.join(ROOT, d), path.join(tmp, d), { recursive: true });
    for (const d of ['documents', 'graduation']) if (!STUB && fs.existsSync(path.join(ROOT, d))) fs.cpSync(path.join(ROOT, d), path.join(tmp, d), { recursive: true });
    let target = null, at = -1, s = '';
    for (const f of (file === 'index.html' ? SITE_FILES : [file])) {
      const fp = path.join(tmp, f);
      if (!fs.existsSync(fp)) continue;
      const txt = fs.readFileSync(fp, 'utf8');
      const i = nth(txt, old, nthOcc);
      if (i >= 0) { target = fp; at = i; s = txt; break; }
    }
    if (at < 0) { console.log('自我測試的替換目標不存在：' + name); ok = false; fs.rmSync(tmp, { recursive: true, force: true }); continue; }
    s = s.slice(0, at) + neu + s.slice(at + old.length);
    fs.writeFileSync(target, s);
    const rs = await runSuite(tmp, { stub: STUB, only: new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) });
    fs.rmSync(tmp, { recursive: true, force: true });
    const caught = rs.length > 0 && rs.some((r) => !r.ok);
    console.log((caught ? '抓到  ' : '漏掉！') + name);
    ok = ok && caught;
  }
  console.log('\n自我測試：' + (ok ? '全部通過' : '有漏掉的錯誤，測試不可信'));
  process.exit(ok ? 0 : 1);
})();
