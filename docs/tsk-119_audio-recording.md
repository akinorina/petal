# TSK-119 マイク録音（録音→プレビュー→アップロード）機能を実装する（設計書）

- Notion: <https://app.notion.com/p/3819ca7d99dc8115835bf430a5b29e00>
- プロジェクト: PRJ-15 Petal 音声コンテンツ対応
- 規模: M / 重要度: MIDDLE
- 依存: TSK-118「音声のアップロード・一覧・再生・詳細・削除のフロントを実装する」（アップロードモーダル基盤・`POST /audios` ＋ 署名付き URL PUT 経路）— **完了済み（PR #90 マージ済み）**

## 1. 課題シート（Notion 転記・フリーズ）

### 一行サマリ

音声アップロードモーダルに、ブラウザのマイクを使った録音機能（MediaRecorder で録音 → その場でプレビュー再生 → アップロード）を追加する。最大約 30 秒・`audio/webm`。

### 背景・動機

PRJ-15 の要求「マイクからの録音（Frontend）とそのデータのアップロード」。画像の `input[capture]` カメラとは別物で、MediaRecorder による独立した実装・検証が必要なため単独 TSK とする。録音音声は将来的な LLM 文字起こしの素材になることを見据え「文字起こしできる程度の品質」を満たす（高音質は不要）。

### 完了条件（課題シート原文）

- アップロードモーダル（フロント TSK で実装したもの）に録音 UI を追加。
- `navigator.mediaDevices.getUserMedia` ＋ `MediaRecorder` でマイク録音。録音形式 `audio/webm`。
- 録音時間は **最大約 30 秒**（上限到達で自動停止、もしくは明示停止）。
- 録音停止後、その場で `<audio>` によりプレビュー再生して内容を確認できる。
- 確認後、録音データ（webm）を既存のアップロード経路（`POST /audios` ＋ 署名付き URL PUT）でアップロードできる。
- マイク権限拒否・未対応ブラウザのエラーハンドリングと UI 表示。
- `cd frontend && pnpm build` が通る。

### スコープ外

- 録音音声のトリミング・波形表示・ノイズ除去等の編集。
- サーバー／クライアントでの形式変換。
- 文字起こし。

### 制約

- `MediaRecorder` のブラウザ対応差（特に Safari の `audio/webm` 非対応の可能性）を実装時に確認し、対応形式のフォールバック方針を決める。
- 状態・副作用は同居フックに切り出す（ページコンポーネントは View 専念）。

## 2. スコープ

### 対象

- 既存アップロードモーダル（`frontend/src/app/(authenticated)/audios/page.tsx` 内 `UploadModal`）への録音 UI 追加。
- 録音ロジックの専用フック `frontend/src/lib/hooks/use-audio-recorder.ts` 新設。
- 録音形式ネゴシエーション・MIME 正規化ユーティリティ（`audio-constants.ts` への追加）。

### 対象外

- バックエンド変更（`/audios` API は既存のまま使用。許可 MIME に `audio/webm` / `audio/mp4` を既に含む）。
- 一覧・詳細ページの変更。
- 録音音声の編集・変換・文字起こし。

## 3. 設計判断ログ

### 判断 1: 録音 UI のアップロードモーダルへの統合方法 — 採用: **ドロップゾーン下に録音セクション併置**

- 採用理由: 既存モーダルへの最小増分。録音完了で録音 blob を `File` 化し、既存の `file` 状態へセットすることで、以降のバリデーション（`validateAudioFile`）・送信（`handleSubmit` → `onUpload`）経路を 100% 再利用できる。新パターンを持ち込まない（制約合致）。
- 却下: 「ファイル / 録音」タブ切替 — design-system にタブ前例がなく新パターン・実装増。
- 却下: 録音専用の別モーダル — モーダル二重化・アップロード経路の重複配線で複雑化。

### 判断 2: Safari 等で `audio/webm` 非対応時のフォールバック — 採用: **webm 優先 → mp4 フォールバック**

- 採用理由: `MediaRecorder.isTypeSupported('audio/webm')` が真なら `audio/webm`、偽なら `audio/mp4` を採用。許可 MIME には既に両者を含むため、許可リスト変更が不要。Safari（webm 非対応・mp4 対応）もカバーできる。両方未対応なら録音 UI を無効化しエラー表示。
- 却下: webm のみ・未対応はエラー — Safari で録音不可となり、利用不可ブラウザが残る。

### 判断 3: 録音ロジックの置き場所 — 採用: **専用フック `use-audio-recorder.ts` 新設**

- 採用理由: 制約「状態・副作用は同居フックに切り出す」に合致。録音状態（`idle` / `recording` / `recorded`）・経過秒・録音 blob・ストリーム/タイマーの後始末・エラーを 1 フックに集約し、`UploadModal` は View に専念。テスト・再利用も容易。
- 却下: `UploadModal` 内に直接実装 — コンポーネントに副作用（MediaRecorder・getUserMedia・interval・stream stop）が密集し制約違反。

### 判断 4: 録音状態モデル

`idle`（初期）→（録音開始: getUserMedia 許可待ち）→ `recording`（録音中・経過秒カウント）→（明示停止 or 30 秒到達で自動停止）→ `recorded`（プレビュー可能・blob 保持）。`recorded` から「録り直し」で `idle` に戻し既存 blob を破棄。エラー時は `error` メッセージを保持し `idle` に戻す。

### 判断 5: 録音 blob → File への変換と MIME 正規化

- `MediaRecorder` の `ondataavailable` で得た chunk を `new Blob(chunks, { type: mimeType })` に結合し、`new File([blob], filename, { type: baseMime })` を生成。
- `baseMime` は採用形式（`audio/webm` または `audio/mp4`）の **codecs サフィックスを除いた base MIME**。`MediaRecorder` が報告する `mimeType` は `audio/webm;codecs=opus` の形を取りうるため、`;` 以降を除去して許可リスト（`ALLOWED_AUDIO_MIME_TYPES`）と一致させる。
- ファイル名は `recording-<yyyyMMdd-HHmmss>.<ext>`（ext: webm/mp4）。`originalFilename` として送信。
- 生成 `File` の `type` は base MIME のため、既存 `validateAudioFile` をそのまま通過する。

### 判断 6: 再生時間（durationSeconds）の扱い

既存アップロード経路 `useAudiosApi.upload` は `measureAudioDuration(file)` で再生時間を計測する。MediaRecorder 生成の webm は既知問題で `duration` が不定（`Infinity`）になり得るが、`measureAudioDuration` は不正値で `null` を返し、`durationSeconds` は任意項目のため許容する（既存挙動踏襲・本 TSK で改善しない）。

## 4. データモデル / API 仕様

- **変更なし**。既存の `POST /audios`（メタ作成＋署名付き URL 発行）→ 署名付き URL への PUT、という TSK-117/118 の経路をそのまま使用。
- 送信ペイロードは既存 `CreateAudioRequestDto`（`originalFilename` / `mimeType` / `sizeBytes` / `durationSeconds?` / `title?` / `description?`）。録音 File から同フィールドを充足する。

## 5. トランザクション境界

本 TSK はフロントエンドのみで、サーバー側の DB トランザクション・外部副作用の新規追加はない（[docs/specs/00_rules.md §4](specs/00_rules.md) 該当なし）。アップロードの整合性は既存経路（メタ作成 → S3 PUT）の挙動に従う。

## 6. UI 設計

`UploadModal` の「ファイル」フィールド（ドロップゾーン）の **直下** に録音セクションを併置する。design-system の `Button` / `Alert` / `Text` を使用し新パターンを持ち込まない。

- **未対応ブラウザ**: 録音セクションは「お使いのブラウザは録音に対応していません」と表示し操作不可。ファイル選択は従来どおり利用可能。
- **idle**: 「マイクで録音」ボタン（`variant="secondary"`）。
- **recording**: 録音中インジケータ（赤丸＋「録音中」）＋ 経過秒 `mm:ss`（最大 0:30）＋「停止」ボタン。30 秒到達で自動停止。
- **recorded**: 「録音結果」見出し ＋ `<audio controls src={objectURL}>` でプレビュー再生 ＋「録り直し」ボタン。録音結果は同時に `file` 状態へセットされ、上部のファイル表示（ファイル名・サイズ）にも反映される。アップロードは既存フッターの「アップロード」ボタンで実行。
- **エラー**: 権限拒否・取得失敗時は録音セクション内に `Alert`（`variant="danger"`）でメッセージ表示。

## 7. 既存設計との差分

- `frontend/src/app/(authenticated)/audios/page.tsx`: `UploadModal` に録音セクションを追加。録音完了時に `file` 状態へ録音 File をセット。録音中はフッターのアップロードボタンを無効化（録音確定前の送信を防ぐ）。
- `frontend/src/lib/hooks/use-audio-recorder.ts`: 新規（録音状態・経過秒・blob・エラー・start/stop/reset・後始末を提供）。
- `frontend/src/lib/audio-constants.ts`: 録音形式ネゴシエーション（`pickRecordingMimeType`）と base MIME 正規化（`stripCodecs`）、録音 blob → File 変換ヘルパ（`recordingBlobToFile`）、録音上限秒 `MAX_RECORDING_SECONDS = 30` を追加。
- ナビゲーション・一覧・詳細・バックエンドは変更なし。

## 8. 完了条件（具体化版）

- [ ] `use-audio-recorder.ts` が録音状態（idle/recording/recorded/error）・経過秒・録音 File・start/stop/reset を提供し、停止時/アンマウント時に stream トラック停止・interval クリア・objectURL revoke を行う。
- [ ] `pickRecordingMimeType()` が `audio/webm` 優先・`audio/mp4` フォールバック・両未対応で `null` を返す。
- [ ] `UploadModal` のドロップゾーン直下に録音セクションが表示され、idle→recording→recorded の遷移が動作する。
- [ ] 30 秒到達で自動停止する。
- [ ] 録音停止後 `<audio>` でプレビュー再生でき、同時に `file` 状態へ録音 File がセットされる。
- [ ] 「アップロード」で録音 File が既存経路（`POST /audios` ＋ 署名付き URL PUT）で送信され、一覧に表示される。
- [ ] マイク権限拒否時・未対応ブラウザ時にエラー UI が表示され、ファイル選択は引き続き利用できる。
- [ ] `cd frontend && pnpm build` が通る。
- [ ] `cd frontend && pnpm lint` が通る。

## 9. 手動動作確認シナリオ

1. `/audios` で「音声をアップロード」→ モーダルのドロップゾーン直下に録音セクションが表示される。
2. 「マイクで録音」→ ブラウザのマイク許可ダイアログで許可 → 録音中表示＋経過秒カウント開始。
3. 「停止」→ 録音結果の `<audio>` が表示され再生できる。上部ファイル表示に `recording-*.webm` が出る。
4. 「アップロード」→ 成功し、一覧の先頭に録音した音声が出て、行内インライン再生できる。
5. 録音中に放置 → 30 秒で自動停止し `recorded` になる。
6. 「録り直し」→ idle に戻り、再録音できる。
7. マイク許可を拒否 → 録音セクションにエラー表示。モーダルのファイル選択は引き続き使える。
8. （可能なら）Safari で録音 → `audio/mp4` で録音・プレビュー・アップロードできる。
9. 録音中にモーダルを閉じる → マイク使用が停止（ブラウザのマイク使用中インジケータが消える）。

## 10. 未確定事項

- なし（主要論点は設計判断ログ 判断 1〜3 で確定済み）。

---

## 11. 実装計画（Phase 4 で追記）

（Phase 4 で記入）
