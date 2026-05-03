# Petal - 画像管理機能 設計

対応タスク: TSK-3「画像管理の基本実装」

## 1. スコープ

[要求仕様書](01_requirements.md) v2 のうち、本ドキュメントが対象とする機能：

- 画像ファイルのアップロード
- 画像ファイルのダウンロード
- 画像の一覧表示
- 画像の詳細表示（画像情報含む）
- 画像の削除

権限要件:

- 画像の閲覧（一覧・詳細・ダウンロード）はアップロードしたユーザー本人のみ。
- 他ユーザーの画像 ID にアクセスした場合は存在自体を隠蔽し、404 を返す。

## 2. 進め方（段階）

| 段階 | 内容 |
| ---- | ---- |
| 1 | Backend API 実装（本ドキュメントの主対象） |
| 2 | Frontend UI 実装 |
| 3 | Localstack の S3 統合 / E2E 動作確認 |

段階 1 の完了基準は、認証済みクライアントが REST API 経由で本機能の 5 つのユースケースをすべて実行できる状態。

## 3. 技術選定

- ストレージ: **AWS S3**。本体ファイルは S3、メタデータは PostgreSQL に保存する。
- アップロード／ダウンロードは **署名付き URL（Presigned URL）** を経由する。バックエンドはファイルバイト列を中継しない。
- SDK: `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`（新規依存追加）。
- Local 環境では Localstack の S3 を使用する想定（[00_rules.md](00_rules.md) §7）。エンドポイントは環境変数で切り替える。

## 4. ディレクトリ構成

[00_rules.md](00_rules.md) の「フィーチャ優先 + オニオン」に従う。

```text
backend/src/image/
  domain/
    image.ts                 # Zod スキーマ + Image エンティティ
    image.repository.ts      # IImageRepository インターフェース
  application/
    image.service.ts         # ユースケース
    image.schemas.ts         # 入力 Zod スキーマ
  infra/
    image.entity.ts          # TypeORM エンティティ
    image.repository.impl.ts
    s3.client.ts             # S3 SDK ラッパ（署名付き URL 生成）
  controller/
    image.controller.ts
    image.dto.ts
  image.module.ts
```

S3 SDK の呼び出しは `infra/s3.client.ts` に隔離し、`application/` から SDK を直接触らない。

## 5. ドメインモデル

`backend/src/image/domain/image.ts`:

| フィールド | 型 | 説明 |
| ---------- | -- | ---- |
| `id` | UUID | 画像 ID |
| `ownerUserId` | UUID | アップロードしたユーザー（`users.id` への FK） |
| `s3Key` | string | S3 オブジェクトキー。`images/<ownerUserId>/<id>` 形式 |
| `originalFilename` | string (1..255) | アップロード時の元ファイル名 |
| `mimeType` | string | `image/jpeg` `image/png` `image/gif` `image/webp` を許可 |
| `sizeBytes` | int (1..10485760) | ファイルサイズ。上限 10 MiB |
| `title` | string \| null (..255) | 任意のタイトル |
| `description` | string \| null (..1000) | 任意の説明 |
| `createdAt` / `updatedAt` / `deletedAt` | timestamptz | 監査列 |

不変条件は `ImageSchema`（Zod）で宣言し、コンストラクタで `parse` する（[00_rules.md](00_rules.md) §1）。

## 6. リポジトリ

`IImageRepository`:

- `findById(id): Promise<Image | null>`
- `findAllByOwner(ownerUserId): Promise<Image[]>`
- `save(image): Promise<Image>`
- `softDelete(id): Promise<void>`

実装は TypeORM。論理削除は `@DeleteDateColumn` を使用（[00_rules.md](00_rules.md) §4）。

## 7. ユースケース（`ImageService`）

| メソッド | 内容 |
| -------- | ---- |
| `createUploadUrl(currentUser, input)` | DB にメタデータレコードを作成し、S3 への **PUT 用署名付き URL** を返す |
| `findAllForOwner(currentUser)` | 自分が所有する画像一覧 |
| `findOneForOwner(currentUser, id)` | 詳細。所有者でなければ `NotFoundException` |
| `createDownloadUrl(currentUser, id)` | 所有確認後、**GET 用署名付き URL** を返す |
| `remove(currentUser, id)` | 所有確認後、論理削除（S3 オブジェクトは残置。物理クリーンアップは別タスク） |

`currentUser` は controller 層で `req.user.sub`（Cognito sub）から `UserService.findByCognitoSub` 経由で解決した `User` を渡す。Service 内では Cognito sub を直接扱わない。

## 8. API

すべて `JwtAuthGuard` 適用下（既定で適用済み・[backend/src/app.module.ts](../backend/src/app.module.ts)）。Public 化はしない。

| Method | Path | リクエスト | レスポンス |
| ------ | ---- | ---------- | ---------- |
| POST | `/images` | `{ originalFilename, mimeType, sizeBytes, title?, description? }` | `{ image: ImageDto, upload: { url, method: "PUT", expiresInSeconds, headers: { "Content-Type" } } }` |
| GET | `/images` | — | `ImageDto[]`（自分の画像のみ） |
| GET | `/images/:id` | — | `ImageDto`（所有者のみ。他は 404） |
| GET | `/images/:id/download-url` | — | `{ url, expiresInSeconds }` |
| DELETE | `/images/:id` | — | 204 No Content |

`ImageDto` は `Image` ドメインから `s3Key` を除いたもの（クライアントに S3 内部キーは返さない）。

入力検証は controller 層で `ImageCreateSchema.safeParse` を呼び、失敗時は `BadRequestException`（既存 `UserController` と同パターン）。

### 署名付き URL ポリシー

- TTL: PUT/GET ともに **300 秒（5 分）**
- PUT: `Content-Type` ヘッダを署名対象に含める。クライアントは PUT 時に同じ Content-Type を必ず送る。
- GET: 単純 GET のみ。Content-Disposition は段階 1 では未対応（必要なら段階 2 で `response-content-disposition` を付与）。

### アップロードのライフサイクル

段階 1 では **DB レコード作成と S3 PUT を分離するが、PUT 完了の検証はしない**（クライアントを信頼する）。

- メリット: 実装が単純。
- デメリット: PUT に失敗・中断した場合 DB に「実体のない画像メタデータ」が残る。
- 対策: 段階 3 以降で「アップロード完了通知」エンドポイント（HEAD で S3 検証 → `status` 列を `ready` に遷移）を導入予定。

## 9. データベース

新規テーブル `petal.images` をマイグレーションで追加する。

カラム:

| カラム | 型 | 制約 |
| ------ | -- | ---- |
| `id` | UUID | PK, default `gen_random_uuid()` |
| `owner_user_id` | UUID | NOT NULL, FK → `petal.users(id)` ON DELETE RESTRICT |
| `s3_key` | VARCHAR(512) | NOT NULL, UNIQUE |
| `original_filename` | VARCHAR(255) | NOT NULL |
| `mime_type` | VARCHAR(100) | NOT NULL |
| `size_bytes` | BIGINT | NOT NULL, CHECK > 0 |
| `title` | VARCHAR(255) | NULL |
| `description` | VARCHAR(1000) | NULL |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT NOW() |
| `updated_at` | TIMESTAMPTZ | NOT NULL DEFAULT NOW() |
| `deleted_at` | TIMESTAMPTZ | NULL |

インデックス: `(owner_user_id, created_at DESC)` を一覧表示用に張る。

ユーザーの論理削除に伴う画像の扱いは段階 1 のスコープ外（FK は RESTRICT で安全側に倒す）。

## 10. 環境変数

[backend/.env.example](../backend/.env.example) に以下を追記する。

```.env
# AWS S3（画像ストレージ）
AWS_REGION=ap-northeast-1
S3_BUCKET=petal-images
# Localstack 利用時はエンドポイントを設定し、forcePathStyle を有効化
S3_ENDPOINT=
S3_FORCE_PATH_STYLE=false
```

`S3_ENDPOINT` が空なら本番 S3、設定があれば Localstack 等を指す（`forcePathStyle: true` 推奨）。

## 11. セキュリティ

- 他ユーザーの画像 ID への直接アクセスは **404** を返し、存在自体を隠す（403 にしない）。
- 署名付き URL の TTL は短く（5 分）。
- S3 バケットはパブリック READ を許可しない（前提）。
- `mime_type` はホワイトリスト方式（`image/*` のうち jpeg/png/gif/webp のみ）。
- `sizeBytes` の上限を Zod で強制（10 MiB）。実際の S3 PUT に対する強制は本タスクでは未実装。バケットポリシーで上限を設定するのが望ましい（インフラ側タスク）。

## 12. 段階 1 の作業項目

1. 依存追加: `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`
2. `backend/.env.example` に S3 設定を追記
3. マイグレーション `CreateImagesTable` を作成
4. `backend/src/image/` 配下にドメイン／アプリ／インフラ／コントローラ実装
5. `image.module.ts` を作成し `app.module.ts` に登録
6. `pnpm --filter backend build` を通す

## 13. 段階 2 以降の予定

- フロントエンド: 一覧／詳細／アップロード UI（`frontend/app/images/`）
- アップロード完了検証エンドポイント（`POST /images/:id/complete` で S3 HEAD → `status` 遷移）
- S3 オブジェクトの物理クリーンアップ（バッチ or イベント駆動）
- 公開／非公開フラグ（[01_requirements.md](01_requirements.md) 将来構想）
