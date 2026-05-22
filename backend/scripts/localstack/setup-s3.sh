#!/usr/bin/env bash
#
# Localstack の S3 初期設定スクリプト。
# .env の S3_BUCKET で指定されたバケットを冪等に作成する。
#
# 前提: `docker compose up -d` 等で Localstack コンテナ (petal_localstack) が
#       既に起動していること。docker-compose の init スクリプトが
#       バケットを自動作成するため、通常は本スクリプトを明示実行する
#       必要はない。バケットを誤って削除した等で再作成したい場合に使う。
#
# 実行方法:
#   pnpm s3:setup
#
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
BACKEND_DIR=$(cd "$SCRIPT_DIR/../.." && pwd)
ENV_FILE="$BACKEND_DIR/.env"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: $ENV_FILE が存在しません。backend/.env.example をコピーしてください。" >&2
  exit 1
fi

# .env から S3_BUCKET を読み取る
# shellcheck disable=SC1090
set -a; source "$ENV_FILE"; set +a
: "${S3_BUCKET:?S3_BUCKET が .env に未設定}"

if ! docker ps --format '{{.Names}}' | grep -q '^petal_localstack$'; then
  echo "ERROR: petal_localstack コンテナが起動していません。pnpm db:up を先に実行してください。" >&2
  exit 1
fi

echo "==> Localstack の S3 起動待ち"
for _ in {1..30}; do
  if curl -fsS http://localhost:4566/_localstack/health 2>/dev/null \
      | grep -q '"s3": "\(running\|available\)"'; then
    echo "    ready"
    break
  fi
  sleep 1
done

echo "==> S3 バケット確認/作成: $S3_BUCKET"
if docker exec petal_localstack awslocal s3api head-bucket --bucket "$S3_BUCKET" >/dev/null 2>&1; then
  echo "    既に存在"
else
  docker exec petal_localstack awslocal s3api create-bucket --bucket "$S3_BUCKET" >/dev/null
  echo "    作成完了"
fi

ALLOWED_ORIGIN="${CORS_ORIGIN:-http://localhost:3001}"
echo "==> S3 バケットに CORS 設定: origin=$ALLOWED_ORIGIN"
CORS_JSON=$(cat <<EOF
{
  "CORSRules": [
    {
      "AllowedHeaders": ["*"],
      "AllowedMethods": ["GET", "PUT", "HEAD"],
      "AllowedOrigins": ["$ALLOWED_ORIGIN"],
      "ExposeHeaders": ["ETag"],
      "MaxAgeSeconds": 300
    }
  ]
}
EOF
)
docker exec petal_localstack awslocal s3api put-bucket-cors \
  --bucket "$S3_BUCKET" --cors-configuration "$CORS_JSON"
echo "    適用完了"
