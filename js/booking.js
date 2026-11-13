/* 預約口試教室：不寄信，只幫學生產生一段可以直接複製、貼到 LINE 或 e-mail 的預約訊息。
   選日期與時間，訊息會即時更新；沒選的日期以 ○、時間以 00:00 佔位，貼出去前再補。
   姓名、學號若已在「自動填表」填過，會自動帶入，級數取學號前三碼；沒填過，姓名與級數以 ○、學號以 0 佔位。不儲存任何資料、不傳送任何資料。
   依賴：js/fillform.js（選用，只讀姓名與學號）。 */
(function (global) {
  var WEEK = ["日", "一", "二", "三", "四", "五", "六"];

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

  // 沒選日期：年份用今年，月日以 ○ 佔位
  function dateText(v) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v || "");
    if (!m) return new Date().getFullYear() + "年○○月○○日（星期○）";
    var d = new Date(+m[1], +m[2] - 1, +m[3]);
    return m[1] + "年" + (+m[2]) + "月" + (+m[3]) + "日（星期" + WEEK[d.getDay()] + "）";
  }
  // 沒選時間：以 00:00 佔位（數字欄位用 0，R 指定）
  function timeText(a, b) {
    return (a || "00:00") + "–" + (b || "00:00");
  }
  // 級數＝學號前三碼（入學學年度），與畢業專區的級數算法相同
  function cohort(sid) {
    var m = /^(\d{3})\d{6}$/.exec(sid || "");
    return m ? m[1] : circles(3);
  }

  // 產生訊息本文（純函式，方便測試）。格式依 R 提供的範本（給莊姐、借 303 教室）
  function draft(kind, s) {
    var name = clean(s.name) || circles(3);
    var sid = clean(s.sid);
    return [
      "莊姐您好，",
      "我是教政所" + cohort(sid) + "級的" + name + "（學號：" + (sid || "000000000") + "），指導教授是" + circles(3) + "老師。",
      "我預計於 " + dateText(s.date) + timeText(s.start, s.end) + "進行" + kind + "，想請問當天 303 教室是否可以借用？",
      "麻煩莊姐了，謝謝！"
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

    var grid = el("div", "booking-grid");
    grid.append(field("日期", date, date.id), field("開始", start, start.id), field("結束", end, end.id));
    var area = el("textarea", "booking-text"); area.rows = 4; area.setAttribute("aria-label", "預約訊息，可直接修改");
    var actions = el("div", "booking-actions");
    var copy = el("button", "ack-button booking-copy", "複製這段訊息"); copy.type = "button";
    actions.append(copy);
    body.append(grid, area, actions);
    box.append(body);

    // 文字框高度跟著內容，不留大片空白、也不切掉最後一行
    function fit() {
      if (!area.isConnected || !box.open) return;
      area.style.height = "auto";
      area.style.height = (area.scrollHeight + 2) + "px";
    }
    area.addEventListener("input", fit);
    global.addEventListener("resize", fit);
    function refresh() {
      var p = profile();
      area.value = draft(kind, { name: p.name, sid: p.sid, date: date.value, start: start.value, end: end.value });
      fit();
    }
    start.addEventListener("change", function () { if (start.value && !end.value) end.value = plusMinutes(start.value, 120); refresh(); });
    [date, end].forEach(function (c) { c.addEventListener("input", refresh); c.addEventListener("change", refresh); });
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
