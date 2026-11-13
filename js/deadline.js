/* 倒推申請日 + 行事曆檔：輸入預計口試日，算出「最晚提出申請日」（口試前 14 天），
   並可下載 .ics 加進手機或電腦行事曆，或開 Google 日曆。
   只依照網站已寫明的規定（口試前 14 天）；不儲存、不傳送任何資料。
   注意：「當學期最後提出申請日為校訂休學日」這條無法由程式判斷，畫面上會提醒自行確認。 */
(function (global) {
  var WEEK = ["日", "一", "二", "三", "四", "五", "六"];
  var LEAD_DAYS = 14;

  function pad(n) { return (n < 10 ? "0" : "") + n; }

  // 一律用 UTC 做日期加減，避免時區與日光節約時間造成差一天
  function parse(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
    if (!m) return null;
    var d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    if (d.getUTCFullYear() !== +m[1] || d.getUTCMonth() !== +m[2] - 1 || d.getUTCDate() !== +m[3]) return null;
    return d;
  }
  function addDays(d, n) { return new Date(d.getTime() + n * 86400000); }
  function iso(d) { return d.getUTCFullYear() + "-" + pad(d.getUTCMonth() + 1) + "-" + pad(d.getUTCDate()); }
  function compact(d) { return d.getUTCFullYear() + pad(d.getUTCMonth() + 1) + pad(d.getUTCDate()); }
  function label(d) { return d.getUTCFullYear() + "年" + (d.getUTCMonth() + 1) + "月" + d.getUTCDate() + "日（" + WEEK[d.getUTCDay()] + "）"; }
  function todayUtc() { var n = new Date(); return new Date(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate())); }

  // 純函式：口試日 → 最晚申請日與狀態
  function plan(examIso, today) {
    var exam = parse(examIso);
    if (!exam) return null;
    var due = addDays(exam, -LEAD_DAYS);
    var t = today || todayUtc();
    var left = Math.round((due.getTime() - t.getTime()) / 86400000);
    return { exam: exam, due: due, daysLeft: left, status: left < 0 ? "late" : left === 0 ? "today" : "ok" };
  }

  function esc(s) { return String(s).replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n"); }
  function fold(line) {
    // RFC 5545：每行最多 75 個位元組，續行以空白開頭；中文要以位元組計算並避免切在字中間
    var out = [], cur = "", bytes = 0, enc = new TextEncoder();
    Array.from(line).forEach(function (ch) {
      var b = enc.encode(ch).length;
      if (bytes + b > (out.length ? 74 : 75)) { out.push(cur); cur = ""; bytes = 0; }
      cur += ch; bytes += b;
    });
    out.push(cur);
    return out.join("\r\n ");
  }

  // 純函式：產生 .ics 文字。兩個全天事件：最晚申請日（前 3 天、前 1 天早上 9 點提醒）與口試日
  function buildIcs(examIso, stamp, kindLabel) {
    var p = plan(examIso);
    if (!p) return "";
    var kind = kindLabel || "口試";
    var st = stamp || new Date();
    var dtstamp = st.getUTCFullYear() + pad(st.getUTCMonth() + 1) + pad(st.getUTCDate()) + "T" + pad(st.getUTCHours()) + pad(st.getUTCMinutes()) + pad(st.getUTCSeconds()) + "Z";
    function event(uid, date, summary, desc, alarms) {
      var l = [
        "BEGIN:VEVENT", "UID:" + uid + "@eapbye.github.io", "DTSTAMP:" + dtstamp,
        "DTSTART;VALUE=DATE:" + compact(date), "DTEND;VALUE=DATE:" + compact(addDays(date, 1)),
        "SUMMARY:" + esc(summary), "DESCRIPTION:" + esc(desc), "TRANSP:TRANSPARENT"
      ];
      alarms.forEach(function (t) {
        l.push("BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:" + esc(summary), "TRIGGER:" + t, "END:VALARM");
      });
      l.push("END:VEVENT");
      return l;
    }
    var lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//eapbye.github.io//教政一點通//ZH", "CALSCALE:GREGORIAN", "METHOD:PUBLISH"]
      .concat(event("due-" + compact(p.exam), p.due, "【教政一點通】" + kind + "申請最晚日",
        "請於口試前 14 天提出申請，並預留資料檢核與寄送口試本及邀請函的時間。當學期最後提出申請日為校訂休學日，請自行確認。" + kind + "日：" + label(p.exam),
        ["-P2DT15H", "-PT15H"]))
      .concat(event("exam-" + compact(p.exam), p.exam, "【教政一點通】" + kind + "日", "預計" + kind + "日。", ["-PT15H"]))
      .concat(["END:VCALENDAR"]);
    return lines.map(fold).join("\r\n") + "\r\n";
  }

  function googleUrl(examIso, kindLabel) {
    var p = plan(examIso);
    if (!p) return "";
    var kind = kindLabel || "口試";
    return "https://calendar.google.com/calendar/render?action=TEMPLATE" +
      "&text=" + encodeURIComponent("【教政一點通】" + kind + "申請最晚日") +
      "&dates=" + compact(p.due) + "/" + compact(addDays(p.due, 1)) +
      "&details=" + encodeURIComponent("請於口試前 14 天提出申請。" + kind + "日：" + label(p.exam));
  }

  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

  function build() {
    var box = el("div", "deadline-calc");
    var title = el("strong", "deadline-calc-title", "輸入預計口試日，幫你倒推最晚申請日");
    var row = el("label", "booking-field deadline-calc-field");
    row.appendChild(el("span", null, "預計口試日"));
    var input = el("input"); input.type = "date"; input.className = "deadline-exam-date";
    row.appendChild(input);
    var result = el("p", "deadline-calc-result"); result.setAttribute("aria-live", "polite");
    var note = el("p", "deadline-calc-note", "只依「口試前 14 天」計算；若當學期最後提出申請日（校訂休學日）更早，以更早者為準，請自行確認。");
    var actions = el("div", "deadline-calc-actions");
    var ics = el("button", "ack-button deadline-ics", "下載行事曆檔（.ics）"); ics.type = "button"; ics.disabled = true;
    var g = el("a", "ack-button deadline-google", "加到 Google 日曆"); g.target = "_blank"; g.rel = "noopener noreferrer"; g.hidden = true;
    var hint = el("p", "deadline-calc-note", "在 LINE 內開啟時可能無法下載檔案，請改用手機瀏覽器開啟，或用 Google 日曆連結。");
    actions.append(ics, g);
    box.append(title, row, result, actions, hint, note);

    function refresh() {
      var p = plan(input.value);
      ics.disabled = !p; g.hidden = !p;
      if (!p) { result.textContent = ""; return; }
      var text = "最晚申請日：" + label(p.due);
      if (p.status === "late") text += "。已經超過最晚申請日 " + (-p.daysLeft) + " 天，請直接洽詢所辦能否受理。";
      else if (p.status === "today") text += "。就是今天。";
      else text += "。距離今天還有 " + p.daysLeft + " 天。";
      result.textContent = text;
      g.href = googleUrl(input.value);
    }
    input.addEventListener("input", refresh);
    input.addEventListener("change", refresh);
    ics.addEventListener("click", function () {
      var text = buildIcs(input.value);
      if (!text) return;
      var blob = new Blob([text], { type: "text/calendar;charset=utf-8" });
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url; a.download = "eap-exam-reminder.ics"; a.rel = "noopener noreferrer"; a.style.display = "none";
      document.body.appendChild(a); a.click();
      setTimeout(function () { a.remove(); }, 1000);
      setTimeout(function () { URL.revokeObjectURL(url); }, 30000);
    });
    return box;
  }

  // 申請步驟裡的可收合版本（首頁的期限提醒視窗只在第一次進站出現，之後要在這裡找）
  function buildDetails(kindLabel) {
    var d = el("details", "booking deadline-details");
    d.appendChild(el("summary", "booking-summary", "倒推最晚申請日，加進行事曆"));
    var body = el("div", "booking-body"); body.appendChild(build(kindLabel)); d.appendChild(body);
    return d;
  }

  function mount() {
    var btn = document.getElementById("closeDeadline");
    if (!btn || document.querySelector(".deadline-calc")) return;
    btn.parentNode.insertBefore(build(), btn);
  }

  global.Deadline = { plan: plan, buildIcs: buildIcs, googleUrl: googleUrl, build: build, buildDetails: buildDetails, mount: mount, LEAD_DAYS: LEAD_DAYS };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount); else mount();
})(window);
