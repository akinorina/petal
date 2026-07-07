# TSK-127 S3 バケットの整理（統合）

> Notion: <https://app.notion.com/p/3879ca7d99dc80e88815c132c109ce14>
> ステータス: 進行中 / 規模: S / 重要度: HIGH

## 課題サマリ（Notion 課題シートより転記）

Petal では S3 のバケットを複数使っているが、1 つのバケットにまとめてサブディレクトリ名で分ける構造に修正したい。

### 現状（実機確認済み）

| 用途 | バケット | プレフィックス |
| --- | --- | --- |
| DB バックアップ | `petal-db-dev` / `petal-db-prod` | `backups/*` |
| 画像 | `petal-images-dev` / `petal-images-prod` | `images/*` |
| 音声 | `petal-images-dev` / `petal-images-prod`（画像と同一） | `audios/*` |

> `BACKUP_S3_BUCKET`（GitHub Secret）の実値は **`petal-db-prod`**。バックアップ cron は prod のみ稼働。

### 目標

| 用途 | バケット | プレフィックス |
| --- | --- | --- |
| DB バックアップ | `petal-(ENV)` | `db_backups/*` |
| 画像 | `petal-(ENV)` | `images/*` |
| 音声 | `petal-(ENV)` | `audios/*` |

`(ENV)` = `dev` / `prod`。ローカル（LocalStack）も命名統一（`petal-local`）。

## スコープ

### 対象

- 新バケット `petal-dev` / `petal-prod` の作成（旧バケット設定を忠実に移植）。
- 既存データの移行（画像・音声・**過去 DB バックアップも含む**）。
- `S3_BUCKET`（dev/prod/local env）と `BACKUP_S3_BUCKET`（GitHub Secret）の切替。
- `backup.yml` のアップロードパス `backups/` → `db_backups/` 変更。
- 移行・検証・切替完了後、旧バケット 4 つの削除（**PR マージ後・ユーザー明示承認後**）。
- 関連ドキュメントの更新。

### 対象外

- アプリのストレージアクセス実装（`s3.client.ts` / `image.service.ts` / `audio.service.ts`）の変更。**S3_BUCKET は全て env 経由**で、画像・音声は既に `images/` `audios/` プレフィックス分離済みのため、バケット名変更のみで目標構造が成立し、コード変更は不要。
- 署名付き URL / CORS / 認可などの機能仕様変更。
- S3 以外のインフラ（Cognito / Neon / Lambda 構成）変更。

## 制約

- **本番稼働中**: prod の画像・音声は稼働中データ。移行中のアップロードとの整合を取る（切替戦略参照）。
- **AWS 権限**: 現行 `default`（`petal-local`）認証はアプリ最小権限のみで、バケット作成・列挙・削除は不可。管理操作は **`Akinori` プロファイル**（AWS SSO）で実行する。事前に `aws sso login --profile Akinori` が必要。
- **破壊的操作の慎重運用**: 旧バケット削除は不可逆。移行・検証完了 + PR マージ + ユーザー明示承認をすべて満たすまで実行しない。
- リージョンは `ap-northeast-1` 固定。

## 設計判断ログ

### 判断 1: アプリコードは変更せず env / 設定層のみで対応

- **採用**: `S3_BUCKET` env の値変更のみ。コード（`s3.client.ts` 等）は触らない。
- **理由**: バケット名は全て `S3_BUCKET` env から注入され、画像/音声は既にキープレフィックスで分離済み。コード変更は不要かつリスクを増やすだけ。
- **却下**: バケット名をコードにハードコード → env 注入の設計を崩すため不採用。

### 判断 2: 切替戦略 = sync → デプロイ → デルタ再 sync → 検証 → 削除

- **採用**: 初回 sync で大半をコピー → env/secret 切替してデプロイ → 直後にもう一度 delta sync で「初回 sync〜デプロイ」間に旧バケットへ入った新規アップロードを回収 → 検証 → 旧バケット削除。
- **理由**: 実質無停止でデータロスなし。presigned URL は都度生成で 300 秒 TTL、保存済みオブジェクトはキーのみで参照するため、新バケットに全オブジェクトが揃っていれば読み取りは成立する。
- **却下**: メンテナンス窓での一括切替 → 一時停止が発生。個人プロジェクト規模では無停止デルタ同期で十分。

### 判断 3: 新バケットは旧バケットの現設定を取得して忠実に移植

- **採用**: `Akinori` で旧バケットの CORS / PublicAccessBlock / 暗号化 / Lifecycle を `get-bucket-*` で取得し、新バケットへ同等適用。`db_backups/` プレフィックスには 28 日 expire の Lifecycle を付与。
- **理由**: 挙動差異（CORS 不一致でブラウザ直アップロード失敗など）を防ぐ。docs 規定（CORS / db_backups 28 日 Lifecycle）とも整合。
- **却下**: docs 規定の標準設定のみ新規セット → 旧バケット固有設定の取りこぼしリスク。

### 判断 4: 過去 DB バックアップも移行

- **採用**: `petal-db-*/backups/*` → `petal-*/db_backups/*` へ sync（プレフィックスリネーム）。
- **理由**: 過去バックアップの継続性を保つ。

### 判断 5: 旧バケット削除は PR マージ後・ユーザー明示承認後

- **採用**: 移行・検証は本タスク内で完了させるが、旧バケットの空化 + 削除はコマンド提示 → ユーザー承認を得てから実行。
- **理由**: 破壊的・不可逆操作の慎重運用（design-philosophy）。

## データモデル / API 仕様

- **該当なし**（インフラ・設定タスク。DB スキーマ・REST API は不変）。

## トランザクション境界

- **DB トランザクションなし**。外部副作用は S3 バケット操作（作成 / sync / 削除）と env / Secret 更新のみ。
- 整合性は「切替戦略（判断 2）」の順序で担保する。デルタ再 sync により切替窓のアップロード差分を回収する。

## 既存設計との差分

| 項目 | 変更前 | 変更後 |
| --- | --- | --- |
| 画像/音声バケット | `petal-images-(ENV)` | `petal-(ENV)`（`images/` `audios/` プレフィックスは不変） |
| バックアップバケット | `petal-db-prod` | `petal-prod` |
| バックアップパス | `s3://.../backups/*` | `s3://.../db_backups/*` |
| `S3_BUCKET`（dev） | `petal-images-dev` | `petal-dev` |
| `S3_BUCKET`（prod） | `petal-images-prod` | `petal-prod` |
| `S3_BUCKET`（local） | 現行値（LocalStack） | `petal-local` |
| `BACKUP_S3_BUCKET`（Secret） | `petal-db-prod` | `petal-prod` |

- `backend/serverless.yml` の IAM ポリシー `arn:aws:s3:::${env:S3_BUCKET}/*` は env 追従のため変更不要。
- `s3.client.ts` / `image.service.ts` / `audio.service.ts` / LocalStack 初期化スクリプトは env 参照のため変更不要。

## 完了条件（具体化版）

- [ ] `petal-dev` / `petal-prod` バケットが `ap-northeast-1` に作成され、旧バケット相当の CORS / PublicAccessBlock / 暗号化 / Lifecycle が適用されている。
- [ ] 旧バケットの全オブジェクトが新バケットへ移行済み（画像 `images/`・音声 `audios/`・過去バックアップ `db_backups/`）。オブジェクト数が旧＝新で一致。
- [ ] `.env.dev(.example)` / `.env.prod(.example)` / `.env.local` の `S3_BUCKET` が新命名に更新されている。
- [ ] `backup.yml` のアップロードパスが `db_backups/` に更新されている。
- [ ] GitHub Secret `BACKUP_S3_BUCKET` が `petal-prod` に更新されている。
- [ ] dev/prod デプロイ後、画像・音声のアップロード/ダウンロードが新バケットで成立する。
- [ ] `backup.yml` を手動実行し `petal-prod/db_backups/backup-YYYY-MM-DD.sql.gz` が生成される。
- [ ] 関連ドキュメント（README.dev/prod, docs/specs/39・42, docs/30_operations/04, docs/tsk-120）が新命名に更新されている。
- [ ] （PR マージ後・ユーザー承認後）旧バケット `petal-images-dev` / `petal-images-prod` / `petal-db-dev` / `petal-db-prod` が削除されている。

## 手動動作確認シナリオ

1. **dev 画像**: dev フロントから画像アップロード → S3 コンソールで `petal-dev/images/<userId>/<id>` を確認 → 一覧・詳細で表示される。
2. **dev 音声**: dev フロントから音声アップロード → `petal-dev/audios/<userId>/<id>` を確認 → 再生できる。
3. **prod 画像/音声**: prod で既存データが引き続き表示・再生できる（読み取りが新バケットに向く）。
4. **prod 新規アップロード**: prod で新規アップロード → `petal-prod/images/...` または `audios/...` に入る（旧バケットには入らない）。
5. **バックアップ**: Actions から `backup.yml` を `Run workflow` 実行 → 成功 → `petal-prod/db_backups/backup-YYYY-MM-DD.sql.gz` の存在とサイズ確認 → `aws s3 cp ... -` → `gunzip` で中身が読める。
6. **旧バケット削除後**: 上記 1〜5 が引き続き成立（旧バケット参照が残っていないことの確認）。

## 未確定事項

- 旧バケットの実 CORS / Lifecycle / 暗号化設定は `Akinori` ログイン後に `get-bucket-*` で確認して移植する（現時点では権限失効で未取得）。
- `petal-db-dev` にオブジェクトが存在するか未確認（存在すれば移行、無ければ空のまま削除）。
- deploy 用 IAM ユーザー / `petal-local` IAM ユーザーのポリシーがバケット名をハードコードしている場合は追従更新が必要になり得る（要ログイン後確認。Lambda 実行ロールは serverless.yml で env 追従のため対象外）。

## 実装計画（Phase 4）

本タスクは **(A) Git 管理対象の機械的変更** と **(B) 実 AWS 操作（対話実行・破壊的操作含む）** の 2 層。B は `Akinori`（SSO）で AI が実行、デプロイのみ既存どおり `petal-deploy`。

### 変更・追加ファイル（A: Git コミット対象）

| ファイル | 変更 |
| --- | --- |
| `backend/.envs/.env.dev.example` | `S3_BUCKET=petal-images-dev` → `petal-dev` |
| `backend/.envs/.env.prod.example` | `S3_BUCKET=petal-images-prod` → `petal-prod` |
| `backend/.envs/.env.local.example` | `S3_BUCKET`（LocalStack 値）→ `petal-local` |
| `.github/workflows/backup.yml` | アップロードパス `backups/` → `db_backups/` |
| `backend/README.dev.md` | バケット名 `petal-images-dev` → `petal-dev`、作成手順の説明を統合構造に更新 |
| `backend/README.prod.md` | バケット名 `petal-images-prod` → `petal-prod`、同上 |
| `docs/specs/39_s3-dev-setup.md` | `petal-images-dev` → `petal-dev` |
| `docs/specs/42_operational-jobs.md` | `petal-db-backup`/`petal-db-prod` → `petal-prod`、`backups/` → `db_backups/` |
| `docs/30_operations/04_storage-setup.md` | バケット命名例 `petal-images-dev` → `petal-dev`、統合構造を反映 |
| `docs/tsk-120_audio-management-docs.md` | 音声バケットの記述 `petal-images-dev` → `petal-dev` |

- **アプリコード・`serverless.yml`・`s3.client.ts`・`image/audio.service.ts`・LocalStack 初期化スクリプトは変更しない**（env 追従）。

### ローカル秘匿 env（Git 対象外・ユーザー更新）

`.envs/.env.dev` / `.env.prod` / `.env.local` は gitignore。デプロイ時に source されるため、ユーザーが該当 1 行を更新する：

- `.env.dev`: `S3_BUCKET=petal-dev`
- `.env.prod`: `S3_BUCKET=petal-prod`
- `.env.local`: `S3_BUCKET=petal-local`（更新後 `pnpm s3:setup` で LocalStack バケット再作成）

### migration・環境変数・依存追加

- DB migration: **なし**。
- 依存追加: **なし**。
- 環境変数: 値変更のみ（新規キーなし）。GitHub Secret `BACKUP_S3_BUCKET`: `petal-db-prod` → `petal-prod`。

### 作業順序（コミット単位 + 完了確認）

**A. Git 変更（本ブランチ）**

1. `chore(tsk-127): env example と backup.yml を新バケット命名に更新`
   - `.env.*.example` 3 ファイル + `backup.yml`。完了確認: `grep -rn "petal-images\|petal-db" backend/.envs/*.example .github/workflows/backup.yml` が 0 件。
2. `docs(tsk-127): S3 バケット統合を各ドキュメントへ反映`
   - README.dev/prod, docs/specs/39・42, docs/30_operations/04, docs/tsk-120。完了確認: `grep -rn "petal-images-\|petal-db-\|/backups/" backend/README*.md docs/` が意図しない旧名 0 件（履歴的記述を除く）。markdownlint 通過。

**B. 実 AWS 操作（Akinori・対話実行）**

3. **設定取得**: `aws sso login --profile Akinori` 後、旧 4 バケットの `get-bucket-cors` / `get-bucket-lifecycle-configuration` / `get-bucket-encryption` / `get-public-access-block` と各プレフィックスの `ls --recursive --summarize`（オブジェクト数記録）。完了確認: 4 バケット分の設定 JSON とオブジェクト数を取得。
4. **新バケット作成**: `petal-dev` / `petal-prod` を作成し、手順 3 の設定を適用。`db_backups/` に 28 日 expire Lifecycle 付与。完了確認: `head-bucket` が 200、`get-bucket-cors` 等が期待値。
5. **初回 sync**: `petal-images-{env}` → `petal-{env}`（images/ audios/ 保持）、`petal-db-{env}/backups` → `petal-{env}/db_backups`。完了確認: 新バケットのオブジェクト数 ≥ 手順 3 記録値。
6. **切替デプロイ**: ユーザーが local 秘匿 env を更新 → `pnpm deploy:dev` / `pnpm deploy:prod`（petal-deploy）。Secret 更新 `gh secret set BACKUP_S3_BUCKET -b petal-prod`。完了確認: デプロイ成功、Lambda 環境変数 `S3_BUCKET` が新名。
7. **デルタ再 sync**: 手順 5 の sync を再実行（切替窓の新規アップロード回収）。完了確認: 新規コピー 0〜少数で収束。
8. **検証**: 手動動作確認シナリオ 1〜5 を実施。完了確認: 全項目パス、新旧オブジェクト数一致。

**C. 旧バケット削除（PR マージ後・ユーザー明示承認後のみ）**

9. 旧 4 バケットを空化 → `delete-bucket`。完了確認: `head-bucket` が 404。**この手順は承認前に実行しない。**

### テスト方針

- 自動テスト: 本タスクはアプリコード非変更のため新規ユニット/E2E テストなし。既存テストは変更なしで通過すること（コード無変更のため影響なし）。
- 手動検証: 上記手順 8 の動作確認シナリオで担保。

### 想定外時の判断ルール

**標準セット**

- AI 単独判断 OK: 軽微な既存コードリファクタ、設計書スコープ内の追加実装。
- 中断して要相談: データモデル変更、API 仕様変更、トランザクション境界変更、外部 API 想定差異、設計判断ログを覆す変更。

**本タスク固有の中断条件**

- 旧バケットの `get-bucket-*` が AccessDenied（`Akinori` 権限不足）→ 中断して相談。
- sync 後もオブジェクト数が旧 > 新で乖離が残る → 中断、原因調査（削除に進まない）。
- 旧バケットに設計書想定外のプレフィックス/大量データを発見 → 中断して確認。
- **旧バケット削除（手順 9）は、移行検証完了 + PR マージ + ユーザー明示承認の 3 点すべてが揃うまで実行しない**（不可逆・破壊的）。
- デプロイが `petal-deploy` の権限/SSO 失効で失敗 → ユーザーに委ねる。

### 事前解決済みの判断ポイント

- **管理操作の認証**: バケット作成/sync/削除 = `Akinori`、デプロイ = `petal-deploy`（既存どおり）。
- **バケット名**: `petal-dev` / `petal-prod` / `petal-local`。
- **バックアップパス**: `db_backups/`。`BACKUP_S3_BUCKET` = `petal-prod`。
- **切替戦略**: sync → デプロイ → デルタ再 sync → 検証 → （承認後）削除。
- **設定移植**: 旧バケットの現設定を取得して忠実に適用。
- **過去バックアップ**: 移行する。
- **ローカル秘匿 env**: ユーザーが 1 行更新（値は上記指定）。`.example` は AI がコミット。
- **dev → prod の順**: dev で先に検証してから prod。
