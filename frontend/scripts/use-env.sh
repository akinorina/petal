#!/bin/bash
# frontend/scripts/use-env.sh
# frontend の環境変数を切り替えるスクリプト。
# frontend/.env.local を .envs/.env.<環境名> へのシンボリックリンクに付け替える。
#
# 使い方（frontend/ ディレクトリから）:
#   bash scripts/use-env.sh local    # ローカル開発環境に切り替え
#   bash scripts/use-env.sh staging  # ステージング環境に切り替え
#
# または pnpm スクリプト経由:
#   pnpm use-env local

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

ENV="${1}"

if [ -z "$ENV" ]; then
  echo "使い方: bash scripts/use-env.sh <環境名>"
  echo "  例: bash scripts/use-env.sh local"
  echo "  例: bash scripts/use-env.sh staging"
  exit 1
fi

ENV_FILE="$FRONTEND_DIR/.envs/.env.$ENV"

if [ ! -f "$ENV_FILE" ]; then
  echo "エラー: .envs/.env.$ENV が見つかりません。"
  echo "  frontend/.envs/.env.$ENV を作成してください（.env.$ENV.example を参考に）。"
  exit 1
fi

ln -sf ".envs/.env.$ENV" "$FRONTEND_DIR/.env.local"
echo "  frontend/.env.local → frontend/.envs/.env.$ENV"
echo ""
echo "frontend の環境を '$ENV' に切り替えました。"
echo "direnv を使用している場合は frontend/ に入り直してください。"
