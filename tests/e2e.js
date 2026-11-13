#!/usr/bin/env node
// 教政一點通 功能測試（Playwright）。只讀網站檔案，不會改動。
// 用法：node tests/e2e.js [網站根目錄]        （預設為本檔上一層）
// 環境變數：E2E_STUB=1  缺少的下載檔／圖片以空檔回應（只在沒有 documents／graduation 的環境用；
//                       檔案是否真的存在由 check_consistency.py 負責）
//           PW_CHROMIUM  指定 Chromium 執行檔路徑（選填）
// 需要：npm i playwright（並安裝瀏覽器）。結束碼 0＝全過、1＝有失敗。
const http = require('http');
const fs = require('fs');
const path = require('path');
const assert = require('assert');
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require(path.join(process.env.NODE_PATH || '', 'playwright')); }
const { chromium } = playwright;

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml',
  '.jpg': 'image/jpeg', '.png': 'image/png', '.pdf': 'application/pdf' };
const STORAGE_KEY = 'thesisChecklistProgressV3';

function serve(root, stub) {
  const srv = http.createServer((req, res) => {
    const p = decodeURIComponent(req.url.split('?')[0]);
    const f = path.join(root, p === '/' ? 'index.html' : p);
    if (!f.startsWith(root)) { res.writeHead(403); return res.end(); }
    fs.readFile(f, (err, data) => {
      if (err) {
        if (stub && /^\/(documents|graduation)\/|\.svg$/.test(p)) { res.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); return res.end(''); }
        res.writeHead(404); return res.end();
      }
      res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' });
      res.end(data);
    });
  });
  return new Promise((r) => srv.listen(0, () => r(srv)));
}

async function newPage(browser, base, opts = {}) {
  const ctx = await browser.newContext({ viewport: opts.viewport || { width: 1440, height: 900 }, acceptDownloads: true,
    isMobile: !!opts.mobile, hasTouch: !!opts.mobile });
  if (opts.seed) await ctx.addInitScript(([k, v]) => { if (!localStorage.getItem('__seeded')) { localStorage.setItem(k, v); localStorage.setItem('__seeded', '1'); } }, [STORAGE_KEY, JSON.stringify(opts.seed)]);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('PAGEERR ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push('CONSOLE ' + m.text()); });
  page.on('dialog', (d) => d.accept());
  page.on('popup', (p) => p.close().catch(() => {}));
  page.setDefaultTimeout(6000);
  page.errors = errors;
  page.base = base;
  return page;
}

// 畫面常整個重畫，點擊偶爾落在剛被換掉的元素上；短逾時、重試幾次
async function retry(page, fn, n = 4) {
  let last;
  for (let i = 0; i < n; i++) {
    try { await dismissModals(page); return await fn(); } catch (e) { last = e; await page.waitForTimeout(400); }
  }
  throw last;
}

async function dismissModals(page) {
  for (let i = 0; i < 6; i++) {
    let hit = false;
    for (const sel of ['#closeSubmissionNotice', '#closeGuide', '#closeDeadline']) {
      const l = page.locator(sel);
      if (await l.isVisible()) { await l.click({ timeout: 15000 }); hit = true; await page.waitForTimeout(150); }
    }
    // 點到可自動填寫的表單會先跳出填表視窗；一般流程測試選「不填，下載空白表」
    const skip = page.locator('#fillSkip');
    if (await skip.isVisible()) { await skip.click({ timeout: 15000 }); hit = true; await page.waitForTimeout(150); }
    if (!hit) return;
  }
}

async function openHome(page) {
  await page.goto(page.base + '/index.html');
  await page.waitForSelector('.mode-card');
  // 第一次進站，期限提醒彈窗會在版面完成後才跳出；先等它，免得它晚到蓋住按鈕
  await page.waitForSelector('#deadlineModal:not(.hidden)', { timeout: 2500 }).catch(() => {});
}

async function enterMode(page, mode) {
  await retry(page, async () => { await dismissModals(page); await page.click(`.mode-card[data-mode="${mode}"]`); });
  await dismissModals(page);
}

// 沿著目前畫面依序點「現在能點的下一個控制項」，直到沒有可點的為止
async function greedyWalk(page, max = 400) {
  const order = [
    '#stepsList .important-reminder input[type=checkbox]:not(:checked)',
    '#stepsList .document-item:not(.is-info):not(.is-done):not(.is-locked) a.download-link:not(.is-unavailable)',
    '#stepsList .document-item:not(.is-info):not(.is-done):not(.is-locked) button:not([disabled])',
    '#stepsList button.documents-done-gate:not([disabled]):not(.is-complete)',
    '#stepsList .inventory-chip[aria-pressed="false"]',
    '#stepsList button.step-done-action:not([disabled]):not(.is-complete)',
  ];
  let clicks = 0;
  const seen = new Map();   // 同一個控制項連點好幾次仍沒進展，視為卡住（避免無窮點擊）
  for (let i = 0; i < max; i++) {
    await dismissModals(page);
    if (await page.locator('#celebrationModal:not(.hidden)').count()) return clicks;
    let done = true;
    for (const sel of order) {
      const loc = page.locator(sel);
      const n = await loc.count();
      for (let k = 0; k < n; k++) {
        const it = loc.nth(k);
        if (!(await it.isVisible())) continue;
        const txt = (await it.textContent().catch(() => '')) || '';
        if (/^\s*取消/.test(txt)) continue;
        // 自訂勾選框的 input 常被 label 蓋住，改點外層 label；畫面重畫造成點不到時重試
        const sig = sel + '|' + txt.trim();
        seen.set(sig, (seen.get(sig) || 0) + 1);
        if (seen.get(sig) > 4) throw new Error('卡住：重複點了仍沒進展「' + txt.trim().slice(0, 24) + '」');
        const isInput = await it.evaluate((el) => el.tagName === 'INPUT').catch(() => false);
        const target = isInput ? it.locator('xpath=ancestor::label[1]') : it;
        let ok = false;
        for (let a = 0; a < 3 && !ok; a++) {
          // 最後確認那一步會延遲跳出「繳交提醒」彈窗，可能剛好蓋住按鈕：每次嘗試前先關彈窗
          try { await dismissModals(page); await target.click({ timeout: 4000 }); ok = true; } catch (e) { await page.waitForTimeout(300); }
        }
        if (!ok) throw new Error('點不到：' + sel.split(' ').slice(-1)[0] + '「' + txt.trim().slice(0, 24) + '」');
        await page.waitForTimeout(90);
        clicks++; done = false; break;
      }
      if (!done) break;
    }
    if (done) return clicks;
  }
  throw new Error('walk 超過 ' + max + ' 次仍未結束');
}

function walkAssertFinished(page) {
  return page.evaluate(() => {
    const t = document.querySelector('#progressText').textContent.trim();
    const m = t.match(/(\d+)\s*\/\s*(\d+)/);
    return { text: t, done: m ? +m[1] : -1, total: m ? +m[2] : -2, celebration: !document.querySelector('#celebrationModal').classList.contains('hidden'),
      links: document.querySelectorAll('#celebrationLinks a').length };
  });
}

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

test('首頁：載入無錯誤、三個入口、提醒彈窗只出現一次', async (b, base) => {
  const page = await newPage(b, base);
  await openHome(page);
  assert.strictEqual(await page.locator('.mode-card[data-mode]').count(), 2, '口試入口應有 2 個');
  assert.ok(await page.locator('#openGraduation').isVisible(), '缺畢業專區入口');
  assert.ok(await page.locator('#deadlineModal:not(.hidden)').count(), '第一次進站應出現期限提醒彈窗');
  const foot = await page.locator('footer, body').first().innerText();
  assert.ok(/政大教政所 維護｜\d+\.\d+\.\d+ 版｜\d{4}-\d{2}-\d{2} 更新/.test(foot), '首頁頁尾看不到版本號與更新日');
  await dismissModals(page);
  await page.reload(); await page.waitForTimeout(1500);
  assert.ok(!(await page.locator('#deadlineModal:not(.hidden)').count()), '30 天內再進站不應再跳期限提醒');
  assert.deepStrictEqual(page.errors, []);
});

test('畢業專區：級數、勾滿 13 項才出彩蛋、取消任一項即消失、重新整理保留勾選', async (b, base) => {
  const page = await newPage(b, base);
  await openHome(page); await dismissModals(page);
  await page.click('#openGraduation');
  await page.waitForSelector('.graduation-grade-card');
  assert.strictEqual(await page.locator('.graduation-grade-card').count(), 5);
  assert.strictEqual(await page.locator('.graduation-grade-card.is-open').count(), 4, '111～114 應開放');
  assert.strictEqual(await page.locator('.graduation-grade-card.is-closed').count(), 1, '115 應為尚未開放');
  // 114 級：開放流程，但還沒拍畢業照，卡片與封面都是哭臉
  assert.ok(await page.locator('.graduation-grade-card.has-placeholder', { hasText: '114級' }).locator('.cry-face').count(), '114 卡片應顯示哭臉');
  await page.locator('.graduation-grade-card', { hasText: '114級' }).click();
  assert.strictEqual(await page.locator('.graduation-task input').count(), 13, '114 應可勾畢業流程');
  await page.waitForSelector('.graduation-cover-placeholder .cry-face', { timeout: 3000 });
  assert.ok((await page.locator('.graduation-cover-placeholder').innerText()).includes('還沒有拍畢業照'), '114 封面應寫還沒有拍畢業照');
  await page.click('#closeGraduation'); await page.click('#openGraduation');
  await page.waitForSelector('.graduation-grade-card');
  await page.locator('.graduation-grade-card', { hasText: '113級' }).click();
  const boxes = page.locator('.graduation-task input');
  assert.strictEqual(await boxes.count(), 13, '畢業流程應有 13 個勾選項（index 1 已停用）');
  const n = await boxes.count();
  for (let i = 0; i < n - 1; i++) await boxes.nth(i).check();
  assert.ok(!(await page.locator('#graduationModal.is-graduation-complete').count()), '還差一項，不該顯示完成');
  assert.ok(!(await page.locator('.graduation-easter-egg').count()), '還差一項，不該出現彩蛋');
  await boxes.nth(n - 1).check();
  assert.ok(await page.locator('#graduationModal.is-graduation-complete').count(), '全勾後應顯示完成');
  await page.waitForSelector('.graduation-easter-egg', { timeout: 3000 });
  await boxes.nth(5).uncheck();
  assert.ok(!(await page.locator('#graduationModal.is-graduation-complete').count()), '取消一項後應取消完成狀態');
  assert.ok(!(await page.locator('.graduation-easter-egg').count()), '取消一項後彩蛋應消失');
  await page.reload(); await page.waitForSelector('.mode-card'); await dismissModals(page);
  await page.click('#openGraduation');
  await page.locator('.graduation-grade-card', { hasText: '113級' }).click();
  assert.strictEqual(await page.locator('.graduation-task input:checked').count(), 12, '重新整理後應保留 12 個勾選');
  assert.deepStrictEqual(page.errors, []);
});

test('畢業專區：舊使用者的勾選依 index 對應（12、13 沒有位移）', async (b, base) => {
  const page = await newPage(b, base, { seed: { graduationTasks: { 'graduation:113:12': true, 'graduation:113:3': true, 'graduation:113:1': true } } });
  await openHome(page); await dismissModals(page);
  await page.click('#openGraduation');
  await page.locator('.graduation-grade-card', { hasText: '113級' }).click();
  assert.strictEqual(await page.locator('.graduation-task input:checked').count(), 2);
  for (const i of [12, 3]) assert.ok(await page.locator(`.graduation-task[data-graduation-task-index="${i}"] input:checked`).count(), `index ${i} 應為已勾`);
  for (const i of [0, 13]) assert.ok(!(await page.locator(`.graduation-task[data-graduation-task-index="${i}"] input:checked`).count()), `index ${i} 不應被勾`);
  assert.deepStrictEqual(page.errors, []);
});

test('畢業專區：115 級顯示還不能畢業（114 級已開放）', async (b, base) => {
  const page = await newPage(b, base);
  await openHome(page); await dismissModals(page);
  await page.click('#openGraduation');
  await page.locator('.graduation-grade-card', { hasText: '114級' }).click();
  assert.ok(!(await page.locator('.graduation-note', { hasText: '還不能畢業' }).count()), '114 已開放，不該再顯示還不能畢業');
  await page.click('#closeGraduation'); await page.click('#openGraduation');
  await page.locator('.graduation-grade-card', { hasText: '115級' }).click();
  assert.ok(await page.locator('.graduation-note', { hasText: '還不能畢業' }).count());
  assert.deepStrictEqual(page.errors, []);
});

test('流程資料：AIGC 與全文電子檔考前備妥、畢業專區不再比對、名稱用全名', async (b, base) => {
  const page = await newPage(b, base);
  await openHome(page);
  // 計畫口試的步驟放在 baseFlow，口試資格等在 flowModes.proposal；學位考試整套在 flowModes.defense
  const d = await page.evaluate(() => ({ proposal: JSON.stringify([baseFlow, flowModes.proposal]), defense: JSON.stringify(flowModes.defense) }));
  assert.ok(d.defense.includes('學位論文AIGC檢測報告書'), '學位論文考試申請應有 AIGC 全名');
  assert.ok(d.defense.includes('Turnitin）全文電子檔'), '學位論文考試申請應有 Turnitin 全文電子檔');
  assert.ok(d.proposal.includes('學位論文AIGC檢測報告書'), '計畫口試應有 AIGC 全名');
  const inv = await page.evaluate(() => buildDefenseSubmissionInventory().map((x) => x.label).join('|'));
  for (const w of ['Turnitin）證明表', 'Turnitin）全文電子檔', '學位論文AIGC檢測報告書']) assert.ok(inv.includes(w), '學位論文考試最後確認清單缺：' + w);
  for (const k of ['proposal', 'defense']) {
    assert.ok(d[k].includes('學位論文原創比對（Turnitin）證明表'), k + ' 缺 Turnitin 全名');
    assert.ok(!/原創比對(?!（Turnitin）(證明表|全文電子檔))/.test(d[k]), k + ' 有不完整的 Turnitin 名稱');
  }
  // 程式拆成外部檔（data／js）後，textContent 是空的；要連外部 script 的原始碼一起讀
  assert.ok(await page.evaluate(async () => (await Promise.all([...document.scripts].map((x) => (x.src ? fetch(x.src).then((r) => r.text()) : Promise.resolve(x.textContent))))).join('').split('inventoryItem("歷年成績單"').length - 1 >= 2), '兩個系統的最後確認清單都應有「歷年成績單」');
  await dismissModals(page);
  await page.click('#openGraduation'); await page.waitForSelector('.graduation-grade-card');
  await page.locator('.graduation-grade-card', { hasText: '113級' }).click();
  await page.waitForSelector('.graduation-flow');
  const gtext = await page.locator('.graduation-flow').innerText();
  assert.ok(!/Turnitin|AIGC/.test(gtext), '畢業專區不應再出現 Turnitin／AIGC');
  assert.ok(gtext.includes('繳交紙本論文 1 本至所辦'), '畢業專區應寫所辦只收 1 本');
  await page.click('#closeGraduation');
  const hrefs = await page.evaluate(() => [...new Set((JSON.stringify(flowModes).match(/documents\/[^"]+/g) || []))]);
  for (const h of hrefs) {
    const st = await page.evaluate(async (u) => (await fetch(u, { method: 'HEAD' })).status, h);
    assert.strictEqual(st, 200, '下載連結無法取得：' + h);
  }
  assert.deepStrictEqual(page.errors, []);
});

for (const opt of [0, 1, 2]) {
  test(`計畫口試：走完整個流程到完成彈窗（資格類型第 ${opt + 1} 種）`, async (b, base) => {
    const page = await newPage(b, base);
    await openHome(page); await dismissModals(page);
    await enterMode(page, 'proposal');
    const label = await page.evaluate(() => baseFlow.precheck.passedLabel);
    await retry(page, () => page.getByText(label, { exact: false }).first().click());
    await retry(page, () => page.locator('.qualification-download').click());
    await dismissModals(page);
    await page.waitForSelector('.qualification-question');
    await retry(page, () => page.locator('.qualification-question label').nth(opt).click());
    // 「已確認，前往第二步」也是 step-done-action 按鈕，交給 greedyWalk 處理（含重畫時的重試）
    await page.waitForTimeout(500);
    await greedyWalk(page);
    const r = await walkAssertFinished(page);
    assert.ok(r.total > 0 && r.done === r.total, `進度未滿：${r.text}`);
    assert.ok(r.celebration, '完成後應出現完成彈窗');
    assert.ok(r.links >= 3, `完成彈窗的示範檔案連結太少：${r.links}`);
    assert.deepStrictEqual(page.errors, []);
  });
}

test('學位論文考試：走完整個流程到完成彈窗（含 AIGC 與全文電子檔）', async (b, base) => {
  const page = await newPage(b, base);
  await openHome(page); await dismissModals(page);
  await enterMode(page, 'defense');
  const n = await page.locator('.precheck-choice').count();
  assert.ok(n >= 2, '資格確認應有至少 2 個勾選');
  for (let i = 0; i < n; i++) {
    // 每勾一項畫面會整個重畫，所以每次重新找
    const item = page.locator('.precheck-choice').nth(i);
    if (!(await item.evaluate((el) => el.classList.contains('is-checked')))) await retry(page, () => item.click());
  }
  // 「已確認，前往下一步」也是 step-done-action 按鈕，交給 greedyWalk
  await greedyWalk(page);
  const r = await walkAssertFinished(page);
  assert.ok(r.total > 0 && r.done === r.total, `進度未滿：${r.text}`);
  assert.ok(r.celebration, '完成後應出現完成彈窗');
  const text = await page.locator('body').innerText();
  assert.ok(text.includes('AIGC'), '學位論文考試畫面應出現 AIGC');
  assert.ok(text.includes('歷年成績單'));
  assert.deepStrictEqual(page.errors, []);
});

test('課表：不在預選期間時，首頁按鈕寫「課程表」，預選頁變成唯讀課表（週課表與清單）', async (b, base) => {
  const page = await newPage(b, base);
  await openHome(page); await dismissModals(page);
  assert.strictEqual(await page.locator('#courseEntryTitle').innerText(), '課程表', '首頁按鈕應寫課程表');
  assert.ok((await page.locator('#courseEntryTerm').innerText()).includes('第 2 學期'), '按鈕上方標學期');
  assert.ok(!(await page.locator('#courseUnavailableModal').count()), '不再有「登記時間已過」視窗');
  await page.click('#openCourseRegistration');
  await page.waitForSelector('#timetableView:not(.hidden)');
  const n = await page.evaluate(() => courses.length);
  assert.strictEqual(await page.locator('#timetableGrid .tt-block').count(), n, '週課表應有每一門課');
  assert.strictEqual(await page.locator('#timetableList tr').count(), n, '清單應有每一門課');
  assert.ok(!(await page.locator('.course-card').first().isVisible().catch(() => false)), '不應出現登記用的課程卡');
  assert.ok(!(await page.locator('#submitButton').isVisible()), '不應出現送出鈕');
  assert.ok((await page.locator('#registrationTitle').innerText()).includes('課程表'));
  assert.deepStrictEqual(page.errors, []);
});

async function fillRegistration(page, picks) {
  await page.fill('#studentId', '112171000'); await page.fill('#studentName', '王小明');
  for (const [id, choice] of Object.entries(picks)) await page.click(`button[data-course="${id}"][data-choice="${choice}"]`);
}

test('預選登記：必填、衝堂擋會修、考慮中可重疊並提醒', async (b, base) => {
  const page = await newPage(b, base);
  await page.context().addInitScript(() => { window.__EAP_FORCE_REGISTER = true; });
  await page.goto(base + '/course-registration.html'); await page.waitForSelector('.course-card');
  assert.strictEqual(await page.locator('.course-card').count(), await page.evaluate(() => courses.length));
  await page.click('#submitButton');
  assert.ok((await page.locator('#message').innerText()).includes('學號與姓名'), '未填姓名學號不可送出');
  await page.fill('#studentId', '112171000'); await page.fill('#studentName', '王小明');
  await page.click('#submitButton');
  assert.ok((await page.locator('#message').innerText()).includes('每門課程'), '未選完不可送出');
  // 這學期的課若剛好沒有衝堂，就臨時加一門與第一門同時段的測試課，確保衝堂邏輯仍被測到
  await page.evaluate(() => { if (!courses.some((a) => courses.some((c) => a.id < c.id && coursesOverlap(a, c)))) { courses.push({ ...courses[0], id: 'zz-overlap-test', name: '測試衝堂課' }); renderCourses(); updateSummary(); } });
  const pair = await page.evaluate(() => { for (const a of courses) for (const c of courses) if (a.id < c.id && coursesOverlap(a, c)) return [a.id, c.id]; return null; });
  assert.ok(pair, '資料中應至少有一組時間重疊的課程');
  await page.click(`button[data-course="${pair[0]}"][data-choice="yes"]`);
  await page.click(`button[data-course="${pair[1]}"][data-choice="yes"]`);
  assert.ok((await page.locator('#message').innerText()).includes('時間重疊'), '兩門衝堂都選會修應被擋');
  assert.ok(!(await page.locator(`button[data-course="${pair[1]}"][data-choice="yes"].is-selected`).count()), '被擋的那門不應顯示為已選');
  await page.click(`button[data-course="${pair[1]}"][data-choice="maybe"]`);
  const rest = await page.evaluate(([a, c]) => courses.filter((x) => x.id !== a && x.id !== c).map((x) => x.id), pair);
  for (const id of rest) await page.click(`button[data-course="${id}"][data-choice="no"]`);
  await page.click('#submitButton');
  await page.waitForSelector('#resultCard:not(.hidden)');
  assert.ok(await page.locator('#overlapWarning:not(.hidden)').count(), '會修與考慮中重疊時，結果頁應列出重疊提醒');
  assert.deepStrictEqual(page.errors, []);
});

test('預選登記：手機結果頁只顯示截圖版，且只含有排入課程的日期', async (b, base) => {
  const page = await newPage(b, base, { viewport: { width: 390, height: 844 }, mobile: true });
  await page.context().addInitScript(() => { window.__EAP_FORCE_REGISTER = true; });
  await page.goto(base + '/course-registration.html'); await page.waitForSelector('.course-card');
  const plan = await page.evaluate(() => {
    const yes = []; const picks = {};
    for (const c of courses) { if (c.day === 2 && !yes.some((y) => coursesOverlap(y, c))) { yes.push(c); picks[c.id] = 'yes'; } else picks[c.id] = 'no'; }
    return { picks, days: [...new Set(yes.map((c) => c.day))].length };
  });
  await fillRegistration(page, plan.picks);
  await page.click('#submitButton');
  await page.waitForSelector('#resultCard:not(.hidden)');
  assert.strictEqual(await page.locator('#resultCard').getAttribute('data-schedule-view'), 'compact');
  assert.ok(!(await page.locator('#resultCard .schedule-wrap').isVisible()), '手機不應顯示詳細版週課表');
  assert.ok(await page.locator('.compact-schedule-panel').isVisible(), '手機應顯示截圖版');
  assert.strictEqual(await page.locator('.compact-day-head').count(), 1 + plan.days, '截圖版只該有「節」加上有課的日期');
  assert.deepStrictEqual(page.errors, []);
});

test('預選登記：全部選不會修時，截圖版顯示「沒有排入」', async (b, base) => {
  const page = await newPage(b, base, { viewport: { width: 390, height: 844 }, mobile: true });
  await page.context().addInitScript(() => { window.__EAP_FORCE_REGISTER = true; });
  await page.goto(base + '/course-registration.html'); await page.waitForSelector('.course-card');
  const picks = await page.evaluate(() => Object.fromEntries(courses.map((c) => [c.id, 'no'])));
  await fillRegistration(page, picks);
  await page.click('#submitButton');
  await page.waitForSelector('#resultCard:not(.hidden)');
  assert.ok((await page.locator('#compactScheduleGrid').innerText()).includes('目前沒有排入會修或考慮中的課程'));
  assert.deepStrictEqual(page.errors, []);
});

// ---------- 自動填表 ----------
const JSZipNode = require('../vendor/jszip.min.js');
const PROFILE = { name: '歐陽慕容小明', sid: '112123456', phone: '0912345678', email: 'ouyang.murong@example.com', title: '測試論文題目' };
const FILL_KEY = 'eapFillProfile_v1';
const QUAL = 'documents/proposal/qualifying-exam-application.odt';

async function openQualification(page) {
  await openHome(page); await dismissModals(page);
  await enterMode(page, 'proposal');
  const label = await page.evaluate(() => baseFlow.precheck.passedLabel);
  await retry(page, () => page.getByText(label, { exact: false }).first().click());
  await page.waitForSelector('.qualification-download');
}
async function readDownload(dl) {
  const buf = fs.readFileSync(await dl.path());
  const zip = await JSZipNode.loadAsync(buf);
  return { buf, zip, xml: await zip.file('content.xml').async('string'), name: dl.suggestedFilename() };
}
const fillModalOpen = (page) => page.evaluate(() => !document.querySelector('#fillModal').classList.contains('hidden'));

test('自動填表：第一次跳窗、填好下載、檔名與內容正確；第二次不再跳窗；晶片可修改', async (b, base) => {
  const page = await newPage(b, base);
  await openQualification(page);
  const [dl] = await Promise.all([page.waitForEvent('download'), (async () => {
    await retry(page, () => page.locator('.qualification-download').click());
    await page.waitForSelector('#fillModal:not(.hidden)');
    for (const k of Object.keys(PROFILE)) await page.fill('#fill_' + k, PROFILE[k]);
    await page.click('#fillSubmit');
  })()]);
  const r = await readDownload(dl);
  assert.strictEqual(r.name, '資格考試申請表.odt');
  assert.ok(r.xml.includes(PROFILE.name) && r.xml.includes(PROFILE.sid) && r.xml.includes(PROFILE.email), '下載檔應含姓名、學號、e-mail');
  const names = Object.keys(r.zip.files);
  assert.strictEqual(names[0], 'mimetype', 'mimetype 必須是第一個檔案');
  assert.strictEqual(await r.zip.file('mimetype').async('string'), 'application/vnd.oasis.opendocument.text');
  // 流程有接續（按下載後才標記）
  await page.waitForSelector('.qualification-question');
  // 晶片
  await page.waitForSelector('#fillChip:not([hidden])');
  assert.ok((await page.locator('#fillChipText').innerText()).includes(PROFILE.name));
  // 第二次：不跳窗直接下載已填檔
  const [dl2] = await Promise.all([page.waitForEvent('download'), retry(page, () => page.locator('.qualification-download').click())]);
  assert.ok(!(await fillModalOpen(page)), '第二次不應再跳窗');
  assert.ok((await readDownload(dl2)).xml.includes(PROFILE.name));
  // 改資料
  await page.click('#fillChipEdit'); await page.waitForSelector('#fillModal:not(.hidden)');
  assert.strictEqual(await page.inputValue('#fill_name'), PROFILE.name);
  assert.ok(await page.locator('#fillSkip').isHidden(), '編輯模式不顯示「不填」');
  await page.fill('#fill_name', '王小明'); await page.click('#fillSubmit');
  assert.ok((await page.locator('#fillChipText').innerText()).includes('王小明'));
  assert.strictEqual(JSON.parse(await page.evaluate((k) => localStorage.getItem(k), FILL_KEY)).name, '王小明');
  assert.deepStrictEqual(page.errors, []);
});

test('自動填表：「不填，下載空白表」下載的就是原檔；取消則不下載也不標記', async (b, base) => {
  const page = await newPage(b, base);
  await openQualification(page);
  // 取消
  await retry(page, () => page.locator('.qualification-download').click());
  await page.waitForSelector('#fillModal:not(.hidden)');
  await page.click('#fillCancel');
  await page.waitForTimeout(400);
  assert.strictEqual(await page.locator('.qualification-question').count(), 0, '取消不應視為已下載');
  assert.strictEqual(await page.evaluate((k) => localStorage.getItem(k), FILL_KEY), null);
  // 不填
  const [dl] = await Promise.all([page.waitForEvent('download'), (async () => {
    await retry(page, () => page.locator('.qualification-download').click());
    await page.waitForSelector('#fillModal:not(.hidden)');
    await page.click('#fillSkip');
  })()]);
  const orig = Buffer.from(await page.evaluate(async (u) => [...new Uint8Array(await (await fetch(u)).arrayBuffer())], QUAL));
  assert.ok((await readDownload(dl)).buf.equals(orig), '空白表應與原檔位元組相同');
  await page.waitForSelector('.qualification-question');
  assert.strictEqual(await page.evaluate((k) => localStorage.getItem(k), FILL_KEY), null, '選不填不應存資料');
  assert.deepStrictEqual(page.errors, []);
});

test('自動填表：欄位留空標紅色 ○；不可填的表單不受影響', async (b, base) => {
  const page = await newPage(b, base);
  await openQualification(page);
  const [dl] = await Promise.all([page.waitForEvent('download'), (async () => {
    await retry(page, () => page.locator('.qualification-download').click());
    await page.waitForSelector('#fillModal:not(.hidden)');
    await page.fill('#fill_name', PROFILE.name); // 其他留空
    await page.click('#fillSubmit');
  })()]);
  const r = await readDownload(dl);
  assert.ok(r.xml.includes('TfillRed') && r.xml.includes('○'), '留空欄位應標紅色 ○');
  assert.ok(/○{3,}/.test(r.xml) && r.xml.includes('fo:background-color="#ffe14d"'), '留空欄位的 ○ 應重複多個並加黃底');
  const res = await page.evaluate(() => {
    const a = document.createElement('a');
    return { fillable: FillForm.isFillable('documents/proposal/committee-invitation.odt'), attached: FillForm.attach(a, 'documents/proposal/committee-invitation.odt', 'x.odt', () => {}) };
  });
  assert.deepStrictEqual(res, { fillable: false, attached: false });
  assert.deepStrictEqual(page.errors, []);
});

test('預約教室：訊息即時更新、帶入已填的姓名學號、有選項才寫日期；流程裡兩處都有', async (b, base) => {
  const page = await newPage(b, base);
  await openHome(page); await dismissModals(page);
  const out = await page.evaluate(() => {
    localStorage.setItem(FillForm._KEY, JSON.stringify({ name: '郭哲宇', sid: '113171009' }));
    const box = RoomBooking.build('學位論文計畫口試'); document.body.append(box); box.open = true; box.dispatchEvent(new Event('toggle'));
    const area = box.querySelector('textarea'); const blank = area.value;
    const d = box.querySelector('input[type=date]'); d.value = '2027-03-10'; d.dispatchEvent(new Event('input', { bubbles: true }));
    const sel = box.querySelectorAll('.booking-grid select'); sel[0].value = '14:00'; sel[0].dispatchEvent(new Event('change', { bubbles: true }));
    const filled = area.value;
    // 指導教授：下拉選（含「其他」；R 11/14 決定不要共同指導）
    const adv = box.querySelectorAll('.booking-people select');
    const names = [...adv[0].options].map((o) => o.textContent);
    adv[0].value = '郭昭佑'; adv[0].dispatchEvent(new Event('change', { bubbles: true }));
    const one = area.value;
    adv[0].value = adv[0].options[adv[0].options.length - 1].value; adv[0].dispatchEvent(new Event('change', { bubbles: true }));
    const other = box.querySelector('.booking-other'); const otherShown = !other.hidden;
    other.value = '王大明'; other.dispatchEvent(new Event('input', { bubbles: true }));
    const typed = area.value;
    const r = { blank, filled, end: sel[1].value, names, one, typed, otherShown, advCount: adv.length, share: !!box.querySelector('.booking-share') }; box.remove(); return r;
  });
  assert.deepStrictEqual(out.names, ['選擇', '吳政達', '郭昭佑', '秦夢群', '湯志民', '陳榮政', '侯永琪', '顏敏仁', '湯家偉', '莊俊儒', '其他（自己填）'], '指導教授名單與順序（R 指定）');
  assert.ok(out.blank.includes('指導教授是○○○老師'), '沒選指導教授以 ○ 佔位');
  assert.ok(out.one.includes('指導教授是郭昭佑老師。'), '選了指導教授寫進訊息');
  assert.ok(out.otherShown && out.typed.includes('指導教授是王大明老師。'), '選「其他」可自己打老師姓名');
  assert.strictEqual(out.advCount, 1, '只有一個指導教授欄（不要共同指導）');
  assert.ok(!out.share, '電腦版（非手機獨立視窗）不顯示分享鈕');
  assert.ok(out.blank.includes('○○月○○日（星期○）') && out.blank.includes('00:00–00:00'), '沒選日期以 ○、時間以 00:00 佔位');
  assert.ok(out.filled.includes('郭哲宇') && out.filled.includes('113171009') && out.filled.includes('教政所113級'), '應帶入已填的姓名、學號與級數');
  assert.ok(out.filled.includes('2027年3月10日（星期三）') && out.filled.includes('14:00–16:00') && out.filled.includes('學位論文計畫口試'), '日期、時段與流程名稱');
  assert.ok(out.filled.startsWith('莊姐您好') && out.filled.includes('303 教室') && out.filled.endsWith('麻煩莊姐了，謝謝！'), '照範本：給莊姐、借 303 教室');
  const empty = await page.evaluate(() => RoomBooking.draft('學位論文考試', {}));
  assert.ok(empty.includes('學號：000000000') && empty.includes('教政所○○○級'), '沒填學號時以 0 佔位、級數以 ○ 佔位');
  assert.strictEqual(out.end, '16:00', '選開始後結束時間預設 2 小時後');
  assert.ok(!/@|mailto:/.test(out.filled), '訊息不應含 e-mail 位址');
  const tools = await page.evaluate(() => baseFlow.steps.find((st) => st.id === 'proposal-docs').documents.find((d) => d.id === 'proposal-application').tool);
  assert.strictEqual(tools, 'roomBooking', '計畫口試申請表應掛預約教室工具');
  const pg = await newPage(b, base);
  await openHome(pg); await dismissModals(pg);
  await enterMode(pg, 'defense');
  const n = await pg.locator('.precheck-choice').count();
  for (let i = 0; i < n; i++) {
    const item = pg.locator('.precheck-choice').nth(i);
    if (!(await item.evaluate((el) => el.classList.contains('is-checked')))) await retry(pg, () => item.click());
  }
  await greedyWalk(pg);
  assert.ok((await pg.locator('#stepsList .booking').count()) >= 1, '學位論文考試的申請步驟應有預約教室工具');
  assert.deepStrictEqual(pg.errors, []);
  assert.deepStrictEqual(page.errors, []);
});

test('手機：首頁不被撐寬；被擋視窗有「只寫預約訊息」入口（畢業專區沒有）；預約視窗可帶入、分享、Esc 關閉', async (b, base) => {
  const page = await newPage(b, base, { viewport: { width: 360, height: 668 }, mobile: true });
  await page.addInitScript(() => { navigator.share = (d) => { window.__shared = d.text; return Promise.resolve(); }; });
  // 第一次進站期限提醒開著時，首頁卡片會先藏起來：先等提醒出現並關掉，再找卡片
  await page.goto(base + '/index.html');
  await page.waitForSelector('#deadlineModal:not(.hidden)', { timeout: 4000 }).catch(() => {});
  await dismissModals(page);
  await page.waitForSelector('.mode-card');
  assert.strictEqual(await page.evaluate(() => document.documentElement.scrollWidth), 360, '手機首頁不可比螢幕寬');
  await page.evaluate(() => localStorage.setItem(FillForm._KEY, JSON.stringify({ name: '郭哲宇', sid: '113171009' })));
  // 期限提醒偶爾晚一點才跳出、蓋住按鈕：用 retry（會先關彈窗）
  await retry(page, async () => { if (!(await page.locator('#mobileOnlyNoticeModal:not(.hidden)').count())) await page.click('#openGraduation', { timeout: 2000 }); await page.waitForSelector('#mobileOnlyNoticeModal:not(.hidden)', { timeout: 2000 }); });
  assert.ok(await page.locator('#openMobileBooking').isHidden(), '畢業專區不顯示預約入口');
  await page.click('#closeMobileOnlyNotice');
  await retry(page, async () => { if (!(await page.locator('#mobileOnlyNoticeModal:not(.hidden)').count())) await page.click('.mode-card[data-mode="defense"]', { timeout: 2000 }); await page.waitForSelector('#openMobileBooking:visible', { timeout: 2000 }); });
  await page.click('#openMobileBooking');
  await page.waitForSelector('#mobileBookingModal:not(.hidden)');
  assert.ok(await page.locator('#mobileOnlyNoticeModal').evaluate((el) => el.classList.contains('hidden')), '開預約視窗時關掉被擋提醒');
  const box = page.locator('#mobileBookingBody .booking');
  assert.strictEqual(await box.locator('input').first().inputValue(), '郭哲宇', '姓名帶入自動填表資料');
  await box.locator('.booking-grid select').first().selectOption('湯家偉');
  const text = await box.locator('textarea').inputValue();
  assert.ok(text.includes('學位論文考試') && text.includes('指導教授是湯家偉老師') && text.includes('113171009'), '依點的主卡決定流程，帶入姓名學號與指導教授');
  const fonts = await box.evaluate((el) => [...el.querySelectorAll('input:not([hidden]), select, textarea')].map((x) => parseFloat(getComputedStyle(x).fontSize)));
  assert.ok(fonts.every((f) => f >= 16), '手機輸入欄至少 16px（iPhone 才不會放大）：' + fonts.join(','));
  const fits = await page.evaluate(() => { const r = document.querySelector('.mobile-booking-card').getBoundingClientRect(); return r.right <= innerWidth && document.documentElement.scrollWidth === innerWidth; });
  assert.ok(fits, '預約視窗不可超出手機螢幕');
  await box.locator('.booking-share').click();
  assert.strictEqual(await page.evaluate(() => window.__shared), text, '分享的是訊息全文');
  await page.keyboard.press('Escape');
  assert.ok(await page.locator('#mobileBookingModal').evaluate((el) => el.classList.contains('hidden')), 'Esc 關閉預約視窗');
  assert.deepStrictEqual(page.errors, []);
});

test('手機課程表：依星期分組的清單（沒課的星期不列），格線課表與科目表收起；電腦不受影響', async (b, base) => {
  const page = await newPage(b, base, { viewport: { width: 360, height: 668 }, mobile: true });
  await page.goto(base + '/course-registration.html'); await page.waitForSelector('.day-course');
  const m = await page.evaluate(() => ({
    days: [...document.querySelectorAll('.day-group h3')].map((h) => h.firstChild.textContent),
    n: document.querySelectorAll('.day-course').length,
    total: courses.length,
    grid: getComputedStyle(document.querySelector('#timetableView .schedule-wrap')).display,
    table: getComputedStyle(document.querySelector('.timetable-table-wrap')).display,
    sw: document.documentElement.scrollWidth,
    code: document.querySelector('.day-course').textContent.includes(courses.filter((c) => c.day === Math.min(...courses.map((x) => x.day))).sort((a, b) => a.start - b.start)[0].code)
  }));
  const expectDays = [...new Set((await page.evaluate(() => courses.map((c) => c.day))))].sort().map((d) => '星期' + '一二三四五'[d - 1]);
  assert.deepStrictEqual(m.days, expectDays, '只列有課的星期');
  assert.strictEqual(m.n, m.total, '每門課都有一張卡');
  assert.ok(m.grid === 'none' && m.table === 'none', '手機收起格線課表與科目表');
  assert.strictEqual(m.sw, 360, '手機課程表頁不可比螢幕寬');
  assert.ok(m.code, '卡片含課號');
  const desk = await newPage(b, base);
  await desk.goto(base + '/course-registration.html'); await desk.waitForSelector('.tt-block');
  assert.strictEqual(await desk.evaluate(() => getComputedStyle(document.querySelector('#timetableDayList')).display), 'none', '電腦不顯示清單');
  assert.deepStrictEqual(page.errors, []);
  assert.deepStrictEqual(desk.errors, []);
});

test('防嵌入：被放進別人網頁的框架時內容隱藏；正常開啟不受影響', async (b, base) => {
  const page = await newPage(b, base);
  await page.setContent(`<iframe id="f" src="${base}/index.html" width="900" height="600"></iframe>`);
  const frame = await (await page.waitForSelector('#f')).contentFrame();
  await frame.waitForLoadState('load');
  await page.waitForTimeout(500);
  const shown = await frame.evaluate(() => getComputedStyle(document.documentElement).display).catch(() => 'navigated');
  assert.ok(shown === 'none' || shown === 'navigated', '被嵌入時應隱藏內容：' + shown);
  const ok = await newPage(b, base);
  await openHome(ok);
  assert.notStrictEqual(await ok.evaluate(() => getComputedStyle(document.documentElement).display), 'none');
  assert.deepStrictEqual(ok.errors, []);
});

test('3.1 步驟：鎖住的步驟收成一列（無內容、有小鎖），解鎖後展開；重設進度先確認', async (b, base) => {
  const page = await newPage(b, base);
  await openHome(page); await dismissModals(page);
  await page.click('.mode-card[data-mode="proposal"]'); await dismissModals(page);
  const locked = page.locator('#stepsList .step-card.is-locked');
  assert.strictEqual(await locked.count(), 4, '一開始後面 4 步應鎖住');
  assert.strictEqual(await locked.locator('.lock-icon').count(), 4, '每個鎖住的步驟都有小鎖');
  assert.strictEqual(await locked.locator('.instruction, .document-item, a, button').count(), 0, '鎖住的步驟不應有任何內容');
  assert.ok(!(await page.locator('#stepsList').innerText()).includes('尚未開啟'), '不再出現「尚未開啟」');
  await page.locator('text=我已修業滿 18 學分').click(); await dismissModals(page);
  // 有進度後按重設：取消則保留
  const before = await page.locator('#progressText, .progress-meter span').first().innerText();
  page.removeAllListeners('dialog');
  let asked = '';
  page.once('dialog', (d) => { asked = d.message(); d.dismiss(); });
  await page.click('#resetProgress');
  await page.waitForTimeout(200);
  if (before.trim().startsWith('0')) assert.strictEqual(asked, '', '沒有進度時不需確認');
  else {
    assert.ok(asked.includes('重設'), '有進度時重設應先確認');
    assert.strictEqual(await page.locator('#progressText, .progress-meter span').first().innerText(), before, '取消後進度不變');
  }
  page.on('dialog', (d) => d.accept());
  assert.deepStrictEqual(page.errors, []);
});

test('最新消息：依日期顯示、一次三則每 5 秒往上捲一則、滑鼠移上去暫停、全部過期就隱藏', async (b, base) => {
  const fake = (iso) => async (ctx) => ctx.addInitScript((t) => {
    const start = new Date(t).getTime(), D = Date, t0 = D.now(), now = () => start + (D.now() - t0);
    Date = class extends D { constructor(...a) { if (a.length) super(...a); else super(now()); } static now() { return now(); } };
  }, iso);
  // 12/11：12/10 那兩則已過期
  let page = await newPage(b, base);
  await fake('2026-12-11T10:00:00+08:00')(page.context());
  await openHome(page); await dismissModals(page);
  await page.mouse.move(2, 2); // 關掉期限視窗後滑鼠可能剛好停在消息列上（會暫停捲動），先移開
  const items = page.locator('#newsStrip .news-item:not(.is-clone)');
  assert.ok(await page.locator('#newsStrip').isVisible(), '有消息時應顯示');
  assert.strictEqual(await items.count(), 5, '12/11 時應剩 5 則');
  assert.ok(!(await items.allTextContents()).some((t) => t.startsWith('12/10')), '過期的不顯示');
  assert.ok((await items.first().innerText()).includes('還有'), '每則應有倒數天數');
  assert.strictEqual(await page.evaluate(() => getComputedStyle(document.querySelector('#newsStrip .news-viewport')).getPropertyValue('--news-rows').trim()), '3', '一次應顯示三則');
  const first = await page.locator('#newsStrip .news-item.is-active').innerText();
  await page.waitForTimeout(5600);
  const second = await page.locator('#newsStrip .news-item.is-active').innerText();
  assert.notStrictEqual(first, second, '5 秒後應換下一則');
  await page.hover('#newsStrip');
  await page.waitForTimeout(5600);
  assert.strictEqual(await page.locator('#newsStrip .news-item.is-active').innerText(), second, '滑鼠移上去應暫停');
  assert.deepStrictEqual(page.errors, []);
  await page.context().close();
  // 全部過期
  page = await newPage(b, base);
  await fake('2027-03-01T10:00:00+08:00')(page.context());
  await openHome(page); await dismissModals(page);
  assert.ok(!(await page.locator('#newsStrip').isVisible()), '全部過期應隱藏');
  assert.deepStrictEqual(page.errors, []);
});

test('Esc 關彈窗；上一頁（滑鼠側鍵）從流程與畢業專區退回上一層', async (b, base) => {
  const page = await newPage(b, base);
  await openHome(page);
  // 首次進站的提報期限視窗：按 Esc 關閉
  if (await page.locator('#deadlineModal:not(.hidden)').count()) {
    await page.keyboard.press('Escape');
    assert.strictEqual(await page.locator('#deadlineModal:not(.hidden)').count(), 0, 'Esc 應關閉提報期限視窗');
  }
  await dismissModals(page);
  // 畢業專區：進某一級 → 上一頁回級數選單 → Esc 關閉
  await page.click('#openGraduation'); await page.waitForSelector('.graduation-grade-card');
  await page.locator('.graduation-grade-card').first().click();
  assert.ok(await page.locator('.graduation-card.is-detail').count(), '應進到該級內頁');
  await page.goBack(); await page.waitForTimeout(200);
  assert.ok(await page.locator('.graduation-card.is-grade-picker').count(), '上一頁應回級數選單');
  await page.keyboard.press('Escape');
  assert.ok(await page.locator('#graduationModal.hidden').count(), 'Esc 應關閉畢業專區');
  // 流程：進流程 → 上一頁回首頁；用「回首頁」鈕離開後，再按上一頁不應又跳回流程
  await page.click('.mode-card[data-mode="proposal"]'); await dismissModals(page);
  assert.ok(await page.evaluate(() => document.body.classList.contains('workflow-open')), '應進入流程');
  await page.goBack(); await page.waitForTimeout(200);
  assert.ok(!(await page.evaluate(() => document.body.classList.contains('workflow-open'))), '上一頁應回首頁');
  await page.click('.mode-card[data-mode="proposal"]'); await dismissModals(page);
  await page.click('#backToModes'); await page.waitForTimeout(200);
  assert.strictEqual(await page.evaluate(() => history.state && history.state.view), 'home', '按回首頁後瀏覽紀錄應停在首頁');
  assert.deepStrictEqual(page.errors, []);
  await page.context().close();
});

test('歷屆論文：首頁入口開名單、每位老師連到論文系統（限教政所、指導教授欄位，新分頁）、Esc 與關閉鈕可關；跨年消息自動加民國年', async (b, base) => {
  const page = await newPage(b, base);
  await openHome(page);
  await dismissModals(page);
  await page.click('#openTheses');
  assert.ok(await page.locator('#thesesModal:not(.hidden)').count(), '應打開歷屆論文視窗');
  const links = await page.$$eval('#thesesModal .thesis-advisor', (as) => as.map((a) => ({ name: a.firstChild.textContent.trim(), href: a.href, target: a.target, rel: a.rel })));
  assert.deepStrictEqual(links.map((l) => l.name), ['吳政達', '秦夢群', '湯志民', '郭昭佑', '陳榮政', '侯永琪', '顏敏仁', '湯家偉', '莊俊儒']);
  for (const l of links) {
    const u = new URL(l.href);
    assert.strictEqual(u.origin + u.pathname, 'https://thesis.lib.nccu.edu.tw/search/', l.name + ' 應連到論文系統搜尋');
    assert.deepStrictEqual(u.searchParams.getAll('query_term'), ['教育行政', l.name], l.name + ' 應搜教政所＋老師名字');
    assert.deepStrictEqual(u.searchParams.getAll('query_field'), ['dept', 'cadvisor'], l.name + ' 應限系所、且只搜指導教授欄位');
    assert.strictEqual(l.target, '_blank'); assert.ok(l.rel.includes('noopener'));
  }
  await page.keyboard.press('Escape');
  assert.ok(await page.locator('#thesesModal.hidden').count(), 'Esc 應關閉歷屆論文視窗');
  await page.click('#openTheses'); await page.click('#closeTheses');
  assert.ok(await page.locator('#thesesModal.hidden').count(), '關閉鈕應關閉視窗');
  // 跨年消息：until 年份比今年大才加民國年，今年的不加
  const texts = await page.$$eval('#newsStrip .news-item:not(.is-clone) .news-text', (els) => els.map((e) => e.textContent));
  const year = Number(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei', year: 'numeric' }).format(new Date()));
  assert.ok(texts.every((t) => !/^\d{3}\//.test(t) || Number(t.slice(0, 3)) + 1911 > year), '只有隔年以後的消息才加民國年：' + texts.join(' | '));
  assert.ok(texts.every((t) => !t.includes('校訂日')), '消息不應再寫校訂日');
  assert.deepStrictEqual(page.errors, []);
  await page.context().close();
});

test('續辦首頁：有進度的流程卡片顯示完成數；沒進度不顯示；改選另一個流程前先確認', async (b, base) => {
  const blank = await newPage(b, base);
  await openHome(blank); await dismissModals(blank);
  assert.deepStrictEqual(await blank.locator('.mode-card .mode-status').allInnerTexts(), ['點擊進入', '點擊進入']);
  assert.deepStrictEqual(blank.errors, []);
  const page = await newPage(b, base, { seed: { mode: 'defense', started: true, precheckAck: true } });
  await openHome(page); await dismissModals(page);
  await page.waitForSelector('.mode-card');
  // 這個種子沒進入流程，首頁一載入就該看到進度
  const texts = await page.evaluate(() => Array.from(document.querySelectorAll('.mode-card')).map((c) => [c.dataset.mode, c.querySelector('.mode-status').textContent]));
  const defense = texts.find((t) => t[0] === 'defense')[1], proposal = texts.find((t) => t[0] === 'proposal')[1];
  assert.ok(/^繼續上次進度（\d+ \/ \d+）$/.test(defense) && !/^繼續上次進度（0 /.test(defense), defense);
  assert.strictEqual(proposal, '點擊進入');
  // 進流程再回首頁，數字要跟流程裡的進度條一致
  await enterMode(page, 'defense');
  const nChoice = await page.locator('.precheck-choice').count();
  for (let i = 0; i < nChoice; i++) {
    const item = page.locator('.precheck-choice').nth(i);
    if (!(await item.evaluate((el) => el.classList.contains('is-checked')))) await retry(page, () => item.click());
  }
  await greedyWalk(page);
  const bar = (await page.locator('#progressText').innerText()).replace(/\s/g, '');
  assert.ok(!bar.startsWith('0/'), '走完流程後進度不該是 0：' + bar);
  if (await page.locator('#closeCelebration').isVisible()) await page.click('#closeCelebration'); else await page.click('#backToModes');
  const back = await page.locator('.mode-card[data-mode="defense"] .mode-status').innerText();
  assert.strictEqual(back, `繼續上次進度（${bar.replace('/', ' / ')}）`);
  // 改選另一個流程：先確認；取消就保留，同意才清除
  let asked = '';
  page.removeAllListeners('dialog');
  page.once('dialog', (d) => { asked = d.message(); d.dismiss(); });
  await page.click('.mode-card[data-mode="proposal"]');
  assert.ok(asked.includes('清除') , '應先跳出確認：' + asked);
  assert.ok(!(await page.locator('body').evaluate((el) => el.classList.contains('workflow-open'))), '取消後仍在首頁');
  assert.ok((await page.locator('.mode-card[data-mode="defense"] .mode-status').innerText()).startsWith('繼續上次進度'), '取消後進度還在');
  page.once('dialog', (d) => d.accept());
  await page.click('.mode-card[data-mode="proposal"]');
  await page.waitForSelector('body.workflow-open');
  await page.click('#backToModes');
  assert.strictEqual(await page.locator('.mode-card[data-mode="defense"] .mode-status').innerText(), '點擊進入', '同意切換後，舊流程進度已清除');
  assert.deepStrictEqual(page.errors, []);
});

test('自動填表：已有資料時走完整個流程，所有可填表單都直接下載、不跳窗', async (b, base) => {
  const page = await newPage(b, base);
  await page.context().addInitScript(([k, v]) => { if (!localStorage.getItem('__fillseeded')) { localStorage.setItem(k, v); localStorage.setItem('__fillseeded', '1'); } }, [FILL_KEY, JSON.stringify(PROFILE)]);
  const downloads = [];
  page.on('download', (d) => downloads.push(d));
  await openQualification(page);
  await retry(page, () => page.locator('.qualification-download').click());
  await page.waitForSelector('.qualification-question');
  await retry(page, () => page.locator('.qualification-question label').nth(0).click());
  await page.waitForTimeout(500);
  await greedyWalk(page);
  const r = await walkAssertFinished(page);
  assert.ok(r.total > 0 && r.done === r.total && r.celebration, `流程未走完：${r.text}`);
  assert.ok(downloads.length >= 4, `應有多份下載，實際 ${downloads.length}`);
  assert.ok(downloads.every((d) => d.suggestedFilename().endsWith('.odt') || d.suggestedFilename().endsWith('.docx')), '下載副檔名異常');
  assert.ok(!(await fillModalOpen(page)));
  assert.deepStrictEqual(page.errors, []);
});

async function runSuite(root, { stub = false, only = null } = {}) {
  const srv = await serve(root, stub);
  const base = 'http://localhost:' + srv.address().port;
  const exe = process.env.PW_CHROMIUM;
  const browser = await chromium.launch({ args: ['--no-sandbox'], env: { ...process.env, LC_ALL: 'C.UTF-8' }, ...(exe ? { executablePath: exe } : {}) })  // UTF-8：否則中文下載檔名會被 Chromium 換成 download;
  const results = [];
  for (const t of tests) {
    if (only && !only.test(t.name)) continue;
    try { await t.fn(browser, base); results.push({ name: t.name, ok: true }); }
    catch (e) { results.push({ name: t.name, ok: false, msg: String(e.message).split('\n').slice(0, process.env.E2E_VERBOSE ? 14 : 1).join(' | ').slice(0, process.env.E2E_VERBOSE ? 1500 : 300) }); }
    // 每個測試結束就關掉它開的分頁：留著會一直吃 CPU，拖慢後面的測試（倒數計時走不動而逾時）
    for (const c of browser.contexts()) await c.close().catch(() => {});
  }
  await browser.close(); srv.close();
  return results;
}

module.exports = { runSuite, tests, newPage, openHome, dismissModals, greedyWalk, serve, retry, enterMode };

if (require.main === module) {
  const root = path.resolve(process.argv[2] || path.join(__dirname, '..'));
  runSuite(root, { stub: process.env.E2E_STUB === '1' }).then((rs) => {
    for (const r of rs) console.log((r.ok ? '通過  ' : '失敗  ') + r.name + (r.ok ? '' : '\n      → ' + r.msg));
    const bad = rs.filter((r) => !r.ok).length;
    console.log(`\n結果：${rs.length - bad} 通過、${bad} 失敗`);
    process.exit(bad ? 1 : 0);
  });
}
