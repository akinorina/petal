# TSK-132 チャットの音声添付 UI（フロント）（設計書）

- Notion: <https://app.notion.com/p/3889ca7d99dc815ba43cee3e2b304548>
- プロジェクト: PRJ-18（Petal LLM音声対応）<https://app.notion.com/p/3819ca7d99dc80bebbd8ed9118b7703f>
- 規模: L / 重要度: HIGH
- 関連: [docs/20_features/09_chat.md](20_features/09_chat.md) / [docs/20_features/10_audio-management.md](20_features/10_audio-management.md) / [docs/tsk-131_chat-audio-backend.md](tsk-131_chat-audio-backend.md) / [docs/tsk-125_chat-image-frontend.md](tsk-125_chat-image-frontend.md)（画像版フロント）

## 1. 課題シート（Notion 転記・フリーズ）

### 一行サマリ

チャット入力欄での音声添付ピッカー・選択プレビュー・送信処理・ユーザーバブル内の音声再生表示を実装する。画像添付の UI 構造を流用し、音声専用コンポーネントを画像と並列に新規作成する。

### 背景・動機

PRJ-18 のフロント。バックエンド（TSK-131）の音声添付送信 API（`attachmentAudioIds` 送信・`audioAttachments` 応答・422 `LLM_AUDIO_UNSUPPORTED`）はマージ済み。既存の音声ライブラリ UI（`use-audios-api` / `audio-constants`）と画像添付 UI（`use-image-attachment` / `ImageAttachmentPicker` / `AttachmentPreviewList` / `MessageAttachments` / `use-chat-conversation`）を流用する。

### 完了条件

- [ ] 音声ライブラリから音声を複数選択して添付できる（上限 3 件＝バックの `MAX_AUDIO_ATTACHMENTS`、選択順=position）。
- [ ] 選択中の音声プレビュー列を表示し、個別取り消しができる。
- [ ] 添付 ID 配列を送信処理に載せて送れる（楽観表示含む）。
- [ ] ユーザーバブル内で添付音声を `<audio>` で再生できる（履歴は署名付き URL）。
- [ ] 音声非対応 provider の 422（`LLM_AUDIO_UNSUPPORTED`）時に専用文言を表示する。
- [ ] `cd frontend && pnpm build` が通る。

### スコープ外

- マイク録音 UI・波形可視化（将来検討。既存 `use-audio-recorder` はチャットでは使わない）。
- バックエンド送信処理（TSK-131・実装済み）。

### 制約

- 画像添付 UI（picker / preview list / message attachments）を流用し、**音声専用コンポーネントを画像と並列に新規作成**する（判断 1）。
- ページは View に専念しロジックは同居フックへ（frontend-architecture 準拠）。`lib/api` を UI から直接呼ばず `lib/api-hooks` 経由。

### 不明点・迷い

解決済み（共通化は行わず音声専用を画像と並列で新規／Picker は行リスト形式。Phase 3 で確定）。

## 2. スコープ

### 対象（新規 + 既存改修）

- 新規: `use-audio-attachment.ts`・`AudioAttachmentPicker.tsx`・`AudioAttachmentPreviewList.tsx`・`MessageAudioAttachments.tsx`。
- 既存改修: `ChatConversation.tsx`（音声フック・ボタン・プレビュー・Dialog の並列追加）・`use-chat-conversation.ts`（`attachmentAudioIds`/楽観/`AUDIO_UNSUPPORTED`/履歴の `audioAttachments`）・`use-chat-api.ts`・`lib/api/chat.ts`（body に `attachmentAudioIds`）。
- OpenAPI 型 `schema.d.ts` の再生成（バック `openapi.json` の音声フィールド取り込み）。

### 対象外

- 上記「スコープ外」のとおり。画像側コンポーネントの汎化・改変はしない。

## 3. 設計判断ログ

### 判断 1: 音声専用を画像と並列で新規（汎化しない）（採用）

- **採用**: `use-audio-attachment` / `AudioAttachmentPicker` / `AudioAttachmentPreviewList` / `MessageAudioAttachments` を画像と対称に新規作成。既存画像コンポーネントには触れない。
- **理由**: TSK-131（バック）でも「独立テーブル・別フィールドで画像に触れない」方針を採っており一貫する。低リスクでレビューしやすい。表示ロジック（画像=グリッド/原寸 Dialog、音声=`<audio>` 再生）が本質的に異なり、ジェネリック汎化はかえって複雑化する。
- 却下: ジェネリック汎化（画像側のリグレッションリスク・表示分岐の複雑化）／ロジックフックのみ汎化（汎化フック設計の手間に見合わない）。

### 判断 2: Picker は行リスト形式（採用）

- **採用**: 音声管理ページと同様、1 行に タイトル・再生時間（`formatDuration`）・サイズ（`formatAudioSize`）＋インライン `<audio controls>` 試聴＋選択チェックを並べる行リスト。複数選択（上限 3）。
- **理由**: 音声は視覚サムネが無く、リストの方が情報量（長さ・サイズ）と試聴に適する。既存 `audio-constants` のフォーマッタを流用できる。
- 却下: 画像同様のグリッド（サムネが無く情報が乏しい・試聴しづらい）。

### 判断 3: メッセージバブル内は `<audio controls>` インライン再生（採用）

- **採用**: ユーザーバブル内で添付音声を `<audio controls>` で再生（履歴は署名付き `downloadUrl`、楽観時は audioId のみ保持し未再生 or プレースホルダ）。画像のような原寸 Dialog は持たない（音声に原寸概念なし）。
- **理由**: 音声の自然な提示方法。`MessageAttachments`（画像）の楽観/履歴の二相パターンは踏襲しつつ表示要素のみ差し替える。

## 4. データ・型

- バック（TSK-131）の型を OpenAPI 再生成で取り込む:
  - `SendMessageRequestDto.attachmentAudioIds?: string[]`
  - `ChatMessageAudioAttachmentDto { audioId, position, mimeType, originalFilename, downloadUrl, expiresInSeconds }`
  - `ChatMessageResponseDto.audioAttachments: ChatMessageAudioAttachmentDto[]`
- 再生成手順は Phase 4 で確認し実装計画に明記（画像 TSK-125 と同手順）。

## 5. UI / 状態

- `use-audio-attachment.ts`: `use-image-attachment` と同型。`useAudiosApi()` を使い、`selectedIds`/`selectedAudios`/`audios`/`isLoading`/`error`/`reload`/`isPickerOpen`/`openPicker`/`closePicker`/`toggle`/`remove`/`clear`/`canAddMore` を返す。上限定数 `MAX_AUDIO_ATTACHMENTS = 3`（バックと一致）。
- `AudioAttachmentPicker.tsx`: design-system `Dialog`。行リスト（試聴・メタ・選択）。空状態は「音声管理へ」リンク。
- `AudioAttachmentPreviewList.tsx`: 入力欄上の選択中音声列（タイトル＋`formatDuration`＋「×」個別取り消し）。
- `MessageAudioAttachments.tsx`: バブル内 `<audio controls>` 列（`DisplayAudioAttachment = { audioId, downloadUrl?, label?, durationSeconds? }`）。
- `ChatConversation.tsx`: 画像と並列に音声フック・「音声」ボタン・プレビュー列・Picker Dialog を追加。`onSend` に音声 id と楽観メタを合流。
- `use-chat-conversation.ts`: `send(content, attachmentImageIds?, optimisticImageAttachments?, attachmentAudioIds?, optimisticAudioAttachments?)` 等に拡張（引数設計は Phase 4 で確定）。`AUDIO_UNSUPPORTED_CODE = 'LLM_AUDIO_UNSUPPORTED'` と専用文言。履歴 `buildMessages` で `audioAttachments` を `DisplayAudioAttachment` へ変換。
- `lib/api/chat.ts` / `use-chat-api.ts`: 送信 body に `attachmentAudioIds` を透過。

## 6. エラー / 認可

- 音声非対応 provider への音声付き送信時、バックが返す 422 `LLM_AUDIO_UNSUPPORTED`（`retryable:false`）を `readPreStreamError` 経由で受け、専用文言を `Alert` 表示。添付は保持して付け直し可能（vision 非対応 UX と同型）。
- 認可・所有者制御はバック側（404）。フロントは所有音声のみ一覧に出る前提。

## 7. 既存設計との差分

- 画像添付フロント（TSK-124/125）に対し音声を並列追加。画像コンポーネントの挙動は不変。
- `ChatConversation` と `use-chat-conversation` のみ画像・音声の両方を扱う合流点になる。

## 8. 完了条件（具体化版）

§1 の完了条件に加え:

- [ ] OpenAPI 型再生成後、`schema.d.ts` に `attachmentAudioIds`/`audioAttachments`/`ChatMessageAudioAttachmentDto` が出る。
- [ ] 新規 4 コンポーネント＋既存 4 ファイル改修。画像側コンポーネントは無改変。
- [ ] `cd frontend && pnpm build`・`pnpm lint`（あれば）が通る。
- [ ] `verify.sh all` が通る。

## 9. 手動動作確認シナリオ

実機の音声分析応答は TSK-133。本タスクは UI とビルドで担保。

1. `cd frontend && pnpm build` が通る。
2. 音声添付ボタン → Picker で音声を選択（上限 3）→ プレビュー列に表示・個別取り消し。
3. 送信 → 楽観バブルに音声、確定後に署名 URL で `<audio>` 再生。履歴再表示でも再生可。
4. 音声非対応 provider 設定時、音声付き送信で専用文言が出る。

## 10. 未確定事項

なし（OpenAPI 再生成手順・send シグネチャの細部は Phase 4 のコード調査で確定）。
