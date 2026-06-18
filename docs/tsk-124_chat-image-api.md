# TSK-124 送受信 API の画像添付対応（設計書）

- Notion: <https://app.notion.com/p/3839ca7d99dc815c9701f245aedf42a3>
- プロジェクト: PRJ-17（Petal LLM画像対応）<https://app.notion.com/p/3819ca7d99dc80e7babef670bc6292ae>
- 規模: L / 重要度: HIGH
- 関連: [docs/20_features/09_chat.md](20_features/09_chat.md) / [docs/20_features/04_image-management.md](20_features/04_image-management.md) / [docs/tsk-122_chat-multimodal-persistence.md](tsk-122_chat-multimodal-persistence.md) / [docs/tsk-123_provider-image-vision.md](tsk-123_provider-image-vision.md)

## 1. 課題シート（Notion 転記・フリーズ）

### 一行サマリ

メッセージ送信 API が画像 id 群を受け取り、所有者認可・枚数上限・vision 可否を検証して base64 content を構築し送信フローへ繋ぐ。履歴取得 API が添付画像情報（表示用 URL 等）を返すよう拡張する。

### 背景・動機

PRJ-17 のアプリ／API 層タスク。TSK-①②の上に、エンドポイントで画像添付を受け付け・検証し、生成フロー（SSE）へ繋ぐ。

### 完了条件

- `POST /chat/threads/:id/messages` が画像 id 群を受け取れる（Zod 検証）。
- 添付画像が所有者本人のものか・枚数上限内か・active provider が vision 対応かを検証し、違反は適切なエラー。
- バックエンドが S3 から画像を取得して base64 content を構築し、既存 SSE 送信フローへ渡す。
- 履歴取得 API が各メッセージの添付画像情報（表示用 URL 等）を返す。
- application 層のユニットテストで主要フロー（正常・認可違反・上限超過・非対応 provider）を網羅。`cd backend && pnpm build` が通る。

### スコープ外

- フロント UI（TSK-④）。
- 画像のその場アップロード（PRJ スコープ外）。

### 制約

- 既存のチャット所有者認可（非所有は 404）・画像所有者認可を踏襲。`any` 禁止・Zod 検証。

### 不明点・迷い

解決済み（表示用 URL＝履歴応答に署名付き URL を埋め込む / 上限＝5 枚 / vision 非対応＝422＋code。Phase 3 で確定）。

## 2. スコープ

### 対象

- `SendMessageSchema` / DTO に `attachmentImageIds` を追加（max 5・uuid）。
- 送信前検証（所有者認可・枚数・vision 可否）と base64 content 構築 → 既存 SSE フローへ。
- 履歴取得 API のレスポンスに添付画像情報（署名付き表示 URL・メタ）を追加。
- `S3StorageClient.getObjectBytes` / `ImageService` の base64 取得 / 新 `ChatAttachmentService`。

### 対象外

- 上記「スコープ外」のとおり。

## 3. 設計判断ログ

### 判断 1: 表示用 URL → 履歴応答に署名付きダウンロード URL を埋め込む（採用）

- **採用**: `GET /chat/threads/:id/messages` のレスポンスで、各添付に `downloadUrl`（既存 `S3StorageClient.createDownloadUrl`・TTL 300s）＋ `mimeType` / `originalFilename` / `imageId` / `position` を返す。フロント（TSK-④）は `<img src>` で直接描画でき、タスク記載「表示用 URL を返す」に忠実。
- 却下: image id・メタのみ返しフロントが `GET /images/:id/download-url` を都度叩く（フロントから画像数分の追加リクエストが出る）。
- 補足: presign は履歴ロード毎に添付数分実行されるが、TTL 内の表示用途として許容。

### 判断 2: 添付枚数上限 → 5 枚（採用）

- **採用**: `MAX_ATTACHMENTS = 5`。`SendMessageSchema` の `attachmentImageIds` を `.max(5)` で検証、超過は 400（既存の `safeParse`→`BadRequestException`）。PRJ-17 の「目安 最大 5 枚」に一致。

### 判断 3: vision 非対応時の HTTP → 422 ＋ `LLM_VISION_UNSUPPORTED`（採用）

- **採用**: 送信前に active provider の `supportsVision()`（TSK-②）をチェックし、画像添付ありで非対応なら `HttpException({ code:'LLM_VISION_UNSUPPORTED', message, retryable:false }, 422)` を **pre-stream** で throw。既存フロントの `{code, retryable}` ハンドリングと整合。provider 内部 guard（TSK-②）は backstop。
- 却下: 400（「リクエストは妥当だがこの provider では処理不可」という意味とずれる）。

### 判断 4: S3 からの base64 取得 → `S3StorageClient.getObjectBytes` を追加（採用）

- **採用**: `getObjectBytes(key): Promise<Buffer>`（`GetObjectCommand` → `Body.transformToByteArray()` → `Buffer`）を追加。`ImageService.getOwnedImageBase64(currentUser, id)` が所有者認可 → バイト取得 → `{ mediaType, data(base64) }` を返す。SDK 呼び出しは既存どおり `common/storage` の infra に隔離。
- 却下: 署名付き URL を発行して backend が HTTP GET（余分な往復・presign コスト）。

### 判断 5: 画像解決の責務 → 新 `ChatAttachmentService`（application）（採用）

- **採用**: chat の application に `ChatAttachmentService` を新設し、`ImageService` に依存させる（`ChatModule` が `ImageModule` を import、`ImageModule` は `ImageService` を export）。責務:
  - `assertAttachmentsSendable(currentUser, imageIds, supportsVision)`: 各 id の所有者認可（非所有/不在は `NotFoundException`=404）＋ 画像添付ありで非対応なら 422 throw。
  - `toLlmContent(currentUser, content, attachments)`: 添付無→ content 文字列、添付有→ `ChatContentPart[]`（本文 text part〔空なら省略〕＋ 各画像の base64 image part）。
  - `toAttachmentViews(currentUser, attachments)`: 各添付を表示用 view（imageId/position/mimeType/originalFilename/downloadUrl/expiresInSeconds）へ。
- 却下: `ChatThreadService` / controller に画像解決を混在（責務肥大・テスト性低下）。

### 判断 6: 履歴の画像再送 → 全メッセージの添付を毎回 base64 化して LLM へ（採用）

- **採用**: PRJ-17 の決定（マルチターン文脈維持）に従い、`streamCompletion` の履歴マッピングで添付ありメッセージは `toLlmContent` で base64 parts 化して送る（新規ユーザーメッセージも履歴に含まれるため同経路で処理）。
- 補足: 毎回 S3 取得＋base64 のコストは機能優先で許容（最適化は後続検討・PRJ 未確定事項）。

## 4. データモデル

変更なし（TSK-① の `chat_message_images` を利用）。DB マイグレーション不要。

## 5. API 仕様

### `POST /chat/threads/:id/messages`（拡張）

- リクエスト body: `{ content: string, attachmentImageIds?: string[] }`。
  - `SendMessageSchema`: `content`（1〜32768）＋ `attachmentImageIds: z.array(z.uuid()).max(5).optional()`。
- 送信前検証（pre-stream・ヘッダー未送出で HTTP 応答）:
  - 各 `attachmentImageIds` が所有者本人の画像か → 非所有/不在は **404**。
  - 枚数 > 5 → **400**（Zod）。
  - 画像添付あり & active provider が vision 非対応 → **422**（`LLM_VISION_UNSUPPORTED`）。
  - スレッド非所有 → **404**（既存どおり）。
- 成功時は従来どおり `text/event-stream`（SSE）。ユーザーメッセージは添付付きで永続化（TSK-① seam）。

### `GET /chat/threads/:id/messages`（拡張）

- レスポンス各要素に `attachments: ChatMessageAttachmentDto[]` を追加。
  - `ChatMessageAttachmentDto = { imageId, position, mimeType, originalFilename, downloadUrl, expiresInSeconds }`。
- 既存フィールド（id/threadId/seq/role/content/日時）は不変。

他エンドポイント（POST threads / PATCH / GET threads / DELETE）は変更なし。

## 6. 送信フロー（`ChatCompletionService.streamCompletion` 改修）

1. `attachmentService.assertAttachmentsSendable(currentUser, input.attachmentImageIds ?? [], chatService.supportsVision())`（所有者認可・vision 検証。pre-stream）。
2. `threadService.addMessage(currentUser, threadId, { role:'user', content, attachmentImageIds })`（添付付き永続化）。非所有は `NotFoundException`。
3. `history = threadService.findMessages(...)`。
4. 各 history メッセージを `await attachmentService.toLlmContent(currentUser, m.content, m.attachments)` で `string | ChatContentPart[]` 化し `messages` を構築。
5. `chatService.generateStream({ messages })` を従来どおりストリーム（delta/done/error・部分保存・切断処理は不変）。

- `ChatService` に `supportsVision(): boolean`（provider 委譲）を追加。

## 7. 既存設計との差分

- application
  - `chat.schemas.ts`: `SendMessageSchema` に `attachmentImageIds`、`MAX_ATTACHMENTS=5`。
  - `chat-attachment.service.ts`（新規）: `ChatAttachmentService`（assert / toLlmContent / toAttachmentViews）。
  - `chat.service.ts`: `supportsVision()` 追加。
  - `chat-completion.service.ts`: 送信前検証・添付付き addMessage・履歴の base64 化。
- controller
  - `chat.dto.ts`: `SendMessageRequestDto.attachmentImageIds?`、`ChatMessageAttachmentDto`、`ChatMessageResponseDto.attachments`。
  - `chat.controller.ts`: GET messages で添付 view を解決して DTO へ。
- image
  - `image.service.ts`: `getOwnedImageBase64(currentUser, id)` 追加。
  - `common/storage/s3.client.ts`: `getObjectBytes(key)` 追加。
  - `image.module.ts`: `ImageService` を `exports` に追加。
- chat module
  - `chat.module.ts`: `ImageModule` を imports、`ChatAttachmentService` を providers。
- application のエラー: 検証エラーは Nest 例外（404/400/422）を pre-stream で投げる。`classifyLlmError` は変更しない（上流生成エラー専用のまま）。
- ドキュメント: `docs/20_features/09_chat.md` への反映は TSK-⑤（仕上げ）に委ねる。

## 8. トランザクション境界

- 送信時のユーザーメッセージ＋添付保存は TSK-① の `addMessage` Tx を踏襲。本タスクで新規 Tx は追加しない。
- S3 取得・presign は読み取り副作用のみ。

## 9. セキュリティ

- 添付・表示はすべて所有者本人の画像に限定（`ImageService.findOneForOwner`）。非所有・不在は存在秘匿で 404。
- エラーに接続先 URL・キー等の秘密情報を含めない（TSK-② 方針踏襲）。
- base64・署名付き URL はいずれも所有者本人にのみ返す。

## 10. 完了条件（具体化版）

- [ ] `POST /chat/threads/:id/messages` が `attachmentImageIds`（max 5・uuid）を受け取り Zod 検証する。
- [ ] 非所有画像→404 / 枚数超過→400 / 画像付き×vision 非対応→422（`LLM_VISION_UNSUPPORTED`）/ 非所有スレッド→404。
- [ ] 添付ありメッセージが添付付きで永続化され、S3 から base64 化されて LLM へ送られる（履歴の過去添付も再送）。
- [ ] `GET /chat/threads/:id/messages` が各メッセージの `attachments`（imageId/position/mimeType/originalFilename/downloadUrl/expiresInSeconds）を返す。
- [ ] application 層テストで 正常・認可違反(404)・上限超過(400)・vision 非対応(422) を網羅。
- [ ] `cd backend && pnpm lint && pnpm test && pnpm build` が通る。

## 11. 未確定事項

なし（Phase 2・3 ですべて解決）。履歴再送のトークン/転送量最適化は PRJ 後続検討。

---

## 12. 実装計画（Phase 4）

### 12.1 変更・追加ファイル

#### コミット 1: 画像 base64 取得・添付解決サービス（土台）

- `backend/src/common/storage/s3.client.ts`（変更）: `getObjectBytes(key): Promise<Uint8Array>` を追加（`GetObjectCommand`→`Body.transformToByteArray()`。`Body` 不在は明確な Error）。
- `backend/src/image/application/image.service.ts`（変更）: `getOwnedImageBase64(currentUser, id): Promise<{ mediaType: ImageMimeType; data: string }>`（findOneForOwner→getObjectBytes→base64）、`getOwnedImageView(currentUser, id): Promise<{ imageId; mimeType; originalFilename; downloadUrl; expiresInSeconds }>`（findOneForOwner→createDownloadUrl）を追加。
- `backend/src/image/image.module.ts`（変更）: `exports: [ImageService]` を追加。
- `backend/src/chat/application/chat.service.ts`（変更）: `supportsVision(): boolean { return this.provider.supportsVision(); }`。
- `backend/src/chat/application/chat-attachment.service.ts`（新規）: `ChatAttachmentService`（`@Injectable`、`ImageService` 注入）:
  - `assertAttachmentsSendable(currentUser, imageIds: string[], supportsVision: boolean): Promise<void>` — `imageIds` 空なら no-op。非対応なら `HttpException({code:'LLM_VISION_UNSUPPORTED', message, retryable:false}, HttpStatus.UNPROCESSABLE_ENTITY)`。各 id を `imageService.findOneForOwner`（非所有/不在は NotFound=404）。
  - `toLlmContent(currentUser, content: string, attachments: ChatMessageImageRef[]): Promise<string | ChatContentPart[]>` — 添付無→content、添付有→`[{type:'text',text:content}]`＋position 順に `{type:'image', ...getOwnedImageBase64}`。
  - `toAttachmentViews(currentUser, attachments): Promise<ChatMessageAttachmentView[]>` — position 順に `getOwnedImageView` ＋ position。
- `backend/src/chat/chat.module.ts`（変更）: `imports` に `ImageModule`、`providers` に `ChatAttachmentService`。
- テスト:
  - `backend/src/chat/application/chat-attachment.service.spec.ts`（新規）: assert（空→no-op / 非対応→422 / 非所有→404）、toLlmContent（添付無→string / 添付有→text＋image parts・base64・position 順）、toAttachmentViews（downloadUrl/メタ）。ImageService はモック。
  - `backend/src/chat/application/chat.service.spec.ts`（変更）: `supportsVision` 委譲を追加（モック provider に `supportsVision`）。
- 完了確認: `cd backend && pnpm lint && pnpm test && pnpm build`。

#### コミット 2: 送受信 API の画像添付対応

- `backend/src/chat/application/chat.schemas.ts`（変更）: `MAX_ATTACHMENTS = 5`、`SendMessageSchema` に `attachmentImageIds: z.array(z.uuid()).max(MAX_ATTACHMENTS).optional()`。
- `backend/src/chat/application/chat-completion.service.ts`（変更）: `ChatAttachmentService` を注入。`streamCompletion` 冒頭で `assertAttachmentsSendable(currentUser, input.attachmentImageIds ?? [], this.chatService.supportsVision())`（pre-stream）。`addMessage` に `attachmentImageIds` を渡す。履歴 `messages` を `await attachmentService.toLlmContent(...)` で構築（`Promise.all`）。
- `backend/src/chat/controller/chat.dto.ts`（変更）: `SendMessageRequestDto.attachmentImageIds?: string[]`、`ChatMessageAttachmentDto`、`ChatMessageResponseDto.attachments: ChatMessageAttachmentDto[]`。
- `backend/src/chat/controller/chat.controller.ts`（変更）: `ChatAttachmentService` 注入。`findMessages` で各メッセージの `attachments` を `toAttachmentViews` で解決し DTO へ（`Promise.all`）。
- `backend/openapi.json`（再生成）: `pnpm openapi:export`。
- テスト:
  - `backend/src/chat/application/chat-completion.service.spec.ts`（変更）: `ChatAttachmentService` モックを追加。送信前 assert が addMessage より前に呼ばれる / assert が 422・404 を投げると pre-stream で伝播 / addMessage に attachmentImageIds が渡る / 履歴 content が toLlmContent 経由で構築される、を網羅。
- 完了確認: `cd backend && pnpm lint && pnpm test && pnpm build`。

### 12.2 migration・環境変数・依存追加

- migration: **不要**（TSK-① の `chat_message_images` を利用）。
- 環境変数: **不要**。
- 依存追加: **不要**（`@aws-sdk/client-s3` の `GetObjectCommand` は既存）。
- openapi: `openapi.json` を再生成・コミット（frontend の `schema.d.ts` 再生成は TSK-④）。

### 12.3 実装方針メモ（確定仕様）

- `assertAttachmentsSendable`: vision チェック（I/O なし）を先に行い fail fast、その後に各 id の所有者認可。
- `toLlmContent`: `content` は SendMessageSchema で min(1) 保証のため text part は常に先頭に入れる。image part は `position` 昇順。
- base64 は `Buffer.from(bytes).toString('base64')`。`ChatImagePart.mediaType` は `Image.mimeType`（enum: image/jpeg|png|gif|webp）をそのまま使用（型整合）。
- 検証エラー（404/400/422）は **pre-stream**（addMessage 前・try 前）で Nest 例外として投げる。controller の最初の `gen.next()` で例外フィルタが正しいステータスを返す。`classifyLlmError` は変更しない。
- 履歴の base64 化は全添付ありメッセージに対して毎回実行（PRJ 文脈維持・判断 6）。

### 12.4 作業順序（コミット単位・各完了確認）

1. **`feat(tsk-124): 画像 base64 取得と添付解決サービスを追加`** — §12.1 コミット 1。完了確認: backend lint/test/build。
2. **`feat(tsk-124): 送受信 API の画像添付対応を実装`** — §12.1 コミット 2（openapi.json 再生成含む）。完了確認: backend lint/test/build、`openapi.json` に `attachmentImageIds`/`attachments` が出力。

### 12.5 テスト方針

- application 層をユニットテストで担保（既存方針）。`ChatAttachmentService`（ImageService モック）と `ChatCompletionService`（ChatAttachmentService/ChatService/ChatThreadService モック）を分離してテスト。
- S3・ImageService の実 I/O は infra であり、既存どおり単体テスト対象外（モックで担保、実通信は手動）。

### 12.6 想定外時の判断ルール

- **AI 単独判断 OK**: SDK の Body→bytes 変換の細部、命名・型 cast の微調整、設計書スコープ内の追加実装。
- **中断して要相談**:
  - 表示用 URL 方式・上限枚数・vision エラー方針（判断 1〜3）を覆す必要。
  - `classifyLlmError`／provider／永続スキーマ／ドメイン content 型の変更が必要と判明（TSK-①②越境）。
  - フロント変更が必要と判明（TSK-④越境）。
  - `ImageService` への依存方向がオニオン違反になる場合。

### 12.7 事前解決済みの判断ポイント

- 表示用 URL → 履歴応答に署名付き downloadUrl＋メタを埋め込む（判断 1）。
- 上限枚数 → 5（判断 2）。
- vision 非対応 → 422＋`LLM_VISION_UNSUPPORTED`、送信前チェック（判断 3）。
- base64 取得 → `S3StorageClient.getObjectBytes`＋`ImageService.getOwnedImageBase64`（判断 4）。
- 画像解決の責務 → 新 `ChatAttachmentService`、`ImageModule` を import・`ImageService` を export（判断 5）。
- 履歴再送 → 全添付を毎回 base64 化（判断 6）。
- 検証順 → vision（fail fast）→ 所有者認可。
- openapi.json → 本タスクで再生成（frontend 再生成は TSK-④）。
- `classifyLlmError`/provider/スキーマ/content 型/フロント → 非変更。

## 13. 手動動作確認シナリオ

1. 自分の画像 id を `attachmentImageIds` に入れて送信 → 画像が base64 化され LLM へ送られ、ユーザーメッセージが添付付きで保存される。
2. 他人の画像 id を送る → 404。6 枚送る → 400。
3. `LLM_PROVIDER=local`（vision 非対応）で画像付き送信 → 422（`LLM_VISION_UNSUPPORTED`）、メッセージ未保存。
4. `GET /chat/threads/:id/messages` で各メッセージに `attachments`（downloadUrl・mimeType・originalFilename・position）が返る。
5. 同一スレッドで続けて送信 → 過去の添付画像も base64 で再送され文脈が維持される。
6. テキストのみ送信（attachmentImageIds 無し）→ 従来どおり動作（後方互換）。
