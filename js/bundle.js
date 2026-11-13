/* 送件小幫手：在「最後確認」步驟提供「複製送件清單」。
   依繳交對象（所辦／指導教授／口試委員）分組的文字清單，可貼到 LINE 或備忘錄。
   全程在瀏覽器內處理，不傳送任何資料。 */
(function (global) {
  var GROUPS = [["office", "所辦"], ["advisor", "指導教授"], ["committee", "口試委員"]];

  function qty(item) { return item.quantity && item.quantity > 1 ? item.quantity : 1; }
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function stampText() { var d = new Date(); return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }

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

  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

  function legacyCopy(text) {
    var ta = document.createElement("textarea");
    ta.value = text; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    var ok = false; try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
    ta.remove();
    if (!ok) throw new Error("copy");
  }
  function copyText(text) {
    if (global.navigator && navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).catch(function () { return legacyCopy(text); });
    }
    try { legacyCopy(text); return Promise.resolve(); } catch (e) { return Promise.reject(e); }
  }

  // opts: { label, items }
  function build(opts) {
    var box = el("div", "bundle");
    var copy = el("button", "ack-button bundle-copy", "複製送件清單"); copy.type = "button";
    var msg = el("p", "bundle-msg"); msg.setAttribute("aria-live", "polite");
    box.append(copy, msg);
    copy.addEventListener("click", function () {
      copyText(checklistText(opts.label, opts.items, stampText())).then(
        function () { msg.textContent = "已複製，可以直接貼到 LINE 或備忘錄。"; },
        function () { msg.textContent = "這個瀏覽器不允許自動複製，請改用電腦的瀏覽器。"; });
    });
    return box;
  }

  global.Bundle = { build: build, checklistText: checklistText };
})(window);
