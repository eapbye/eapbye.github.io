# 標題用明體子集

`title-serif-tc-bold.woff2`：思源宋體（Noto Serif CJK TC Bold，SIL Open Font License 1.1）的子集，
只含網站大標題會用到的字（首頁與流程頁的「政大教政一點通」、課程表頁標題、畢業專區標題）。
`title-serif-tc-bold.chars.txt` 列出子集裡有哪些字；`tests/check_consistency.py` 會核對標題用字都在裡面。

標題換成子集裡沒有的字時（例如課程表標題改字），用下面的指令重做子集，並把新字補進 chars.txt：

    pip install fonttools brotli
    pyftsubset NotoSerifCJK-Bold.ttc --font-number=3 --text-file=css/fonts/title-serif-tc-bold.chars.txt \
      --flavor=woff2 --layout-features='*' --output-file=css/fonts/title-serif-tc-bold.woff2

（NotoSerifCJK-Bold.ttc 可從 Google Noto CJK 或 Linux 的 fonts-noto-cjk 套件取得；--font-number=3 是繁體中文 TC。）
