#!/usr/bin/env node
// 自動填表的版面檢查：用「很長的壓力資料」「一般資料」「全部留空（滿版 ○）」各填 8 份表單，各自轉成 PDF，
// 頁數必須和原始表單一樣（填完不能多出一頁、也不能少）。
// 用法：node tests/fill_check.js [網站根目錄]
// 需要：playwright 與 LibreOffice（soffice）、pdfinfo（poppler）。找不到 soffice 時只做內容檢查並印出警告。
const fs = require('fs'), path = require('path'), os = require('os'), cp = require('child_process'), assert = require('assert');
const { serve } = require('./e2e.js');
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require(path.join(process.env.NODE_PATH || '', 'playwright')); }
const root = path.resolve(process.argv[2] || path.join(__dirname, '..'));
const FORMS = ['proposal/01-proposal-review-checklist', 'proposal/04-committee-review-result', 'proposal/05-committee-summary-result',
  'proposal/qualifying-exam-application', 'defense/00-defense-checklist', 'defense/02-originality-report', 'defense/04-exam-scoring-sheet', 'defense/aigc-detection-report'];
const STRESS = { name: '歐陽慕容小明', sid: '112123456', phone: '0912345678', email: 'ouyang.murong.xiaoming@example-university.edu.tw',
  title: '探討數位轉型脈絡下終身學習政策之執行困境與因應策略：以臺北市社區大學為例的混合研究' };
const TYPICAL = { name: '郭哲宇', sid: '113171009', phone: '0912345678', email: 'test@nccu.edu.tw', title: '數位轉型下的終身學習政策研究' };
const CASES = [['壓力', STRESS], ['一般', TYPICAL], ['留空', {}]];
const sh = (c) => cp.spawnSync('bash', ['-lc', c], { encoding: 'utf8' });
const pages = (f) => { const m = (sh(`pdfinfo '${f}'`).stdout || '').match(/Pages:\s+(\d+)/); return m ? +m[1] : -1; };

(async () => {
  const soffice = sh('command -v soffice || command -v libreoffice').stdout.trim();
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fillcheck-'));
  const srv = await serve(root, false);
  const base = 'http://localhost:' + srv.address().port;
  const exe = process.env.PW_CHROMIUM;
  const browser = await playwright.chromium.launch({ args: ['--no-sandbox'], ...(exe ? { executablePath: exe } : {}) });
  const page = await browser.newPage();
  await page.goto(base + '/index.html');
  const out = {};
  for (const [label, data] of CASES) for (const f of FORMS) {
    const b64 = await page.evaluate(async ([u, d]) => {
      const r = await fillOdt(u, d); const buf = new Uint8Array(await r.blob.arrayBuffer());
      let s = ''; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
      return { b: btoa(s), filled: r.filled };
    }, [`${base}/documents/${f}.odt`, data]);
    const name = path.basename(f) + '.' + label;
    fs.writeFileSync(path.join(tmp, name + '.filled.odt'), Buffer.from(b64.b, 'base64'));
    fs.copyFileSync(path.join(root, 'documents', f + '.odt'), path.join(tmp, name + '.orig.odt'));
    out[name] = b64.filled;
  }
  await browser.close(); srv.close();
  let bad = 0;
  if (!soffice) { console.log('警告：找不到 LibreOffice，略過頁數檢查'); }
  else {
    sh(`cd '${tmp}' && '${soffice}' --headless --convert-to pdf --outdir pdf *.odt >/dev/null 2>&1`);
    for (const name of Object.keys(out)) {
      const a = pages(path.join(tmp, 'pdf', name + '.orig.pdf')), b = pages(path.join(tmp, 'pdf', name + '.filled.pdf'));
      const ok = a > 0 && a === b; if (!ok) bad++;
      console.log((ok ? '通過  ' : '失敗  ') + name + `：原檔 ${a} 頁、填後 ${b} 頁；填入 ${out[name].join(',')}`);
    }
  }
  console.log(`\n產出資料夾：${tmp}\n結果：${bad ? bad + ' 份版面改變' : '全部頁數一致'}`);
  process.exit(bad ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
