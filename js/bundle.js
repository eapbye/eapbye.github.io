/* 送件一條龍：在「最後確認」步驟提供兩個小工具。
   1) 複製送件清單：依繳交對象（所辦／指導教授／口試委員）分組的文字清單，可貼到 LINE 或備忘錄。
   2) 下載全部表單（ZIP）：把這個流程的 ODT 表單一次打包，附一份文字版列印與送件順序；
      可自動填寫的表單會帶入「自動填表」已存的姓名、學號等，沒有資料就保持原檔。
   全程在瀏覽器內處理，不傳送任何資料。依賴：vendor/jszip.min.js、js/odtfill.js、js/fillform.js（皆選用其一缺就略過填寫）。 */
(function (global) {
  var GROUPS = [["office", "所辦"], ["advisor", "指導教授"], ["committee", "口試委員"]];

  function qty(item) { return item.quantity && item.quantity > 1 ? item.quantity : 1; }

  // 純函式：產生送件清單文字
  function checklistText(label, items, stamp) {
    var lines = ["【" + label + "】送件清單", ""];
    GROUPS.forEach(function (g) {
      var rows = items.filter(function (it) { return it.recipient === g[0]; });
      if (!rows.length) return;
      lines.push("■ 交給" + g[1]);
      rows.forEach(function (it) {
        var who = it.detail && it.detail !== g[1] ? "（" + it.detail + "）" : "";
        var name = String(it.label).replace(/（\d+ 份）$/, "");
        lines.push("☐ " + name + who + (qty(it) > 1 ? " × " + qty(it) + " 份" : ""));
      });
      lines.push("");
    });
    var total = items.reduce(function (n, it) { return n + qty(it); }, 0);
    lines.push("共 " + total + " 份。實際繳交項目與份數，以所辦最新公告為準。");
    if (stamp) lines.push("清單產生日：" + stamp);
    return lines.join("\n");
  }

  // 純函式：產生 ZIP 裡的順序說明
  function orderText(label, docs, items, stamp, filledNames) {
    var lines = ["【" + label + "】表單列印與送件順序", ""];
    lines.push("一、這個資料夾裡的表單（依流程順序編號）");
    docs.forEach(function (d, i) {
      lines.push("  " + pad(i + 1) + "　" + d.title + (filledNames.indexOf(d.href) >= 0 ? "（已帶入你的基本資料，紅色 ○ 為尚未填寫處）" : ""));
    });
    lines.push("");
    lines.push("二、列印提醒");
    lines.push("  除了簽名欄以外，表單請以打字方式填寫，不可手寫。");
    lines.push("  列印後需要簽名的欄位，請依各表單說明找對應的人簽名。");
    lines.push("");
    lines.push(checklistText(label, items, stamp));
    return lines.join("\n");
  }

  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function stampText() { var d = new Date(); return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function safeName(s) { return String(s).replace(/[\\/:*?"<>|]/g, "").replace(/\s+/g, "").trim() || "file"; }
  function ext(href) { var m = /\.([a-z0-9]+)(?:[?#].*)?$/i.exec(href); return m ? m[1].toLowerCase() : "odt"; }

  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

  function copyText(text) {
    if (global.navigator && navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).catch(function () { return legacyCopy(text); });
    }
    return Promise.resolve(legacyCopy(text));
  }
  function legacyCopy(text) {
    var ta = document.createElement("textarea");
    ta.value = text; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    var ok = false; try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
    ta.remove();
    if (!ok) throw new Error("copy");
  }

  function profile() {
    try { return (global.FillForm && FillForm._load && FillForm._load()) || null; } catch (e) { return null; }
  }
  function hasData(p) { return !!p && ["name", "sid", "phone", "email", "title"].some(function (k) { return String(p[k] || "").trim(); }); }

  async function buildZip(opts) {
    var zip = new JSZip();
    var p = profile();
    var filledHrefs = [];
    var missing = [];
    for (var i = 0; i < opts.docs.length; i++) {
      var d = opts.docs[i];
      var buf;
      try {
        var res = await fetch(d.href);
        if (!res.ok) throw new Error("fetch " + res.status);
        buf = await res.arrayBuffer();
      } catch (e) { missing.push(d.title); continue; }
      var data = buf;
      if (hasData(p) && global.fillOdtBuffer && global.FillForm && FillForm.isFillable(d.href)) {
        try { data = (await global.fillOdtBuffer(buf, p)).blob; filledHrefs.push(d.href); } catch (e) { data = buf; }
      }
      zip.file(pad(i + 1) + "_" + safeName(d.title.replace(/[（(](?:ODT|DOCX|PDF)[)）]/gi, "")) + "." + ext(d.href), data);
    }
    var order = orderText(opts.label, opts.docs.filter(function (d) { return missing.indexOf(d.title) < 0; }), opts.items, stampText(), filledHrefs);
    if (missing.length) order += "\n\n注意：下列表單這次沒能下載，請回到流程頁個別下載：\n" + missing.map(function (t) { return "  - " + t; }).join("\n");
    zip.file("00_列印與送件順序.txt", "﻿" + order.replace(/\n/g, "\r\n"));
    var blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
    return { blob: blob, filled: filledHrefs.length, missing: missing };
  }

  function download(blob, name) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url; a.download = name; a.rel = "noopener noreferrer"; a.style.display = "none";
    document.body.appendChild(a); a.click();
    setTimeout(function () { a.remove(); }, 1000);
    setTimeout(function () { URL.revokeObjectURL(url); }, 30000);
  }

  // opts: { label, items, docs: [{title, href}], locked }
  function build(opts) {
    var box = el("div", "bundle");
    box.appendChild(el("strong", "bundle-title", "送件小幫手"));
    var row = el("div", "bundle-actions");
    var copy = el("button", "ack-button bundle-copy", "複製送件清單"); copy.type = "button";
    var zip = el("button", "ack-button bundle-zip", "下載全部表單（ZIP）"); zip.type = "button";
    row.append(copy, zip);
    var msg = el("p", "bundle-msg"); msg.setAttribute("aria-live", "polite");
    box.append(row, msg,
      el("p", "bundle-note", "ZIP 內含這個流程的表單，另附一份文字版列印與送件順序；若已填過「自動填表」資料，可填的表單會自動帶入。"));
    copy.addEventListener("click", function () {
      copyText(checklistText(opts.label, opts.items, stampText())).then(
        function () { msg.textContent = "已複製，可以直接貼到 LINE 或備忘錄。"; },
        function () { msg.textContent = "這個瀏覽器不允許自動複製，請改用電腦的瀏覽器。"; });
    });
    zip.addEventListener("click", async function () {
      zip.disabled = true; msg.textContent = "打包中，請稍候…";
      try {
        var r = await buildZip(opts);
        download(r.blob, "eap-forms.zip");
        msg.textContent = "已下載 ZIP" + (r.filled ? "（" + r.filled + " 份已帶入基本資料）" : "") + (r.missing.length ? "；" + r.missing.length + " 份沒能下載，詳見 ZIP 內說明" : "") + "。";
      } catch (e) { msg.textContent = "打包失敗，請改為回到流程頁逐一下載。"; }
      zip.disabled = false;
    });
    return box;
  }

  global.Bundle = { build: build, checklistText: checklistText, orderText: orderText, buildZip: buildZip };
})(window);
