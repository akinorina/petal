# TSK-125 フロントの画像添付 UI と会話表示（設計書）

- Notion: <https://app.notion.com/p/3839ca7d99dc810b85bedb504dd408de>
- プロジェクト: PRJ-17（Petal LLM画像対応）<https://app.notion.com/p/3819ca7d99dc80e7babef670bc6292ae>
- 規模: L / 重要度: HIGH
- 関連: [docs/20_features/09_chat.md](20_features/09_chat.md) / [docs/20_features/04_image-management.md](20_features/04_image-management.md) / [docs/tsk-124_chat-image-api.md](tsk-124_chat-image-api.md) / [docs/tsk-122_chat-multimodal-persistence.md](tsk-122_chat-multimodal-persistence.md) / [docs/tsk-123_provider-image-vision.md](tsk-123_provider-image-vision.md)

## 1. 課題シート（Notion 転記・フリーズ）

### 一行サマリ

`<ChatPanel>` 入力欄に所有ライブラリ画像の選択・プレビュー・取り消し UI を追加して送信時に image id を付与し、会話表示でユーザーメッセージの添付画像を表示する。

### 背景・動機

PRJ-17 のフロントタスク。既存ライブラリ（petal.images）から画像を選んで添付し、会話に画像を表示できるようにする。先行 TSK-124（送受信 API の画像添付対応）はマージ済みで、`attachmentImageIds`（最大 5）受付と履歴応答の `attachments`（署名付き `downloadUrl` 等）はバック側に実装済み。

### 完了条件

- [ ] 入力欄から所有ライブラリ画像を選択・プレビュー・取り消しでき、送信時に image id が付与される。
- [ ] 会話表示でユーザーメッセージの添付画像サムネイル／プレビューが表示され、履歴再表示でも表示される。
- [ ] vision 非対応 provider 利用時は添付不可／エラーを UX 上わかりやすく提示。
- [ ] ページは View に専念しステート／副作用は同居フックへ切り出す（frontend-architecture 準拠）。
- [ ] `cd frontend && pnpm build` が通る。

### スコープ外

- チャット画面でのその場アップロード（PRJ スコープ外）。
- バックエンド API（TSK-124・実装済み）。
- vision 対応可否をフロントで事前取得して添付ボタンを無効化する仕組み（バック API 追加が前提で本 TSK 範囲外）。

### 制約

- 秘密情報を `NEXT_PUBLIC_*` に置かない。design-system／既存 chat 部品（`components/chat/`）の構成・命名に揃える。

### 不明点・迷い

解決済み（添付選択 UI＝Dialog 選択＋入力欄上プレビュー / vision 非対応＝送信時 422 を専用メッセージ表示。Phase 3 で確定）。

## 2. スコープ

### 対象

- `components/chat/` への画像添付 UI 追加（入力欄の添付ボタン・選択 Dialog・入力欄上プレビュー列・取り消し）。
- 会話表示（ユーザーメッセージバブル）への添付サムネイル表示＋クリック原寸プレビュー。
- 送信フロー（`use-chat-conversation.ts` / `lib/api/chat.ts`）への `attachmentImageIds` 付与。
- 添付選択 state／ライブラリ取得を担う同居フック `use-image-attachment.ts` の新設。
- `LLM_VISION_UNSUPPORTED`（422）の UX 表示。
- フロント OpenAPI 型 `schema.d.ts` の再生成（バック `openapi.json` の新フィールド取り込み）。

### 対象外

- 上記「スコープ外」のとおり。

## 3. 設計判断ログ

### 判断 1: 添付選択 UI → Dialog 選択 + 入力欄上プレビュー（採用）

- **採用**: 入力欄に「画像」ボタンを置き、押下で design-system の `Dialog` にライブラリ一覧をグリッド表示。複数選択（最大 5）して確定すると、入力欄上にプレビューサムネイル列を表示し、各サムネイルの「×」で個別取り消し。
- **理由**: 選択（Dialog）と現在の添付状態（プレビュー列）を責務分離でき、多数の所有画像一覧にも耐える。既存 `Dialog`／`Button` を再利用でき、シートの「入力欄に追加」という意図に忠実。
- 却下: Popover インライン選択（一覧が狭く多数画像に不向き、結局プレビュー併用が必要）／全画面ドロワー（オーバースペックでシート意図から離れる）。

### 判断 2: vision 非対応 provider の UX → 送信時 422 を専用メッセージ表示（採用）

- **採用**: 画像付き送信時にバックが返す `422 LLM_VISION_UNSUPPORTED`（`retryable:false`）を、`streamChatMessage` の `readPreStreamError()` 経由で受け、専用の分かりやすいメッセージで `Alert` 表示。添付内容は保持して付け直し（provider 切替後の再送）を可能にする。
- **理由**: フロントには provider の vision 対応可否を取得する経路が現状なく、事前判定にはバック API 追加（本 TSK 範囲外）が必要。送信時エラー表示は新規 API 不要でスコープ内に収まる。
- 却下: 事前に添付ボタンを無効化（バック API 追加が前提）／両方（同上）。

### 判断 3: 会話表示 → バブル内サムネ + クリックで原寸プレビュー（採用）

- **採用**: ユーザーメッセージバブル内に `attachments` をサムネイル列で表示し、クリックで `Dialog` 原寸プレビュー。履歴再表示時は `GET /messages` が返す各添付の署名付き `downloadUrl` をそのまま `<img src>` に使う（追加リクエスト不要）。
- **理由**: TSK-124 がメッセージごとに署名付き `downloadUrl`＋メタを返す設計のため、履歴表示はレスポンスのみで完結する。
- 却下: サムネのみ（原寸確認ができず UX が劣る）。

### 判断 4: 添付選択 state／副作用の置き場所 → 専用フック `use-image-attachment.ts`（採用）

- **採用**: 選択中の image id／ライブラリ取得（`useImagesApi`）／add・remove・clear・上限制御を専用フックに集約し、`ChatConversation`（View）はそれを使うだけにする。`send` は `(content, imageIds)` に拡張。
- **理由**: 完了条件「View 専念・state は同居フックへ」と既存命名規則（`use-{component}.ts`）に合致。送信責務（`useChatConversation`）と選択責務を分離して肥大化を防ぐ。
- 却下: `useChatConversation` に統合（送信と選択が混在し肥大化）／`ChatConversation` 内 `useState`（frontend-architecture 違反）。

### 判断 5: ライブラリ画像／プレビューのサムネイル URL → `useImageDownloadApi` で都度取得（採用）

- **採用**: `ImageResponseDto`（一覧）は URL を含まないため、選択 Dialog・入力欄プレビュー・楽観バブルのサムネイルは既存 `useImageDownloadApi().getDownloadUrl(id)` を画像ごとに取得する（`images/page.tsx` のサムネイル取得パターンを踏襲）。会話履歴の添付は `attachments[].downloadUrl` を直接使うため取得不要。
- **理由**: 既存の画像表示と整合し、署名付き URL の取得経路を一本化できる。
- 却下: 一覧 DTO に URL を持たせる（バック変更が必要で範囲外）。

## 4. 実装方針（モジュール構成）

### 4.1 型再生成

- バック `backend/openapi.json` には `SendMessageRequestDto.attachmentImageIds` と `ChatMessageResponseDto.attachments`（`ChatMessageAttachmentDto`）が既に存在。フロント `src/lib/openapi/schema.d.ts` は未反映のため `cd frontend && pnpm openapi:gen` で再生成する。

### 4.2 新規 `components/chat/use-image-attachment.ts`

- 責務: 添付選択 state（`selectedIds: string[]`）、ライブラリ一覧（`useImagesApi`）、Dialog 開閉、`add/remove/toggle/clear`、上限（`MAX_ATTACHMENTS = 5`）制御。
- 返却: `selectedIds`, `selectedImages`（メタ）, `images`, `isLoading`, `error`, `isPickerOpen`, `openPicker`, `closePicker`, `toggle`, `remove`, `clear`, `canAddMore`。

### 4.3 新規プレゼンテーション部品

- `ImageAttachmentPicker.tsx`: `Dialog` 内のライブラリグリッド＋複数選択（上限到達時の抑制）。
- `AttachmentPreviewList.tsx`: 入力欄上の選択中サムネ列＋「×」取り消し。
- `MessageAttachments.tsx`: バブル内サムネ列＋クリックで `Dialog` 原寸プレビュー。
- サムネイル URL 取得は `images/page.tsx` のパターンを小コンポーネント（例 `ImageThumb`）として共通化し、選択 Dialog・プレビュー・楽観バブルで再利用。

### 4.4 既存改修

- `lib/api/chat.ts`: `streamChatMessage` / `sendRequest` に `attachmentImageIds?: string[]` を追加し body に含める。
- `use-chat-conversation.ts`:
  - `OptimisticMessage` に `attachments?`（表示用）を追加。
  - `send(content, attachmentImageIds, optimisticAttachments)` に拡張。`actions.streamMessage` へ image ids を渡す。
  - `buildMessages` でサーバ確定メッセージの `attachments` を保持して描画用に渡す。
  - 楽観バブルは選択中画像のローカル情報でサムネ表示。
- `use-chat-api.ts`（`useChatActionsApi.streamMessage`）: `attachmentImageIds` を透過。
- `ChatConversation.tsx`: `use-image-attachment` を使い、添付ボタン／プレビュー列／選択 Dialog を配置。`handleSend` で `content` と `selectedIds` を送信し送信後 `clear()`。ユーザーバブルに `MessageAttachments` を描画。vision 422 を専用文言で表示。
- `ChatPanel`/`use-chat-panel.ts`: 既存 props 配線は維持（必要に応じ `send` シグネチャ変更を伝播）。

## 5. 動作確認シナリオ（受け入れ）

1. 入力欄の「画像」ボタン→Dialog でライブラリ画像を複数選択→入力欄上にプレビュー、各「×」で取り消し。上限 5 を超えて選べない。
2. テキスト＋画像で送信→ユーザーバブルにテキストとサムネが出る。サムネクリックで原寸プレビュー。送信後は選択がクリアされる。
3. 別スレッドへ移動して戻る／リロードで履歴を再取得→添付サムネが再表示される。
4. vision 非対応 provider で画像付き送信→専用メッセージの Alert が出て、添付は保持され付け直せる。
5. `cd frontend && pnpm build` が通る（型再生成込み）。

## 6. 想定外時のルール

- 設計と既存実装が食い違う／本書で判断が付かない場合は、勝手に進めず作業を止めて差分を報告する（破壊的操作・独断進行の禁止）。
- バック挙動（エラーコード・レスポンス形）が本書記載と異なる場合は実装を止めて報告する。

## 7. 実装計画

（Phase 4 で追記）
