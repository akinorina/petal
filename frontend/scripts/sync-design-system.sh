#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────
# Design System Sync Script
#
# 配布モデル: "standalone + copy"
# このスクリプトはアプリ側にコピーして使う。アプリのプロジェクトルートから
# 実行すると、design-system リポジトリから必要なファイルだけを取得して
# 自分のコードベースに取り込む。
#
# 使い方:
#   ./scripts/sync-design-system.sh tokens          → tokens (CSS + TS) を同期
#   ./scripts/sync-design-system.sh component Button → 特定コンポーネントを同期
#   ./scripts/sync-design-system.sh all              → tokens + 全コンポーネント
#
# 環境変数:
#   DS_PATH    design-system リポジトリのローカルパス (default: ../design-system)
#   DS_TARGET  アプリ側の取り込み先 (default: src/design-system)
#
# 配布されるもの:
#   - tokens/: styles.css (CSS変数) + index.js + index.d.ts
#   - components/<Name>/: .tsx + .css + index.ts + SPEC.md
#
# 配布されないもの (design-system 内部用):
#   - *.stories.tsx (Storybook 用。アプリ実装に不要かつパス不整合の原因)
#   - tokens/*.json (生の編集対象。配布するのは dist の生成物のみ)
# ──────────────────────────────────────────────────────────────────────

set -euo pipefail

DS_PATH="${DS_PATH:-../design-system}"
DS_TARGET="${DS_TARGET:-src/design-system}"

if [ ! -d "$DS_PATH" ]; then
  echo "Error: design-system not found at $DS_PATH"
  echo "Set DS_PATH env var or clone the repo:"
  echo "  git clone <design-system-repo> $DS_PATH"
  exit 1
fi

# tokens は build 済みの dist から取る (JSON ではなく生成物を配布)
sync_tokens() {
  echo "→ Syncing tokens..."
  # design-system 側で最新ビルドを保証
  (cd "$DS_PATH" && pnpm build:tokens > /dev/null)
  mkdir -p "$DS_TARGET/tokens"
  cp "$DS_PATH/dist/styles.css" "$DS_TARGET/tokens/styles.css"
  cp "$DS_PATH/dist/tokens.js" "$DS_TARGET/tokens/index.js"
  cp "$DS_PATH/dist/tokens.d.ts" "$DS_TARGET/tokens/index.d.ts"
  echo "  ✓ $DS_TARGET/tokens/"
}

sync_component() {
  local name="$1"
  local src_dir="$DS_PATH/src/components/$name"
  if [ ! -d "$src_dir" ]; then
    echo "Error: component '$name' not found at $src_dir"
    echo "Available components:"
    ls "$DS_PATH/src/components/"
    exit 1
  fi
  echo "→ Syncing component: $name"
  mkdir -p "$DS_TARGET/components/$name"
  # コンポーネント本体をコピー
  cp -R "$src_dir/." "$DS_TARGET/components/$name/"
  # .stories.tsx は design-system 側 Storybook 専用なので除外
  # (アプリ側に持つと dist/tokens.js への相対パスが壊れる、かつアプリ実装に不要)
  find "$DS_TARGET/components/$name" -name '*.stories.tsx' -delete
  # spec も一緒にコピー (参照しやすいように)
  local spec_file
  spec_file="$DS_PATH/components/$(echo "$name" | tr '[:upper:]' '[:lower:]').md"
  if [ -f "$spec_file" ]; then
    cp "$spec_file" "$DS_TARGET/components/$name/SPEC.md"
  fi
  echo "  ✓ $DS_TARGET/components/$name/ (stories は除外)"
}

sync_all() {
  sync_tokens
  for dir in "$DS_PATH"/src/components/*/; do
    sync_component "$(basename "$dir")"
  done
}

case "${1:-}" in
  tokens)
    sync_tokens
    ;;
  component)
    if [ -z "${2:-}" ]; then
      echo "Usage: $0 component <Name>"
      exit 1
    fi
    sync_component "$2"
    ;;
  all)
    sync_all
    ;;
  *)
    echo "Usage:"
    echo "  $0 tokens                  Sync design tokens"
    echo "  $0 component <Name>        Sync a single component (e.g. Button)"
    echo "  $0 all                     Sync tokens + all components"
    echo ""
    echo "Environment:"
    echo "  DS_PATH=$DS_PATH"
    echo "  DS_TARGET=$DS_TARGET"
    exit 1
    ;;
esac

echo ""
echo "✅ Done."
echo ""
echo "Note: コピー後のファイルは「あなたのコード」です。自由に編集できますが、"
echo "      design-system から更新が来た場合は手動で merge or 再 sync してください。"
