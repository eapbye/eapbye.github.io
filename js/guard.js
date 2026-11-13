/* 防被嵌進別人的網頁（點擊劫持）。
   GitHub Pages 不能設定 X-Frame-Options，meta 形式的 CSP 又不支援 frame-ancestors，
   所以這裡用最基本的作法：發現自己被放在別的網站的框架裡，就先藏起內容，並嘗試把整個視窗導回本站。 */
(function () {
  try {
    if (window.top === window.self) return;
  } catch (e) { /* 跨網域讀取 top 會丟錯，代表確實被嵌入 */ }
  document.documentElement.style.display = "none";
  try { window.top.location.replace(window.self.location.href); } catch (e) { /* 被擋也沒關係，內容已隱藏 */ }
})();
