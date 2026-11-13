/* 自動填表：點擊可填的 .odt 表單時，第一次跳出小視窗收集基本資料，
   之後每份表單都直接下載「已填好」的版本。資料只存在這台電腦的瀏覽器（localStorage），不會上傳。
   依賴：js/odtfill.js（fillOdt）。 */
(function (global) {
  var KEY = "eapFillProfile_v1";
  var FIELDS = ["name", "sid", "phone", "email", "title"];
  // 有欄位可以自動填的表單（路徑須與 data/flow.js 一致）
  var FILLABLE = [
    "documents/proposal/01-proposal-review-checklist.odt",
    "documents/proposal/04-committee-review-result.odt",
    "documents/proposal/05-committee-summary-result.odt",
    "documents/proposal/qualifying-exam-application.odt",
    "documents/defense/00-defense-checklist.odt",
    "documents/defense/02-originality-report.odt",
    "documents/defense/04-exam-scoring-sheet.odt",
    "documents/defense/aigc-detection-report.odt"
  ];
  var skippedThisVisit = false; // 選過「不填」後，這次瀏覽不再一直跳窗
  var pending = null;           // 等彈窗結果的那次下載

  function $(s) { return document.querySelector(s); }
  function isFillable(href) { return FILLABLE.indexOf(href) >= 0; }

  function load() {
    try {
      var p = JSON.parse(localStorage.getItem(KEY) || "null");
      if (p && typeof p === "object") return p;
    } catch (e) { /* 讀不到就當作沒有 */ }
    return null;
  }
  function save(p) { try { localStorage.setItem(KEY, JSON.stringify(p)); } catch (e) { /* 無法儲存時仍可使用這一次 */ } }
  function clear() { try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ } }
  function clean(v) { return String(v == null ? "" : v).replace(/[\s　]+/g, " ").trim(); }
  function hasAny(p) { return !!p && FIELDS.some(function (k) { return clean(p[k]); }); }

  function triggerDownload(href, name) {
    var a = document.createElement("a");
    a.href = href;
    if (name) a.download = name;
    a.rel = "noopener noreferrer";
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { a.remove(); }, 1000);
  }

  async function downloadFilled(href, name, profile) {
    var res = await global.fillOdt(href, profile);
    var url = URL.createObjectURL(res.blob);
    triggerDownload(url, name);
    setTimeout(function () { URL.revokeObjectURL(url); }, 30000);
  }

  // 完成一次下載（填好 → 失敗就退回原始空白檔），最後通知 app.js
  async function run(href, name, profile, onDone) {
    if (profile) {
      try { await downloadFilled(href, name, profile); }
      catch (e) { triggerDownload(href, name); }
    } else {
      triggerDownload(href, name);
    }
    if (onDone) onDone();
  }

  function readForm() {
    var p = {};
    FIELDS.forEach(function (k) { p[k] = clean($("#fill_" + k).value); });
    return p;
  }

  function openModal(editOnly) {
    var p = load() || {};
    FIELDS.forEach(function (k) { $("#fill_" + k).value = p[k] || ""; });
    $("#fillModal").classList.toggle("is-edit", !!editOnly);
    $("#fillTitle").textContent = editOnly ? "修改我的基本資料" : "要幫你填好表單嗎？";
    $("#fillSubmit").textContent = editOnly ? "儲存" : "下載已填好的表";
    $("#fillClear").hidden = !load();
    $("#fillModal").classList.remove("hidden");
    $("#fill_name").focus();
  }
  function closeModal() { $("#fillModal").classList.add("hidden"); pending = null; }

  function renderChip() {
    var chip = $("#fillChip");
    if (!chip) return;
    var p = load();
    if (!hasAny(p)) { chip.hidden = true; return; }
    var label = [clean(p.name), clean(p.sid)].filter(Boolean).join("・");
    var text = $("#fillChipText");
    text.replaceChildren();
    var k = document.createElement("span"); k.className = "fill-chip-label"; k.textContent = "表單自動帶入";
    var v = document.createElement("span"); v.className = "fill-chip-value"; v.textContent = label;
    text.append(k, document.createTextNode("　"), v);
    chip.hidden = false;
  }

  function init() {
    var modal = $("#fillModal");
    if (!modal || modal.dataset.ready) return;
    modal.dataset.ready = "1";
    $("#fillForm").addEventListener("submit", function (e) {
      e.preventDefault();
      var p = readForm();
      save(p);
      renderChip();
      var job = pending;
      var edit = modal.classList.contains("is-edit");
      closeModal();
      if (!edit && job) run(job.href, job.name, hasAny(p) ? p : null, job.onDone);
    });
    $("#fillSkip").addEventListener("click", function () {
      var job = pending;
      skippedThisVisit = true;
      closeModal();
      if (job) run(job.href, job.name, null, job.onDone);
    });
    $("#fillCancel").addEventListener("click", closeModal);
    $("#fillClear").addEventListener("click", function () {
      clear(); renderChip();
      FIELDS.forEach(function (k) { $("#fill_" + k).value = ""; });
      $("#fillClear").hidden = true;
    });
    modal.addEventListener("keydown", function (e) { if (e.key === "Escape") closeModal(); });
    $("#fillChipEdit").addEventListener("click", function () { pending = null; openModal(true); });
    renderChip();
  }

  /* 掛到下載連結上。onDone：真的下載後才呼叫（取消視窗則不呼叫）。
     不是可填表單時，什麼都不做，維持原本的連結行為。 */
  function attach(link, href, downloadName, onDone) {
    if (!isFillable(href) || !global.fillOdt || !$("#fillModal")) return false;
    init();
    link.addEventListener("click", function (e) {
      e.preventDefault();
      var p = load();
      if (hasAny(p)) { run(href, downloadName, p, onDone); return; }
      if (skippedThisVisit) { run(href, downloadName, null, onDone); return; }
      pending = { href: href, name: downloadName, onDone: onDone };
      openModal(false);
    });
    return true;
  }

  global.FillForm = { attach: attach, isFillable: isFillable, init: init, _load: load, _KEY: KEY };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})(window);
