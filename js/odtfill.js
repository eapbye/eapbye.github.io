/* 以瀏覽器端改寫 .odt：找到「標籤格」，把值寫進右邊第一個空格；沒值的欄位標紅色 ○。
   .odt 是壓縮檔，content.xml 存整張表；只改 content.xml，其他檔案原封不動。
   規則：
   1. 標籤格：姓名、學生姓名、學號、聯絡電話、e-mail、論文題目。
   2. 右邊第一個格子是空的 → 把值寫進去。
   3. 聯絡電話的格子若已印有「手機」（表21 的「(手機)(宅)(公)」、計畫口試檢核表的「手機」），
      只把手機號碼寫在「手機」後面，並把後面的空白縮短同樣的字數，版面不位移；宅、公不動。
   4. 簽名、勾選框、相似度、日期一律不碰。
   依賴：vendor/jszip.min.js（全域 JSZip）。 */
(function (global) {
  var NS = {
    text: "urn:oasis:names:tc:opendocument:xmlns:text:1.0",
    table: "urn:oasis:names:tc:opendocument:xmlns:table:1.0",
    office: "urn:oasis:names:tc:opendocument:xmlns:office:1.0",
    style: "urn:oasis:names:tc:opendocument:xmlns:style:1.0",
    fo: "urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0"
  };
  var LABELS = { "姓名": "name", "學生姓名": "name", "學號": "sid", "聯絡電話": "phone", "e-mail": "email", "論文題目": "title" };
  var RED = "TfillRed";

  function norm(s) { return String(s || "").replace(/[\s　]+/g, ""); }
  function clean(v) { return String(v == null ? "" : v).replace(/[\s　]+/g, " ").trim(); }
  // 半形字算 1、全形字算 2：用來估算縮短多少空白才不會把版面撐開
  function width(s) { var w = 0; for (var i = 0; i < s.length; i++) w += s.charCodeAt(i) > 255 ? 2 : 1; return w; }

  function childCells(row) {
    var out = [];
    for (var n = row.firstChild; n; n = n.nextSibling) {
      if (n.nodeType === 1 && n.namespaceURI === NS.table && (n.localName === "table-cell" || n.localName === "covered-table-cell")) out.push(n);
    }
    return out;
  }

  // 取得某個格子所在欄的寬度（英吋）；查不到回傳 0
  function toInch(v) {
    var m = /^([\d.]+)(in|cm|mm|pt)$/.exec(v || "");
    if (!m) return 0;
    return parseFloat(m[1]) / { in: 1, cm: 2.54, mm: 25.4, pt: 72 }[m[2]];
  }
  function columnWidth(doc, cell) {
    var row = cell.parentNode, table = row.parentNode;
    while (table && !(table.localName === "table" && table.namespaceURI === NS.table)) table = table.parentNode;
    if (!table) return 0;
    var idx = 0;
    for (var n = row.firstChild; n && n !== cell; n = n.nextSibling) {
      if (n.nodeType === 1 && n.namespaceURI === NS.table && /table-cell$/.test(n.localName)) idx += parseInt(n.getAttributeNS(NS.table, "number-columns-repeated") || "1", 10);
    }
    var cols = table.getElementsByTagNameNS(NS.table, "table-column"), at = 0;
    for (var i = 0; i < cols.length; i++) {
      var rep = parseInt(cols[i].getAttributeNS(NS.table, "number-columns-repeated") || "1", 10);
      if (idx < at + rep) {
        var name = cols[i].getAttributeNS(NS.table, "style-name");
        var styles = doc.getElementsByTagNameNS(NS.style, "style");
        for (var j = 0; j < styles.length; j++) {
          if (styles[j].getAttributeNS(NS.style, "name") === name) {
            var pr = styles[j].getElementsByTagNameNS(NS.style, "table-column-properties")[0];
            return pr ? toInch(pr.getAttributeNS(NS.style, "column-width")) : 0;
          }
        }
        return 0;
      }
      at += rep;
    }
    return 0;
  }
  // 手機號碼不能折行：格子太窄時，估算能放下的字級（最小 8pt）
  function shrinkStyle(doc, size) {
    var name = "TfillSmall" + size.toString().replace(".", "_");
    var auto = doc.getElementsByTagNameNS(NS.office, "automatic-styles")[0];
    var exists = false, all = auto.getElementsByTagNameNS(NS.style, "style");
    for (var i = 0; i < all.length; i++) if (all[i].getAttributeNS(NS.style, "name") === name) exists = true;
    if (!exists) {
      var st = doc.createElementNS(NS.style, "style:style");
      st.setAttributeNS(NS.style, "style:name", name);
      st.setAttributeNS(NS.style, "style:family", "text");
      var tp = doc.createElementNS(NS.style, "style:text-properties");
      tp.setAttributeNS(NS.fo, "fo:font-size", size + "pt");
      st.appendChild(tp); auto.appendChild(st);
    }
    return name;
  }

  function redCircle(doc) {
    var sp = doc.createElementNS(NS.text, "text:span");
    sp.setAttributeNS(NS.text, "text:style-name", RED);
    sp.textContent = "○";
    return sp;
  }

  // 只填「手機」：找到含「手機」的段落，把號碼接在那段文字後面，並縮短緊接著的連續空白（text:s）
  function fillMobile(doc, cell, val) {
    var ps = cell.getElementsByTagNameNS(NS.text, "p");
    for (var i = 0; i < ps.length; i++) {
      var p = ps[i];
      var node = null;
      for (var n = p.firstChild; n; n = n.nextSibling) {
        if (n.nodeType === 3 && n.nodeValue.indexOf("手機") >= 0) { node = n; break; }
      }
      if (!node) continue;
      var lead = /\s$/.test(node.nodeValue) ? "" : " ";
      var ins = val ? doc.createTextNode(lead + val) : null;
      var mark = val ? null : redCircle(doc);
      var used = val ? width(lead + val) : 2;
      var after = node.nextSibling;
      p.insertBefore(ins || mark, after);
      // 緊接著的 <text:s text:c="N"/> 就是留給手寫的空白：扣掉剛寫入的寬度，至少留 1 格
      var s = ins ? ins.nextSibling : mark.nextSibling;
      if (s && s.nodeType === 1 && s.namespaceURI === NS.text && s.localName === "s") {
        var c = parseInt(s.getAttributeNS(NS.text, "c") || "1", 10);
        s.setAttributeNS(NS.text, "text:c", String(Math.max(1, c - used)));
      }
      return true;
    }
    return false;
  }

  function fillCell(doc, cell, val, key) {
    var p = cell.getElementsByTagNameNS(NS.text, "p")[0];
    if (!p) { p = doc.createElementNS(NS.text, "text:p"); cell.appendChild(p); }
    if (!val) { p.appendChild(redCircle(doc)); return; }
    var node = doc.createTextNode(val);
    if (key === "phone") {
      var w = columnWidth(doc, cell);               // 英吋；扣掉段落縮排與框線的空間
      if (w > 0) {
        var avail = (w - 0.4) * 72;                 // pt
        // 以最寬字型（約 0.64 個字寬／半形字）保守估算
        var size = Math.floor(Math.min(12, avail / (width(val) * 0.64)) * 2) / 2;
        if (size < 12) {
          var sp = doc.createElementNS(NS.text, "text:span");
          sp.setAttributeNS(NS.text, "text:style-name", shrinkStyle(doc, Math.max(8, size)));
          sp.appendChild(node); p.appendChild(sp); return;
        }
      }
    }
    p.appendChild(node);
  }

  async function fillOdtBuffer(buffer, data) {
    var zip = await JSZip.loadAsync(buffer);
    var xml = await zip.file("content.xml").async("string");
    var doc = new DOMParser().parseFromString(xml, "application/xml");
    if (doc.getElementsByTagName("parsererror").length) throw new Error("parse");
    var auto = doc.getElementsByTagNameNS(NS.office, "automatic-styles")[0];
    var st = doc.createElementNS(NS.style, "style:style");
    st.setAttributeNS(NS.style, "style:name", RED);
    st.setAttributeNS(NS.style, "style:family", "text");
    var tp = doc.createElementNS(NS.style, "style:text-properties");
    tp.setAttributeNS(NS.fo, "fo:color", "#ff0000");
    tp.setAttributeNS(NS.fo, "fo:font-weight", "bold");
    st.appendChild(tp); auto.appendChild(st);
    var filled = [];
    var rows = doc.getElementsByTagNameNS(NS.table, "table-row");
    for (var r = 0; r < rows.length; r++) {
      var cells = childCells(rows[r]);
      for (var i = 0; i < cells.length; i++) {
        var c = cells[i];
        if (c.localName !== "table-cell") continue;
        var key = LABELS[norm(c.textContent)];
        if (!key) continue;
        var tgt = null;
        for (var j = i + 1; j < cells.length; j++) { if (cells[j].localName === "table-cell") { tgt = cells[j]; break; } }
        if (!tgt) continue;
        var val = clean(data && data[key]);
        if (norm(tgt.textContent)) {
          // 格子裡已有字：只有「聯絡電話」且已印有「手機」時才處理
          if (key === "phone" && tgt.textContent.indexOf("手機") >= 0 && fillMobile(doc, tgt, val)) filled.push(val ? key : key + ":○");
          continue;
        }
        fillCell(doc, tgt, val, key);
        filled.push(val ? key : key + ":○");
      }
    }
    var out = new XMLSerializer().serializeToString(doc);
    if (out.indexOf("<?xml") !== 0) out = '<?xml version="1.0" encoding="UTF-8"?>' + out;
    zip.file("content.xml", out);
    // mimetype 必須是壓縮檔裡的第一個檔案且不壓縮，Word、LibreOffice 才認得
    zip.file("mimetype", "application/vnd.oasis.opendocument.text", { compression: "STORE" });
    var blob = await zip.generateAsync({ type: "blob", mimeType: "application/vnd.oasis.opendocument.text", compression: "DEFLATE" });
    return { blob: blob, filled: filled };
  }

  async function fillOdt(url, data) {
    var res = await fetch(url);
    if (!res.ok) throw new Error("fetch " + res.status);
    return fillOdtBuffer(await res.arrayBuffer(), data);
  }

  global.fillOdt = fillOdt;
  global.fillOdtBuffer = fillOdtBuffer;
})(window);
