# 音声管理

音声のアップロード（ファイル / マイク録音）・一覧（インライン再生）・詳細・ダウンロード・削除。ファイル本体は S3、メタデータは `petal.audios`。音声は **所有者本人のみ閲覧可**。
実装: [backend/src/audio/](../../backend/src/audio/) / フロント [frontend/src/app/(authenticated)/audios/](../../frontend/src/app/%28authenticated%29/audios/), [frontend/src/lib/api-hooks/use-audios-api.ts](../../frontend/src/lib/api-hooks/use-audios-api.ts), [frontend/src/lib/use-audio-recorder.ts](../../frontend/src/lib/use-audio-recorder.ts)

## エンドポイント

| メソッド | パス | 概要 |
| -------- | ---- | ---- |
| POST | /audios | アップロード（メタ作成 + 署名付き PUT URL 発行） |
| GET | /audios | 自分の音声一覧（新着順） |
| GET | /audios/:id | 詳細 |
| GET | /audios/:id/download-url | 署名付きダウンロード URL |
| DELETE | /audios/:id | 削除（論理） |

## アップロードシーケンス

`POST /audios` でメタ作成 + 署名付き URL を取得 → **ブラウザが S3 へ直接 PUT**（バックエンドはバイトを中継しない）。署名付き PUT の機構は画像と同一。
マイク録音の場合は、クライアントで録音結果から `File` を生成してから上記と同一のアップロード経路に流す。

1. （録音時のみ）ユーザーがマイク録音 → プレビュー → 必要なら録り直し。録音結果を `File` として取得。
2. ブラウザがファイル（選択 / D&D / 録音結果）をクライアント検証（MIME・20 MiB・`measureAudioDuration`）。
3. ブラウザ → Backend: `POST /audios`（メタ作成要求）。
4. Backend: `petal.audios` にメタを作成（`s3_key = audios/<userId>/<audioId>`）し、署名付き PUT URL を発行して返す。
5. ブラウザ → S3: 署名付き URL へ音声バイト本体を直接 PUT。**バックエンドはバイトを中継しない。**
6. S3 → ブラウザ: 200 OK。ブラウザは一覧 1 ページ目へ遷移し完了表示。

## アップロード UI

- **ドラッグ＆ドロップ**: アップロードモーダルにドロップゾーン。一覧ページ全体でも D&D 可。
- **ファイル選択ボタン**: ドロップゾーン内に design-system Button を内包。
- **マイク録音**: `MediaRecorder` で録音（[frontend/src/lib/use-audio-recorder.ts](../../frontend/src/lib/use-audio-recorder.ts) / [frontend/src/lib/audio-constants.ts](../../frontend/src/lib/audio-constants.ts)）。最大 30 秒で自動停止。形式は `audio/webm` 優先、未対応環境（Safari 等）は `audio/mp4` へフォールバック。録音 → プレビュー → 録り直し可。録音結果は既存アップロード経路へ流す。録音非対応環境では録音 UI を無効表示。
- タイトル / 説明は任意。
- 受理形式: MP3 / WAV / WebM / MP4 / OGG（`audio/mpeg, audio/wav, audio/webm, audio/mp4, audio/ogg`）。サイズ上限 20 MiB。

## 一覧 / 詳細

- 一覧: **リスト形式 + インライン `<audio controls>` 再生**（画像はグリッド）。1 行を再生すると他行を自動停止。Pagination。所有者別の新着順（`IDX_audios_owner_created`）。
- 詳細（[frontend/src/app/(authenticated)/audios/[id]/](../../frontend/src/app/%28authenticated%29/audios/[id]/)）: メタ情報表示・ダウンロード・削除。再生時間は `formatDuration`（mm:ss）、サイズは `formatAudioSize` で表示。
- 共通関数: `formatAudioSize` / `formatDuration` / `validateAudioFile` / `measureAudioDuration`（[frontend/src/lib/audio-constants.ts](../../frontend/src/lib/audio-constants.ts)）。

## ストレージ

- S3。アップロード・ダウンロードとも**署名付き URL** でブラウザと S3 が直接やり取りし、バックエンドはバイトを中継しない。
- S3 オブジェクトキー（`s3_key`）は `audios/<userId>/<audioId>` で、DB で一意（UNIQUE）。
- 画像と**同一バケットを共用**し、`audios/` プレフィックスで分離する。
- バケット / IAM / CORS の構築は [30_operations/04_storage-setup.md](../30_operations/04_storage-setup.md)。

## 削除

論理削除（`deleted_at`）。所有者ユーザーは音声が残る限り物理削除できない（`onDelete: RESTRICT`）。

## 関連ドキュメント

- DB スキーマ → [10_architecture/05_database-schema.md](../10_architecture/05_database-schema.md)
- API 設計 → [10_architecture/06_api-design.md](../10_architecture/06_api-design.md)
- S3 構築 → [30_operations/04_storage-setup.md](../30_operations/04_storage-setup.md)
