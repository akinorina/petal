#!/usr/bin/env bash
#
# Phase 5（実装作業）完了条件の機械検証。
# サブエージェントはこのスクリプトの終了コードで自走判断する（散文チェック不要）。
#
# 使い方:
#   scripts/verify.sh [backend|frontend|docs|all]
#   引数省略時は all。
#
# 注意: pnpm workspace は組まないため、必ず各ディレクトリへ cd して実行する
#       （`pnpm --filter` は使わない。AGENTS.md §1）。
#
set -euo pipefail

root="$(git rev-parse --show-toplevel)"

verify_backend() {
  echo "▶ backend build"
  (cd "$root/backend" && pnpm build)
}

verify_frontend() {
  echo "▶ frontend build"
  (cd "$root/frontend" && pnpm build)
}

verify_docs() {
  echo "▶ markdownlint (docs)"
  (cd "$root" && npx markdownlint-cli 'docs/**/*.md')
}

target="${1:-all}"
case "$target" in
  backend)  verify_backend ;;
  frontend) verify_frontend ;;
  docs)     verify_docs ;;
  all)      verify_backend; verify_frontend; verify_docs ;;
  *)
    echo "usage: $0 [backend|frontend|docs|all]" >&2
    exit 2
    ;;
esac

echo "✅ verify: ${target} passed"
