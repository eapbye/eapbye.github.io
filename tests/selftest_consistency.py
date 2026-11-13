#!/usr/bin/env python3
"""檢查腳本的自我測試：複製網站、故意放入已知錯誤，確認 check_consistency.py 都抓得到。
放入的錯誤都在暫存資料夾，不會動到真正的網站檔案。
用法：python3 tests/selftest_consistency.py
"""
import importlib.util
import os
import shutil
import sys
import tempfile

sys.dont_write_bytecode = True
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
spec = importlib.util.spec_from_file_location("cc", os.path.join(HERE, "check_consistency.py"))
cc = importlib.util.module_from_spec(spec)
spec.loader.exec_module(cc)


def clone():
    tmp = tempfile.mkdtemp(prefix="eap_selftest_")
    for name in ("index.html", "course-registration.html", "animation-preview.html",
                 "eap_nccu_background.svg", "eap_nccu_v8_terminal.svg"):
        p = os.path.join(ROOT, name)
        if os.path.isfile(p):
            shutil.copy2(p, tmp)
    wf = os.path.join(ROOT, ".github", "workflows")
    if os.path.isdir(wf):
        shutil.copytree(wf, os.path.join(tmp, ".github", "workflows"))
    for d in ("documents", "graduation", "css", "js", "data", "vendor"):
        if os.path.isdir(os.path.join(ROOT, d)):
            shutil.copytree(os.path.join(ROOT, d), os.path.join(tmp, d))
    return tmp


# index.html 拆檔後，「首頁的內容」分散在這幾個檔案；fname 給 "index.html" 時，到這幾個檔案裡找含有目標字串的那一個來改
SITE_FILES = ("index.html", "css/tokens.css", "css/style.css", "data/flow.js", "js/app.js")


def sub(tmp, fname, old, new, count=1):
    names = SITE_FILES if fname == "index.html" else (fname,)
    for n in names:
        p = os.path.join(tmp, n)
        if not os.path.isfile(p):
            continue
        s = open(p, encoding="utf-8").read()
        if old in s:
            open(p, "w", encoding="utf-8").write(s.replace(old, new, count))
            return
    raise AssertionError(f"自我測試的替換目標不存在：{old[:30]}")


def odt_sub(tmp, rel, old, new):
    """改寫 ODT 內文（保留 mimetype 在最前面且不壓縮）。"""
    import zipfile
    p = os.path.join(tmp, rel)
    zin = zipfile.ZipFile(p)
    items = [(i, zin.read(i.filename)) for i in zin.infolist()]
    zin.close()
    with zipfile.ZipFile(p, "w") as zout:
        for info, data in items:
            if info.filename == "content.xml":
                text = data.decode("utf-8")
                assert old in text, f"自我測試的替換目標不存在：{old}"
                data = text.replace(old, new).encode("utf-8")
            zout.writestr(info, data, compress_type=info.compress_type)


def rm(tmp, rel):
    os.remove(os.path.join(tmp, rel))


FAULTS = [
    ("刪掉被連結的下載檔", lambda t: rm(t, "documents/defense/05-grade-report.odt"), "連結的檔案不存在"),
    ("Turnitin 名稱少了（Turnitin）", lambda t: sub(t, "index.html", "學位論文原創比對（Turnitin）證明表", "學位論文原創比對證明表"), "Turnitin 名稱不完整"),
    ("畢業勾選項 index 重複", lambda t: sub(t, "index.html", 'data-graduation-task-index="13"', 'data-graduation-task-index="12"'), "index 重複"),
    ("畢業勾選項 index 位移（13 變 14）", lambda t: sub(t, "index.html", 'data-graduation-task-index="13"', 'data-graduation-task-index="14"'), "index 不見了"),
    ("STORAGE_KEY 改名", lambda t: sub(t, "index.html", "thesisChecklistProgressV3", "thesisChecklistProgressV4"), "進度會消失"),
    ("課程時間與節次不符", lambda t: sub(t, "js/course-registration.js", "週二 09:10-12:00", "週二 09:10-11:00"), "time 與 day"),
    ("最後更新日改成半形括號", lambda t: sub(t, "index.html", "（最後更新日：", "(最後更新日："), "最後更新日"),
    ("預選登記頁出現兩個學期", lambda t: sub(t, "course-registration.html", "115 學年度第 1 學期預排課表", "115 學年度第 2 學期預排課表"), "不同學期"),
    ("學位考試申請漏掉 AIGC", lambda t: sub(t, "index.html", 'id: "defense-aigc-certificate"', 'id: "defense-aigc-x"'), "defense-aigc-certificate"),
    ("學位考試最後確認漏掉全文電子檔", lambda t: sub(t, "index.html", 'inventoryItem("學位論文原創比對（Turnitin）全文電子檔", "office"),', ''), "全文電子檔"),
    ("畢業專區又出現 Turnitin", lambda t: sub(t, "index.html", "<strong>完成論文修訂</strong>", "<strong>完成論文修訂與 Turnitin</strong>"), "畢業專區不應再出現"),
    ("畢業專區所辦紙本論文又變成 2 本", lambda t: sub(t, "index.html", "繳交紙本論文 1 本至所辦", "繳交紙本論文 2 本至所辦"), "1 本至所辦"),
    ("畢業專區停用的 index 1 被重新使用", lambda t: sub(t, "index.html", 'data-graduation-task-index="2"', 'data-graduation-task-index="1"'), "已停用"),
    ("下載表單內文換回舊流程字樣", lambda t: odt_sub(t, "documents/defense/02-originality-report.odt", '申請學位論文</text:span><text:span text:style-name="T66">考</text:span><text:span text:style-name="T67">試', '送繳學位論文考試成績單'), "舊流程字樣"),
    ("拿掉內容安全政策", lambda t: sub(t, "index.html", 'http-equiv="Content-Security-Policy"', 'http-equiv="X-Removed"'), "內容安全政策"),
    ("CSP 的 script-src 又加回 'unsafe-inline'", lambda t: sub(t, "index.html", "script-src 'self'", "script-src 'self' 'unsafe-inline'"), "script-src 含"),
    ("預選登記頁 CSP 加回 'unsafe-inline'", lambda t: sub(t, "course-registration.html", "script-src 'self'", "script-src 'self' 'unsafe-inline'"), "script-src 含"),
    ("CSP 放行外部網域", lambda t: sub(t, "index.html", "img-src 'self'", "img-src https://example.com 'self'"), "允許外部網域"),
    ("首頁出現行內 <script>", lambda t: sub(t, "index.html", '  <script src="js/app.js"></script>', '  <script>alert(1)</script>\n  <script src="js/app.js"></script>'), "行內 <script>"),
    ("首頁出現行內 onerror", lambda t: sub(t, "index.html", '  <script src="js/app.js"></script>', '  <img src="x" onerror="alert(1)">\n  <script src="js/app.js"></script>'), "行內事件屬性"),
    ("js 又產生行內 onerror", lambda t: sub(t, "js/app.js", 'function watchImageFallback', 'const bad = `<img onerror="x()">`; function watchImageFallback'), "行內事件屬性"),
    ("js 使用 eval", lambda t: sub(t, "js/app.js", 'function watchImageFallback', 'const bad = () => eval("1"); function watchImageFallback'), "eval"),
    ("jszip 被改動", lambda t: sub(t, "vendor/jszip.min.js", "JSZip", "JSZIp"), "jszip"),
    ("發佈流程使用 @main", lambda t: sub(t, ".github/workflows/pages.yml", "actions/checkout@v4", "actions/checkout@main"), "浮動版本"),
    ("首頁不再載入防嵌入 guard.js", lambda t: sub(t, "index.html", '  <script src="js/guard.js"></script>\n', ""), "guard.js"),
    ("刪掉畢業封面圖", lambda t: rm(t, "graduation/113/cover-detail.jpg"), "缺圖"),
    ("刪掉首頁引用的 js", lambda t: rm(t, "js/app.js"), "連結的檔案不存在"),
    ("pages.yml 漏掉 js 資料夾", lambda t: sub(t, ".github/workflows/pages.yml", "          cp -r js _site/js\n", ""), "所在資料夾不會被部署"),
    ("pages.yml 漏掉 vendor 資料夾", lambda t: sub(t, ".github/workflows/pages.yml", "          cp -r vendor _site/vendor\n", ""), "所在資料夾不會被部署"),
    ("首頁引用的 jszip 檔被刪掉", lambda t: os.remove(os.path.join(t, "vendor", "jszip.min.js")), "連結的檔案不存在"),
    ("首頁不再載入流程資料 flow.js", lambda t: sub(t, "index.html", '  <script src="data/flow.js"></script>\n', ""), "學位論文考試申請缺少"),
]


def main():
    base = cc.check(ROOT)
    base_fails = [m for l, m in base if l == "FAIL"]
    ok = True
    if base_fails:
        print("現況就有 FAIL，無法做自我測試：")
        for m in base_fails:
            print("  ", m)
        sys.exit(1)
    print("現況：FAIL 0（基準）")
    for name, inject, expect in FAULTS:
        tmp = clone()
        try:
            inject(tmp)
            fails = [m for l, m in cc.check(tmp) if l == "FAIL"]
            hit = any(expect in m for m in fails)
        finally:
            shutil.rmtree(tmp, ignore_errors=True)
        print(("抓到  " if hit else "漏掉！") + name)
        ok = ok and hit
    print("\n自我測試：" + ("全部通過" if ok else "有漏掉的錯誤，檢查腳本不可信"))
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
