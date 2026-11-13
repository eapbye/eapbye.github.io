/* 預約口試教室：不寄信，只幫學生產生一段可以直接複製、貼到 LINE 或 e-mail 的預約訊息。
   選日期與時間，訊息會即時更新；沒選的日期以 ○、時間以 00:00 佔位，貼出去前再補。
   姓名、學號若已在「自動填表」填過，會自動帶入，級數取學號前三碼；沒填過，姓名與級數以 ○、學號以 0 佔位。不儲存任何資料、不傳送任何資料。
   指導教授用下拉選單選（名單在下方 ADVISORS，依 R 指定順序；換老師時改這裡）；選「其他」可自己打（R 11/14：不要共同指導）。
   手機版（standalone）：被擋的「請改用電腦操作」視窗可另開一個只寫預約訊息的視窗，多姓名、學號兩欄與「分享到 LINE」（navigator.share）。
   依賴：js/fillform.js（選用，只讀姓名與學號）。 */
(function (global) {
  var WEEK = ["日", "一", "二", "三", "四", "五", "六"];
  // 本所指導教授（依所網「師資陣容」，順序由 R 指定，2026-11-14）
  var ADVISORS = ["吳政達", "郭昭佑", "秦夢群", "湯志民", "陳榮政", "侯永琪", "顏敏仁", "湯家偉", "莊俊儒"];
  var OTHER = "__other";

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
    var advisors = (s.advisors || []).map(clean).filter(Boolean);
    var advisorText = advisors.length ? advisors.map(function (a) { return a + "老師"; }).join("、") : circles(3) + "老師";
    return [
      "莊姐您好，",
      "我是教政所" + cohort(sid) + "級的" + name + "（學號：" + (sid || "000000000") + "），指導教授是" + advisorText + "。",
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

  // 指導教授下拉：名單＋「其他（自己填）」；選其他時出現文字欄
  function advisorPicker(labelText, firstText, id) {
    var sel = el("select"); sel.id = id;
    var o = el("option", "", firstText); o.value = ""; sel.append(o);
    ADVISORS.forEach(function (a) { var op = el("option", "", a); op.value = a; sel.append(op); });
    var other = el("option", "", "其他（自己填）"); other.value = OTHER; sel.append(other);
    var input = el("input", "booking-other"); input.type = "text"; input.hidden = true;
    input.placeholder = "老師姓名"; input.setAttribute("aria-label", labelText + "姓名");
    var wrap = field(labelText, sel, id);
    wrap.append(input);
    sel.addEventListener("change", function () { input.hidden = sel.value !== OTHER; if (!input.hidden) input.focus(); });
    return { wrap: wrap, sel: sel, input: input, value: function () { return sel.value === OTHER ? input.value : sel.value; } };
  }

  // kind：「學位論文計畫口試」或「學位論文考試」
  // opts.standalone：手機獨立視窗用——一開始就展開、沒有收合鈕、多姓名學號兩欄與分享鈕
  function build(kind, opts) {
    opts = opts || {};
    var uid = "booking" + Math.random().toString(36).slice(2, 8);
    var box = el("details", "booking" + (opts.standalone ? " is-standalone" : ""));
    var summary = el("summary", "booking-summary", "還沒約教室？幫我寫預約訊息");
    box.append(summary);
    var body = el("div", "booking-body");

    var who = null, nameIn = null, sidIn = null;
    if (opts.standalone) {
      var p0 = profile();
      nameIn = el("input"); nameIn.type = "text"; nameIn.id = uid + "n"; nameIn.autocomplete = "name"; nameIn.value = p0.name || "";
      sidIn = el("input"); sidIn.type = "text"; sidIn.id = uid + "i"; sidIn.inputMode = "numeric"; sidIn.maxLength = 9; sidIn.value = p0.sid || "";
      who = el("div", "booking-people");
      who.append(field("姓名", nameIn, nameIn.id), field("學號", sidIn, sidIn.id));
    }
    var adv1 = advisorPicker("指導教授", "選擇", uid + "a");
    var people = el("div", "booking-people");

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
    var canShare = !!(opts.standalone && global.navigator && typeof navigator.share === "function");
    var share = null;
    if (canShare) {
      share = el("button", "booking-share", "分享到 LINE"); share.type = "button";
      actions.prepend(share);
    }
    // 電腦：指導教授自成一列；手機獨立視窗：指導教授與日期同一列、開始與結束同一列，比較緊湊
    if (opts.standalone) grid.prepend(adv1.wrap); else people.append(adv1.wrap);
    if (who) body.append(who);
    if (!opts.standalone) body.append(people);
    body.append(grid, area, actions);
    box.append(body);
    if (opts.standalone) box.open = true;

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
      var name = nameIn ? nameIn.value : p.name, sid = sidIn ? sidIn.value : p.sid;
      area.value = draft(kind, { name: name, sid: sid, advisors: [adv1.value()], date: date.value, start: start.value, end: end.value });
      fit();
    }
    start.addEventListener("change", function () { if (start.value && !end.value) end.value = plusMinutes(start.value, 120); refresh(); });
    [date, end, adv1.sel, adv1.input].concat(nameIn ? [nameIn, sidIn] : []).forEach(function (c) { c.addEventListener("input", refresh); c.addEventListener("change", refresh); });
    box.addEventListener("toggle", function () { if (box.open) refresh(); });
    var timer = null;
    copy.addEventListener("click", function () {
      copyText(area.value, area, function (ok) {
        copy.textContent = ok ? "已複製，可以貼到 LINE 或信件" : "請長按文字框全選後複製";
        clearTimeout(timer);
        timer = setTimeout(function () { copy.textContent = "複製這段訊息"; }, 2600);
      });
    });
    if (share) {
      share.addEventListener("click", function () {
        navigator.share({ text: area.value }).catch(function (e) {
          if (e && e.name === "AbortError") return; // 學生自己取消分享
          copy.click();
        });
      });
    }
    refresh();
    return box;
  }

  global.RoomBooking = { build: build, draft: draft };
})(window);
