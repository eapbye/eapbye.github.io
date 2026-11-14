/* 莊姐季節造型（3.0.9）：依台灣日期換頭像（原圖不動，配件由 tests/season_avatars.py 疊上）。
   節日優先、前後約一週；沒有節日的時候用月份主題；其他時間用原圖。
   農曆節日每年日期不同：每年人事總處公布行事曆後，在 LUNAR 補上下一年（除夕、元宵、端午、中秋）。
   沒寫到的年份，農曆節日就不換（月份主題照常）。 */
(function (global) {
  "use strict";
  var LUNAR = {
    2026: { eve: "2026-02-16", lantern: "2026-03-03", dragon: "2026-06-19", moon: "2026-09-25" },
    2027: { eve: "2027-02-05", lantern: "2027-02-20", dragon: "2027-06-09", moon: "2027-09-15" },
    2028: { eve: "2028-01-25", lantern: "2028-02-09", dragon: "2028-05-28", moon: "2028-10-03" }
  };
  var BASE = "css/zhuang-avatar.svg";

  function today() {
    return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  }
  function shift(iso, days) {
    var p = iso.split("-").map(Number);
    var d = new Date(Date.UTC(p[0], p[1] - 1, p[2] + days));
    return d.toISOString().slice(0, 10);
  }
  function within(t, from, to) { return t >= from && t <= to; }

  // 回傳主題名稱（沒有就回傳空字串）；t 是 YYYY-MM-DD，給測試用
  function theme(t) {
    t = t || today();
    var y = Number(t.slice(0, 4)), md = t.slice(5);
    var L = LUNAR[y];
    if (L) {
      if (within(t, shift(L.eve, -7), shift(L.lantern, 7))) return "newyear";   // 除夕前一週到元宵後一週
      if (within(t, shift(L.dragon, -7), shift(L.dragon, 7))) return "dragonboat";
      if (within(t, shift(L.moon, -7), shift(L.moon, 7))) return "midautumn";
    }
    if (within(md, "09-23", "10-02")) return "teacher";       // 教師節 9/28 前後
    if (within(md, "12-01", "12-31")) return "christmas";     // 聖誕：整個 12 月
    if (within(md, "06-01", "06-30")) return "graduation";    // 畢業季：6 月（端午那幾天讓給端午）
    if (within(md, "09-01", "09-10")) return "school";        // 開學季
    return "";
  }
  function avatar(t) {
    var name = theme(t);
    return name ? "css/zhuang-avatar-" + name + ".svg" : BASE;
  }
  function apply() {
    var src = avatar();
    if (src === BASE) return;
    // 首頁雲、各提醒視窗、確認視窗裡的莊姐一起換
    var imgs = document.querySelectorAll('img[src$="zhuang-avatar.svg"]');
    for (var i = 0; i < imgs.length; i++) imgs[i].setAttribute("src", src);
  }

  global.EapSeason = { theme: theme, avatar: avatar, apply: apply };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", apply); else apply();
})(window);
