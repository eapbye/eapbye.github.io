/* 一次性改版公告橫幅：第一次進站顯示，按「知道了」後記在這台瀏覽器，不再出現。
   換新公告時，改 KEY 的版本字尾與 index.html 的文字即可。 */
(function () {
  var KEY = "eapNotice_compareBeforeExam_v1";
  var el = document.getElementById("updateNotice");
  if (!el) return;
  var seen = false;
  try { seen = localStorage.getItem(KEY) === "1"; } catch (e) { /* 讀不到就當作沒看過 */ }
  if (seen) { el.remove(); return; }
  el.hidden = false;
  var btn = document.getElementById("closeUpdateNotice");
  if (btn) btn.addEventListener("click", function () {
    try { localStorage.setItem(KEY, "1"); } catch (e) { /* 無法儲存時，這次瀏覽內仍會收起 */ }
    el.remove();
  });
})();
