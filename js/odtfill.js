/* 以瀏覽器端改寫 .odt：找到「標籤格」，把值寫進右邊第一個空格；沒值的欄位標紅色 ○。
   .odt 是壓縮檔，content.xml 存整張表；只改 content.xml，其他檔案原封不動。
   規則：
   1. 標籤格：姓名、學生姓名、學號、聯絡電話、e-mail、論文題目。
   2. 右邊第一個格子是空的 → 把值寫進去。
   3. 聯絡電話的格子若已印有「手機」（表21 的「(手機)(宅)(公)」、計畫口試檢核表的「手機」），
      只把手機號碼寫在「手機」後面，並把後面的空白縮短同樣的字數，版面不位移；宅、公不動。
   4. 簽名、勾選框、相似度、日期一律不碰。
   5. 沒值的欄位標「紅字黃底的 ○」，個數依欄位一般長度（姓名 3、學號 9、電話 10、e-mail 8、題目 8）；填入的字目標 14pt（和表單標籤同大），放不下才縮小；題目可折兩行。
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
  function styleColumnWidth(doc, name) {
    var styles = doc.getElementsByTagNameNS(NS.style, "style");
    for (var j = 0; j < styles.length; j++) {
      if (styles[j].getAttributeNS(NS.style, "name") === name) {
        var pr = styles[j].getElementsByTagNameNS(NS.style, "table-column-properties")[0];
        return pr ? toInch(pr.getAttributeNS(NS.style, "column-width")) : 0;
      }
    }
    return 0;
  }
  // 第 i 欄（0 起算）的寬度（英吋）；查不到回傳 0
  function widthOfColumn(doc, table, i) {
    var cols = table.getElementsByTagNameNS(NS.table, "table-column"), at = 0;
    for (var k = 0; k < cols.length; k++) {
      var rep = parseInt(cols[k].getAttributeNS(NS.table, "number-columns-repeated") || "1", 10);
      if (i < at + rep) return styleColumnWidth(doc, cols[k].getAttributeNS(NS.table, "style-name"));
      at += rep;
    }
    return 0;
  }
  // 取得某個格子的可用寬度（英吋）：合併儲存格會把跨過的欄寬加總；查不到回傳 0
  function columnWidth(doc, cell) {
    var row = cell.parentNode, table = row.parentNode;
    while (table && !(table.localName === "table" && table.namespaceURI === NS.table)) table = table.parentNode;
    if (!table) return 0;
    var idx = 0;
    for (var n = row.firstChild; n && n !== cell; n = n.nextSibling) {
      if (n.nodeType === 1 && n.namespaceURI === NS.table && /table-cell$/.test(n.localName)) idx += parseInt(n.getAttributeNS(NS.table, "number-columns-repeated") || "1", 10);
    }
    var span = parseInt(cell.getAttributeNS(NS.table, "number-columns-spanned") || "1", 10), total = 0;
    for (var c = 0; c < span; c++) {
      var w = widthOfColumn(doc, table, idx + c);
      if (!w) return 0;
      total += w;
    }
    return total;
  }
  // 手機號碼不能折行：格子太窄時，估算能放下的字級（最小 8pt；填入字最小 10pt）
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

  // 沒填的欄位：依該欄一般長度重複 ○，再加黃底，印出來才一眼看得到
  var CIRCLES = { name: 3, sid: 9, phone: 10, email: 8, title: 8 };
  function circleCount(key) { return CIRCLES[key] || 3; }
  function redCircle(doc, key) {
    var sp = doc.createElementNS(NS.text, "text:span");
    sp.setAttributeNS(NS.text, "text:style-name", RED);
    sp.textContent = new Array(circleCount(key) + 1).join("○");
    return sp;
  }
  // 填入的字：目標 14pt（和表單印好的標籤一樣大）；放不下才逐級縮小（最小 10pt）。
  // 論文題目可以折成兩行，其他欄位要一行放完。全形字寬 1 em、半形約 0.55 em。
  function emWidth(s) { var w = 0; for (var i = 0; i < s.length; i++) w += s.charCodeAt(i) > 255 ? 1 : 0.55; return w; }
  function fitSize(doc, cell, val, key) {
    var w = columnWidth(doc, cell);
    if (!(w > 0)) return 12;
    var avail = (w - 0.4) * 72, em = emWidth(val), maxLines = key === "title" ? 2 : 1;
    var sizes = [14, 13, 12, 11, 10.5, 10];
    for (var i = 0; i < sizes.length; i++) if (Math.ceil(em * sizes[i] / avail) <= maxLines) return sizes[i];
    return 10;
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
      var mark = val ? null : redCircle(doc, "phone");
      var used = val ? width(lead + val) : 2 * circleCount("phone");
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
    if (!val) { p.appendChild(redCircle(doc, key)); return; }
    var sp = doc.createElementNS(NS.text, "text:span");
    sp.setAttributeNS(NS.text, "text:style-name", shrinkStyle(doc, fitSize(doc, cell, val, key)));
    sp.appendChild(doc.createTextNode(val));
    p.appendChild(sp);
  }


  /* ===== 口試資訊（3.0.9）：只填有把握的格子 =====
     哪些表單、填哪些格子寫死在 EXAM_FORMS；其他表單（邀請函、委員略歷、填表日期、成績報告單、簽名頁、檢核表）一律不碰。
     做法是「等寬替換」：把表單上留給手寫的空白（text:s 或空白字元）換成數字，少掉的寬度從空白扣，
     整行長度不變，不會把後面的字推到下一行。找不到錨點字就整格不填。 */
  var EXAM_FORMS = {
    "04-committee-review-result.odt": { term: true, time: "口試時間", copies: 3 },
    "05-committee-summary-result.odt": { term: true, time: "口試時間" },
    "04-exam-scoring-sheet.odt": { term: true, time: "考試時間", copies: 3 },
    "02-proposal-template.odt": { time: "口試時間", place: "口試地點" }
  };
  var WEEK = "日一二三四五六";

  function examInfo(data) {
    var d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(clean(data && data.examDate));
    var t = /^(\d{2}):(\d{2})$/.exec(clean(data && data.examStart));
    var r = /^(\d)(\d{2})$/.exec(clean(data && data.examRoom));
    var info = {};
    if (d) {
      var y = +d[1], m = +d[2], day = +d[3];
      var dt = new Date(Date.UTC(y, m - 1, day));
      if (dt.getUTCMonth() === m - 1) {
        info.date = { roc: y - 1911, m: m, d: day, week: WEEK[dt.getUTCDay()] };
        // 學年度：8～12 月是當年民國年第 1 學期；1 月是前一年第 1 學期；2～7 月是前一年第 2 學期
        info.term = m >= 8 ? { y: y - 1911, s: 1 } : (m === 1 ? { y: y - 1912, s: 1 } : { y: y - 1912, s: 2 });
      }
    }
    if (t) info.time = { h: t[1], mm: t[2] };
    if (r) info.room = { floor: r[1], room: r[0] };
    return info;
  }

  // 把段落攤平成 token：文字節點、text:s（N 個空白）、其他元素（tab、換行）當一個非空白字元
  function tokensOf(p) {
    var out = [];
    (function walk(node) {
      for (var n = node.firstChild; n; n = n.nextSibling) {
        if (n.nodeType === 3) out.push({ node: n, kind: "t", text: n.nodeValue });
        else if (n.nodeType === 1 && n.namespaceURI === NS.text && n.localName === "s") {
          var c = parseInt(n.getAttributeNS(NS.text, "c") || "1", 10);
          out.push({ node: n, kind: "s", text: new Array(c + 1).join(" ") });
        } else if (n.nodeType === 1 && n.namespaceURI === NS.text && (n.localName === "tab" || n.localName === "line-break")) {
          out.push({ node: n, kind: "x", text: "\t" });
        } else if (n.nodeType === 1) walk(n);
      }
    })(p);
    var at = 0;
    out.forEach(function (t) { t.start = at; at += t.text.length; t.end = at; });
    return out;
  }
  function flatOf(toks) { return toks.map(function (t) { return t.text; }).join(""); }
  function spaceNode(doc, n) { var s = doc.createElementNS(NS.text, "text:s"); if (n > 1) s.setAttributeNS(NS.text, "text:c", String(n)); return s; }

  // 在 from 之後找 anchor，把它前面連續的空白換成 val（靠右貼著錨點）；回傳新的游標位置，找不到回傳 -1
  function fillBefore(doc, p, anchor, val, from) {
    var toks = tokensOf(p), flat = flatOf(toks);
    var i = flat.indexOf(anchor, from || 0);
    if (i < 0) return -1;
    var j = i;
    while (j > 0 && flat.charAt(j - 1) === " ") j--;
    var blank = i - j;
    if (!blank) return -1; // 錨點前沒有留空白：不硬塞，免得撐開版面
    var keep = Math.max(1, blank - width(val));
    var first = true;
    toks.forEach(function (t) {
      if (t.end <= j || t.start >= i) return;
      var a = Math.max(t.start, j) - t.start, b = Math.min(t.end, i) - t.start;
      var parent = t.node.parentNode;
      if (t.kind === "s") {
        if (first) { parent.insertBefore(spaceNode(doc, keep), t.node); parent.insertBefore(doc.createTextNode(val), t.node); }
        var left = t.text.length - (b - a);
        if (left > 0) { if (left > 1) t.node.setAttributeNS(NS.text, "text:c", String(left)); else t.node.removeAttributeNS(NS.text, "c"); }
        else parent.removeChild(t.node);
      } else if (t.kind === "t") {
        var before = t.text.slice(0, a), after = t.text.slice(b);
        t.node.nodeValue = before;
        var ref = t.node.nextSibling;
        if (first) { parent.insertBefore(spaceNode(doc, keep), ref); parent.insertBefore(doc.createTextNode(val), ref); }
        if (after) parent.insertBefore(doc.createTextNode(after), ref);
        if (!before) parent.removeChild(t.node);
      }
      first = false;
    });
    return j + keep + val.length + anchor.length;
  }
  // 依序填一串錨點；任何一個找不到就停（已填的保留，因為每個都是獨立的等寬替換）
  function fillSeq(doc, p, pairs, start) {
    var cur = start || 0;
    for (var k = 0; k < pairs.length; k++) {
      var next = fillBefore(doc, p, pairs[k][0], pairs[k][1], cur);
      if (next < 0) return false;
      cur = next;
    }
    return true;
  }
  function labelCell(doc, label) {
    var rows = doc.getElementsByTagNameNS(NS.table, "table-row");
    for (var r = 0; r < rows.length; r++) {
      var cells = childCells(rows[r]);
      for (var i = 0; i < cells.length; i++) {
        if (cells[i].localName === "table-cell" && norm(cells[i].textContent) === label) {
          for (var j = i + 1; j < cells.length; j++) if (cells[j].localName === "table-cell") return cells[j];
        }
      }
    }
    return null;
  }
  function firstParaWith(root, text) {
    var ps = root.getElementsByTagNameNS(NS.text, "p");
    for (var i = 0; i < ps.length; i++) if (norm(ps[i].textContent).indexOf(text) >= 0) return ps[i];
    return null;
  }

  function fillExam(doc, recipe, info, filled) {
    if (recipe.term && info.term) {
      var hp = firstParaWith(doc, "學年度第");
      if (hp && /學年度第學期$/.test(norm(hp.textContent)) && fillSeq(doc, hp, [["學年度", String(info.term.y)], ["學期", String(info.term.s)]])) filled.push("term");
    }
    if (recipe.time && info.date && info.time) {
      var cell = labelCell(doc, recipe.time);
      var tp = cell && firstParaWith(cell, "年");
      if (tp) {
        var t = norm(tp.textContent);
        var pairs = [["年", String(info.date.roc)], ["月", String(info.date.m)], ["日", String(info.date.d)]];
        if (t.indexOf("星期") >= 0) pairs.push(["）", info.date.week]);
        pairs.push(["時", info.time.h], ["分", info.time.mm]);
        if (fillSeq(doc, tp, pairs)) filled.push("examTime");
      }
    }
    if (recipe.place && info.room) {
      var pc = labelCell(doc, recipe.place);
      var pp = pc && firstParaWith(pc, "樓");
      if (pp) {
        var startAt = flatOf(tokensOf(pp)).indexOf("）");
        if (startAt >= 0 && fillSeq(doc, pp, [["樓", info.room.floor], ["室", info.room.room]], startAt + 1)) filled.push("examPlace");
      }
    }
  }

  // 同一張表要 N 份（評審意見表、評分表各 3 份）：把內文複製成 N 頁，每份從新的一頁開始
  function repeatBody(doc, copies) {
    var body = doc.getElementsByTagNameNS(NS.office, "text")[0];
    if (!body || copies < 2) return;
    var CONTENT = { "text:p": 1, "text:h": 1, "table:table": 1, "text:list": 1, "text:section": 1 };
    var content = [];
    for (var n = body.firstChild; n; n = n.nextSibling) if (n.nodeType === 1 && CONTENT[n.prefix + ":" + n.localName]) content.push(n);
    if (!content.length || content[0].localName !== "p") return; // 第一個不是段落就不複製（沒有安全的分頁點）
    var auto = doc.getElementsByTagNameNS(NS.office, "automatic-styles")[0];
    var orig = content[0].getAttributeNS(NS.text, "style-name");
    var name = "TfillBreak";
    var st = null, all = auto.getElementsByTagNameNS(NS.style, "style");
    for (var i = 0; i < all.length; i++) if (all[i].getAttributeNS(NS.style, "name") === orig && all[i].getAttributeNS(NS.style, "family") === "paragraph") st = all[i].cloneNode(true);
    if (!st) {
      st = doc.createElementNS(NS.style, "style:style");
      st.setAttributeNS(NS.style, "style:family", "paragraph");
      if (orig) st.setAttributeNS(NS.style, "style:parent-style-name", orig);
    }
    st.setAttributeNS(NS.style, "style:name", name);
    var pp = st.getElementsByTagNameNS(NS.style, "paragraph-properties")[0];
    if (!pp) { pp = doc.createElementNS(NS.style, "style:paragraph-properties"); st.insertBefore(pp, st.firstChild); }
    pp.setAttributeNS(NS.fo, "fo:break-before", "page");
    auto.appendChild(st);
    for (var k = 1; k < copies; k++) {
      content.forEach(function (c, idx) {
        var clone = c.cloneNode(true);
        if (idx === 0) clone.setAttributeNS(NS.text, "text:style-name", name);
        body.appendChild(clone);
      });
    }
  }

  async function fillOdtBuffer(buffer, data, file) {
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
    tp.setAttributeNS(NS.fo, "fo:background-color", "#ffe14d");
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
    var recipe = EXAM_FORMS[String(file || "").split("/").pop()];
    if (recipe) {
      fillExam(doc, recipe, examInfo(data), filled);
      if (recipe.copies) repeatBody(doc, recipe.copies);
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
    return fillOdtBuffer(await res.arrayBuffer(), data, url);
  }

  global.fillOdt = fillOdt;
  global.fillOdtBuffer = fillOdtBuffer;
})(window);
