#!/usr/bin/env bash
set -euo pipefail

# 起動時に S3 バケットを作成し、フロントエンドからの直アップロード用に
# CORS を設定する。すでに存在する場合は CORS 設定のみ再適用する。
BUCKET="${S3_BUCKET:?S3_BUCKET が未設定}"

# カンマ区切りで複数オリジンを指定可能。例: "https://localhost:3001,https://192.168.11.9:3001"
FRONTEND_ORIGINS="${FRONTEND_ORIGINS:-https://localhost:3001}"

# カンマ区切りを JSON 配列に変換
ORIGINS_JSON=$(echo "$FRONTEND_ORIGINS" | tr ',' '\n' | sed 's/^[[:space:]]*//' | sed 's/[[:space:]]*$//' | awk '{print "\"" $0 "\""}' | paste -sd ',' -)

if awslocal s3api head-bucket --bucket "$BUCKET" 2>/dev/null; then
  echo "[init] bucket already exists: $BUCKET"
else
  echo "[init] creating bucket: $BUCKET"
  awslocal s3api create-bucket --bucket "$BUCKET"
fi

echo "[init] applying CORS to bucket: $BUCKET (origins=$FRONTEND_ORIGINS)"
CORS_JSON=$(cat <<EOF
{
  "CORSRules": [
    {
      "AllowedHeaders": ["*"],
      "AllowedMethods": ["GET", "PUT", "HEAD"],
      "AllowedOrigins": [$ORIGINS_JSON],
      "ExposeHeaders": ["ETag"],
      "MaxAgeSeconds": 300
    }
  ]
}
EOF
)
awslocal s3api put-bucket-cors --bucket "$BUCKET" --cors-configuration "$CORS_JSON"
