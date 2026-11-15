#!/usr/bin/env python3
"""莊姐季節造型產生器（3.0.9）：原圖 css/zhuang-avatar.svg 一筆不改，只在最後疊上配件，另存成 css/zhuang-avatar-<主題>.svg。
配件放在 .float 群組裡，跟著原本的上下漂浮一起動。改配件後重跑：python3 -B -I tests/season_avatars.py
哪一天換哪一套由 js/season.js 決定。"""
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
BASE = (ROOT / "css" / "zhuang-avatar.svg").read_text(encoding="utf-8")

ACCESSORIES = {
    # 聖誕：紅色聖誕帽，尖端垂到右邊、白色毛球
    "christmas": """
        <path class="line" d="M162 112 C186 46 252 18 314 28 C356 36 392 62 404 100 L380 116 C368 92 346 76 322 72 C318 86 320 100 330 112 Z" fill="#e8384f" />
        <path class="line" d="M162 112 C190 52 254 26 314 30 C300 52 300 84 330 112 Z" fill="#e8384f" />
        <path class="line" d="M146 118 C196 92 324 92 374 118 L372 148 C322 122 198 122 148 148 Z" fill="#ffffff" />
        <circle class="line" cx="404" cy="112" r="22" fill="#ffffff" />""",
    # 春節＋元宵：左側頭髮別一朵紅梅、右下拿紅包
    "newyear": """
        <g transform="translate(176 118)">
          <circle class="thin-line" cx="0" cy="-17" r="13" fill="#ff4d5e" />
          <circle class="thin-line" cx="16" cy="-5" r="13" fill="#ff4d5e" />
          <circle class="thin-line" cx="10" cy="14" r="13" fill="#ff4d5e" />
          <circle class="thin-line" cx="-10" cy="14" r="13" fill="#ff4d5e" />
          <circle class="thin-line" cx="-16" cy="-5" r="13" fill="#ff4d5e" />
          <circle cx="0" cy="0" r="7" fill="#ffd34d" />
        </g>
        <g transform="rotate(12 392 412)">
          <rect class="line" x="360" y="370" width="64" height="86" rx="8" fill="#e8384f" />
          <path class="thin-line" d="M360 392 C380 408 404 408 424 392" fill="none" stroke="#ffcf4a" />
          <circle cx="392" cy="420" r="13" fill="#ffcf4a" />
          <circle cx="392" cy="420" r="6" fill="#e8384f" />
        </g>""",
    # 端午：右下拿一顆粽子
    "dragonboat": """
        <g transform="rotate(-8 400 410)">
          <path class="line" d="M352 448 L398 364 L446 448 Z" fill="#6cb85f" />
          <path d="M370 416 L426 416" stroke="rgba(255,255,255,.35)" stroke-width="5" stroke-linecap="round" />
          <path class="thin-line" d="M362 432 L436 432" stroke="#c98a3f" fill="none" />
          <path class="thin-line" d="M398 368 L398 446" stroke="#c98a3f" fill="none" />
        </g>""",
    # 教師節：胸前別一朵大康乃馨（放大 2.1 倍，遠看也認得出）
    "teacher": """
        <g transform="translate(318 372) scale(2.1)">
          <path class="thin-line" d="M-6 14 L-18 44 M6 14 L18 44" stroke="#ff7cbc" fill="none" />
          <path class="thin-line" d="M0 6 C-24 10 -30 28 -14 30 C-6 22 0 16 0 6 Z" fill="#5fae5a" />
          <circle class="thin-line" cx="-12" cy="-6" r="12" fill="#ff5f7e" />
          <circle class="thin-line" cx="12" cy="-6" r="12" fill="#ff5f7e" />
          <circle class="thin-line" cx="0" cy="-20" r="12" fill="#ff5f7e" />
          <circle class="thin-line" cx="0" cy="4" r="12" fill="#ff8aa0" />
        </g>""",
    # 畢業季：學士帽＋金色流蘇
    "graduation": """
        <path class="line" d="M186 92 L186 128 C230 146 290 146 334 128 L334 92 Z" fill="#26324f" />
        <path class="line" d="M260 34 L410 82 L260 128 L110 82 Z" fill="#33416a" />
        <circle cx="260" cy="81" r="8" fill="#ffcf4a" />
        <path d="M260 81 C320 86 372 92 388 100 L388 150" stroke="#ffcf4a" stroke-width="6" stroke-linecap="round" fill="none" />
        <path class="thin-line" d="M378 148 L398 148 L402 176 L374 176 Z" fill="#ffcf4a" />""",
}

MARK = "      </g>\n    </svg>"
assert BASE.rstrip().endswith("</g>\n    </svg>"), "原圖結尾格式改了，請更新本程式"
for name, acc in ACCESSORIES.items():
    out = BASE.rstrip()[: -len(MARK)] + "\n        <!-- 季節配件：" + name + "（tests/season_avatars.py 產生） -->" + acc + "\n" + MARK + "\n"
    (ROOT / "css" / f"zhuang-avatar-{name}.svg").write_text(out, encoding="utf-8")
    print("寫出", f"css/zhuang-avatar-{name}.svg")
