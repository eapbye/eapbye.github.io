// 課程預選時段：首頁「預選登記／課程表」按鈕與 course-registration.html 都依這裡切換。
// 日期含首尾兩天（台灣時間，YYYY-MM-DD）。沒有預選就兩個都留空：網站一律顯示課表。
//   預選開始前：顯示課表，並寫「預選登記將於 ○/○～○/○ 開放」
//   預選期間：  顯示預選登記
//   預選結束後：顯示課表
(function () {
  "use strict";
  var W = {
    term: "115-2",
    registrationStart: "",
    registrationEnd: ""
  };
  function today() {
    return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  }
  W.status = function () {
    if (!W.registrationStart || !W.registrationEnd) return "none";
    var t = today();
    if (t < W.registrationStart) return "before";
    if (t > W.registrationEnd) return "after";
    return "open";
  };
  W.label = function (iso) {
    var p = String(iso).split("-");
    return Number(p[1]) + "/" + Number(p[2]);
  };
  window.EAP_COURSE_WINDOW = W;
  // 預選登記頁把本檔放在 <head>：先在 <html> 標上是否開放，CSS 據此一開始就只畫課表或只畫登記，
  // 不會先閃出預選登記再換成課表（__EAP_FORCE_REGISTER 只給測試用）
  var open = window.__EAP_FORCE_REGISTER || W.status() === "open";
  document.documentElement.classList.add(open ? "reg-open" : "reg-closed");
})();
