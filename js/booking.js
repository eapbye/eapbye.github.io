/* 預約口試教室：不寄信，只幫學生產生一段可以直接複製、貼到 LINE 或 e-mail 的預約訊息。
   選日期與時間，訊息會即時更新；沒選的地方先用 ○ 佔位，貼出去前再補。
   姓名、學號若已在「自動填表」填過，會自動帶入；沒填過就以 ○ 佔位。不儲存任何資料、不傳送任何資料。
   依賴：js/fillform.js（選用，只讀姓名與學號）。 */
(function (global) {
  var WEEK = ["日", "一", "二", "三", "四", "五", "六"];
  var DEFAULT_PEOPLE = 4; // 學生 1 位 + 指導教授 + 兩位口試委員

  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function circles(n) { return new Array(n + 1).join("○"); }

  function timeOptions() {
    var out = [];
    for (var m = 8 * 60; m <= 21 * 60 + 30; m += 30) out.push(pad(Math.floor(m / 60)) + ":" + pad(m % 60));
    return out;
  }
  function plusMinutes(hhmm, add) {
    var p = hhmm.split(":"), t = (+p[0]) * 60 + (+p[1]) + add;
    if (t > 22 * 60) t = 22 * 60;
    return pad(Math.floor(t / 60)) + ":" + pad(t % 60);
  }

  function profile() {
    try { return (global.FillForm && global.FillForm._load && global.FillForm._load()) || {}; } catch (e) { return {}; }
  }
  function clean(v) { return String(v == null ? "" : v).replace(/[\s　]+/g, " ").trim(); }

  function dateText(v) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v || "");
    if (!m) return circles(4) + "年" + "○月○日（○）";
    var d = new Date(+m[1], +m[2] - 1, +m[3]);
    return m[1] + "年" + (+m[2]) + "月" + (+m[3]) + "日（" + WEEK[d.getDay()] + "）";
  }
  function timeText(a, b) {
    return (a || "○○:○○") + "–" + (b || "○○:○○");
  }

  // 產生訊息本文（純函式，方便測試）
  function draft(kind, s) {
    var name = clean(s.name) || circles(3);
    var sid = clean(s.sid) || circles(9);
    var people = parseInt(s.people, 10) > 0 ? parseInt(s.people, 10) : DEFAULT_PEOPLE;
    return [
      "助教您好，",
      "我是教育行政與政策研究所碩士班的" + name + "（學號：" + sid + "），指導教授是" + circles(3) + "老師。",
      "我預計於 " + dateText(s.date) + " " + timeText(s.start, s.end) + " 進行" + kind + "，現場共 " + people + " 位（含我）。想請問當天教育學院（井塘樓）是否有教室可以借用？",
      "如果這個時段沒有空教室，也麻煩告知可以借用的其他時段，謝謝您！"
    ].join("\n");
  }

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function field(labelText, control, id) {
    var wrap = el("label", "booking-field");
    wrap.htmlFor = id;
    wrap.append(el("span", "booking-label", labelText), control);
    return wrap;
  }

  function copyText(text, area, done) {
    function fallback() {
      try { area.focus(); area.select(); document.execCommand("copy"); done(true); } catch (e) { done(false); }
    }
    if (global.navigator && navigator.clipboard && global.isSecureContext) {
      navigator.clipboard.writeText(text).then(function () { done(true); }, fallback);
    } else fallback();
  }

  // kind：「學位論文計畫口試」或「學位論文考試」
  function build(kind) {
    var uid = "booking" + Math.random().toString(36).slice(2, 8);
    var box = el("details", "booking");
    var summary = el("summary", "booking-summary", "還沒約教室？幫我寫預約訊息");
    box.append(summary);
    var body = el("div", "booking-body");

    var date = el("input"); date.type = "date"; date.id = uid + "d";
    var d0 = new Date(); date.min = d0.getFullYear() + "-" + pad(d0.getMonth() + 1) + "-" + pad(d0.getDate());
    var start = el("select"); start.id = uid + "s";
    var end = el("select"); end.id = uid + "e";
    [start, end].forEach(function (sel) {
      var o = el("option", "", "選擇"); o.value = ""; sel.append(o);
      timeOptions().forEach(function (t) { var op = el("option", "", t); op.value = t; sel.append(op); });
    });
    var people = el("input"); people.type = "number"; people.id = uid + "p"; people.min = "2"; people.max = "20"; people.value = String(DEFAULT_PEOPLE);

    var grid = el("div", "booking-grid");
    grid.append(field("日期", date, date.id), field("開始", start, start.id), field("結束", end, end.id), field("人數", people, people.id));
    var area = el("textarea", "booking-text"); area.rows = 7; area.setAttribute("aria-label", "預約訊息，可直接修改");
    var actions = el("div", "booking-actions");
    var copy = el("button", "ack-button booking-copy", "複製這段訊息"); copy.type = "button";
    actions.append(copy);
    body.append(grid, area, actions);
    box.append(body);

    function refresh() {
      var p = profile();
      area.value = draft(kind, { name: p.name, sid: p.sid, date: date.value, start: start.value, end: end.value, people: people.value });
    }
    start.addEventListener("change", function () { if (start.value && !end.value) end.value = plusMinutes(start.value, 120); refresh(); });
    [date, end, people].forEach(function (c) { c.addEventListener("input", refresh); c.addEventListener("change", refresh); });
    box.addEventListener("toggle", function () { if (box.open) refresh(); });
    var timer = null;
    copy.addEventListener("click", function () {
      copyText(area.value, area, function (ok) {
        copy.textContent = ok ? "已複製，可以貼到 LINE 或信件" : "請長按文字框全選後複製";
        clearTimeout(timer);
        timer = setTimeout(function () { copy.textContent = "複製這段訊息"; }, 2600);
      });
    });
    refresh();
    return box;
  }

  global.RoomBooking = { build: build, draft: draft };
})(window);
