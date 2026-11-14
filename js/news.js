// 首頁「最新消息」輪播。更新消息只改 NEWS：until 是最後顯示日（台灣時間當天結束後自動消失）。
// 沒有有效消息時整條隱藏；一次顯示三則，超過三則時每 5 秒往上捲一則（像車站看板），滑鼠移上去暫停。
// 跨年的消息不用自己寫年份：until 的年份比今年大時，日期前會自動加上民國年（例如 116/1/25）。
(function () {
  "use strict";
  var NEWS = [
    { text: "12/10（四）學位論文考試提報截止", until: "2026-12-10" },
    { text: "12/10（四）休學截止", until: "2026-12-10" },
    { text: "12/17（四）學位論文計畫口試提報截止", until: "2026-12-17" },
    { text: "12/24（四）學位論文考試最晚舉行日（經同意可展期至 1/8）", until: "2026-12-24" },
    { text: "12/31（四）學位論文計畫口試最晚舉行日", until: "2026-12-31" },
    { text: "1/25（一）繳交學位考試成績報告單（附比對報告、簽名頁）", until: "2027-01-25" },
    { text: "2/23（二）辦理離校手續", until: "2027-02-23" }
  ];
  var INTERVAL_MS = 5000;

  function taipeiToday() {
    // 以台灣時間的日期字串比較，避免使用者電腦時區不同
    var parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
    return parts; // YYYY-MM-DD
  }

  function activeNews() {
    var today = taipeiToday();
    return NEWS.filter(function (n) { return n.until >= today; });
  }

  var VISIBLE = 3; // 同時顯示幾則

  function daysLeft(until) {
    var t = taipeiToday().split("-").map(Number), u = until.split("-").map(Number);
    return Math.round((Date.UTC(u[0], u[1] - 1, u[2]) - Date.UTC(t[0], t[1] - 1, t[2])) / 86400000);
  }

  function row(n) {
    var li = document.createElement("li");
    li.className = "news-item";
    var text = document.createElement("span");
    text.className = "news-text";
    // 跨年的消息自動在日期前加民國年（例如 116/1/25），年份取自 until
    var y = Number(n.until.slice(0, 4)), label = y > Number(taipeiToday().slice(0, 4)) ? (y - 1911) + "/" + n.text : n.text;
    text.title = label;
    // 拆成日期與內容兩段：電腦照舊排成一行；手機日期與倒數放第一行、內容另起一行（見 style.css 手機版修正）
    var m = /^((?:\d{3}\/)?\d{1,2}\/\d{1,2}（.）)\s*(.*)$/.exec(label);
    if (m) {
      var date = document.createElement("span"); date.className = "news-date"; date.textContent = m[1];
      var rest = document.createElement("span"); rest.className = "news-rest"; rest.textContent = m[2];
      text.append(date, rest);
    } else text.textContent = label;
    var d = daysLeft(n.until);
    var chip = document.createElement("span");
    chip.className = "news-days" + (d <= 7 ? " is-soon" : "");
    chip.textContent = d === 0 ? "今天" : "還有 " + d + " 天";
    li.append(text, chip);
    return li;
  }

  function build() {
    var strip = document.getElementById("newsStrip");
    if (!strip) return;
    var items = activeNews();
    if (!items.length) { strip.hidden = true; return; }
    var viewport = strip.querySelector(".news-viewport");
    var shown = Math.min(VISIBLE, items.length);
    viewport.style.setProperty("--news-rows", shown);
    var list = document.createElement("ul");
    list.className = "news-list";
    items.forEach(function (n) { list.append(row(n)); });
    var rolling = items.length > shown;
    // 無縫循環：尾端接上前幾則的複本
    if (rolling) items.slice(0, shown).forEach(function (n) { var c = row(n); c.setAttribute("aria-hidden", "true"); c.classList.add("is-clone"); list.append(c); });
    viewport.replaceChildren(list);
    strip.hidden = false;
    if (!rolling) return;

    var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var index = 0, paused = false;
    function rowHeight() { var f = list.firstElementChild; return f ? f.getBoundingClientRect().height / (f.currentCSSZoom || 1) : 0; } // 大螢幕放大時量到的是放大後高度，換回原尺寸
    function go(i, animate) {
      list.style.transition = animate && !reduce ? "transform 560ms cubic-bezier(0.2, 0.7, 0.2, 1)" : "none";
      list.style.transform = "translateY(" + (-i * rowHeight()) + "px)";
      list.querySelectorAll(".news-item").forEach(function (li, k) { li.classList.toggle("is-active", k === i); });
    }
    function tick() {
      if (paused) return;
      index += 1;
      go(index, true);
      if (index === items.length) setTimeout(function () { index = 0; go(0, false); }, reduce ? 0 : 600);
    }
    go(0, false);
    strip.addEventListener("mouseenter", function () { paused = true; });
    strip.addEventListener("mouseleave", function () { paused = false; });
    strip.addEventListener("focusin", function () { paused = true; });
    strip.addEventListener("focusout", function () { paused = false; });
    document.addEventListener("visibilitychange", function () { paused = document.hidden; });
    setInterval(tick, INTERVAL_MS);
  }

  window.EapNews = { activeNews: activeNews };
  // 本檔放在 index.html 底部、緊接 guard.js 之後，執行時消息列已在頁面上，直接建立，
  // 不等 DOMContentLoaded（那要等 jszip、app.js 等所有腳本跑完，消息會晚 1～2 秒才出現）
  if (document.getElementById("newsStrip") || document.readyState !== "loading") build();
  else document.addEventListener("DOMContentLoaded", build);
})();
