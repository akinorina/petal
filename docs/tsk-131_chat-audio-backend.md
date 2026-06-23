# TSK-131 チャットの音声マルチモーダル送信（バックエンド）（設計書）

- Notion: <https://app.notion.com/p/3889ca7d99dc81deb3b5f6066d0ec007>
- プロジェクト: PRJ-18（Petal LLM音声対応）<https://app.notion.com/p/3819ca7d99dc80bebbd8ed9118b7703f>
- 規模: L / 重要度: HIGH
- 関連: [docs/20_features/09_chat.md](20_features/09_chat.md) / [docs/20_features/10_audio-management.md](20_features/10_audio-management.md) / [docs/tsk-130_audio-chat-methods.md](tsk-130_audio-chat-methods.md) / 画像版の先行タスク tsk-122〜126

## 1. 課題シート（Notion 転記・フリーズ）

### 一行サマリ

チャットに音声添付をネイティブ送信するバックエンド実装。`ChatContentPart` に audio part を追加し、音声添付テーブル・provider 別 mapping・音声対応判定・422 fail-fast・認可を画像添付と同型で実装する。

### 背景・動機

PRJ-18 の中核。音声を文字起こしせず audio content part として base64 で LLM へ直接渡す。画像添付（TSK-122〜126）の `chat-attachment.service.ts` / `llm-message.ts` / provider clients を流用・汎化する。前提の音声ライブラリは TSK-130 で `AudioService.getOwnedAudioBase64` / `getOwnedAudioView` を追加済み。

### 完了条件

- [ ] `ChatContentPart` に audio part（type/mediaType/data(base64)）を追加し、`hasAudioContent` が動く。
- [ ] `chat_message_images` と同型の音声添付テーブル（message_id / audio_id / position）を追加し、順序付きで永続化する。
- [ ] `SendMessageSchema` に音声添付 ID を追加（最大 3 件/メッセージ）し Zod 検証する。
- [ ] provider 別 `supportsAudio()` 判定を追加。対応 provider の mapping（base64 → 各 SDK の音声入力形式）を実装する。
- [ ] 音声非対応 provider 選択時は pre-stream で 422 fail-fast（専用エラーコード）。所有者認可（404）が効く。
- [ ] 過去メッセージの音声添付も毎回 LLM へ再送し文脈を維持する。
- [ ] domain / application / infra の各層にテストがある。

### スコープ外

- フロント UI（TSK-132）。
- 実機での音声分析検証（TSK-133）。
- Claude（Anthropic）での音声対応（API 非対応のため対象外、422 で弾く側）。
- 音声の形式変換・トランスコード（録音形式をそのまま送る。形式別適合は TSK-133 で検証）。

### 制約

- `LLM_PROVIDER` による provider 切替可能なまま実装する（特定 provider に固定しない）。
- 画像添付の content mapping / pre-stream validation / 多層防御パターンを踏襲する。

### 不明点・迷い

解決済み（テーブルは新規 `chat_message_audios`／provider は vision と同枠で全 provider に mapping 実装／形式ギャップは全形式そのまま送り TSK-133 で検証。Phase 3 で確定）。

## 2. スコープ

### 対象（既存構造への対称追加）

- domain: `ChatContentPart` への audio part 追加、`hasAudioContent`、`ChatMessageAudioRef`、`ChatMessage.audioAttachments`、`AudioUnsupportedError`、`LlmProvider.supportsAudio()`。
- application: `chat.schemas`／`chat-thread.schemas` への `attachmentAudioIds`、`ChatAttachmentService` の音声対応（検証・base64 化・view 化）、`ChatService.supportsAudio()`、`ChatThreadService.addMessage` の音声採番、`ChatCompletionService` の合流。
- infra: provider clients 3 種の audio 変換分岐＋`supportsAudio()`、`llm.config` の `supportsAudio` フラグ、`ChatMessageAudioEntity`、リポジトリの保存/取得/削除、migration。
- controller/dto: `SendMessageRequestDto` の `attachmentAudioIds`、メッセージ応答の `audioAttachments`。
- `.env.example`（OPENAI_AUDIO / LOCALLLM_AUDIO 追記）。

### 対象外

- 上記「スコープ外」のとおり。

## 3. 設計判断ログ

### 判断 1: 添付参照は新規 `chat_message_audios` テーブル（採用）

- **採用**: `chat_message_images` と対称な独立テーブル（message_id / audio_id / position / 論理削除）を新設。
- **理由**: 課題シートの「同型追加」に忠実。既存画像テーブル・データ・migration・画像側コードに一切触れず、リスクを局所化できる。
- 却下: `chat_message_attachments` への汎用化リファクタ（既存 entity・migration・リポジトリ・画像側コードの大幅改変が必要でスコープ超過）。

### 判断 2: provider 対応は vision と同枠（採用）

- **採用**: `LlmProvider.supportsAudio()` を追加。Claude=false 固定 / Gemini=true 固定 / OpenAI・Local=env（`OPENAI_AUDIO`・`LOCALLLM_AUDIO`、既定 false）。全 client に audio 変換分岐を実装し、`LLM_PROVIDER` 切替可能なまま。
- **理由**: 既存 vision の多層防御（pre-stream 422 ＋ client 内 guard）と完全対称にでき、設計・テストを最小の差分で揃えられる。
- 却下: Gemini のみ実装（他 provider を後回しにすると非対称になり、provider 切替時の挙動が不明瞭）。

### 判断 3: 形式ギャップは全形式そのまま送る（採用）

- **採用**: mapping は録音形式（webm/mp4 含む）を変換せずそのまま渡す。Gemini は `inlineData.mimeType` に `mediaType` をそのまま、OpenAI は `mediaType` から `format`（mp3/wav/webm/mp4/ogg）を導出して `input_audio.format` に渡す（SDK 型へキャスト。画像の `media_type as ...` と同方針）。provider が非対応形式を拒否した場合はそのエラーを伝搬。
- **理由**: 形式別適合は実機依存で、検証は TSK-133 の役割。本タスクは「通過のみ」とし、形式判定を持ち込まない（画像 mapping と同じ「形式検証は別タスク」方針）。
- 却下: provider 受入形式のみ許可して送信前に弾く（provider 別対応形式表の保守が必要でスコープ超過）。

### 判断 4: ChatMessage は `audioAttachments` を別フィールドで持つ（採用）

- **採用**: 既存 `attachments`（画像）はそのまま、`audioAttachments: ChatMessageAudioRef[]` を追加する。
- **理由**: 既存 `attachments` のリネームは 6 箇所以上に波及。別フィールド追加なら画像側コードを変えずに済む。命名の非対称は許容しコメントで明示。
- 却下: `attachments` を `imageAttachments` へリネーム（churn 大）／画像・音声を 1 配列に統合（type 判別が必要で複雑化）。

## 4. データモデル

### 新規テーブル `petal.chat_message_audios`（`chat_message_images` と対称）

| カラム | 型 | 制約 |
| --- | --- | --- |
| id | UUID | PK, default gen_random_uuid() |
| message_id | UUID | NOT NULL, FK → chat_messages(id) ON DELETE RESTRICT |
| audio_id | UUID | NOT NULL, FK → audios(id) ON DELETE RESTRICT |
| position | INT | NOT NULL |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT NOW() |
| updated_at | TIMESTAMPTZ | NOT NULL DEFAULT NOW() |
| deleted_at | TIMESTAMPTZ | NULL（論理削除） |

- UNIQUE (message_id, position) / INDEX (message_id)。
- migration: `database/migrations/1746144009000-CreateChatMessageAudios.ts`（`1746144008000` の直後）。

### ドメイン型

```ts
// domain/chat-message.ts
export const ChatMessageAudioRefSchema = z.object({
  audioId: z.uuid(),
  position: z.number().int().nonnegative(),
});
export type ChatMessageAudioRef = z.infer<typeof ChatMessageAudioRefSchema>;
// ChatMessageSchema に追加:
//   audioAttachments: z.array(ChatMessageAudioRefSchema).default([]),
// ChatMessage クラスに readonly audioAttachments: ChatMessageAudioRef[] を追加。

// domain/llm-message.ts
export const ChatAudioPartSchema = z.object({
  type: z.literal('audio'),
  mediaType: z.string().min(1),
  data: z.string().min(1),
});
// discriminatedUnion に ChatAudioPartSchema を追加。
export function hasAudioContent(messages: { content: string | ChatContentPart[] }[]): boolean
//   image 版と同型で type === 'audio' を判定。
```

## 5. API 仕様

### 入力（変更）

- `POST /chat/threads/:id/messages` リクエストボディに `attachmentAudioIds?: string[]`（最大 3）を追加。
  - `chat.schemas.ts`: `MAX_AUDIO_ATTACHMENTS = 3`、`SendMessageSchema` に `attachmentAudioIds: z.array(z.uuid()).max(MAX_AUDIO_ATTACHMENTS).optional()`。
  - `chat-thread.schemas.ts`: `AddMessageInputSchema` に `attachmentAudioIds: z.array(z.uuid()).optional()`。

### 出力（変更）

- `GET /chat/threads/:id/messages` の各メッセージに `audioAttachments: ChatMessageAudioAttachmentDto[]` を追加（画像の `attachments` と並列）。
  - DTO: `{ audioId, position, mimeType(AudioMimeType), originalFilename, downloadUrl, expiresInSeconds }`。

### エラー

- 音声非対応 provider に音声付き送信 → pre-stream で **422 `LLM_AUDIO_UNSUPPORTED`**（`retryable:false`）。`LLM_VISION_UNSUPPORTED` と対称。
- 非所有/不在 audio_id → 404（`AudioService.findOneForOwner` 伝播）。

## 6. トランザクション境界

- `ChatThreadRepositoryImpl.addMessage`: 既存トランザクション内で、message 保存後に画像添付行・**音声添付行**を保存（全成功 or 全ロールバック）。外部 API 副作用なし（純 DB）。
- `softDeleteThread`: 既存トランザクションに音声添付行の論理削除を追加（画像と同様、メッセージより先に落とす）。

## 7. provider 別 mapping（infra）

### `LlmProvider` I/F（domain/llm-provider.ts）

`supportsAudio(): boolean` を追加。

### claude.client.ts

- `supportsAudio(): boolean { return false; }`
- `toClaudeContent`: audio part は到達しない想定だが、型安全のため明示分岐し `AudioUnsupportedError('Claude')` を throw（防御）。image 分岐は現状維持。
- `generateStream` の先頭 guard に `if (!this.supportsAudio() && hasAudioContent(input.messages)) throw new AudioUnsupportedError('Claude');` を追加。

### gemini.client.ts

- `supportsAudio(): boolean { return true; }`
- `toGeminiParts`: audio part → `{ inlineData: { mimeType: part.mediaType, data: part.data } }`（image と同形）。`type` で分岐。
- guard 追加（true のため発火しないが対称性のため記述しても良い。最小化のため省略可）。

### openai-compatible.client.ts

- `supportsAudio(): boolean { return this.config.supportsAudio; }`
- `toOpenAiContent`: audio part → `{ type: 'input_audio', input_audio: { data: part.data, format: mediaTypeToOpenAiAudioFormat(part.mediaType) } }`（`format` は SDK 型 `'wav'|'mp3'` へキャスト）。
  - ヘルパー `mediaTypeToOpenAiAudioFormat(mediaType)`: `audio/mpeg`→`'mp3'`、それ以外は `audio/` を除いた subtype（`wav`/`webm`/`mp4`/`ogg`）。
  - audio part は user role のみ（既存の user 限定分岐に乗る）。
- `generateStream` の先頭 guard に audio guard を追加。

### llm.config.ts

- `LlmEnvSchema` に `OPENAI_AUDIO: BooleanishSchema`、`LOCALLLM_AUDIO: BooleanishSchema` を追加。
- `OpenAiCompatConfig` に `supportsAudio: boolean` を追加。
- `openaiConfig.supportsAudio = this.env.OPENAI_AUDIO ?? false`、`localConfig.supportsAudio = this.env.LOCALLLM_AUDIO ?? false`。
- コンストラクタの env パースに `OPENAI_AUDIO` / `LOCALLLM_AUDIO` の取り込みを追加。

## 8. application 層の合流

### ChatAttachmentService（chat-attachment.service.ts）

- コンストラクタに `AudioService` を追加注入。
- `assertAttachmentsSendable(currentUser, imageIds, audioIds, supportsVision, supportsAudio)` に拡張:
  - `imageIds.length>0 && !supportsVision` → 422 `LLM_VISION_UNSUPPORTED`（既存）。
  - `audioIds.length>0 && !supportsAudio` → 422 `LLM_AUDIO_UNSUPPORTED`（追加）。
  - 各 imageId を `imageService.findOneForOwner`、各 audioId を `audioService.findOneForOwner` で認可。
- `toLlmContent(currentUser, content, imageAttachments, audioAttachments)` に拡張: parts = `[text, ...画像(position 昇順), ...音声(position 昇順)]`。音声 part は `audioService.getOwnedAudioBase64` の `{mediaType,data}` を `{type:'audio',...}` に。添付が両方空なら従来どおり文字列を返す。
- `toAudioAttachmentViews(currentUser, audioAttachments)` を追加（`toAttachmentViews` と対称、`audioService.getOwnedAudioView` 由来）。

### ChatService（chat.service.ts）

- `supportsAudio(): boolean { return this.provider.supportsAudio(); }` を追加。

### ChatThreadService（chat-thread.service.ts）

- `addMessage`: `input.attachmentAudioIds` を position 採番し `audioAttachments` として `ChatMessage` に渡す。

### ChatCompletionService（chat-completion.service.ts）

- `assertAttachmentsSendable` 呼び出しに `input.attachmentAudioIds ?? []` と `this.chatService.supportsAudio()` を追加。
- `addMessage` 呼び出しに `attachmentAudioIds: input.attachmentAudioIds` を追加。
- 履歴 → LLM 変換の `toLlmContent` 呼び出しに `message.audioAttachments` を追加。

### controller / dto

- `SendMessageRequestDto` に `attachmentAudioIds?: string[]`。
- `chat.dto.ts` に `ChatMessageAudioAttachmentDto`、`ChatMessageResponseDto` に `audioAttachments` を追加。
- `chat.controller.ts` の `findMessages` で `audioAttachments: await this.attachmentService.toAudioAttachmentViews(currentUser, message.audioAttachments)` を付与。

### chat.module.ts / リポジトリ

- `TypeOrmModule.forFeature` に `ChatMessageAudioEntity` を追加。
- `ChatThreadRepositoryImpl`: `ChatMessageAudioEntity` repo を注入。`findMessages` で音声行も `In(messageIds)` で一括取得（N+1 回避）し `toMessageDomain` に渡す。`addMessage` で音声行を保存。`softDeleteThread` で音声行を論理削除。`toMessageDomain(entity, imageAttachments, audioAttachments)` に拡張。
- `ImageModule` と同様、`ChatModule` の imports に `AudioModule` を追加（`AudioService` を使うため）。`AudioModule` が `AudioService` を export 済みであることを確認（未 export なら exports に追加）。

## 9. 既存設計との差分

- 画像マルチモーダル（text/image part・`chat_message_images`・vision 判定・`LLM_VISION_UNSUPPORTED`）に対し、音声を完全対称に追加する。既存画像パスの挙動は不変。
- `ChatMessage` のみ `audioAttachments` フィールド追加で非対称（判断 4）。

## 10. 完了条件（具体化版）

- [ ] `llm-message.ts`: `ChatAudioPartSchema` 追加・union 拡張・`hasAudioContent` 追加。`llm-message.spec.ts` の「未知 type は parse 失敗」テストを `audio` 以外（例 `video`）へ更新し、audio part の parse 成功を追加。
- [ ] `chat-message.ts`: `ChatMessageAudioRef` 追加・`audioAttachments` 追加。
- [ ] `audio-unsupported.error.ts` 新規（`AudioUnsupportedError`）。
- [ ] `llm-provider.ts`: `supportsAudio()` を I/F に追加。3 client に実装。
- [ ] provider clients: 音声変換分岐＋guard。`gemini.client.spec.ts`/`openai-compatible.client.spec.ts`/`claude.client.spec.ts` に audio 変換・`supportsAudio` テスト追加。
- [ ] `llm.config.ts`: env・config・getter 追加。
- [ ] `chat.schemas.ts`/`chat-thread.schemas.ts`: `attachmentAudioIds`・`MAX_AUDIO_ATTACHMENTS`。
- [ ] `chat-attachment.service.ts`: 音声対応（assert/toLlmContent/toAudioAttachmentViews）。`chat-attachment.service.spec.ts` に音声ケース追加（AudioService モック）。
- [ ] `chat.service.ts`/`chat-thread.service.ts`/`chat-completion.service.ts`: 合流。関連 spec を新シグネチャに更新。
- [ ] infra: `chat-message-audio.entity.ts` 新規、リポジトリ 3 メソッド改修、migration 新規、`chat.module.ts` 改修。
- [ ] dto/controller: `attachmentAudioIds`・`audioAttachments`。
- [ ] `.env.*.example` に `OPENAI_AUDIO` / `LOCALLLM_AUDIO` 追記。
- [ ] `cd backend && pnpm build` / `pnpm test` / `pnpm lint` が緑。

## 11. 手動動作確認シナリオ

実機の音声分析応答確認は TSK-133。本タスクは自動テストと型/ビルドで担保する。

1. `cd backend && pnpm build` が通る（型エラーなし）。
2. `cd backend && pnpm test` が緑（既存テスト含む。シグネチャ変更で更新したものも）。
3. `cd backend && pnpm lint` が通る。
4. （任意）`pnpm migration:run` で `chat_message_audios` が作成され、`migration:revert` で戻せる。
5. provider mapping のユニットテストで、audio part が Gemini=`inlineData`・OpenAI=`input_audio` に変換され、Claude は `supportsAudio()=false` であることを確認。

## 12. 未確定事項

なし。
