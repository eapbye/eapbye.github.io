#!/usr/bin/env node
// 畫面比對：同一組操作在「基準版」與「修改版」各截一輪圖，逐像素比較，列出哪些畫面變了。
// 給改視覺（階段 C）時用：確認只有想改的地方變了，其他畫面一格都沒動。
// 用法：node tests/visual_compare.js <基準網站根目錄> <修改版網站根目錄> [輸出資料夾]
//   或：bash tests/visual_compare.sh [git 版本，預設 main]   （自動把該版本取出當基準，與目前工作目錄比）
// 輸出：每個畫面一組 base／new／diff 三張 PNG（diff 以紅色標出不同處）與 report.json。
// 比對前會先收掉改版公告、停掉頭像動畫、固定時間，避免與內容無關的差異。結束碼 0＝完全一致、1＝有差異。
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto');
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require(path.join(process.env.NODE_PATH || '', 'playwright')); }
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.png': 'image/png', '.pdf': 'application/pdf' };
const [baseRoot, newRoot, outArg] = process.argv.slice(2).map((p, i) => (i < 2 ? path.resolve(p) : p));
if (!baseRoot || !newRoot) { console.error('用法：node tests/visual_compare.js <基準根目錄> <修改版根目錄> [輸出資料夾]'); process.exit(2); }
const out = path.resolve(outArg || 'visual_out');
fs.mkdirSync(out, { recursive: true });
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');

function serve(root) {
  const srv = http.createServer((req, res) => {
    const p = decodeURIComponent(req.url.split('?')[0]);
    const f = path.join(root, p === '/' ? 'index.html' : p);
    if (!f.startsWith(root)) { res.writeHead(403); return res.end(); }
    fs.readFile(f, (err, data) => {
      if (err) { res.writeHead(404); return res.end(); }
      res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); res.end(data);
    });
  });
  return new Promise((r) => srv.listen(0, () => r(srv)));
}

async function shoot(browser, root, dir) {
  fs.mkdirSync(dir, { recursive: true });
  const srv = await serve(root), base = 'http://localhost:' + srv.address().port, errs = [];
  for (const [vpName, vp] of [['d1440', { width: 1440, height: 900 }], ['m390', { width: 390, height: 844 }]]) {
    const ctx = await browser.newContext({ viewport: vp, reducedMotion: 'reduce', locale: 'zh-TW', timezoneId: 'Asia/Taipei' });
    await ctx.addInitScript(() => {
      try { localStorage.setItem('eapNotice_compareBeforeExam_v1', '1'); } catch (e) {}
      const start = new Date('2026-11-12T12:00:00+08:00').getTime(), D = Date, t0 = D.now(), now = () => start + (D.now() - t0);
      Date = class extends D { constructor(...a) { if (a.length) super(...a); else super(now()); } static now() { return now(); } };
    });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errs.push(vpName + ' PAGEERR ' + e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(vpName + ' CONSOLE ' + m.text()); });
    const dismiss = async () => {
      for (let i = 0; i < 20; i++) {
        let hit = false;
        for (const sel of ['#closeSubmissionNotice', '#closeGuide', '#closeDeadline']) {
          const l = page.locator(sel);
          if (await l.isVisible() && await l.isEnabled()) { await l.click({ timeout: 8000 }).catch(() => {}); hit = true; await page.waitForTimeout(200); }
        }
        if (!hit && !(await page.locator('.info-modal:not(.hidden)').count())) return;
        if (!hit) await page.waitForTimeout(500);
      }
    };
    const snap = async (name) => {
      await page.waitForTimeout(400);
      fs.writeFileSync(path.join(dir, `${vpName}-${name}.png`), await page.screenshot({ fullPage: true, animations: 'disabled' }));
    };
    await page.goto(base + '/index.html');
    await page.waitForSelector('.mode-card', { state: 'attached' });
    await page.addStyleTag({ content: 'img.avatar-image, .mini-avatar, .qa-helper-avatar { visibility: hidden !important; }' });
    await page.waitForTimeout(6500);
    await snap('home-first-visit'); await dismiss(); await snap('home');
    if (vpName === 'd1440') {
      for (const mode of ['proposal', 'defense']) {
        await page.click(`.mode-card[data-mode="${mode}"]`); await page.waitForTimeout(500); await dismiss(); await snap(`flow-${mode}`);
        await page.click('#backToModes'); await page.waitForTimeout(300);
      }
      await page.evaluate(() => showGraduation()); await snap('graduation');
      await page.evaluate(() => { const b = document.querySelector('#closeGraduation'); if (b) b.click(); });
      await page.evaluate(() => showDeadline()); await snap('deadline');
      // 填表視窗（第一次點可填表單時跳出）
      await page.evaluate(() => { document.querySelector('#closeDeadline')?.click(); });
      await page.evaluate(() => { document.querySelector('#fillModal')?.classList.remove('hidden'); }); await snap('fill-modal');
      await page.evaluate(() => { document.querySelector('#fillModal')?.classList.add('hidden'); });
    } else {
      await page.click('.mode-card[data-mode="defense"]'); await snap('mobile-notice');
    }
    await ctx.close();
  }
  srv.close();
  return errs;
}

(async () => {
  const exe = process.env.PW_CHROMIUM;
  const browser = await playwright.chromium.launch({ args: ['--no-sandbox'], env: { ...process.env, LC_ALL: 'C.UTF-8' }, ...(exe ? { executablePath: exe } : {}) });
  const bDir = path.join(out, 'base'), nDir = path.join(out, 'new'), dDir = path.join(out, 'diff');
  fs.mkdirSync(dDir, { recursive: true });
  const errB = await shoot(browser, baseRoot, bDir), errN = await shoot(browser, newRoot, nDir);
  // 以瀏覽器內的 canvas 算像素差，並產生 diff 圖（不同處標紅，其餘淡化）
  const page = await browser.newPage();
  const names = fs.readdirSync(nDir).filter((f) => f.endsWith('.png')).sort();
  const rows = [];
  for (const n of names) {
    const a = fs.existsSync(path.join(bDir, n)) ? fs.readFileSync(path.join(bDir, n)) : null, b = fs.readFileSync(path.join(nDir, n));
    if (!a) { rows.push({ name: n, status: '基準版沒有此畫面', diffPixels: -1 }); continue; }
    if (sha(a) === sha(b)) { rows.push({ name: n, status: '一致', diffPixels: 0 }); continue; }
    const r = await page.evaluate(async ([x, y]) => {
      const load = (s) => new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.src = 'data:image/png;base64,' + s; });
      const [ia, ib] = await Promise.all([load(x), load(y)]);
      const w = Math.max(ia.width, ib.width), h = Math.max(ia.height, ib.height);
      const mk = (im) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.drawImage(im, 0, 0); return g.getImageData(0, 0, w, h); };
      const A = mk(ia), B = mk(ib), c = document.createElement('canvas'); c.width = w; c.height = h;
      const g = c.getContext('2d'), D = g.createImageData(w, h);
      let n = 0, x0 = w, y0 = h, x1 = 0, y1 = 0;
      for (let i = 0; i < A.data.length; i += 4) {
        const d = Math.abs(A.data[i] - B.data[i]) + Math.abs(A.data[i + 1] - B.data[i + 1]) + Math.abs(A.data[i + 2] - B.data[i + 2]);
        const p = i / 4, px = p % w, py = (p / w) | 0;
        if (d > 8) { n++; D.data[i] = 255; D.data[i + 1] = 0; D.data[i + 2] = 0; D.data[i + 3] = 255; x0 = Math.min(x0, px); y0 = Math.min(y0, py); x1 = Math.max(x1, px); y1 = Math.max(y1, py); }
        else { D.data[i] = D.data[i + 1] = D.data[i + 2] = 255 - (255 - A.data[i]) * 0.25; D.data[i + 3] = 255; }
      }
      g.putImageData(D, 0, 0);
      return { n, box: n ? [x0, y0, x1, y1] : null, size: [ia.width, ia.height, ib.width, ib.height], png: c.toDataURL('image/png').split(',')[1] };
    }, [a.toString('base64'), b.toString('base64')]);
    fs.writeFileSync(path.join(dDir, n), Buffer.from(r.png, 'base64'));
    rows.push({ name: n, status: r.n ? '有差異' : '一致（僅細微色差）', diffPixels: r.n, box: r.box, size: r.size });
  }
  await browser.close();
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify({ rows, errB, errN }, null, 1));
  let changed = 0;
  for (const r of rows) {
    if (r.diffPixels !== 0 && r.status !== '一致（僅細微色差）') changed++;
    console.log((r.diffPixels === 0 ? '一致  ' : '有差異') + '  ' + r.name + (r.box ? `  差異 ${r.diffPixels} 像素，範圍 x${r.box[0]}-${r.box[2]} y${r.box[1]}-${r.box[3]}` : '') + (r.size && (r.size[0] !== r.size[2] || r.size[1] !== r.size[3]) ? `  頁面尺寸 ${r.size[0]}×${r.size[1]} → ${r.size[2]}×${r.size[3]}` : ''));
  }
  if (errN.length) { console.log('\n修改版的主控台／頁面錯誤：'); errN.forEach((e) => console.log('  ' + e)); }
  console.log(`\n結果：${rows.length - changed} 個畫面一致、${changed} 個畫面有差異；差異圖在 ${dDir}`);
  process.exit(changed || errN.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
