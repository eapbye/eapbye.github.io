#!/usr/bin/env bash
# 把指定的 git 版本（預設 main）取出當基準，與目前工作目錄逐像素比對畫面。用法：bash tests/visual_compare.sh [git 版本] [輸出資料夾]
set -euo pipefail
REF="${1:-main}"; OUT="${2:-visual_out}"
HERE="$(cd "$(dirname "$0")/.." && pwd)"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
git -C "$HERE" archive "$REF" | tar -x -C "$TMP"
node "$HERE/tests/visual_compare.js" "$TMP" "$HERE" "$OUT"
