#!/usr/bin/env bash
#
# PostToolUse hook（matcher: Edit|Write）。
# 編集されたファイルが docs/ 配下の .md のときだけ markdownlint をかける。
# Claude が手動 lint を忘れても、ハーネス側で機械的に担保する。
#
# 入力: stdin に Claude Code が渡す JSON（tool_input.file_path を参照）。
# 出力: lint エラー時は非ゼロ終了し、内容を stderr へ（Claude へフィードバックされる）。
#
set -euo pipefail

payload="$(cat)"

# file_path を取り出す（jq が無くても動くよう python3 でパース）
file_path="$(printf '%s' "$payload" | python3 -c \
  'import json,sys; print(json.load(sys.stdin).get("tool_input",{}).get("file_path",""))' \
  2>/dev/null || true)"

[ -z "$file_path" ] && exit 0

case "$file_path" in
  *docs/*.md)
    root="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
    (cd "$root" && npx --no-install markdownlint-cli "$file_path") || {
      echo "markdownlint エラー: $file_path を修正してください" >&2
      exit 2
    }
    ;;
esac

exit 0
