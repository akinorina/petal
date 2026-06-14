#!/usr/bin/env bash
set -euo pipefail

# mkcert で生成した開発用証明書から、LocalStack が HTTPS で使う
# 証明書ファイル一式を certs/localstack/ に生成する。
#
# LocalStack は /var/lib/localstack/cache/ 配下の以下 3 ファイルを参照する:
#   server.test.pem     ... 秘密鍵 + 証明書の連結
#   server.test.pem.crt ... 証明書
#   server.test.pem.key ... 秘密鍵
#
# mkcert の証明書を更新した場合は本スクリプトを再実行すること。

# certs/ はリポジトリルートに置かれているため、backend/scripts/localstack/ から 3 階層上へ移動する。
cd "$(dirname "$0")/../../.."

CERT=certs/localhost+2.pem
KEY=certs/localhost+2-key.pem
OUT_DIR=certs/localstack

[[ -f "$CERT" && -f "$KEY" ]] || {
  echo "error: $CERT / $KEY が見つかりません" >&2
  exit 1
}

mkdir -p "$OUT_DIR"
cat "$KEY" "$CERT" > "$OUT_DIR/server.test.pem"
cp "$CERT" "$OUT_DIR/server.test.pem.crt"
cp "$KEY" "$OUT_DIR/server.test.pem.key"

echo "generated: $OUT_DIR/server.test.pem{,.crt,.key}"
