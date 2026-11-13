#!/usr/bin/env python3
"""教政一點通 靜態一致性檢查（只讀，不改任何檔案）。

用法：python3 tests/check_consistency.py [網站根目錄]
  不給路徑時，以本檔所在資料夾的上一層為網站根目錄。
結果等級：FAIL（必須修）、WARN（請人判斷）、INFO（參考）。有 FAIL 時結束碼為 1。
"""
import datetime
import os
import re
import sys

# 這幾個 key 一旦改名，已用過網站的人的進度就會消失（見交接檔第 11 節）。
# 真的要改時，連同這裡的基準一起改。
BASELINE_KEYS = {
    "STORAGE_KEY": "thesisChecklistProgressV3",
    "GUIDE_STORAGE_PREFIX": "thesisGuideModalSeenV3",
    "DEADLINE_STORAGE_KEY": "thesisDeadlineModalSeenV3",
    "SUBMISSION_NOTICE_PREFIX": "thesisSubmissionNoticeSeenV3",
}
# 畢業專區勾選項既有的 index 不可消失或位移（見交接檔第 6 節）。
# index 1 原為考後 Turnitin 勾選項，2026-11-12 流程改版後停用：不再使用、也不可挪給別項（舊使用者可能存有 index 1 的勾選）。
RETIRED_GRAD_INDEXES = {1}
BASELINE_GRAD_INDEXES = set(range(14)) - RETIRED_GRAD_INDEXES

TURNITIN_FULL = "學位論文原創比對（Turnitin）證明表"
AIGC_FULL = "學位論文AIGC檢測報告書"


JSZIP_SHA256 = "acc7e41455a80765b5fd9c7ee1b8078a6d160bbbca455aeae854de65c947d59e"


def read(path):
    with open(path, encoding="utf-8") as f:
        return f.read()


def line_of(text, pos):
    return text.count("\n", 0, pos) + 1


def read_site(root):
    """讀 index.html，再把它用 <link>／<script src> 引用的本機 css、js 依序接在後面，
    串成一份文字交給下面的檢查（拆檔後，原本對 index.html 全文做的檢查照常有效）。
    回傳 (全文, 各段來源)；各段來源用來把位置換回「檔名＋行號」。"""
    html = read(os.path.join(root, "index.html"))
    parts = [("index.html", html)]
    for m in re.finditer(r'<link[^>]+href="([^"#:]+\.css)"|<script[^>]+src="([^"#:]+\.js)"', html):
        rel = m.group(1) or m.group(2)
        fp = os.path.join(root, rel)
        if os.path.isfile(fp):
            parts.append((rel, read(fp)))
    text, segs = "", []
    for rel, body in parts:
        segs.append((len(text), len(text) + len(body), rel))
        text += body + "\n"
    return html, text, segs


def where(text, segs, pos):
    """全文中的位置 → (檔名, 該檔第幾行, 該行文字)。"""
    for start, end, rel in segs:
        if start <= pos <= end:
            body = text[start:end]
            ln = body.count("\n", 0, pos - start) + 1
            return rel, ln, body.split("\n")[ln - 1].strip()
    return "?", 0, ""


def check(root):
    res = []

    def add(level, msg):
        res.append((level, msg))

    idx_path = os.path.join(root, "index.html")
    reg_path = os.path.join(root, "course-registration.html")
    for p in (idx_path, reg_path):
        if not os.path.isfile(p):
            add("FAIL", f"找不到 {os.path.basename(p)}")
            return res
    html, idx, segs = read_site(root)
    reg = read(reg_path)
    # 預選登記頁的程式已搬到 js/course-registration.js，課程資料從那裡讀（接在 HTML 後面，HTML 的行號不變）
    reg_js_path = os.path.join(root, "js", "course-registration.js")
    if os.path.isfile(reg_js_path):
        reg += "\n" + read(reg_js_path)

    def loc(pos):
        rel, ln, _ = where(idx, segs, pos)
        return f"{rel} 第 {ln} 行"

    def loc_line(pos):
        rel, ln, line = where(idx, segs, pos)
        return f"{rel} 第 {ln} 行 {line[:60]}"

    # ---- 部署清單（.github/workflows/pages.yml；舊的 .gitlab-ci.yml 亦可）----
    deployed_files = {"index.html", "course-registration.html"}
    deployed_dirs = set()
    ci_path = os.path.join(root, ".github", "workflows", "pages.yml")
    if not os.path.isfile(ci_path):
        ci_path = os.path.join(root, ".gitlab-ci.yml")
    if os.path.isfile(ci_path):
        ci = read(ci_path)
        for m in re.finditer(r"cp\s+(-r\s+)?(\S+)\s+(?:public|_site)/", ci):
            (deployed_dirs if m.group(1) else deployed_files).add(m.group(2))
        for m in re.finditer(r"\[ -f (\S+) \]", ci):
            deployed_files.add(m.group(1))
        for m in re.finditer(r"\[ -d (\S+) \]", ci):
            deployed_dirs.add(m.group(1))
    else:
        add("WARN", "找不到 .github/workflows/pages.yml，無法核對哪些檔案會被部署")

    # ---- 本機連結與檔案是否存在、是否會被部署 ----
    refs = {}
    for m in re.finditer(r'"((?:documents|graduation)/[^"$`{}\s]+\.[A-Za-z0-9]+)"', idx):
        refs.setdefault(m.group(1), loc(m.start()))
    for m in re.finditer(r'(?:href|src)="([^"#:$]+\.(?:html|svg|png|jpg|pdf|odt|docx|css|js))(?:\?[^"]*)?"', idx):
        refs.setdefault(m.group(1), loc(m.start()))
    for m in re.finditer(r'(?:href|src)="([^"#:$]+\.(?:html|svg|png|jpg))(?:\?[^"]*)?"', reg):
        refs.setdefault(m.group(1), f"course-registration.html 第 {line_of(reg, m.start())} 行")
    for path, ln in sorted(refs.items()):
        if not os.path.isfile(os.path.join(root, path)):
            add("FAIL", f"連結的檔案不存在：{path}（{ln}）")
        top = path.split("/")[0]
        if "/" in path:
            if top not in deployed_dirs:
                add("FAIL", f"{path} 所在資料夾不會被部署到網站")
        elif path not in deployed_files:
            add("FAIL", f"{path} 不在發佈設定（pages.yml）的部署清單內")
    add("INFO", f"程式中引用的本機檔案共 {len(refs)} 個")

    # ---- 畢業專區封面圖 ----
    m = re.search(r"const graduationYears = \[(.*?)\n    \];", idx, re.S)
    if m:
        for obj in re.finditer(r"\{([^{}]*?)\}", m.group(1), re.S):
            body = obj.group(1)
            folder = re.search(r'folder:\s*"(\d+)"', body)
            if not folder or "pendingTitle" in body or "coverPlaceholder" in body:  # 還不能畢業／還沒拍畢業照：不需要圖
                continue
            card = re.search(r'cardImage:\s*"([^"]+)"', body)
            for name in (card.group(1) if card else "cover-card.jpg", "cover-detail.jpg", "cover.jpg"):
                p = os.path.join(root, "graduation", folder.group(1), name)
                if not os.path.isfile(p):
                    add("FAIL", f"畢業專區 {folder.group(1)} 級缺圖：graduation/{folder.group(1)}/{name}")
    else:
        add("WARN", "找不到 graduationYears 區塊，略過封面圖檢查")

    # ---- documents 孤兒檔與舊檔 ----
    doc_root = os.path.join(root, "documents")
    if os.path.isdir(doc_root):
        for dp, _, files in os.walk(doc_root):
            for fn in sorted(files):
                rel = os.path.relpath(os.path.join(dp, fn), root).replace(os.sep, "/")
                if rel in refs:
                    continue
                stem, ext = os.path.splitext(rel)
                if ext == ".docx" and os.path.isfile(os.path.join(root, stem + ".odt")):
                    add("INFO", f"舊 DOCX（已有 ODT，網站未連結）：{rel}")
                else:
                    add("WARN", f"documents 內的檔案網站沒有連結：{rel}")

    # ---- localStorage key 基準 ----
    for name, want in BASELINE_KEYS.items():
        m = re.search(r"const %s = \"([^\"]*)\"" % name, idx)
        if not m:
            add("FAIL", f"找不到常數 {name}")
        elif m.group(1) != want:
            add("FAIL", f"{name} 由 {want} 變成 {m.group(1)}：已使用過網站的人，進度會消失")

    # ---- 畢業專區勾選項 index ----
    found = [int(x) for x in re.findall(r'data-graduation-task-index="(\d+)"', idx)]
    if len(found) != len(set(found)):
        dup = sorted({x for x in found if found.count(x) > 1})
        add("FAIL", f"畢業專區勾選項 index 重複：{dup}")
    missing = sorted(BASELINE_GRAD_INDEXES - set(found))
    if missing:
        add("FAIL", f"畢業專區既有的勾選項 index 不見了：{missing}")
    reused = sorted(RETIRED_GRAD_INDEXES & set(found))
    if reused:
        add("FAIL", f"畢業專區已停用的 index 被重新使用：{reused}")
    add("INFO", f"畢業專區勾選項 {len(set(found))} 個（index 最大值 {max(found) if found else '無'}）")

    # ---- 名稱一致 ----
    for m in re.finditer("原創比對", idx):
        tail = idx[m.start():m.start() + len("原創比對（Turnitin）證明表")]
        if tail != "原創比對（Turnitin）證明表" and not idx[m.start():].startswith("原創比對（Turnitin）全文電子檔"):
            add("FAIL", f"Turnitin 名稱不完整（應為「{TURNITIN_FULL}」）：{loc(m.start())}")
    for m in re.finditer("Turnitin", idx):
        before = idx[max(0, m.start() - 6):m.start()]
        after = idx[m.end():m.end() + 6]
        if before.endswith("原創比對（") and (after.startswith("）證明表") or after.startswith("）全文電子")):
            continue
        add("INFO", f"Turnitin 單獨出現（請人確認是否合理）：{loc_line(m.start())}")
    for m in re.finditer("AIGC", idx):
        s = idx[max(0, m.start() - 4):m.end() + 5]
        if s != AIGC_FULL:
            add("WARN", f"AIGC 未用全名「{AIGC_FULL}」：{loc_line(m.start())}")
    for m in re.finditer("成績單", idx):
        # 「高普特考及格證明影本或成績單」是考試成績，不是歷年成績單，屬正常寫法
        if idx[max(0, m.start() - 2):m.start()] == "歷年" or idx[max(0, m.start() - 11):m.start()] == "高普特考及格證明影本或":
            continue
        if True:
            add("WARN", f"「成績單」前面沒有「歷年」：{loc_line(m.start())}")

    # ---- 2026-11-12 流程改版：考前就要備妥比對與 AIGC，考後只剩簽名頁 ----
    a = idx.find('id: "defense-docs"')
    b = idx.find('id: "defense-submission-check"')
    defense_docs = idx[a:b] if 0 <= a < b else ""
    for need in ('id: "defense-plagiarism-certificate"', 'id: "defense-turnitin-fulltext"', 'id: "defense-aigc-certificate"'):
        if need not in defense_docs:
            add("FAIL", f"學位論文考試申請缺少 {need}（流程規定申請時須附 Turnitin 證明表、全文電子檔、AIGC 檢測報告書）")
    m = re.search(r"function buildDefenseSubmissionInventory\(\) \{.*?\n    \}\n", idx, re.S)
    inv = m.group(0) if m else ""
    for need in ("Turnitin）證明表", "Turnitin）全文電子檔", "學位論文AIGC檢測報告書"):
        if need not in inv:
            add("FAIL", f"學位論文考試的最後確認清單缺少「{need}」")
    a = idx.find("畢業流程 5 步驟")
    b = idx.find("setupGraduationTasks(checklist, item);", a)
    grad = idx[a:b] if 0 <= a < b else ""
    if not grad:
        add("FAIL", "找不到畢業專區流程區塊")
    for word in ("Turnitin", "AIGC"):
        if word in grad:
            add("FAIL", f"畢業專區不應再出現 {word}（比對與 AIGC 已改在考前完成）")
    if "繳交紙本論文 1 本至所辦" not in grad:
        add("FAIL", "畢業專區應寫「繳交紙本論文 1 本至所辦」（所辦只收 1 本）")

    # ---- 下載表單內文不可殘留舊流程（2026-11-12 起比對與 AIGC 改在申請學位論文考試時繳交）----
    import zipfile
    old_phrases = ("送繳學位論文考試成績單", "送繳學位考試成績單前", "繳交學位考試成績單時", "簽核【學位論文考試成績單】")
    for dp, _, files in os.walk(doc_root):
        for fn in files:
            if not fn.endswith(".odt"):
                continue
            fp = os.path.join(dp, fn)
            try:
                xml = zipfile.ZipFile(fp).read("content.xml").decode("utf-8", "ignore")
            except Exception as e:
                add("FAIL", f"表單無法開啟：{os.path.relpath(fp, root)}（{e}）")
                continue
            text = re.sub(r"<[^>]+>", "", xml)
            for ph in old_phrases:
                if ph in text:
                    add("FAIL", f"表單內文仍是舊流程字樣「{ph}」：{os.path.relpath(fp, root)}")

    # ---- 基本安全設定：內容安全政策（CSP）、行內程式、外部資源 ----
    pages = [("index.html", html), ("course-registration.html", reg)]
    for name in ("animation-preview.html",):
        if name in deployed_files and os.path.isfile(os.path.join(root, name)):
            pages.append((name, read(os.path.join(root, name))))
    for name, text in pages:
        m = re.search(r'http-equiv="Content-Security-Policy"\s+content="([^"]*)"', text)
        if not m:
            add("FAIL", f"{name} 缺少內容安全政策（Content-Security-Policy）meta")
            continue
        policy = m.group(1)
        script_src = re.search(r"script-src([^;]*)", policy)
        if not script_src:
            add("FAIL", f"{name} 的 CSP 沒有 script-src")
        elif "'unsafe-inline'" in script_src.group(1) or "'unsafe-eval'" in script_src.group(1):
            add("FAIL", f"{name} 的 script-src 含 'unsafe-inline' 或 'unsafe-eval'，等於放行任何被注入的程式")
        for need in ("default-src 'self'", "object-src 'none'", "base-uri 'self'", "form-action 'self'"):
            if need not in policy:
                add("FAIL", f"{name} 的 CSP 缺少 {need}")
        if re.search(r"https?://", policy):
            add("FAIL", f"{name} 的 CSP 允許外部網域：{policy}")
        if re.search(r"<script(?![^>]*\ssrc=)[^>]*>\s*\S", text):
            add("FAIL", f"{name} 有行內 <script>，CSP 不允許（請搬到 js/ 資料夾）")
        if re.search(r"\son[a-z]+\s*=\s*[\"']", text):
            add("FAIL", f"{name} 有行內事件屬性（onclick、onerror 等），CSP 不允許")
        if re.search(r"<script[^>]+src=[\"']?https?:", text):
            add("FAIL", f"{name} 載入外部 script，違反目前的內容安全政策設計")
        if re.search(r"""(?:href|src|action)=["']\s*javascript:""", text, re.I):
            add("FAIL", f"{name} 有 javascript: 連結")
        if name != "animation-preview.html" and 'src="js/guard.js"' not in text:
            add("FAIL", f"{name} 沒有載入 js/guard.js（防被嵌進別人網頁）")
    # js/ 資料夾裡不得產生行內事件屬性、eval
    js_dir = os.path.join(root, "js")
    if os.path.isdir(js_dir):
        for fn in sorted(os.listdir(js_dir)):
            if not fn.endswith(".js"):
                continue
            src = read(os.path.join(js_dir, fn))
            if re.search(r"""\son(?:error|load|click|mouseover|focus)\s*=\s*["'\\]""", src):
                add("FAIL", f"js/{fn} 產生了行內事件屬性（會被 CSP 擋掉，請改用 addEventListener）")
            if re.search(r"\beval\s*\(|new Function\s*\(", src):
                add("FAIL", f"js/{fn} 使用 eval 或 new Function")
    # vendor/jszip：固定版本與雜湊（官方 3.10.1 的 jszip.min.js）
    vz = os.path.join(root, "vendor", "jszip.min.js")
    if os.path.isfile(vz):
        import hashlib
        digest = hashlib.sha256(open(vz, "rb").read()).hexdigest()
        if digest != JSZIP_SHA256:
            add("FAIL", "vendor/jszip.min.js 內容與已核對的官方 3.10.1 不同（若是刻意升級，請改 tests/check_consistency.py 的 JSZIP_SHA256）")
        else:
            add("INFO", "vendor/jszip.min.js 與官方 3.10.1 相同")
    # 發佈流程裡的 Actions 要固定在主版本以上，且不得用 @main／@master
    if os.path.isfile(ci_path) and ci_path.endswith("pages.yml"):
        for m in re.finditer(r"uses:\s*(\S+)@(\S+)", ci):
            if m.group(2) in ("main", "master", "latest"):
                add("FAIL", f"發佈流程使用浮動版本 {m.group(1)}@{m.group(2)}")
        if "check_consistency.py" not in ci:
            add("WARN", "pages.yml 沒有在部署前執行 tests/check_consistency.py")

    # ---- 最後更新日 ----
    ups = re.findall(r"（最後更新日：(\d{4}-\d{2}-\d{2})）", idx)
    if len(ups) != 1 or idx.count("最後更新日") != 1:
        add("FAIL", f"首頁「（最後更新日：YYYY-MM-DD）」應恰好出現 1 次（需全形括號、西元日期）；"
                     f"符合格式 {len(ups)} 次，「最後更新日」字樣共 {idx.count('最後更新日')} 次")
    else:
        stamped = datetime.date.fromisoformat(ups[0])
        newest = None
        scan = [idx_path, reg_path] + [os.path.join(root, rel) for _, _, rel in segs[1:]]
        for dp, _, files in os.walk(doc_root):
            scan += [os.path.join(dp, f) for f in files]
        for p in scan:
            d = datetime.datetime.fromtimestamp(os.path.getmtime(p), datetime.timezone(datetime.timedelta(hours=8))).date()
            if newest is None or d > newest[0]:
                newest = (d, os.path.relpath(p, root))
        if newest and newest[0] > stamped:
            add("WARN", f"最後更新日是 {stamped}，但 {newest[1]} 的修改日是 {newest[0]}：是否忘了更新首頁日期")
        else:
            add("INFO", f"最後更新日 {stamped}，沒有比它更新的網站檔案")

    # ---- 預選登記資料 ----
    periods = re.findall(r'\["([0-9A-Z])",\s*"(\d\d:\d\d)-(\d\d:\d\d)"\]', reg)
    days = "一二三四五六日"
    courses = re.findall(r"\{\s*id:\s*\"([^\"]+)\",\s*name:\s*\"([^\"]+)\"(.*?)\},?\n", reg, re.S)
    ids = [c[0] for c in courses]
    if len(ids) != len(set(ids)):
        add("FAIL", "預選登記課程 id 重複")
    if not courses or not periods:
        add("WARN", "讀不到預選登記課程或節次表，略過")
    for cid, name, rest in courses:
        try:
            day = int(re.search(r"day:\s*(\d)", rest).group(1))
            start = int(re.search(r"start:\s*(\d+)", rest).group(1))
            span = int(re.search(r"span:\s*(\d+)", rest).group(1))
            tm = re.search(r'time:\s*"週(.)\s*(\d\d:\d\d)-(\d\d:\d\d)"', rest)
        except AttributeError:
            add("FAIL", f"課程「{name}」欄位不齊（day／start／span／time）")
            continue
        if not tm:
            add("FAIL", f"課程「{name}」time 格式不是「週X HH:MM-HH:MM」")
            continue
        if start < 1 or start - 1 + span > len(periods):
            add("FAIL", f"課程「{name}」start／span 超出節次表")
            continue
        want = (days[day - 1], periods[start - 1][1], periods[start - 1 + span - 1][2])
        if (tm.group(1), tm.group(2), tm.group(3)) != want:
            add("FAIL", f"課程「{name}」time 與 day／start／span 不一致：寫 週{tm.group(1)} {tm.group(2)}-{tm.group(3)}，"
                         f"換算應為 週{want[0]} {want[1]}-{want[2]}")
    # ---- 標題用明體子集：標題用字都要在子集裡（缺字會退回別的字型，看起來會不一致）----
    font_dir = os.path.join(root, "css", "fonts")
    chars_path = os.path.join(font_dir, "title-serif-tc-bold.chars.txt")
    if os.path.isfile(os.path.join(font_dir, "title-serif-tc-bold.woff2")) and os.path.isfile(chars_path):
        have = set(read(chars_path))
        need = {"首頁標題": "政大教政一點通", "畢業專區標題": "選擇你的級數畢業專區"}
        for key in ("title", "timetableTitle"):
            m = re.search(key + r':\s*"([^"]+)"', reg)
            if m:
                need["課程表頁標題（" + key + "）"] = m.group(1)
        for y in re.findall(r'year:\s*"(\d+級)"', idx):
            need["畢業專區 " + y] = y
        for label, text in need.items():
            miss = sorted(set(text) - have - {" "})
            if miss:
                add("FAIL", f"{label}「{text}」有字不在標題明體子集裡：{''.join(miss)}（見 css/fonts/README.md 重做子集）")
    else:
        add("WARN", "找不到 css/fonts/title-serif-tc-bold.woff2 或 chars.txt，標題會退回系統字型")

    terms = set(re.findall(r"(\d+) 學年度第 (\d) 學期", reg))
    if len(terms) > 1:
        add("FAIL", f"預選登記頁出現不同學期：{sorted(terms)}")
    elif terms:
        add("INFO", "預選登記頁學期：%s 學年度第 %s 學期，共 %d 門課" % (*sorted(terms)[0], len(courses)))
    return res


def main():
    root = sys.argv[1] if len(sys.argv) > 1 else os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    res = check(root)
    order = {"FAIL": 0, "WARN": 1, "INFO": 2}
    for level, msg in sorted(res, key=lambda x: order[x[0]]):
        print(f"[{level}] {msg}")
    fails = sum(1 for l, _ in res if l == "FAIL")
    warns = sum(1 for l, _ in res if l == "WARN")
    print(f"\n結果：FAIL {fails}、WARN {warns}")
    sys.exit(1 if fails else 0)


if __name__ == "__main__":
    main()
