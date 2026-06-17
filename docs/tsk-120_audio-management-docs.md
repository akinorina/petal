# TSK-120 音声管理機能のドキュメントを整備する — 設計書

> 本書は Notion タスク TSK-120 の設計議論（Phase 3）と実装計画（Phase 4）を記録する実行契約。
> 完成後の現状仕様は `docs/20_features/10_audio-management.md` を正とし、本書は経緯・判断理由のアーカイブ。

## 0. 課題シート（Notion TSK-120 転記）

- **Notion**: [TSK-120](https://app.notion.com/p/3819ca7d99dc813781a1def4845ef48b)（規模 M / 重要度 LOW）
- **プロジェクト**: PRJ-15

### 一行サマリ

画像管理ドキュメント（`docs/20_features/04_image-management.md`）と同等の音声管理ドキュメントを新規作成し、目次・関連ドキュメントへのリンクを整備する。

### 背景・動機

PRJ-15 の成果物の一部。実装（Backend / Frontend / 録音）が確定した後に、現状仕様として体系ドキュメントへ反映する。AGENTS.md の方針上、機能仕様は `docs/` を正とするため必須。

### 完了条件

- `docs/20_features/10_audio-management.md` を新規作成。画像管理ドキュメントと同等の構成（概要・エンドポイント表・アップロード/録音シーケンス・一覧/詳細・ストレージ・削除・関連ドキュメント）。
- `docs/README.md` の目次・`docs/20_features/` 配下の索引へ音声管理を追加。
- DB スキーマ（`docs/10_architecture/05_database-schema.md`）に `audios` が記載されていることを確認（未反映なら追記）。
- 必要に応じて `docs/30_operations/04_storage-setup.md` に音声の S3 取り扱いを追記。
- 実装（モジュール・ページ・エンドポイント）とドキュメントの記述が一致している。

### スコープ外

- 実装そのもの（他 TSK）。

### 制約

- 既存ドキュメントの様式・リンク記法（相対パス）に揃える。

## 1. 実装の現状（調査結果）

ドキュメント化対象の実装はすべて main にマージ済み。要点：

### Backend（`backend/src/audio/`）

画像モジュールとほぼ同型（DDD + オニオン、署名付き URL でバイト中継なし、論理削除）。

| メソッド | パス | 概要 |
| --- | --- | --- |
| POST | /audios | アップロード（メタ作成 + 署名付き PUT URL 発行） |
| GET | /audios | 自分の音声一覧（新着順） |
| GET | /audios/:id | 詳細 |
| GET | /audios/:id/download-url | 署名付きダウンロード URL |
| DELETE | /audios/:id | 削除（論理） |

- テーブル `petal.audios`：`id / owner_user_id(FK, onDelete: RESTRICT) / s3_key(UNIQUE) / original_filename / mime_type / size_bytes(bigint) / duration_seconds(int, nullable) / title / description / created_at / updated_at / deleted_at`。
- インデックス `IDX_audios_owner_created (owner_user_id, created_at)`。
- S3 キー: `audios/<userId>/<audioId>`（画像と同一バケット、プレフィックスで分離）。
- 入力検証（`audio.schemas.ts`）: MIME 許可 = `audio/mpeg, audio/wav, audio/webm, audio/mp4, audio/ogg`、サイズ上限 `20 MiB`、`duration_seconds` は任意・正整数。

### Frontend（`frontend/src/app/(authenticated)/audios/`, `frontend/src/lib/`）

- 一覧: **リスト形式 + インライン `<audio controls>` 再生**（画像はグリッド）。1 行再生時に他行を自動停止。Pagination。新着順。
- アップロード UI: D&D（モーダル / ページ全体）・ファイル選択ボタン・**マイク録音**。タイトル / 説明は任意。
- マイク録音（`use-audio-recorder.ts` / `audio-constants.ts`）: MediaRecorder、最大 30 秒で自動停止、`audio/webm` 優先 → 未対応なら `audio/mp4`（Safari 等）へフォールバック、録音 → プレビュー → 録り直し可、録音結果は既存アップロード経路へ流す。非対応環境は録音 UI を無効表示。
- 共通関数: `formatAudioSize` / `formatDuration`（mm:ss）/ `validateAudioFile` / `measureAudioDuration`。
- 詳細ページ `audios/[id]/`: メタ情報表示・ダウンロード・削除。

### 既存ドキュメントの現状

- DB スキーマ `docs/10_architecture/05_database-schema.md`: `audios` セクション・ERD ともに**記載済み**（追記不要、整合確認のみ）。
- `docs/30_operations/04_storage-setup.md`: 音声への言及なし（画像前提の記述のみ）。
- `docs/10_architecture/06_api-design.md`: `images` のエンドポイント表はあるが `audios` は未掲載。
- `docs/20_features/diagrams/`: 図は `*.drawio.svg`（XML 埋め込み SVG）。`image-upload-sequence.drawio.svg` あり。音声用なし。

## 2. 設計判断（Phase 3 決定事項）

| 論点 | 決定 | 理由 |
| --- | --- | --- |
| 新規ファイル番号 | `docs/20_features/10_audio-management.md` | chat=`09_` の次の連番。課題シートの想定どおり。 |
| アップロード/録音シーケンス図 | **音声専用 drawio 図を新規作成**（`audio-upload-sequence.drawio.svg`） | 署名付き PUT 機構は画像と同一だが、録音 → プレビュー → アップロードのクライアント側フローを含め音声単体で完結させる。drawio スキルで生成。 |
| api-design への反映 | **`06_api-design.md` に `audios` エンドポイント表を追加** | images と対になり、実装とドキュメントの整合・完全性が上がる。 |
| storage-setup への反映 | **`04_storage-setup.md` に音声の S3 取り扱いを追記** | 完了条件の「必要に応じて」に該当。音声も同一バケットを `audios/` プレフィックスで共用する旨と相互リンク。 |
| AGENTS.md ドキュメント表 | 機能仕様行の機能列挙に「音声」を追加（per-file 追記は不要） | 表はディレクトリ単位。列挙の正確性のみ補正。 |

## 3. 新規ドキュメントの構成（`10_audio-management.md`）

画像管理ドキュメントの節立てを踏襲しつつ音声固有点を反映する：

1. **タイトル + 概要**: アップロード（ファイル / マイク録音）・一覧（インライン再生）・詳細・ダウンロード・削除。本体は S3、メタは `petal.audios`。所有者本人のみ閲覧可。実装リンク（backend/audio, frontend/audios, use-audios-api, use-audio-recorder）。
2. **エンドポイント**: 5 行の表（/audios）。
3. **アップロードシーケンス**: 署名付き PUT の説明 + `diagrams/audio-upload-sequence.drawio.svg` 埋め込み。録音はクライアントで File を生成してから同一経路に流す点を明記。
4. **アップロード UI**: D&D・ファイル選択・マイク録音（MediaRecorder / 最大 30 秒 / webm→mp4 / プレビュー・録り直し / 非対応環境の扱い）。受理形式 MP3/WAV/WebM/MP4/OGG・20 MiB。
5. **一覧 / 詳細**: リスト + インライン再生（他行自動停止）・Pagination・新着順（`IDX_audios_owner_created`）・詳細ページ・`formatDuration` 表示。
6. **ストレージ**: S3 署名付き URL、`s3_key = audios/<userId>/<id>`（UNIQUE）、同一バケット共用、storage-setup へのリンク。
7. **削除**: 論理削除（`deleted_at`）、`onDelete: RESTRICT`。
8. **関連ドキュメント**: DB スキーマ / storage-setup / api-design。

---

## 4. 実装計画（Phase 4）

### 変更対象ファイル

| # | ファイル | 操作 | 内容 |
| --- | --- | --- | --- |
| 1 | `docs/20_features/10_audio-management.md` | 新規 | 上記 3 章の構成で作成 |
| 2 | `docs/20_features/diagrams/audio-upload-sequence.drawio.svg` | 新規 | drawio スキルで録音→アップロードのシーケンス図を生成 |
| 3 | `docs/20_features/diagrams/README.md` | 追記 | 図表テーブルに音声アップロード図の行を追加 |
| 4 | `docs/README.md` | 追記 | 20_features カテゴリ表に `10_audio-management.md` 行を追加 |
| 5 | `docs/10_architecture/06_api-design.md` | 追記 | `images` 表の後に `audios` エンドポイント表を追加 |
| 6 | `docs/30_operations/04_storage-setup.md` | 追記 | 音声も同一バケットを `audios/` プレフィックスで共用する旨・相互リンクを追記 |
| 7 | `docs/10_architecture/05_database-schema.md` | 確認のみ | `audios` 記載済み。実装と差異がなければ無編集 |
| 8 | `AGENTS.md` | 追記 | 機能仕様行の機能列挙に「音声」を追加 |

### コミット計画（日本語・docs スコープ）

- C1: `docs(tsk-120): 音声管理の現状仕様ドキュメントを追加`（#1, #3, #4 — 本文 + 図索引 + 目次）
- C2: `docs(tsk-120): 音声アップロードのシーケンス図を追加`（#2、drawio 生成物）
- C3: `docs(tsk-120): API 設計・ストレージ構築・AGENTS に音声を反映`（#5, #6, #8）

> 設計書（本ファイル）の先行コミットは別途 C0。

### 事前解決済みの判断ポイント（ドライラン）

1. **新規ファイル番号** → `10_`（確定）。
2. **図の作成手段** → drawio スキルで `.drawio.svg`（XML 埋め込み SVG）を生成し既存様式に合わせる。生成不調時はテキスト記述へフォールバックし、後続で図を差し替える。
3. **DB スキーマ** → 既に記載済み。実装（entity）と表記が一致しているため無編集。CHECK 制約（`size_bytes > 0` / `duration_seconds > 0`）の記述は doc にあるが entity にはアプリ層検証として存在 → 既存記述を尊重し変更しない。
4. **storage-setup のバケット名** → 既存記述は `petal-images-dev`。音声専用バケットは設けず同一バケット共用のため、バケット名は変えず「画像・音声で共用、プレフィックスで分離」と補足する。
5. **api-design の挿入位置** → `images` セクション（controller リンク付き見出し + 表）の直後に同形式で `audios` を追加。
6. **リンク記法** → すべて相対パス・既存の `(authenticated)` の URL エンコード（`%28authenticated%29`）に合わせる。

### 想定外時のルール

- 実装と doc 草案に矛盾を発見した場合 → **実装（コード）を正**として doc を実装に合わせ、矛盾点を PR 本文に記録。
- drawio スキルが期待様式の `.drawio.svg` を出力できない場合 → 図はテキスト節で代替し、図ファイルは作らず diagrams/README 追記も見送る（PR 本文に明記）。

### 完了条件（機械検証可能）

- [ ] `docs/20_features/10_audio-management.md` が存在し、8 節を満たす。
- [ ] `docs/README.md` の 20_features 表に `10_audio-management.md` 行がある。
- [ ] `docs/20_features/diagrams/README.md` に音声図の行がある（図を作成した場合）。
- [ ] `docs/10_architecture/06_api-design.md` に `audios` の 5 エンドポイントが記載。
- [ ] `docs/30_operations/04_storage-setup.md` に音声の S3 記述がある。
- [ ] `AGENTS.md` 機能仕様行に「音声」が含まれる。
- [ ] doc 内の相対リンクが解決できる（壊れリンクなし）。
