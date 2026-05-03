#!/usr/bin/env bash
set -euo pipefail

# 起動時に S3 バケットを作成し、フロントエンドからの直アップロード用に
# CORS を設定する。すでに存在する場合は CORS 設定のみ再適用する。
BUCKET="${S3_BUCKET:?S3_BUCKET が未設定}"
ALLOWED_ORIGIN="${FRONTEND_ORIGIN:-http://localhost:3001}"

if awslocal s3api head-bucket --bucket "$BUCKET" 2>/dev/null; then
  echo "[init] bucket already exists: $BUCKET"
else
  echo "[init] creating bucket: $BUCKET"
  awslocal s3api create-bucket --bucket "$BUCKET"
fi

echo "[init] applying CORS to bucket: $BUCKET (origin=$ALLOWED_ORIGIN)"
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
awslocal s3api put-bucket-cors --bucket "$BUCKET" --cors-configuration "$CORS_JSON"
