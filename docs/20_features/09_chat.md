# LLM チャット

**Claude / Gemini / OpenAI / LocalLLM** の各 LLM と対話するチャット機能（provider は env で切替）。
ユーザーごとに会話スレッドを永続化し、応答をストリーミング（SSE）で逐次表示する。
実装: [backend/src/chat/](../../backend/src/chat/) / フロント
[frontend/src/app/(authenticated)/chat/](../../frontend/src/app/%28authenticated%29/chat/)。

原典: [tsk-107](../specs/tsk-107_llm-provider-and-local-client.md)（プロバイダ抽象・ローカルクライアント） /
[tsk-108](../specs/tsk-108_chat-persistence.md)（永続化） /
[tsk-109](../specs/tsk-109_chat-send-receive-api.md)（送受信 API） /
[tsk-110](../specs/tsk-110_chat-frontend.md)（フロント） /
[tsk-111](../specs/tsk-111_chat-finishing.md)（仕上げ: テスト補完・本ドキュメント整備） /
[tsk-113](../specs/tsk-113_chat-ui-componentization.md)（会話 UI の部品化 `<ChatPanel>`） /
[tsk-114](../specs/tsk-114_chat-markdown-rendering.md)（アシスタントメッセージの Markdown 表示） /
[tsk-115](../specs/tsk-115_chat-ui-layout.md)（会話枠内スクロールのレイアウト） /
[tsk-116](../specs/tsk-116_multi-llm-provider.md)（複数 LLM provider 対応: Claude/Gemini/OpenAI/Local） /
[tsk-121](../tsk-121_chat-thread-title-edit.md)（スレッドタイトルのインライン編集） /
[tsk-122](../tsk-122_chat-multimodal-persistence.md)（メッセージのマルチモーダル化・添付画像の永続化） /
[tsk-123](../tsk-123_provider-image-vision.md)（provider の画像変換・vision 対応可否判定） /
[tsk-124](../tsk-124_chat-image-api.md)（送受信 API の画像添付対応・base64 化） /
[tsk-125](../tsk-125_chat-image-frontend.md)（フロントの画像添付 UI・会話表示） /
[tsk-126](../tsk-126_chat-image-finishing.md)（画像対応の仕上げ: ドキュメント整備・動作確認） /
[tsk-130](../tsk-130_audio-chat-methods.md)（音声ライブラリのチャット連携メソッド追加） /
[tsk-131](../tsk-131_chat-audio-backend.md)（送受信 API の音声添付対応・base64 化・provider 別 mapping） /
[tsk-132](../tsk-132_chat-audio-frontend.md)（フロントの音声添付 UI・会話表示） /
[tsk-133](../tsk-133_chat-audio-finishing.md)（音声対応の仕上げ: 実機検証・ドキュメント整備）。

## アーキテクチャ

オニオン構成（`src/chat/{domain,application,infra,controller}/`）。

- **domain**: `LlmProvider` 抽象（DI シンボル `LLM_PROVIDER`）・`ChatThread` / `ChatMessage`
  エンティティ・`IChatThreadRepository`。外部 SDK を参照しない。
- **application**: `ChatThreadService`（スレッド/メッセージ CRUD・所有者認可）・
  `ChatService`（生成のラッパ）・`ChatCompletionService`（送信フローのオーケストレーション）・
  `classifyLlmError`（上流エラー分類）。
- **infra**: `OpenAiCompatibleClient`（`openai` SDK で `LlmProvider` を実装）・
  `ChatThreadRepositoryImpl`（TypeORM）・`LlmConfig`（env 検証）。
- **controller**: `ChatController`。SSE 応答を直接 `Response` に書き出す。

LLM プロバイダは `LlmProviderRegistry`（application）が設定済みの 4 provider
（`ClaudeClient` / `GeminiClient` / `OpenAiCompatibleClient`×2）を保持し、`LLM_PROVIDER`
シンボルには env `LLM_PROVIDER` で指定された有効 provider（`registry.getActive()`）を
factory で束ねる（[chat.module.ts](../../backend/src/chat/chat.module.ts)）。レジストリは
`get(id)` で任意の provider を引け、複数同時アクセス（fan-out）の基盤にもなる。

## データモデル

`petal.chat_threads`（[chat-thread.entity.ts](../../backend/src/chat/infra/chat-thread.entity.ts)）:

| カラム | 説明 |
| ------ | ---- |
| id | UUID（PK） |
| owner_user_id | 所有ユーザー（FK → users, `onDelete: RESTRICT`） |
| title | スレッドタイトル（nullable・最大 255） |
| created_at / updated_at | 日時 |
| deleted_at | 論理削除（`@DeleteDateColumn`） |

- `IDX_chat_threads_owner_created`（owner_user_id, created_at）で所有者別一覧を取得。

`petal.chat_messages`（[chat-message.entity.ts](../../backend/src/chat/infra/chat-message.entity.ts)）:

| カラム | 説明 |
| ------ | ---- |
| id | UUID（PK） |
| thread_id | 所属スレッド（FK → chat_threads, `onDelete: RESTRICT`） |
| seq | スレッド内連番（bigint・0 始まり） |
| role | `user` / `assistant`（最大 20） |
| content | 本文（text） |
| created_at / updated_at | 日時 |
| deleted_at | 論理削除（`@DeleteDateColumn`） |

- migration: [1746144006000-CreateChatTables.ts](../../backend/database/migrations/1746144006000-CreateChatTables.ts)。
- `seq` は追加時に `findMaxSeq + 1`（無ければ 0）で採番する。

`petal.chat_message_images`（[chat-message-image.entity.ts](../../backend/src/chat/infra/chat-message-image.entity.ts)・[tsk-122](../tsk-122_chat-multimodal-persistence.md)）:
メッセージに添付された画像（既存ライブラリ `petal.images`）への順序付き参照。

| カラム | 説明 |
| ------ | ---- |
| id | UUID（PK） |
| message_id | 添付先メッセージ（FK → chat_messages, `onDelete: RESTRICT`） |
| image_id | 参照画像（FK → images, `onDelete: RESTRICT`） |
| position | メッセージ内の表示・送信順（int・0 始まり） |
| created_at / updated_at | 日時 |
| deleted_at | 論理削除（`@DeleteDateColumn`） |

- `UQ(message_id, position)` で同一メッセージ内の順序重複を防ぎ、`IDX(message_id)` でメッセージ別にまとめ取得する。
- migration: [1746144008000-CreateChatMessageImages.ts](../../backend/database/migrations/1746144008000-CreateChatMessageImages.ts)。
- `onDelete: RESTRICT` のため、画像が添付に使われている限り元画像は物理削除できない（画像管理側も論理削除）。
- ドメインでは `ChatMessage.attachments: ChatMessageImageRef[]`（`imageId` + `position`）として保持する
  （[chat-message.ts](../../backend/src/chat/domain/chat-message.ts)）。`attachments` は既定 `[]` で、
  テキストのみの既存メッセージと後方互換。

`petal.chat_message_audios`（[chat-message-audio.entity.ts](../../backend/src/chat/infra/chat-message-audio.entity.ts)・[tsk-131](../tsk-131_chat-audio-backend.md)）:
メッセージに添付された音声（既存ライブラリ `petal.audios`）への順序付き参照。`chat_message_images` と対称。

| カラム | 説明 |
| ------ | ---- |
| id | UUID（PK） |
| message_id | 添付先メッセージ（FK → chat_messages, `onDelete: RESTRICT`） |
| audio_id | 参照音声（FK → audios, `onDelete: RESTRICT`） |
| position | メッセージ内の表示・送信順（int・0 始まり） |
| created_at / updated_at | 日時 |
| deleted_at | 論理削除（`@DeleteDateColumn`） |

- `UQ(message_id, position)` / `IDX(message_id)`。migration: [1746144009000-CreateChatMessageAudios.ts](../../backend/database/migrations/1746144009000-CreateChatMessageAudios.ts)。
- ドメインでは `ChatMessage.audioAttachments: ChatMessageAudioRef[]`（`audioId` + `position`）として画像（`attachments`）と別フィールドで保持する。両者とも既定 `[]`。

## マルチモーダルメッセージと添付（画像・音声）

既存ライブラリ（`petal.images` / `petal.audios`）の画像・音声をメッセージに添付し、対応 provider に内容を分析させる
（画像の原典: [tsk-122](../tsk-122_chat-multimodal-persistence.md)〜[tsk-125](../tsk-125_chat-image-frontend.md)。
音声の原典: [tsk-130](../tsk-130_audio-chat-methods.md)〜[tsk-133](../tsk-133_chat-audio-finishing.md)）。
音声は文字起こしせず **base64 のまま LLM へネイティブ送信**する（provider の音声入力を直接使う）。

### LLM へ渡す content 表現

LLM に渡すワイヤ表現はマルチモーダルな content parts（[llm-message.ts](../../backend/src/chat/domain/llm-message.ts)）:

- `ChatContentPart` は `type` による discriminated union。
  - `text`: `{ type: 'text', text }`
  - `image`: `{ type: 'image', mediaType, data }`（`data` は **base64**）
  - `audio`: `{ type: 'audio', mediaType, data }`（`data` は **base64**）
- メッセージの `content` は **`string` も許容**（テキストのみ）で、配列はマルチモーダル。既存メッセージと後方互換。
- `contentToText()` は text part のみ連結（image/audio part は無視）、`hasImageContent()` / `hasAudioContent()` はそれぞれの part 有無を判定する純粋関数。

### 画像の取得と base64 化（経路の違い）

`ChatAttachmentService`（application・[chat-attachment.service.ts](../../backend/src/chat/application/chat-attachment.service.ts)）が
添付の所有者認可・base64 化・表示 view 化を担う。

- 送信・履歴再送時は **バックエンドが S3 から画像バイトを取得して base64 化**し、各 provider 形式へ渡す
  （Claude image block / Gemini inlineData / OpenAI image_url の data URL。変換は各 infra クライアントに隔離）。
- これは画像管理の通常のアップロード／ダウンロード（**署名付き URL でブラウザと S3 が直接やり取りし
  バックエンドはバイトを中継しない**）とは異なる経路である点に注意（[04_image-management.md](04_image-management.md)）。
- 履歴表示用には `getOwnedImageView` で署名付き表示 URL（`downloadUrl`）＋メタを返す。
- **音声も同経路**: `AudioService.getOwnedAudioBase64`（送信用・S3→base64）/ `getOwnedAudioView`（履歴用・署名 URL＋メタ）を
  `ChatAttachmentService` が呼び、各 provider 形式へ変換する（Gemini inlineData / OpenAI `input_audio`。Claude は音声非対応）。
  `toLlmContent` は text → 画像 part → 音声 part の順（各 `position` 昇順）で parts を組み立てる。

### vision 対応可否

provider ごとに画像入力対応可否を持つ（`LlmProvider.supportsVision()`・原典 [tsk-123](../tsk-123_provider-image-vision.md)）:

| provider | supportsVision | 既定 |
| -------- | -------------- | ---- |
| Claude | true（固定） | — |
| Gemini | true（固定） | — |
| OpenAI（本家） | env `OPENAI_VISION` | true |
| LocalLLM | env `LOCALLLM_VISION` | false（モデルに合わせ運用者が設定） |

vision 非対応 provider に画像付きで送信した場合、**送信前（pre-stream）に明確なエラーで block** する（後述「送信フロー」「エラー分類」）。

### audio 対応可否

provider ごとに音声入力対応可否を持つ（`LlmProvider.supportsAudio()`・原典 [tsk-131](../tsk-131_chat-audio-backend.md)）:

| provider | supportsAudio | 既定 |
| -------- | ------------- | ---- |
| Claude | false（固定・Anthropic API が音声入力非対応） | — |
| Gemini | true（固定） | — |
| OpenAI（本家） | env `OPENAI_AUDIO` | false |
| LocalLLM | env `LOCALLLM_AUDIO` | false（モデルに合わせ運用者が設定） |

audio 非対応 provider に音声付きで送信した場合、**送信前（pre-stream）に 422 `LLM_AUDIO_UNSUPPORTED` で block** する（vision と対称）。
`LOCALLLM_AUDIO=true` は **音声入力を受けるモデル**（`input_audio` content type 対応）が前提で、vision のみのモデル（例: gemma）では LLM 側が拒否する。

**形式適合**: バックエンドは添付音声を**形式変換せず**そのまま base64 で渡す（Gemini=inlineData の `mimeType`、OpenAI 互換=`input_audio.format`）。
形式別の受理可否は **provider・モデル依存**で、確実なのは **wav / mp3**。OpenAI 互換の `input_audio.format` は本来 `wav`/`mp3` 想定で、録音由来の webm/mp4 は弾かれることがある。
**実機検証（tsk-133・2026-06-24）**: `LLM_PROVIDER=gemini` で音声添付→音声内容に基づく応答を確認済み（PRJ-18 の「最低 1 provider で音声分析が動く」を満足）。

### 添付の上限・認可

- 1 メッセージあたり最大 **画像 5 枚**（`MAX_ATTACHMENTS`）/ **音声 3 件**（`MAX_AUDIO_ATTACHMENTS`）
  （[chat.schemas.ts](../../backend/src/chat/application/chat.schemas.ts)）。
- 添付できるのは **所有者本人の画像・音声のみ**（非所有/不在は 404）。フロントの選択 UI も自分のものだけ提示する。

## 認可

- すべての操作は **所有者本人のみ**。`ChatThreadService.findThreadForOwner` が
  `thread.isOwnedBy(currentUser.id)` を検証し、非所有なら `NotFoundException`
  （存在秘匿のため 404）。送信・履歴取得・削除すべてこのチェックを通る。

## API

すべて `@Controller('chat')`・Bearer 認証
（[chat.controller.ts](../../backend/src/chat/controller/chat.controller.ts)）。

| メソッド | パス | 概要 |
| -------- | ---- | ---- |
| POST | `/chat/threads` | スレッド作成（`title` 任意） |
| PATCH | `/chat/threads/:id` | スレッドのタイトル更新（更新後 DTO を返す） |
| GET | `/chat/threads` | 自分のスレッド一覧 |
| GET | `/chat/threads/:id/messages` | スレッドのメッセージ一覧（各メッセージの `attachments` 付き） |
| POST | `/chat/threads/:id/messages` | メッセージ送信＋応答ストリーム（SSE）。`attachmentImageIds`・`attachmentAudioIds` で添付 |
| DELETE | `/chat/threads/:id` | スレッド論理削除（204） |

- 入力は Zod 検証（`CreateThreadInputSchema` / `UpdateThreadInputSchema` / `SendMessageSchema`）。本文は 1〜32768 文字。
- **画像添付**（[tsk-124](../tsk-124_chat-image-api.md)）:
  - `POST /chat/threads/:id/messages` の body は `{ content: string, attachmentImageIds?: string[] }`。
    `attachmentImageIds` は uuid 配列で **最大 5 件**（`SendMessageSchema`）。
  - `GET /chat/threads/:id/messages` の各メッセージは `attachments: ChatMessageAttachmentDto[]` を返す。
    各要素は `{ imageId, position, mimeType, originalFilename, downloadUrl, expiresInSeconds }`
    （`downloadUrl` は署名付き表示 URL・[chat.dto.ts](../../backend/src/chat/controller/chat.dto.ts)）。
- **音声添付**（[tsk-131](../tsk-131_chat-audio-backend.md) / [tsk-132](../tsk-132_chat-audio-frontend.md)）:
  - `POST` の body に `attachmentAudioIds?: string[]`（uuid・**最大 3 件**）を追加（`SendMessageSchema`）。画像と独立に指定できる。
  - `GET` の各メッセージは `audioAttachments: ChatMessageAudioAttachmentDto[]` を返す。
    各要素は `{ audioId, position, mimeType, originalFilename, downloadUrl, expiresInSeconds }`。フロントは `<audio>` で再生する。
- `PATCH /chat/threads/:id`（[tsk-121](../tsk-121_chat-thread-title-edit.md)）: body `{ title: string | null }`。
  `UpdateThreadInputSchema` が `title` を trim し、空（空白のみ含む）は `null` 化、max 255 は trim 後に適用する。
  `ChatThreadService.updateThreadTitle` が所有者を確認のうえ `IChatThreadRepository.updateThreadTitle`
  （既存行を読み込み title を更新して保存）で永続化する（非所有は 404）。

## 送信フローとストリーミング

`POST /chat/threads/:id/messages` は `text/event-stream` を返す。フローは
`ChatCompletionService.streamCompletion`（[chat-completion.service.ts](../../backend/src/chat/application/chat-completion.service.ts)）:

1. **添付の送信前検証**（pre-stream・`ChatAttachmentService.assertAttachmentsSendable`）。
   vision 非対応 provider に画像付きなら 422 `LLM_VISION_UNSUPPORTED`、audio 非対応 provider に音声付きなら
   422 `LLM_AUDIO_UNSUPPORTED` で即 block（I/O なしで fail fast）、続けて各添付画像・音声の所有者認可（非所有/不在は 404）。
   SSE 開始前なので HTTP ステータスで応答する。
2. ユーザーメッセージを保存（添付があれば `chat_message_images` / `chat_message_audios` も同一トランザクションで保存。
   非所有スレッドなら `NotFoundException` が伝播し SSE 開始前に 404）。
3. スレッドの履歴をロードし、各メッセージの添付を `toLlmContent` で **base64 の image/audio part に変換**して
   LLM へ渡す。これにより**過去の添付画像・音声も毎回再送され**、マルチターンで添付の文脈が維持される。
4. プロバイダのストリームを `delta` イベントとして逐次転送。
5. 完了時にアシスタント全文を保存し `done` イベント（messageId / seq / finishReason）を送出。
   生成が空文字なら保存せず messageId / seq は `null`。

SSE イベント（[chat-stream.ts](../../backend/src/chat/application/chat-stream.ts)）:

| event | data |
| ----- | ---- |
| `delta` | `{ type, delta }` 部分テキスト |
| `done` | `{ type, messageId, seq, finishReason }` 完了 |
| `error` | `{ type, code, message, retryable }` ストリーム開始後エラー |

- **切断時**: クライアント切断（`req.on('close')`）で generator を `return` し、
  `finally` で受信済み部分テキストをアシスタントメッセージとして保存する（部分保存）。
- 保存は二重ガード（`state.persisted`）で `finally` 重複実行時も 1 回のみ。

## エラー分類

`classifyLlmError`（[chat-error.ts](../../backend/src/chat/application/chat-error.ts)）が
上流エラーをダックタイピング（`status` / `code`）で分類する。**接続先 URL・上流本文などの
秘密情報はメッセージに含めない**。

| 条件 | code | retryable | HTTP |
| ---- | ---- | --------- | ---- |
| vision 非対応 provider に画像添付（pre-stream） | `LLM_VISION_UNSUPPORTED` | false | 422 |
| audio 非対応 provider に音声添付（pre-stream） | `LLM_AUDIO_UNSUPPORTED` | false | 422 |
| status 429 | `LLM_RATE_LIMITED` | true | 429 |
| status ≥ 500 | `LLM_UPSTREAM_UNAVAILABLE` | true | 502 |
| status 4xx（429 以外） | `LLM_BAD_REQUEST` | false | 502 |
| 接続エラー（ECONNREFUSED 等） | `LLM_UPSTREAM_UNAVAILABLE` | true | 502 |
| その他 | `LLM_GENERATION_FAILED` | true | 502 |

- `LLM_VISION_UNSUPPORTED` / `LLM_AUDIO_UNSUPPORTED` は送信前（delta 未送出）に判定する固定エラーで、`classifyLlmError` ではなく
  `ChatAttachmentService` が直接 422 `HttpException` を投げる。生成は開始されずメッセージも保存されない。

- **ストリーム開始前**（delta 未送出）のエラーは `HttpException` 化し、Nest の例外フィルタが
  HTTP ステータスで応答する（ヘッダー未送出のため）。
- **ストリーム開始後**のエラーは部分保存のうえ `error` イベントで通知する。
- フロントは `code` / `retryable` でリトライ可否を判断する。

## 環境変数

chat フィーチャ専用。Zod スキーマは
[llm.config.ts](../../backend/src/chat/infra/llm.config.ts) の `LlmEnvSchema`。
example は [backend/.envs/.env.local.example](../../backend/.envs/.env.local.example) /
[.env.dev.example](../../backend/.envs/.env.dev.example) に記載。

Claude / Gemini / OpenAI（本家）/ LocalLLM の 4 provider を provider 別キーで定義し、
`LlmProviderRegistry` が設定済みのものを保持する。Chat は `LLM_PROVIDER` で 1 つを使う
（[tsk-116](../specs/tsk-116_multi-llm-provider.md)）。

| 変数 | 必須 | 説明 |
| ---- | ---- | ---- |
| `LLM_PROVIDER` | — | Chat が使う provider: `claude`/`gemini`/`openai`/`local`（既定 `local`） |
| `CLAUDE_API_KEY` / `CLAUDE_MODEL` | claude 時 ○ / — | Claude（Anthropic Messages API）のキーと既定モデル |
| `GEMINI_API_KEY` / `GEMINI_MODEL` | gemini 時 ○ / — | Gemini（@google/genai）のキーと既定モデル |
| `OPENAI_API_KEY` / `OPENAI_MODEL` / `OPENAI_BASE_URL` | openai 時 ○ / — / — | OpenAI（本家）のキー・既定モデル・接続先（既定 `https://api.openai.com/v1`） |
| `OPENAI_VISION` | — | OpenAI（本家）の画像入力対応可否（既定 `true`） |
| `OPENAI_AUDIO` | — | OpenAI（本家）の音声入力対応可否（既定 `false`・audio 対応モデル利用時に設定） |
| `LOCALLLM_BASE_URL` / `LOCALLLM_API_KEY` / `LOCALLLM_MODEL` | local 時 ○ / — / — | LocalLLM（OpenAI 互換）の接続先・キー（既定 `not-needed`）・既定モデル |
| `LOCALLLM_VISION` | — | LocalLLM の画像入力対応可否（既定 `false`・vision 対応モデル利用時に設定） |
| `LOCALLLM_AUDIO` | — | LocalLLM の音声入力対応可否（既定 `false`・`input_audio` 対応モデル利用時に設定） |

- 各 `*_API_KEY` は秘密情報のため `NEXT_PUBLIC_*` に置かない（backend のみ保持）。
- `OPENAI_VISION` / `LOCALLLM_VISION` / `OPENAI_AUDIO` / `LOCALLLM_AUDIO` は boolean-ish（`true`/`false`/`1`/`0`）。
  未設定時の既定は vision が OpenAI=true / Local=false、audio が OpenAI=false / Local=false。
  Claude / Gemini は env を持たず、vision は常に対応・audio は Claude=非対応 / Gemini=対応で固定（[tsk-123](../tsk-123_provider-image-vision.md) / [tsk-131](../tsk-131_chat-audio-backend.md)）。
- 未設定でもアプリ起動は妨げず、active provider の env 不足時は利用時に明確なエラーを返す。

## フロントエンド

会話 UI は自己完結した再利用部品 `<ChatPanel>`（[frontend/src/components/chat/](../../frontend/src/components/chat/)）に切り出してある。
`(authenticated)/chat/` 配下のページはそれを描画するだけで、ページは View に専念し、ステート/副作用は同居フックへ切り出す（[frontend-architecture](../10_architecture/03_frontend-architecture.md)）。

- 一覧 `chat/page.tsx` ＋ `use-chat-page.ts`
- 新規 `chat/new/page.tsx` ＋ `use-chat-new-page.ts`（`onThreadCreated` 供給）
- 既存スレッド `chat/[threadId]/page.tsx` ＋ `use-chat-thread-page.ts`（`threadId` 供給に加え、
  `useChatThreadsApi` から一致スレッドの `title`（`string | null`・正本）と `isLoading` / `reload` を返す。
  タイトルは `<EditableThreadTitle>` がインライン編集する）

各チャットページは `flex h-full flex-col gap-4` で「タイトル → 戻りリンク → `<ChatPanel>`」を
**縦積み**する（タイトル・戻りリンクは `flex-none`、`<ChatPanel>` は `flex-1 min-h-0`）。
新規ページのタイトルは固定文言「新規チャット」、既存スレッドページはスレッドタイトルを上部に表示する
（タイトルは chat UI 内部には持たせずページ側のヘッダに置く）。

既存スレッドページのタイトルは再利用部品 `<EditableThreadTitle>`（[tsk-121](../tsk-121_chat-thread-title-edit.md)）で
インライン編集できる。`components/chat/` に `EditableThreadTitle.tsx`（プレゼン）＋ `use-editable-thread-title.ts`
（編集状態・楽観更新）として置き、barrel から公開する（`<ChatPanel>` と同じ「公開部品＋非公開フック」パターン）。

- 表示状態: タイトル（`Text as="h1"`）自体がボタンで、タップ（または併置の「編集」ボタン）で `Input` 化する。
- 確定（完了ボタン or Enter）で入力値を即時反映（楽観更新）し、裏で `chatApi.updateThread`（`useChatActionsApi.updateThreadTitle`）→
  `useChatThreadsApi.reload()` で正本へ収束。空（空白のみ）は `null` 保存で「無題の会話」表示。失敗時は正本へ戻し `Alert` で通知する。
- キャンセル（キャンセルボタン or Esc）で編集前へ戻す。一覧取得中（`isLoading`）は編集不可（プレースホルダ表示）。

`<ChatPanel>`（`components/chat/`）は `threadId` を渡すだけで API 配線・送信・SSE
ストリーミング描画・ローディング/notFound 表示まで内部で完結する自己完結部品。
chat UI 自体は「会話コンテンツ + 入力欄」の 2 部構成。

- `mode` prop: `"thread"`（`threadId` 指定で既存スレッド表示）/ `"new"`（初回送信で遅延作成し、
  完了後に `onThreadCreated(threadId)` を呼ぶ。新規ページはこれで確定スレッドへ遷移）。
- 高さは親に追従（`h-full` + 内部スクロール）し、枠は埋め込み側が `className` で与える。
  チャットページは `flex-1 min-h-0` を渡すため chat UI は利用可能領域（ビューポート − TopBar）
  いっぱいに追従し、会話が長くなっても会話枠内だけがスクロールしてページ全体は動かない
  （認証レイアウト `(authenticated)/layout.tsx` を `h-dvh` flex 化し `<main>` を唯一の
  スクロールコンテナにしている）。モーダル/サイドバー等へもドロップするだけで埋め込める。
- 内部部品 `ChatConversation.tsx` / `use-chat-conversation.ts`（会話プレゼン・送信
  オーケストレーション）は `components/chat/` 内の非公開実装で、barrel は `ChatPanel` /
  `ChatPanelProps` のみ公開する。
- アシスタントメッセージ（ストリーミング中含む）は内部部品 `MarkdownContent.tsx`
  （react-markdown + remark-gfm）で Markdown（GFM: 表・打ち消し線・タスクリスト・自動リンク）
  として整形描画する。スタイルは `MarkdownContent.css`（`.chat-markdown` スコープ、
  デザイントークンのみ使用）。リンクは新規タブ（`rel="noopener noreferrer"`）で開き、
  生 HTML は描画しない（`rehype-raw` 不使用）。ユーザーメッセージは従来どおり
  プレーンテキスト（`whitespace-pre-wrap`）表示。

## テスト

Application 層をユニットテストで担保（[testing-strategy](../40_processes/02_testing-strategy.md)）。
`ChatThreadService` / `ChatService` / `ChatCompletionService` / `classifyLlmError` の
spec を同居配置。送信フローは正常系・空生成・pre/mid-stream エラー・切断・finishReason 欠落を網羅。

画像添付（[tsk-126](../tsk-126_chat-image-finishing.md)）も同方針で担保する。

- domain: `llm-message`（parts 判別・`contentToText` / `hasImageContent`）・`chat-message`（`attachments` の既定/不変条件）・`vision-unsupported.error`。
- application: `ChatAttachmentService`（vision 422 / 所有者認可 404 / base64 化・position 昇順 / 表示 view 化）・
  `ChatCompletionService`（pre-stream 422 と未保存・`attachmentImageIds` 伝播・履歴の `toLlmContent` 経由再送）。
- infra（provider）: 各クライアントの content マッピングと vision guard を spec で確認。
- 実機での全 provider E2E 動作確認の手順は [tsk-126 §6](../tsk-126_chat-image-finishing.md) を参照。

## 関連ドキュメント

- 要求仕様 → [00_overview/02_requirements.md](../00_overview/02_requirements.md)
- アーキテクチャ → [10_architecture/](../10_architecture/)
- テスト方針 → [40_processes/02_testing-strategy.md](../40_processes/02_testing-strategy.md)
- DB スキーマ → [10_architecture/05_database-schema.md](../10_architecture/05_database-schema.md)
</content>
