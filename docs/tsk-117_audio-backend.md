# TSK-117 音声管理のバックエンド API と DB を実装する（設計書）

- Notion: https://app.notion.com/p/3819ca7d99dc813eac71fc8e34e6dd30
- プロジェクト: PRJ-15 Petal 音声コンテンツ対応
- 規模: L / 重要度: HIGH

## 1. 課題シート（Notion 転記・フリーズ）

### 一行サマリ

既存の画像管理機能（`backend/src/image/`）をミラーし、音声の `audio` モジュールと `petal.audios` テーブルを新設して、アップロード（署名付き URL 発行）・一覧・詳細・ダウンロード URL・削除の 5 エンドポイントを実装する。

### 背景・動機

PRJ-15「Petal 音声コンテンツ対応」の Backend 土台。画像と同じく、音声本体はブラウザ ↔ S3 を署名付き URL で直接やり取りし、バックエンドはバイトを中継しない。本 TSK が提供する OpenAPI 型を後続のフロント TSK が利用する。

### 完了条件

- `backend/src/audio/` を画像と同構成で新設（`domain` / `application` / `infra` / `controller` / `audio.module.ts`）。
- ドメインエンティティは Zod スキーマ ＋ コンストラクタ `parse()`。許可 MIME（`audio/mpeg` / `audio/wav` / `audio/webm` / `audio/mp4` / `audio/ogg`）とサイズ上限 **20 MiB** を定義。
- エンドポイント:
  - `POST /audios` … メタ作成 ＋ S3 署名付きアップロード URL 発行
  - `GET /audios` … 自分の音声一覧（所有者別・新着順）
  - `GET /audios/:id` … 詳細
  - `GET /audios/:id/download-url` … 署名付きダウンロード URL
  - `DELETE /audios/:id` … 論理削除
- `petal.audios` テーブルを migration（`backend/database/migrations/`）で新設。`owner_user_id`（`onDelete: RESTRICT`）・`s3_key` 一意・所有者新着順インデックス・`@DeleteDateColumn`。
- 署名付き URL で S3 直 PUT/GET（バックエンドはバイト中継しない）。S3 オブジェクトキーは `audios/<userId>/<id>`。
- **音声は所有者本人のみ取得可**（他ユーザーの音声は 404 相当）。
- `app.module` に `AudioModule` を登録し、OpenAPI（`openapi.json`）を再エクスポート。
- `docs/10_architecture/05_database-schema.md` に `audios` テーブルを追記。
- `cd backend && pnpm build` が通る。

### スコープ外

- フロントエンド実装（別 TSK）。
- 音声の変換・トランスコード。
- 文字起こし（転写）。

### 制約

- DDD・オニオンアーキテクチャ、フィーチャ優先構成。Domain は Infrastructure を参照しない。外部 SDK（S3）は `infra/` に隔離。
- `any` 禁止 / `strict` / Zod で外部入力をバリデーション。論理削除のみ。
- 既存 `image` モジュールのパターンを踏襲し、新パターンを持ち込まない。

## 2. 設計判断（Phase 3 議論結果）

### 判断 1: S3StorageClient を common 化して共有【確定】

既存 `image/infra/s3.client.ts` の `S3StorageClient` は画像固有ロジックを一切持たず、`key` と `contentType` を受けて署名付き URL を発行するだけの汎用クラス。複製すると同一コードが 2 箇所に増える。

**決定**: `S3StorageClient` を `backend/src/common/storage/` へ移設し、`StorageModule`（provide + export）として切り出す。`ImageModule` / `AudioModule` の双方が `StorageModule` を import して DI で共有する。

- 理由: 重複ゼロ。既存 `src/common/`（decorators / exceptions / guards / observability / types）の共有レイヤー慣習に沿う。S3 クライアントはフィーチャ非依存なので common が適所。
- 影響範囲（image 側のリファクタ）:
  - `backend/src/image/infra/s3.client.ts` を削除し `backend/src/common/storage/s3.client.ts` へ移動。
  - `image.module.ts` の `providers` から `S3StorageClient` を外し、`imports` に `StorageModule` を追加。
  - `image.service.ts` の import パスを `../../common/storage/s3.client` に変更。
- 非機能要件は不変（URL 形式・TTL・rewrite ロジックはそのまま移設）。

### 判断 2: audios に再生時間 `durationSeconds`（nullable）を追加【確定】

画像の `title` / `description`（任意・nullable）に加え、音声では再生時間が一覧/詳細で有用。クライアントが計測値を送る前提で nullable とし、未送信時は `null`。

- スキーマ: `durationSeconds: z.number().int().positive().nullable()`
- DTO（リクエスト）: `durationSeconds?: number`（任意）
- DB: `duration_seconds INTEGER`（nullable, `CHECK (duration_seconds > 0)`）
- レスポンス DTO に `durationSeconds: number | null` を含める。

## 3. 成果物の構成

`backend/src/audio/` を image と同構成でミラー（差分は許可 MIME / サイズ上限 / S3 キー prefix / `durationSeconds`）。

| ファイル | 内容（image との差分） |
| --- | --- |
| `domain/audio.ts` | `Audio` エンティティ + `AudioSchema`。`ALLOWED_AUDIO_MIME_TYPES`（5 種）、`MAX_AUDIO_SIZE_BYTES = 20 * 1024 * 1024`、`durationSeconds` 追加。 |
| `domain/audio.repository.ts` | `IAudioRepository` + `AUDIO_REPOSITORY` シンボル。image と同インターフェース。 |
| `application/audio.schemas.ts` | `CreateAudioSchema`（`durationSeconds?` 追加）。 |
| `application/audio.service.ts` | image と同ロジック。S3 キー `audios/<userId>/<id>`、404 メッセージは「音声が見つかりません」。 |
| `infra/audio.entity.ts` | `@Entity({ schema: 'petal', name: 'audios' })`。`IDX_audios_owner_created`、`duration_seconds` 列追加。 |
| `infra/audio.repository.impl.ts` | image と同実装。`durationSeconds` の往復を追加。 |
| `controller/audio.controller.ts` | `@Controller('audios')` / `@ApiTags('audios')`。5 エンドポイント。 |
| `controller/audio.dto.ts` | Request/Response DTO。`durationSeconds` 追加。`mimeType` enum = 音声 5 種。 |
| `audio.module.ts` | `TypeOrmModule.forFeature([AudioEntity])` + `UserModule` + `StorageModule`。 |

共有:

| ファイル | 内容 |
| --- | --- |
| `backend/src/common/storage/s3.client.ts` | `image/infra/s3.client.ts` から移設（内容不変）。 |
| `backend/src/common/storage/storage.module.ts` | `S3StorageClient` を provide + export。 |

migration:

| ファイル | 内容 |
| --- | --- |
| `backend/database/migrations/1746144007000-CreateAudiosTable.ts` | `petal.audios` 作成。images と同構造 + `duration_seconds INTEGER`（nullable, `CHECK > 0`）。`UQ_audios_s3_key`、`IDX_audios_owner_created`。 |

その他更新:

- `backend/src/app.module.ts` … `AudioModule` を imports に追加。
- `backend/src/image/*` … 判断 1 のリファクタ（s3.client 移設に伴う import 修正）。
- `backend/openapi.json` … `pnpm openapi:export` で再生成。
- `docs/10_architecture/05_database-schema.md` … `audios` テーブル追記。

## 4. 動作確認シナリオ（PR チェックリスト転記用）

- [ ] `cd backend && pnpm build` が通る。
- [ ] `cd backend && pnpm lint` が通る（`any` なし）。
- [ ] `POST /audios` が音声メタを作成し、`upload`（PUT URL / Content-Type ヘッダ / TTL）を返す。許可外 MIME・20 MiB 超は 400。
- [ ] `GET /audios` が所有者本人の音声を新着順で返す。
- [ ] `GET /audios/:id` が詳細を返す。他ユーザーの音声 ID は 404。
- [ ] `GET /audios/:id/download-url` が署名付き GET URL を返す。
- [ ] `DELETE /audios/:id` が論理削除（204）。削除後は 404。
- [ ] migration `up`/`down` が成功し、`audios` テーブルが images と同制約 + `duration_seconds` を持つ。
- [ ] `openapi.json` に `audios` 系エンドポイントと DTO が出力される。
- [ ] image 系の既存挙動が S3 クライアント移設後も不変（リグレッションなし）。

## 5. 実装計画

（Phase 4 で追記）
