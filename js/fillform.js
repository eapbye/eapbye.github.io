/* 自動填表：點擊可填的 .odt 表單時，第一次跳出小視窗收集基本資料，
   之後每份表單都直接下載「已填好」的版本。已存過資料時，每次打開網站的第一次下載仍會先跳窗讓學生確認
   （公用電腦上才不會直接拿到上一位同學的資料），確認後這次瀏覽不再跳。資料只存在這台電腦的瀏覽器（localStorage），不會上傳。
   依賴：js/odtfill.js（fillOdt）。 */
(function (global) {
  var KEY = "eapFillProfile_v1";
  var FIELDS = ["name", "sid", "phone", "email", "title", "examDate", "examStart", "examRoom"];
  // 有欄位可以自動填的表單（路徑須與 data/flow.js 一致）
  var FILLABLE = [
    "documents/proposal/01-proposal-review-checklist.odt",
    "documents/proposal/04-committee-review-result.odt",
    "documents/proposal/05-committee-summary-result.odt",
    "documents/proposal/02-proposal-template.odt",
    "documents/proposal/qualifying-exam-application.odt",
    "documents/defense/00-defense-checklist.odt",
    "documents/defense/02-originality-report.odt",
    "documents/defense/04-exam-scoring-sheet.odt",
    "documents/defense/aigc-detection-report.odt"
  ];
  // 下載檔名用所網的表單全名（不加表號；評審意見表依紙本表頭）。有自動填表姓名時，前面加「姓名_」。
  var FULL_NAMES = {
    "documents/proposal/qualifying-exam-application.odt": "國立政治大學教育行政與政策研究所資格考試申請表",
    "documents/defense/02-originality-report.odt": "學位論文原創比對（Turnitin）證明表",
    "documents/defense/aigc-detection-report.odt": "碩士學位論文AIGC檢測報告書",
    "documents/proposal/01-proposal-review-checklist.odt": "教政所學位論文計畫口試資料檢核表",
    "documents/proposal/02-proposal-template.odt": "國立政治大學教育行政與政策研究所學位論文計畫口試申請表",
    "documents/proposal/committee-invitation.odt": "國立政治大學教育行政與政策研究所學位論文考試邀請函",
    "documents/proposal/04-committee-review-result.odt": "國立政治大學教育行政與政策研究所學位論文計畫口試委員評審意見表",
    "documents/proposal/05-committee-summary-result.odt": "國立政治大學教育行政與政策研究所學位論文計畫口試委員綜合評審結果表",
    "documents/defense/00-defense-checklist.odt": "教政所學位論文考試資料檢核表",
    "documents/defense/03-committee-invitation.odt": "國立政治大學教育行政與政策研究所學位論文考試邀請函",
    "documents/defense/04-exam-scoring-sheet.odt": "國立政治大學教育行政與政策研究所學位論文考試評分表",
    "documents/defense/05-grade-report.odt": "國立政治大學碩、博士學位候選人學位考試成績報告單",
    "documents/defense/06-signature-page.odt": "國立政治大學教育行政與政策研究所碩士班碩士學位論文通過簽名頁",
    "documents/defense/thesis-spine-format.docx": "國立政治大學教育行政與政策研究所碩士論文書背撰打格式",
    "documents/graduation/academic-quality-consent.odt": "國立政治大學碩博士學生電子論文學術品質同意書"
  };
  // 檔名不可用的字元一律拿掉
  function safeName(v) { return String(v || "").replace(/[\\/:*?"<>|]/g, "").replace(/[\s　]+/g, "").trim(); }
  function fileName(href, fallback, profile) {
    var m = /\.([a-z0-9]+)(?:[?#].*)?$/i.exec(href || "");
    var base = FULL_NAMES[href] && m ? FULL_NAMES[href] + "." + m[1].toLowerCase() : (fallback || "");
    if (!base) return "";
    var p = profile === undefined ? load() : profile;
    var who = safeName(p && p.name);
    return who ? who + "_" + base : base;
  }

  var skippedThisVisit = false; // 選過「不填」後，這次瀏覽不再一直跳窗
  var confirmedThisVisit = false; // 這次瀏覽已看過（確認過）存著的資料；公用電腦上才不會拿到上一位的資料
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
  // 學號、手機、e-mail：全形英數（注音輸入法的全形模式）一律轉半形；姓名與題目不轉，免得動到中文標點
  var HALF = { sid: 1, phone: 1, email: 1, examRoom: 1 };
  function half(v) { return String(v).replace(/[\uff01-\uff5e]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0xfee0); }).replace(/\u3000/g, " "); }
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
    name = fileName(href, name, profile || load());
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
    FIELDS.forEach(function (k) { var v = $("#fill_" + k).value; p[k] = clean(HALF[k] ? half(v) : v); });
    return p;
  }

  function openModal(editOnly) {
    var saved = load();
    var p = saved || {};
    FIELDS.forEach(function (k) { $("#fill_" + k).value = p[k] || ""; });
    $("#fillModal").classList.toggle("is-edit", !!editOnly);
    $("#fillTitle").textContent = editOnly ? "修改我的基本資料" : (hasAny(saved) ? "確認你的基本資料" : "要幫你填好表單嗎？");
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
    var exam = /^\d{4}-(\d{2})-(\d{2})$/.exec(clean(p.examDate));
    var label = [clean(p.name), clean(p.sid), exam ? "口試 " + Number(exam[1]) + "/" + Number(exam[2]) + (clean(p.examStart) ? " " + clean(p.examStart) : "") : ""].filter(Boolean).join("・");
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
      confirmedThisVisit = true;
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
      if (hasAny(p) && confirmedThisVisit) { run(href, downloadName, p, onDone); return; }
      if (skippedThisVisit) { run(href, downloadName, null, onDone); return; }
      pending = { href: href, name: downloadName, onDone: onDone };
      openModal(false);
    });
    return true;
  }

  // 預約教室訊息選的日期、開始時間，也記進同一份資料（下載時帶入口試時間）
  function remember(fields) {
    var p = load() || {};
    var changed = false;
    Object.keys(fields).forEach(function (k) {
      if (FIELDS.indexOf(k) < 0) return;
      var v = clean(fields[k]);
      if (v && p[k] !== v) { p[k] = v; changed = true; }
    });
    if (changed) { save(p); renderChip(); }
  }

  global.FillForm = { attach: attach, isFillable: isFillable, init: init, fileName: fileName, remember: remember, _load: load, _KEY: KEY };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})(window);
