// 首頁「最新消息」輪播。更新消息只改 NEWS：until 是最後顯示日（台灣時間當天結束後自動消失）。
// 沒有任何有效消息時整條隱藏；只有一則時靜止；多則時每 5 秒往上換一則，滑鼠移上去暫停。
(function () {
  "use strict";
  var NEWS = [
    { text: "12/10（四）學位論文考試提報截止（校訂日 12/18）", until: "2026-12-10" },
    { text: "12/10（四）休學截止（校訂日 12/18）", until: "2026-12-10" },
    { text: "12/17（四）學位論文計畫口試提報截止", until: "2026-12-17" },
    { text: "12/24（四）學位論文考試最晚舉行日；經同意可展期至 1/8（五），但仍須在 12/10 前提報", until: "2026-12-24" },
    { text: "12/31（四）學位論文計畫口試最晚舉行日", until: "2026-12-31" },
    { text: "1/25（一）繳交學位考試成績報告單（校訂日 1/29），須附論文修正後的比對與檢測文件及通過簽名頁", until: "2027-01-25" },
    { text: "2/23（二）辦理離校手續（校訂日 2/26）", until: "2027-02-23" }
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

  function build() {
    var strip = document.getElementById("newsStrip");
    if (!strip) return;
    var items = activeNews();
    if (!items.length) { strip.hidden = true; return; }
    var viewport = strip.querySelector(".news-viewport");
    var list = document.createElement("ul");
    list.className = "news-list";
    items.forEach(function (n) {
      var li = document.createElement("li");
      li.className = "news-item";
      li.textContent = n.text;
      li.title = n.text;
      list.append(li);
    });
    viewport.replaceChildren(list);
    strip.hidden = false;
    if (items.length < 2) return;

    var index = 0, timer = null, paused = false;
    var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var lis = Array.prototype.slice.call(list.children);
    lis.forEach(function (li, i) { li.classList.toggle("is-active", i === 0); });
    strip.classList.add(reduce ? "is-fading" : "is-rolling");

    function show(next) {
      var prev = lis[index];
      index = next;
      var cur = lis[index];
      prev.classList.remove("is-active");
      prev.classList.add("is-leaving");
      cur.classList.remove("is-leaving");
      cur.classList.add("is-active");
      setTimeout(function () { prev.classList.remove("is-leaving"); }, 600);
    }
    function tick() { if (!paused) show((index + 1) % lis.length); }
    function start() { if (!timer) timer = setInterval(tick, INTERVAL_MS); }
    strip.addEventListener("mouseenter", function () { paused = true; });
    strip.addEventListener("mouseleave", function () { paused = false; });
    strip.addEventListener("focusin", function () { paused = true; });
    strip.addEventListener("focusout", function () { paused = false; });
    document.addEventListener("visibilitychange", function () { paused = document.hidden; });
    start();
  }

  window.EapNews = { activeNews: activeNews };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", build);
  else build();
})();
