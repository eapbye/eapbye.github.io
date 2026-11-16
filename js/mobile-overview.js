// 手機「流程一覽」（3.0.17 試辦）
// 手機點「學位論文計畫口試」「學位論文考試」兩張主卡時，不開流程（流程只限電腦），改開這個唯讀的一覽：
// 每一步要準備什麼、誰要簽名、範例檔、最後確認要交給誰。不鎖步驟、不給下載鈕、不寫進度。
// 資料全部取自 data/flow.js（經 app.js 的 currentFlow）與 app.js 的最後確認清單，改規定時只改一處；
// 這個檔只負責「手機怎麼排」。電腦口吻的句子（下方、右下角、點擊…）手機不顯示，見 MOBILE_EXTRA。
(function () {
  "use strict";

  // 文件在手機上用短名：優先查 app.js 最後確認清單的短名表（INVENTORY_DISPLAY，同一份來源）；
  // 查不到再用下面的對照；都沒有就用 flow.js 的原標題去掉份數。
  var SHORT = {
    "proposal-plagiarism-certificate": "Turnitin 比對證明表",
    "defense-plagiarism-certificate": "Turnitin 比對證明表",
    "defense-turnitin-fulltext": "Turnitin 全文電子檔",
    "proposal-review-checklist": "資料檢核表",
    "defense-checklist": "資料檢核表",
    "proposal-application": "申請表",
    "defense-application": "申請書",
    "committee-invitation": "邀請函",
    "defense-invitation": "邀請函",
    "committee-review-result": "評審意見表",
    "committee-summary-result": "綜合評審結果表",
    "defense-scoring-sheet": "評分表",
    "grade-report": "成績報告單",
    "signature-page": "簽名頁",
    "proposal-book": "口試本",
    "defense-book": "考試本"
  };

  // 標題括號裡的說明若是電腦版的口吻，手機換成這裡的句子；空字串＝不顯示。
  // 沒列到、又含「右下角／下方／點擊」的說明一律不顯示，避免手機上出現讀不通的句子。
  var MOBILE_EXTRA = {
    "請至行政大樓四樓列印": "行政大樓 4 樓列印",
    "點擊下方檔案下載並以打字方式填寫": "到電腦下載，打字填寫",
    "請參考右下角步驟與範例": ""
  };
  var DESKTOP_WORDS = /右下角|下方|點擊/;

  var QUAL_NAMES = {
    "written-exam": "筆試",
    "journal-publication": "期刊／研討會論文發表",
    "civil-service-exam": "高普考或同等級考試"
  };

  var root = null, backBtn = null, returnFocusTo = null, openMode = "";

  function h(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  // 「學位論文計畫口試申請表 1 份（說明）」→ 名稱、份數、說明
  function splitTitle(title) {
    var m = /^(.*?)\s*(\d+)\s*([份本])(?:（(.+)）)?$/.exec(title || "");
    if (!m) return { name: title || "", qty: "", extra: "" };
    var extra = m[4] || "";
    if (Object.prototype.hasOwnProperty.call(MOBILE_EXTRA, extra)) extra = MOBILE_EXTRA[extra];
    else if (DESKTOP_WORDS.test(extra)) extra = "";
    return { name: m[1], qty: m[2] + " " + m[3], extra: extra };
  }

  function shortName(doc, name) {
    var d = inventoryDisplay({ label: name }).short;
    return d !== name ? d : SHORT[doc.id] || name;
  }

  function linkButton(label, href) {
    var a = h("a", "mo-btn", /範例/.test(label) ? "看範例" : label);
    a.href = href;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    return a;
  }

  function bookingButton(mode) {
    var b = h("button", "mo-btn is-main", "幫我寫預約訊息");
    b.type = "button";
    b.addEventListener("click", function () {
      if (!window.RoomBooking) return;
      var label = flowModes[mode].label;
      document.getElementById("mobileBookingBody").replaceChildren(RoomBooking.build(label, { standalone: true }));
      document.getElementById("mobileBookingModal").classList.remove("hidden");
    });
    return b;
  }

  function docRow(doc, mode) {
    var s = splitTitle(doc.title);
    var row = h("div", "mo-row");
    var top = h("div", "mo-r1");
    top.append(h("span", "mo-rn", shortName(doc, s.name)));
    if (s.qty) top.append(h("span", "mo-qty", s.qty));
    row.append(top);
    if (s.extra) row.append(h("div", "mo-extra", s.extra));
    if (doc.sign && doc.sign.length) {
      var chips = h("div", "mo-chips");
      doc.sign.forEach(function (who) { chips.append(h("span", "mo-sign", "✍ " + who + "簽名")); });
      row.append(chips);
    }
    if (doc.note) row.append(h("div", "mo-note", doc.note));
    if (doc.path && doc.path.length) {
      var path = h("div", "mo-path");
      doc.path.forEach(function (p, i) {
        if (i) path.append(h("b", "", "›"));
        path.append(h("span", "", p));
      });
      row.append(path);
    }
    if (doc.tip) {
      var tip = h("div", "mo-tip");
      var img = h("img");
      img.alt = ""; img.src = "css/zhuang-avatar.svg"; img.setAttribute("aria-hidden", "true");
      tip.append(img, h("div", "", doc.tip));
      row.append(tip);
    }
    var btns = h("div", "mo-btns");
    if (doc.sample) btns.append(linkButton(doc.sample[0], doc.sample[1]));
    if (doc.tool === "roomBooking") btns.append(bookingButton(mode));
    if (btns.children.length) row.append(btns);
    return row;
  }

  function requirementRow(text, links) {
    var s = splitTitle(text);
    var row = h("div", "mo-row");
    var top = h("div", "mo-r1");
    top.append(h("span", "mo-rn", s.name));
    if (s.qty) top.append(h("span", "mo-qty", s.qty));
    row.append(top);
    if (s.extra) row.append(h("div", "mo-extra", s.extra));
    if (links && links.length) {
      var btns = h("div", "mo-btns");
      links.forEach(function (l) { if (l && l.href) btns.append(linkButton(l.label, l.href)); });
      if (btns.children.length) row.append(btns);
    }
    return row;
  }

  // ---- 第一步：資格確認 ----
  function precheckStep(flow, mode) {
    var pre = flow.precheck;
    var rows = [];
    var head = h("div", "mo-row");
    if (mode === "defense") {
      (pre.items || []).forEach(function (it) { head.append(h("div", "mo-cond", "✓ " + it.label.replace(/^我已/, "已"))); });
    } else {
      head.append(h("div", "mo-rn", (pre.passedLabel || "").replace(/^我已/, "需先")));
    }
    rows.push(head);
    (pre.requirements || []).forEach(function (t) { rows.push(requirementRow(t)); });
    var count = (pre.requirements || []).length;
    if (flow.qualification) {
      count += 1;
      var grp = h("div", "mo-optgrp");
      grp.append(h("div", "mo-opttl", "資格三選一"));
      flow.qualification.options.forEach(function (o) {
        var box = h("div", "mo-opt");
        box.append(h("b", "", QUAL_NAMES[o.id] || o.label));
        var need = (o.requirements || []).map(function (r) { return splitTitle(r).name; });
        box.append(h("span", "", need.length ? need.join("、") : "免附資料（檢核表勾「通過筆試」）"));
        if (o.link) {
          var btns = h("div", "mo-btns");
          btns.append(linkButton(o.link.label, o.link.href));
          box.append(btns);
        }
        grp.append(box);
      });
      rows.push(grp);
    }
    return { name: (pre.number || "").split("：")[1] || "資格確認", sub: "", rows: rows, count: count, unit: "項" };
  }

  // ---- 最後確認：依繳交對象 ----
  function inventorySub(d) {
    var parts = [];
    if (d.tag) parts.push(d.tag);
    if (d.note) parts.push(d.note);
    if (d.sign) parts.push(/簽$/.test(d.sign) ? d.sign : d.sign + "簽");
    if (d.day) parts.push(d.day);
    return parts.join("・");
  }

  function inventoryGroup(title, items, sub) {
    var g = h("div", "mo-grp");
    var gt = h("div", "mo-gt");
    gt.append(h("span", "", title), h("small", "", sub || countInventoryTotal(items) + " 份"));
    g.append(gt);
    items.forEach(function (item) {
      var d = inventoryDisplay(item);
      var it = h("div", "mo-it");
      var l = h("div", "mo-il");
      l.append(h("b", "", d.short));
      var sub2 = inventorySub(d);
      if (sub2) l.append(h("span", "", sub2));
      it.append(l);
      var q = inventoryQuantity(item);
      if (q > 1) it.append(h("span", "mo-qty", "×" + q));
      g.append(it);
    });
    return g;
  }

  function submissionStep(step, mode) {
    var items = mode === "defense" ? buildDefenseSubmissionInventory() : buildProposalSubmissionInventory();
    var wrap = document.createDocumentFragment();
    // 手機上沒有選資格的動作，清單固定是「筆試」版；選別種資格的人另外要加資格證明
    if (mode === "proposal") wrap.append(h("div", "mo-gnote", "資格若選期刊發表或高普考，所辦另加資格證明（見第 1 步）"));
    var office = items.filter(function (i) { return i.recipient === "office"; });
    var advisor = items.filter(function (i) { return i.recipient === "advisor"; });
    var eachCommittee = items.filter(function (i) { return i.recipient === "committee" && i.detail === "A 口試委員"; });
    wrap.append(inventoryGroup("繳交所辦", office));
    wrap.append(inventoryGroup("繳交指導教授", advisor));
    wrap.append(inventoryGroup("繳交口試委員", eachCommittee, "兩位各 " + countInventoryTotal(eachCommittee) + " 份"));
    return { name: (step.number || "").split("：")[1] || "最後確認", sub: "", rows: [wrap], count: countInventoryTotal(items), unit: "份" };
  }

  function buildSteps(flow, mode) {
    var steps = [precheckStep(flow, mode)];
    (flow.steps || []).forEach(function (s) {
      var name = (s.number || "").split("：")[1] || s.title || "";
      if (s.type === "documents") {
        steps.push({
          name: name,
          sub: s.title && s.title !== name ? s.title : "",
          rows: s.documents.map(function (d) { return docRow(d, mode); }),
          count: s.documents.length, unit: "項"
        });
      } else if (s.type === "declaration") {
        var intro = h("div", "mo-row");
        intro.append(h("div", "mo-extra", "到 iNCCU 填寫論文題目申報單，再列印"));
        var rows = [intro];
        (s.requirements || []).forEach(function (t) { rows.push(requirementRow(t, [s.link, s.sample])); });
        steps.push({ name: name, sub: "iNCCU 填申報單", rows: rows, count: (s.requirements || []).length, unit: "項" });
      } else if (s.type === "submission") {
        steps.push(submissionStep(s, mode));
      }
    });
    return steps;
  }

  // ---- 畫面 ----
  function render(mode) {
    var flow = currentFlow(mode);
    root.dataset.flow = mode;
    var steps = buildSteps(flow, mode);
    root.replaceChildren();

    backBtn = h("button", "mo-back", "← 回首頁");
    backBtn.id = "mobileOverviewBack";
    backBtn.type = "button";
    backBtn.addEventListener("click", close);
    root.append(backBtn);

    var head = h("div", "mo-head");
    var title = h("h1", "", flow.label);
    title.id = "mobileOverviewTitle";
    head.append(title);
    var next = window.EapNews && EapNews.nextFor ? EapNews.nextFor(mode) : null;
    if (next) {
      var dl = h("div", "mo-dl");
      dl.append(h("span", "", next.text));
      dl.append(h("span", "mo-left" + (next.days <= 7 ? " is-soon" : ""), next.days === 0 ? "今天" : "還有 " + next.days + " 天"));
      head.append(dl);
    }
    var pc = h("div", "mo-pc");
    pc.append(h("i", ""), document.createTextNode("手機看清單，下載與填表請用電腦"));
    head.append(pc);
    root.append(head);

    var cards = [];
    steps.forEach(function (s, i) {
      var card = h("section", "mo-step");
      var bodyId = "moBody" + (i + 1);
      var btn = h("button", "mo-sh");
      btn.type = "button";
      btn.setAttribute("aria-expanded", "false");
      btn.setAttribute("aria-controls", bodyId);
      btn.append(h("span", "mo-num", String(i + 1)));
      var t = h("span", "mo-t");
      t.append(h("span", "mo-name", s.name));
      if (s.sub) t.append(h("span", "mo-sub", s.sub));
      btn.append(t);
      if (s.count) btn.append(h("span", "mo-cnt", s.count + " " + s.unit));
      btn.append(h("span", "mo-chev"));
      var body = h("div", "mo-body");
      body.id = bodyId;
      body.hidden = true;
      s.rows.forEach(function (r) { body.append(r); });
      btn.addEventListener("click", function () {
        var wasOpen = card.classList.contains("is-open");
        cards.forEach(function (c) {
          c.card.classList.remove("is-open");
          c.btn.setAttribute("aria-expanded", "false");
          c.body.hidden = true;
        });
        if (!wasOpen) {
          card.classList.add("is-open");
          btn.setAttribute("aria-expanded", "true");
          body.hidden = false;
          var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
          card.scrollIntoView({ block: "start", behavior: reduce ? "auto" : "smooth" });
        }
      });
      card.append(btn, body);
      cards.push({ card: card, btn: btn, body: body });
      root.append(card);
    });

    var foot = h("div", "mo-foot");
    var img = h("img");
    img.alt = ""; img.src = "css/zhuang-avatar.svg"; img.setAttribute("aria-hidden", "true");
    foot.append(img, h("span", "", "點一步，看要準備什麼"));
    root.append(foot);
  }

  function open(mode) {
    if (!root || !flowModes[mode]) return;
    returnFocusTo = document.activeElement;
    openMode = mode;
    render(mode);
    root.classList.remove("hidden");
    document.body.classList.add("mo-lock");
    root.scrollTop = 0;
    if (typeof pushView === "function") pushView("overview");
    if (backBtn) backBtn.focus({ preventScroll: true });
  }

  // 只收起畫面（上一頁由 app.js 的 popstate 呼叫，瀏覽紀錄已經退掉了）
  function hide() {
    if (!root) return;
    root.classList.add("hidden");
    document.body.classList.remove("mo-lock");
    root.replaceChildren();
    openMode = "";
    if (returnFocusTo && returnFocusTo.focus) { try { returnFocusTo.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
    returnFocusTo = null;
  }

  // 用畫面上的「回首頁」關閉：同時把那筆瀏覽紀錄退掉
  function close() {
    hide();
    if (typeof leaveView === "function") leaveView("overview");
  }

  function isOpen() { return !!root && !root.classList.contains("hidden"); }

  function init() { root = document.getElementById("mobileOverview"); }
  if (document.getElementById("mobileOverview") || document.readyState !== "loading") init();
  else document.addEventListener("DOMContentLoaded", init);

  window.MobileOverview = { open: open, close: close, hide: hide, isOpen: isOpen };
})();
