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

### 事前解決済みの判断ポイント（ドライラン結果）

| # | 判断ポイント | 決定 |
| --- | --- | --- |
| DP1 | common storage モジュールの形 | `src/common/storage/s3.client.ts`（移設・内容不変）＋ `storage.module.ts`（`S3StorageClient` を provide+export、`@Global` にはしない）。`ImageModule`/`AudioModule` が個別に import。 |
| DP2 | `durationSeconds` の型 | ドメイン/レスポンス: `number` または `null`。Create スキーマ/リクエスト DTO: 任意（`z.number().int().positive().nullable()` / `?: number`）。DB: `INTEGER` nullable + `CHECK (duration_seconds > 0)`。 |
| DP3 | migration タイムスタンプ | `1746144007000`（chat の `1746144006000` の次）。クラス名 `CreateAudiosTable1746144007000`。 |
| DP4 | `S3StorageClient` の他参照 | image モジュールのみ（`image.module.ts` / `image.service.ts`）。移設に伴い両ファイルの import を修正。他フィーチャへの波及なし。 |
| DP5 | 404 メッセージ | image を踏襲し「音声が見つかりません: ${id}」。 |
| DP6 | ルート/タグ | `@Controller('audios')` / `@ApiTags('audios')` / `@ApiBearerAuth('bearer')`。 |
| DP7 | openapi 再生成の DB 依存 | `pnpm openapi:export` は AppModule を起動するため Postgres 接続が必要。**実行前に `cd backend && docker compose up -d postgres` でローカル DB を起動**。`pnpm build`（=`nest build`）自体は DB 非依存。 |
| DP8 | frontend `schema.d.ts` 再生成 | **本 TSK スコープ外**（フロント TSK）。backend `openapi.json` のみ更新。 |
| DP9 | テスト | image モジュールに既存ユニットテストは無い。新規テストは追加しない（スコープ外）。完了ゲートは lint + build + openapi 再生成。 |

### 想定外時のルール

設計書/実装計画と矛盾する事象（既存 image の挙動差異、想定外の依存、build/openapi 失敗の原因が本 TSK 外）に遭遇したら、**勝手に新パターンを導入せず**、その時点までをコミットして「未解決事項」を自主レビューに明記して停止・報告する。

### コミット分割

1. **refactor(common): S3StorageClient を common/storage へ移設し共有化**
   - `src/common/storage/s3.client.ts`（`image/infra/s3.client.ts` から移動、内容不変）
   - `src/common/storage/storage.module.ts` 新規（provide+export）
   - `image/infra/s3.client.ts` 削除
   - `image.module.ts`: providers から `S3StorageClient` 除去、imports に `StorageModule` 追加
   - `image.service.ts`: import パスを `../../common/storage/s3.client` に変更
   - ゲート: `pnpm build` 通過（image 挙動不変）
2. **feat(audio): audio モジュール（domain/application/infra/controller/module）を実装**
   - `domain/audio.ts` / `domain/audio.repository.ts` / `application/audio.schemas.ts` / `application/audio.service.ts` / `infra/audio.entity.ts` / `infra/audio.repository.impl.ts` / `controller/audio.controller.ts` / `controller/audio.dto.ts` / `audio.module.ts`
   - 差分: 許可 MIME 5 種 / 20 MiB / S3 キー `audios/<userId>/<id>` / `durationSeconds`
   - ゲート: `pnpm build` 通過
3. **feat(audio): audios テーブルの migration を追加**
   - `database/migrations/1746144007000-CreateAudiosTable.ts`
   - ゲート: `docker compose up -d postgres` 済みで `pnpm migration:run`（コマンド名は package.json を確認）→ up/down が成功
4. **feat(audio): AppModule に AudioModule を登録し openapi.json を再生成**
   - `src/app.module.ts` imports に `AudioModule`
   - `pnpm openapi:export`（DB 起動済み）で `backend/openapi.json` 更新
   - ゲート: `openapi.json` に `audios` 系パス/DTO が出力
5. **docs(tsk-117): database-schema に audios テーブルを追記**
   - `docs/10_architecture/05_database-schema.md` に `### audios` 節（images と同形式 + `duration_seconds`）

### 完了ゲート（Phase 5 検証）

```bash
cd backend && pnpm install
docker compose up -d postgres
pnpm lint && pnpm build
pnpm openapi:export   # openapi.json 更新
# migration up/down 確認（コマンドは package.json 参照）
```

`pnpm lint`（`any` なし）・`pnpm build` 成功、`openapi.json` に audios 反映、migration 成功を満たすこと。
