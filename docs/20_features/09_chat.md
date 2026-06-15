# LLM チャット

**Claude / Gemini / OpenAI / LocalLLM** の各 LLM と対話するチャット機能（provider は env で切替）。
ユーザーごとに会話スレッドを永続化し、応答をストリーミング（SSE）で逐次表示する。
実装: [backend/src/chat/](../../backend/src/chat/) / フロント
[frontend/src/app/(authenticated)/chat/](../../frontend/src/app/%28authenticated%29/chat/)。

原典: [tsk-107](../tsk-107_llm-provider-and-local-client.md)（プロバイダ抽象・ローカルクライアント） /
[tsk-108](../tsk-108_chat-persistence.md)（永続化） /
[tsk-109](../tsk-109_chat-send-receive-api.md)（送受信 API） /
[tsk-110](../tsk-110_chat-frontend.md)（フロント） /
[tsk-113](../tsk-113_chat-ui-componentization.md)（会話 UI の部品化 `<ChatPanel>`） /
[tsk-114](../tsk-114_chat-markdown-rendering.md)（アシスタントメッセージの Markdown 表示） /
[tsk-116](../tsk-116_multi-llm-provider.md)（複数 LLM provider 対応: Claude/Gemini/OpenAI/Local）。

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
| GET | `/chat/threads` | 自分のスレッド一覧 |
| GET | `/chat/threads/:id/messages` | スレッドのメッセージ一覧 |
| POST | `/chat/threads/:id/messages` | メッセージ送信＋応答ストリーム（SSE） |
| DELETE | `/chat/threads/:id` | スレッド論理削除（204） |

- 入力は Zod 検証（`CreateThreadInputSchema` / `SendMessageSchema`）。本文は 1〜32768 文字。

## 送信フローとストリーミング

`POST /chat/threads/:id/messages` は `text/event-stream` を返す。フローは
`ChatCompletionService.streamCompletion`（[chat-completion.service.ts](../../backend/src/chat/application/chat-completion.service.ts)）:

1. ユーザーメッセージを保存（非所有なら `NotFoundException` が伝播し SSE 開始前に 404）。
2. スレッドの履歴をロードし LLM へ渡す。
3. プロバイダのストリームを `delta` イベントとして逐次転送。
4. 完了時にアシスタント全文を保存し `done` イベント（messageId / seq / finishReason）を送出。
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
| status 429 | `LLM_RATE_LIMITED` | true | 429 |
| status ≥ 500 | `LLM_UPSTREAM_UNAVAILABLE` | true | 502 |
| status 4xx（429 以外） | `LLM_BAD_REQUEST` | false | 502 |
| 接続エラー（ECONNREFUSED 等） | `LLM_UPSTREAM_UNAVAILABLE` | true | 502 |
| その他 | `LLM_GENERATION_FAILED` | true | 502 |

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
（[tsk-116](../tsk-116_multi-llm-provider.md)）。

| 変数 | 必須 | 説明 |
| ---- | ---- | ---- |
| `LLM_PROVIDER` | — | Chat が使う provider: `claude`/`gemini`/`openai`/`local`（既定 `local`） |
| `CLAUDE_API_KEY` / `CLAUDE_MODEL` | claude 時 ○ / — | Claude（Anthropic Messages API）のキーと既定モデル |
| `GEMINI_API_KEY` / `GEMINI_MODEL` | gemini 時 ○ / — | Gemini（@google/genai）のキーと既定モデル |
| `OPENAI_API_KEY` / `OPENAI_MODEL` / `OPENAI_BASE_URL` | openai 時 ○ / — / — | OpenAI（本家）のキー・既定モデル・接続先（既定 `https://api.openai.com/v1`） |
| `LOCALLLM_BASE_URL` / `LOCALLLM_API_KEY` / `LOCALLLM_MODEL` | local 時 ○ / — / — | LocalLLM（OpenAI 互換）の接続先・キー（既定 `not-needed`）・既定モデル |

- 各 `*_API_KEY` は秘密情報のため `NEXT_PUBLIC_*` に置かない（backend のみ保持）。
- 未設定でもアプリ起動は妨げず、active provider の env 不足時は利用時に明確なエラーを返す。

## フロントエンド

会話 UI は自己完結した再利用部品 `<ChatPanel>`（[frontend/src/components/chat/](../../frontend/src/components/chat/)）に切り出してある。
`(authenticated)/chat/` 配下のページはそれを描画するだけで、ページは View に専念し、ステート/副作用は同居フックへ切り出す（[frontend-architecture](../10_architecture/03_frontend-architecture.md)）。

- 一覧 `chat/page.tsx` ＋ `use-chat-page.ts`
- 新規 `chat/new/page.tsx` ＋ `use-chat-new-page.ts`（`onThreadCreated` 供給）
- 既存スレッド `chat/[threadId]/page.tsx` ＋ `use-chat-thread-page.ts`（`threadId` 供給に加え、
  `useChatThreadsApi` から一致スレッドの `title`（null は「無題の会話」）を引いて返す）

各チャットページは `flex h-full flex-col gap-4` で「タイトル → 戻りリンク → `<ChatPanel>`」を
**縦積み**する（タイトル・戻りリンクは `flex-none`、`<ChatPanel>` は `flex-1 min-h-0`）。
新規ページのタイトルは固定文言「新規チャット」、既存スレッドページはスレッドタイトルを上部に表示する
（タイトルは chat UI 内部には持たせずページ側のヘッダに置く。タイトル編集は別タスク）。

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

## 関連ドキュメント

- 要求仕様 → [00_overview/02_requirements.md](../00_overview/02_requirements.md)
- アーキテクチャ → [10_architecture/](../10_architecture/)
- テスト方針 → [40_processes/02_testing-strategy.md](../40_processes/02_testing-strategy.md)
- DB スキーマ → [10_architecture/05_database-schema.md](../10_architecture/05_database-schema.md)
</content>
