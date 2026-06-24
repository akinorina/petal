#!/usr/bin/env bash
# PreToolUse(Bash) フック: 危険なコマンドを実行前にブロックする。
# stdin で受け取る JSON の .tool_input.command を検査し、
# 該当した場合は exit 2 で実行を拒否する（exit 2 のみブロッキング）。
set -euo pipefail

input=$(cat)
command=$(printf '%s' "$input" | jq -r '.tool_input.command // empty')

if [ -z "$command" ]; then
  exit 0
fi

# DB/ファイルの破壊的操作
if printf '%s' "$command" | grep -Eiq 'rm[[:space:]]+-[a-z]*rf|rm[[:space:]]+-[a-z]*fr|DROP[[:space:]]+TABLE|TRUNCATE|DELETE[[:space:]]+FROM[[:space:]]+users'; then
  echo '❌ 危険なコマンド（破壊的操作）は禁止されています。' >&2
  exit 2
fi

# main ブランチへの直接 push
if printf '%s' "$command" | grep -Eq 'git[[:space:]]+push.*\bmain\b'; then
  echo '⚠️ main ブランチへの直接 push は禁止です。確認のうえ手動で実行してください。' >&2
  exit 2
fi

exit 0
