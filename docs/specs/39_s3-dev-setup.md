# 39. S3 開発環境用バケット作成・IAM 設定（TSK-39）

## 0. ステータス

- ステータス：**実装中**
- 対応タスク：TSK-39（フェーズ3-4 ストレージ）

## 1. 目的

画像ストレージ用 S3 開発環境バケットを整備し、Lambda（`petal-backend-dev`）から画像の
アップロード・取得が行えるようにする。

## 2. スコープ

### 対象

- `petal-dev` バケットの CORS 設定
- Lambda 環境変数 `S3_BUCKET` を `petal-dev` に更新（`deploy:dev` 再実行）
- 動作確認（`POST /images`・`GET /images/:id`）

### 非対象

- バケット作成・Lambda IAM 設定（実施済み）
- 本番環境用 `petal-images` バケットの設定
- フロントエンド画像 UI（別タスク）

## 3. 現状確認（TSK-39 着手時点）

| 項目 | 状態 |
| ---- | ---- |
| `petal-dev` バケット（ap-northeast-1） | 作成済み |
| Lambda 実行ロールへの S3 権限付与 | 設定済み（`petal-dev/*` に PutObject / GetObject / DeleteObject / HeadObject） |
| `.envs/.env.dev` の `S3_BUCKET=petal-dev` | 設定済み |
| Lambda 環境変数の `S3_BUCKET` | `petal-images`（古い値）→ 更新が必要 |
| バケット CORS 設定 | 未設定 → AWS コンソールで手動設定 |

## 4. CORS 設定

### 設定対象

バケット: `petal-dev`（ap-northeast-1）

### AWS コンソール手順

1. AWS コンソール → S3 → `petal-dev` → **アクセス許可** タブ
2. **Cross-Origin Resource Sharing (CORS)** セクションの「編集」をクリック
3. 以下の JSON を貼り付けて保存

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "HEAD"],
    "AllowedOrigins": [
      "https://main.d1ynk40fj8t289.amplifyapp.com",
      "http://localhost:3000"
    ],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }
]
```

### 設定方針

- `AllowedMethods`: 画像アップロード（PUT）・取得（GET）・存在確認（HEAD）
- `AllowedOrigins`: Amplify dev URL とローカル開発用 localhost を許可
- `AllowedHeaders: ["*"]`: Content-Type など署名付き URL に含まれるヘッダーを許可

## 5. Lambda 環境変数の更新

`.envs/.env.dev` はすでに `S3_BUCKET=petal-dev` になっているため、
`deploy:dev` を再実行するだけで Lambda 環境変数が更新される。

```bash
cd backend
pnpm run deploy:dev
```

## 6. 環境変数一覧

| 変数名 | 開発環境値 | 説明 |
| ------ | ---------- | ---- |
| `S3_BUCKET` | `petal-dev` | S3 バケット名 |
| `S3_ENDPOINT` | （空） | Localstack 用エンドポイント。本番 S3 は空でよい |
| `S3_FORCE_PATH_STYLE` | `false` | Localstack 利用時のみ `true` |

## 7. 完了条件

- `petal-dev` バケットに CORS が設定されている
- Lambda 環境変数 `S3_BUCKET` が `petal-dev` になっている
- Lambda から画像のアップロード（`POST /images`）が成功する
- Lambda から画像の取得（`GET /images/:id`）が成功する

## 8. 動作確認シナリオ（手動）

1. `POST /auth/login` でアクセストークンを取得
2. `POST /images` に `{ originalFilename, mimeType, sizeBytes }` を送信 → 署名付き PUT URL を取得
3. 取得した URL へ直接 PUT リクエストで画像バイナリをアップロード
4. `GET /images` で一覧取得 → アップロードした画像が含まれることを確認
5. `GET /images/:id/download-url` で署名付き GET URL を取得 → ブラウザで画像表示確認
