#!/bin/bash
# scripts/use-env.sh
# 環境を切り替えるスクリプト。backend/.env と frontend/.env.local を
# 指定した環境の .envs/.env.<環境名> へのシンボリックリンクに付け替える。
#
# 使い方:
#   bash scripts/use-env.sh local    # ローカル開発環境に切り替え
#   bash scripts/use-env.sh staging  # ステージング環境に切り替え

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

ENV="${1}"

if [ -z "$ENV" ]; then
  echo "使い方: bash scripts/use-env.sh <環境名>"
  echo "  例: bash scripts/use-env.sh local"
  echo "  例: bash scripts/use-env.sh staging"
  exit 1
fi

BACKEND_ENV_FILE="$ROOT_DIR/backend/.envs/.env.$ENV"
FRONTEND_ENV_FILE="$ROOT_DIR/frontend/.envs/.env.$ENV"

if [ ! -f "$BACKEND_ENV_FILE" ]; then
  echo "エラー: $BACKEND_ENV_FILE が見つかりません。"
  echo "  backend/.envs/.env.$ENV を作成してください（.env.$ENV.example を参考に）。"
  exit 1
fi

if [ ! -f "$FRONTEND_ENV_FILE" ]; then
  echo "エラー: $FRONTEND_ENV_FILE が見つかりません。"
  echo "  frontend/.envs/.env.$ENV を作成してください（.env.$ENV.example を参考に）。"
  exit 1
fi

ln -sf ".envs/.env.$ENV" "$ROOT_DIR/backend/.env"
echo "  backend/.env → backend/.envs/.env.$ENV"

ln -sf ".envs/.env.$ENV" "$ROOT_DIR/frontend/.env.local"
echo "  frontend/.env.local → frontend/.envs/.env.$ENV"

echo ""
echo "環境を '$ENV' に切り替えました。"
echo "direnv を使用している場合は各ディレクトリに入り直してください。"
