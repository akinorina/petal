# ストレージ構築（S3 / LocalStack）

画像ファイルは S3 に保存する。アップロード・ダウンロードとも**署名付き URL** でブラウザと S3 が直接やり取りし、バックエンドはバイトを中継しない（[20_features/04_image-management.md](../20_features/04_image-management.md)）。

## ローカル（LocalStack）

```bash
cd backend
docker compose up -d     # LocalStack 起動
pnpm s3:setup            # バケット作成（scripts/localstack/setup-s3.sh）
pnpm s3:logs             # ログ確認
```

`.envs/.env.local` の S3 関連変数（バケット名・エンドポイント）を設定する。

## 本番 / dev（AWS S3）

### バケット

- 環境ごとにバケットを作成（dev は `petal-images-dev` など）。
- 署名付き URL でアクセスするため、バケットは原則非公開。

### CORS

ブラウザから S3 へ直接 PUT / GET するため、フロントのオリジンを許可する CORS を設定する（`PUT` / `GET` / 必要なヘッダ）。

### IAM

バックエンド（Lambda）の実行ロールに、対象バケットへの最小権限（`PutObject` / `GetObject` / `DeleteObject` 等）を付与する。

原典（dev 構築手順・CORS 例）: [specs/39_s3-dev-setup.md](../specs/39_s3-dev-setup.md)

## 関連ドキュメント

- 画像管理 → [20_features/04_image-management.md](../20_features/04_image-management.md)
- デプロイ（Lambda の IAM）→ [05_deployment.md](05_deployment.md)
- 原典 → [specs/39_s3-dev-setup.md](../specs/39_s3-dev-setup.md)
