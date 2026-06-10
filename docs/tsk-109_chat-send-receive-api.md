# TSK-109: チャット送受信 API（ストリーミング・認可・エラー対応）

- Notion: [チャット送受信 API をストリーミング・認可・エラー対応込みで実装する](https://app.notion.com/p/37b9ca7d99dc81d0adf0fa817200559f)
- プロジェクト: PRJ-16（Petal LLMチャット実装）
- 規模: L / 重要度: HIGH / 完了予定: 2026-06-12

---

## 0. 課題シート（Notion 転記）

### 一行サマリ

LLM 生成（TSK-107）と永続化（スレッド/メッセージ・TSK-108）を結合し、ストリーミング応答・所有者認可・エラー処理を含むチャット送受信 API（controller）を実装する。

### 背景・動機

PRJ-16 の結合点。フロントから受けた送信を、ユーザーメッセージ保存 → LLM 生成（ストリーム）→ アシスタントメッセージ保存という一連の API として提供する。

### 完了条件（課題シート原文）

- [ ] controller/DTO を実装し、外部入力を Zod でバリデーションしている
- [ ] 認証ユーザーがスレッド作成→メッセージ送信→ストリーミング応答受信ができる（SSE 等）
- [ ] 送信メッセージと生成応答の両方が DB に永続化される
- [ ] 他人のスレッドへのアクセスが拒否される（所有者認可）
- [ ] 接続/生成エラー時に適切なエラー応答を返す（フロントがリトライ判断できる形）
- [ ] Application 層のユニットテストがある

### スコープ外

- LLM クライアント本体（TSK-107 実装済み）・永続化リポジトリ本体（TSK-108 実装済み）
- フロントエンド UI

### 制約

- 接続経路はバックエンドプロキシ固定。秘密情報をフロントに返さない
- DDD + オニオン、`any` 禁止、Zod、認証は既存 AuthGuard に準拠

### 不明点・迷い（→ 本設計で解決）

- ストリーミングの転送方式（SSE / chunked 等）→ 本設計 §4 D1 で確定（**fetch + SSE 形式**）

---

## 1. スコープ

### 対象

- 既存 `backend/src/chat/` フィーチャへ **controller 層を新設**し、HTTP エンドポイントを公開する。
  - `controller/chat.controller.ts` … スレッド CRUD + 送信（ストリーム応答）
  - `controller/chat.dto.ts` … リクエスト/レスポンス DTO（OpenAPI 契約の真実のソース）
- 送信フローの結合（オーケストレーション）を行う application ユースケース `ChatCompletionService` を新設。
  - ユーザーメッセージ保存 → 会話履歴を LLM へ → `generateStream` → クライアントへ逐次転送 → 完了/中断時にアシスタントメッセージ保存。
- 入力 Zod スキーマ（`application/chat.schemas.ts` 系）。
- Application 層（`ChatCompletionService`）のユニットテスト。

### 対象外（このタスクで実装しない）

- LLM クライアント本体（TSK-107 `ChatService`/`OpenAiCompatibleClient`・**改変しない**）。
- 永続化リポジトリ本体（TSK-108 `ChatThreadService`/リポジトリ・**改変しない**）。
- フロントエンド UI（別タスク）。
- モデル一覧エンドポイント（`ChatService.listModels` は internal のまま。クライアントへ未公開）。
- タイトル自動生成（TSK-108 D4 のとおりスコープ外）。
- 並行採番（seq）の堅牢化（TSK-108 D2 のとおり所有者単独会話前提）。

---

## 2. 制約

- DDD + オニオン。controller → application → domain の依存方向。controller は外部入力を Zod で検証してから service を呼ぶ。
- `any` 禁止、`strict`。レスポンスの `Date` は controller の整形関数で `toISOString()`。
- 認証は既存のグローバル `JwtAuthGuard`（`APP_GUARD`）に準拠。各エンドポイントは要認証（`@ApiBearerAuth('bearer')`）。`@Public()` は付けない。
- 認可（所有者チェック）は TSK-108 `ChatThreadService` が `NotFoundException`（存在秘匿）で実装済み。controller/orchestrator はこれに**委譲するだけ**で、認可ロジックを再実装しない。
- 秘密情報（接続先 URL・API キー・上流エラー本文）をレスポンスに混入させない。エラーはコード化した汎用メッセージのみ返す。
- 既存パターン（`backend/src/image/controller/` 一式）に揃える。新パターンを持ち込まない。

---

## 3. 採用技術・既存資産（確定事項サマリ）

| 論点 | 採用 |
| --- | --- |
| 送信フローの結合 | application に `ChatCompletionService`（`ChatThreadService` + `ChatService` を DI して結合） |
| ストリーミング転送 | `@Res()` で `text/event-stream` を手書き（SSE 形式）。フロントは fetch の ReadableStream で消費（EventSource 不使用） |
| 認可 | TSK-108 `ChatThreadService` の `NotFoundException`（存在秘匿）へ委譲 |
| current user 解決 | `image` と同様 `UserService.findById(req.user.userId)`（`UserModule` を import） |
| エラー応答 | **段階別**（§4 D3） |
| 中断時の永続化 | **切断検知で部分保存**（§4 D4） |

既存資産（再実装しない）:

- `application/chat.service.ts`（`ChatService.generateStream/generate/listModels`、TSK-107）
- `application/chat-thread.service.ts`（`createThread/findThreadsForOwner/findThreadForOwner/addMessage/findMessages/removeThread`、所有者認可込み、TSK-108）
- `domain/llm-message.ts`（`ChatRole`/`ChatMessage = {role, content}`、LLM 送信用 DTO 型）

---

## 4. 設計判断ログ

### D1: ストリーミング転送は「fetch + SSE 形式」（採用）

- **採用**: controller で `@Res()` を取り、`Content-Type: text/event-stream` を手書きして `event:`/`data:` フレームを `res.write()` する。フロントは `fetch()` の `response.body.getReader()` で読み、SSE をパースする（ブラウザネイティブ `EventSource` は使わない）。
- **理由**: 既存 `JwtAuthGuard` はトークンを **`Authorization` ヘッダーのみ**から抽出する（[jwt-auth.guard.ts](../backend/src/common/guards/jwt-auth.guard.ts) `extractBearerToken`）。ブラウザネイティブ `EventSource` はカスタムヘッダーを送れないため、SSE をそのまま使うと認証と両立しない。fetch ベースなら `Authorization` ヘッダー認証がそのまま効き、SSE の `event:`/`data:` 整形（型付きイベント分岐）も保てる。フロントの API クライアントも fetch ベース（openapi middleware がトークン付与）で一貫する。
- **却下（NestJS `@Sse()` + `EventSource`）**: トークンをクエリ文字列に載せる必要があり、アクセスログ/Referer に秘密情報が漏れる。制約「秘密情報を URL に置かない」と衝突。
- **却下（NDJSON over chunked）**: 実装は薄いが、型付きイベント（`delta`/`done`/`error`）の意味を `event:` 行で明示できる SSE 形式の方が拡張時に読みやすい。SSE 形式でも fetch 消費なので NDJSON と同じく認証制約を回避できる。

### D2: 送信フローの結合は application の `ChatCompletionService`（採用）

- **採用**: 送信オーケストレーション（ユーザー保存→履歴ロード→LLM ストリーム→アシスタント保存）を application の新ユースケース `ChatCompletionService` に閉じ込め、`ChatThreadService`（永続化＋認可）と `ChatService`（LLM）を DI して結合する。controller は HTTP 入出力（Zod 検証・SSE 整形・切断検知）のみ担う。
- **理由**: 結合ロジックは「ユースケース」であり application 層が適切。controller を薄く保てばテスト対象（application）に結合ロジックが乗り、controller を単体テスト対象外（[specs/00_rules.md §8](specs/00_rules.md)）に保てる。認可は `ChatThreadService.addMessage`/`findMessages` が内部で `findThreadForOwner` を呼ぶため、再実装せず委譲できる。
- **却下（controller に結合ロジックを書く）**: controller が太りテスト不能領域に分岐が乗る。
- **却下（`ChatCompletionService` が repository を直接触る）**: 認可ロジック（`findThreadForOwner`）が二重化する。`ChatThreadService` のユースケースを再利用する方が DRY。
- application → application の DI は同一リング内で依存方向違反ではない。

### D3: エラー応答は「段階別」（採用）

- **採用**:
  - **ストリーム開始前**（入力検証・認可・LLM 接続確立失敗）→ 通常の **HTTP ステータス**で返す（400/404/429/502）。レスポンスボディに `{ code, message, retryable }`。
  - **ストリーム開始後**（最初の `delta` 送出後の生成エラー）→ SSE の `event: error` で `{ code, message, retryable }` を流して正常終了する。
- **実装上の要点**: controller は orchestrator の **最初のイベントを取得してから** SSE ヘッダー（200）を書く。最初のイベント取得時に例外が出れば、ヘッダー未送出のため Nest の例外フィルタが HTTP ステータスで応答できる。最初の `delta` 送出後はヘッダー送出済みのため、以降のエラーは `event: error` で伝える。
- **理由**: フロントが「HTTP ステータス or `error` イベント」を一貫した `{ code, retryable }` 形で解釈でき、リトライ判断（完了条件）ができる。接続失敗（上流ダウン）を 502 で返せば通常の HTTP リトライに乗せやすい。
- **エラー分類**（`retryable`）: 接続失敗/タイムアウト/上流 5xx → `retryable: true`、上流 429 → `retryable: true`（`LLM_RATE_LIMITED`）、上流 4xx（モデル不在等）→ `retryable: false`、その他 → `retryable: true`。分類は上流エラーを **ダックタイピング**（`status`/`code`/`message`）で判定し、`openai` 型を application に import しない（オニオン維持）。**上流のエラー本文はそのまま返さない**（接続先 URL 等の漏洩防止）。

### D4: クライアント切断時は「部分保存」（採用）

- **採用**: クライアントが生成途中で切断したら（`req` の `close`）、その時点まで蓄積した `delta` をアシスタントメッセージとして保存し、LLM ストリームを中断する。
- **理由**: 部分応答も会話履歴に残り、再開時に文脈が途切れない。所有者単独会話のため副作用は小さい。
- **実装上の要点**: controller は `req.on('close')` で orchestrator の async generator に `.return()` を送る。orchestrator は `finally` で「未保存なら蓄積分を保存」する（二重保存ガード付き、蓄積が空なら保存しない）。`.return()` の伝播で内部の `for await`（`ChatService.generateStream`）が break し、`openai` SDK の HTTP リクエストが abort される（TSK-107 を改変せず実現）。
- **却下（切断時は破棄）**: 実装は単純だが部分応答が履歴から消える。

### D5: `finishReason` は転送のみ・非永続（採用）

- **採用**: `done`/`error` イベントに `finishReason` を載せるが、DB には保存しない。
- **理由**: `chat_messages`（TSK-108）に `finish_reason` 列が無い。保存するとスキーマ変更（migration）が必要になりスコープ外。現状フロントは終端マーカーとしてイベントの `finishReason` を見れば足りる。
- **影響**: migration 追加なし。

### D6: 送信入力は本文のみ（モデル等の上流パラメータは非公開）（採用）

- **採用**: 送信リクエストは `{ content }` のみ。`model`/`temperature`/`maxTokens` はクライアントから受けず、サーバ既定（`LLM_MODEL` 等）を用いる。
- **理由**: モデル一覧エンドポイントを公開しない（スコープ外）ため、クライアントが妥当な `model` を知る手段がない。最小の API 面に絞り、チューニングパラメータの公開は将来タスクに委ねる。

---

## 5. データモデル / 型

新規の永続化モデルは無い（TSK-108 の `chat_threads`/`chat_messages` をそのまま使う）。本タスクで定義するのは **DTO とストリームイベント型** のみ。

### ストリームイベント（application、非永続の判別共用体）

`application/chat-stream.ts`:

```ts
export type ChatStreamEvent =
  | { type: 'delta'; delta: string }
  | { type: 'done'; messageId: string | null; seq: number | null; finishReason: string | null }
  | { type: 'error'; code: ChatErrorCode; message: string; retryable: boolean };
```

- `delta`: 生成テキストの 1 片。
- `done`: 正常終了。保存できたアシスタントメッセージの `messageId`/`seq`（生成が空で未保存なら `null`）と `finishReason`。
- `error`: ストリーム開始後の生成エラー。`{ code, message, retryable }`。

### エラーコード（application）

`application/chat-error.ts`:

```ts
export type ChatErrorCode =
  | 'LLM_UPSTREAM_UNAVAILABLE' // 接続失敗/タイムアウト/上流5xx（retryable: true）
  | 'LLM_RATE_LIMITED'        // 上流429（retryable: true）
  | 'LLM_BAD_REQUEST'         // 上流4xx（モデル不在等・retryable: false）
  | 'LLM_GENERATION_FAILED';  // その他（retryable: true）

export interface ClassifiedChatError {
  code: ChatErrorCode;
  message: string; // 日本語の汎用メッセージ（上流本文は載せない）
  retryable: boolean;
  httpStatus: number; // 開始前エラー時に使う（429 or 502）
}

export function classifyLlmError(err: unknown): ClassifiedChatError;
```

`classifyLlmError` は `err` を `{ status?: number; code?: string; message?: string }` としてダックタイピングし、上記表に従って分類する（`openai` を import しない）。

### DTO（controller、OpenAPI 契約）

`controller/chat.dto.ts`:

```ts
// レスポンス
class ChatThreadResponseDto {
  id: string; ownerUserId: string; title: string | null;
  createdAt: string; /* date-time */ updatedAt: string; /* date-time */
}
class ChatMessageResponseDto {
  id: string; threadId: string; seq: number;
  role: 'system' | 'user' | 'assistant'; // @ApiProperty({ enum })
  content: string; createdAt: string; updatedAt: string;
}
// リクエスト
class CreateThreadRequestDto { title?: string | null; }
class SendMessageRequestDto { content: string; }
```

- 送信エンドポイントの **レスポンスは SSE ストリーム**のため DTO で表現できない。`@ApiProduces('text/event-stream')` を付け、SSE イベント形（`delta`/`done`/`error`）は本設計書 §6 を一次情報とする（OpenAPI には本文型を載せない）。

### 入力 Zod スキーマ（application）

`application/chat.schemas.ts`:

```ts
export const SendMessageSchema = z.object({
  content: z.string().min(1).max(MAX_MESSAGE_CONTENT_LENGTH), // 32768
});
export type SendMessageInput = z.infer<typeof SendMessageSchema>;
// スレッド作成は既存 CreateThreadInputSchema（chat-thread.schemas.ts）を再利用
```

---

## 6. API 仕様

`Auth` はすべて 🔑（要認証）。ベースパスは `/chat`。

| メソッド | パス | 概要 | リクエスト | レスポンス |
| --- | --- | --- | --- | --- |
| POST | `/chat/threads` | スレッド作成 | `CreateThreadRequestDto` | `201` `ChatThreadResponseDto` |
| GET | `/chat/threads` | 自分のスレッド一覧（新着順） | — | `200` `ChatThreadResponseDto[]` |
| GET | `/chat/threads/:id/messages` | メッセージ一覧（seq 昇順） | — | `200` `ChatMessageResponseDto[]` |
| POST | `/chat/threads/:id/messages` | 送信 + ストリーム応答 | `SendMessageRequestDto` | `200` `text/event-stream`（SSE） |
| DELETE | `/chat/threads/:id` | スレッド論理削除（メッセージ連鎖） | — | `204` |

非所有者・不在のスレッドはすべて `404 NotFound`（存在秘匿、`ChatThreadService` に委譲）。

### SSE ストリーム形式（`POST /chat/threads/:id/messages`）

レスポンスヘッダ:

```text
Content-Type: text/event-stream; charset=utf-8
Cache-Control: no-cache
Connection: keep-alive
X-Accel-Buffering: no
```

イベント（1 イベント = `event:` 行 + `data:`(JSON) 行 + 空行）:

```text
event: delta
data: {"type":"delta","delta":"こん"}

event: delta
data: {"type":"delta","delta":"にちは"}

event: done
data: {"type":"done","messageId":"<uuid>","seq":3,"finishReason":"stop"}
```

生成エラー時（ストリーム開始後）:

```text
event: error
data: {"type":"error","code":"LLM_GENERATION_FAILED","message":"応答の生成に失敗しました","retryable":true}
```

ストリーム開始前エラー（HTTP ステータス + JSON ボディ）:

```text
HTTP/1.1 502 Bad Gateway
{"code":"LLM_UPSTREAM_UNAVAILABLE","message":"LLM サーバに接続できません","retryable":true}
```

### ChatCompletionService（application）

```ts
@Injectable()
class ChatCompletionService {
  constructor(
    private readonly threadService: ChatThreadService,
    private readonly chatService: ChatService,
  ) {}

  // 送信フローの結合。pre-stream エラーは throw（→ controller が HTTP 化）、
  // post-start エラーは error イベントを yield。切断は generator.return() で finally 保存。
  async *streamCompletion(
    currentUser: User,
    threadId: string,
    input: SendMessageInput,
  ): AsyncGenerator<ChatStreamEvent>;
}
```

---

## 7. シーケンス（送信 + ストリーム）

```text
client → POST /chat/threads/:id/messages  (Authorization: Bearer ...)
  JwtAuthGuard: req.user 確立（既存）
  ChatController:
    SendMessageSchema.safeParse(body)        // 失敗 → 400
    currentUser = userService.findById(req.user.userId)
    gen = completionService.streamCompletion(currentUser, id, input)
    first = await gen.next()                 // ← ここまでが pre-stream
      [orchestrator] threadService.addMessage(user, id, {role:'user', content})  // 非所有 → 404
      [orchestrator] history = threadService.findMessages(user, id)
      [orchestrator] stream = chatService.generateStream({ messages: history.map(...) })
      [orchestrator] for await chunk: 最初の delta を yield  // 接続失敗 → throw（!started）
    // first が例外 → Nest 例外フィルタが HTTP（404/502/429/400）。ヘッダー未送出
    res.writeHead(200, { text/event-stream ... })   // 最初のイベント取得成功後
    req.on('close', () => gen.return())              // 切断検知
    writeEvent(first); for await ev of gen: writeEvent(ev)
      [orchestrator] 各 delta を yield（蓄積）
      [orchestrator] done チャンク → persist(assistant) → done イベント yield
      [orchestrator] 生成エラー（started後）→ persist(partial) → error イベント yield
      [orchestrator] finally: 未保存なら蓄積分を保存（切断時の部分保存）
    res.end()
```

---

## 8. トランザクション境界

- 本フローは「DB 書込（ユーザーメッセージ）→ 外部 API（LLM ストリーム・長時間）→ DB 書込（アシスタントメッセージ）」。LLM 生成は長時間ストリームのため、[specs/00_rules.md §4](specs/00_rules.md) の「DB→外部 API→COMMIT」を単一トランザクションで満たすことはできない（接続を生成完了まで保持できない）。
- したがって **2 つの独立した DB 書込**に分ける:
  1. ユーザーメッセージ保存（`addMessage`、それ自体は短い）。
  2. アシスタントメッセージ保存（生成完了/中断後）。
- LLM 生成が途中失敗・切断しても、ユーザーメッセージは保存済みのまま残す（ユーザーが送った事実は消さない）。これは「片方失敗ならもう片方も無効化したい」要件が無いケースであり、§4 の例外条項（論理的に独立）に該当する。
- 各 `addMessage` 内の seq 採番〜INSERT は TSK-108 の実装に従う（本タスクで新たなトランザクションは導入しない）。

---

## 9. 既存設計との差分

- `chat` フィーチャに **controller 層**を新設（`image` と並ぶ HTTP 公開フィーチャになる）。
- `ChatModule`: `controllers: [ChatController]` を追加、`imports` に `UserModule`、`providers` に `ChatCompletionService` を追加（既存の `ChatService`/`ChatThreadService`/`LLM_PROVIDER`/`CHAT_THREAD_REPOSITORY` は維持）。
- `docs/10_architecture/06_api-design.md`: エンドポイント一覧に `chat`（5 エンドポイント）を追記。
- `docs/10_architecture/02_backend-architecture.md`: `chat` フィーチャ行のエンドポイントを「なし」→「`/chat/*`」に更新。
- OpenAPI: DTO 追加に伴い `backend/openapi.json` を再生成（`pnpm openapi:export`）。フロント型生成（`frontend/pnpm openapi:gen`）はフロントタスク側で行う想定だが、生成物（`backend/openapi.json`）はコミットする。
- migration 追加なし（D5）。環境変数追加なし（TSK-107 の `LLM_*` を流用）。

---

## 10. 完了条件（実装視点の具体化）

- [ ] `backend/src/chat/controller/chat.controller.ts` と `chat.dto.ts` を追加し、§6 の 5 エンドポイントを公開。外部入力（body）を Zod で `safeParse` し、失敗時 `400`。
- [ ] `backend/src/chat/application/chat-completion.service.ts`（`ChatCompletionService`）/ `chat-stream.ts` / `chat-error.ts` / `chat.schemas.ts` を追加。
- [ ] `ChatModule` に controller・`UserModule`・`ChatCompletionService` を配線。
- [ ] 認証ユーザーが `POST /chat/threads` → `POST /chat/threads/:id/messages` で SSE ストリーム応答を受信できる。
- [ ] ユーザーメッセージとアシスタントメッセージの両方が `chat_messages` に永続化される（切断時は部分保存）。
- [ ] 非所有者のスレッドは全エンドポイントで `404`（`ChatThreadService` 委譲）。
- [ ] 接続失敗 → `502 {code:'LLM_UPSTREAM_UNAVAILABLE', retryable:true}`、生成中エラー → `event: error {retryable}`。上流エラー本文・秘密情報を返さない。
- [ ] `backend/src/chat/application/chat-completion.service.spec.ts` を追加（`ChatThreadService`/`ChatService` をモック）。下記シナリオ網羅。
- [ ] `cd backend && pnpm build` が通る。`cd backend && pnpm test` が緑。`cd backend && pnpm lint` が通る。
- [ ] `cd backend && pnpm openapi:export` を実行し `backend/openapi.json` を更新・コミット。
- [ ] `docs/10_architecture/06_api-design.md` / `02_backend-architecture.md` を更新。
- [ ] `npx markdownlint-cli 'docs/**/*.md'` が通る。

### ユニットテストのシナリオ（`chat-completion.service.spec.ts`）

- **正常系**: `addMessage(user)` → `findMessages` 履歴 → `generateStream` が複数 delta + 終端 done → 全 delta を yield し、`addMessage(assistant, 蓄積全文)` が呼ばれ、最後に `done` イベント（`messageId`/`finishReason`）を yield。
- **非所有者**: `addMessage(user)` が `NotFoundException` を throw → そのまま伝播し、`generateStream` は呼ばれない。
- **pre-stream 接続失敗**: `generateStream` が最初の delta 前に throw → orchestrator が分類済みエラーを throw（`!started`）。アシスタント `addMessage` は呼ばれない。
- **mid-stream エラー**: delta を 1 つ yield 後に `generateStream` が throw → delta イベントに続き **部分保存**（`addMessage(assistant, 部分)`）→ `error` イベントを yield。
- **切断（部分保存）**: delta を 1 つ消費後に `generator.return()` → `finally` で部分保存（`addMessage(assistant, 部分)`）が 1 回呼ばれ、以降のイベントは出ない。
- **空生成**: delta 0 件で done → アシスタント保存は呼ばれず（蓄積空）、`done` イベントの `messageId`/`seq` は `null`。
- **二重保存ガード**: 正常終了後に `finally` が走っても `addMessage(assistant)` が二重に呼ばれない。

---

## 11. 手動動作確認シナリオ

> 前提: LM Studio 等の OpenAI 互換サーバをローカル起動（`LLM_BASE_URL` 設定済み）。DB に migration 適用済み（TSK-108）。`SKIP_AUTH=true` か有効なアクセストークンを用意。`pnpm --filter backend start:dev` で起動。

1. **スレッド作成**: `POST /chat/threads`（body `{}`）→ `201` でスレッド `id` が返る。
2. **送信 + ストリーム**: `curl -N -H 'Authorization: Bearer <t>' -H 'Content-Type: application/json' -d '{"content":"こんにちは"}' http://localhost:3000/chat/threads/<id>/messages` → `event: delta` が複数届き、最後に `event: done`。
3. **永続化**: `GET /chat/threads/<id>/messages` → `user`（こんにちは）と `assistant`（生成全文）が seq 昇順で 2 件返る。
4. **所有者認可**: 別ユーザーのトークンで `GET /chat/threads/<id>/messages` → `404`。
5. **接続エラー**: `LLM_BASE_URL` を到達不能値にして送信 → HTTP `502 {code:'LLM_UPSTREAM_UNAVAILABLE', retryable:true}`（ストリーム開始前）。
6. **切断時の部分保存**: 送信の `curl` を途中で `Ctrl-C` → 数秒後 `GET .../messages` に部分内容の assistant メッセージが残る。
7. **入力検証**: `content` 空で送信 → `400`。

（ユニットテストは service をモックするため、実接続・SSE 配信・切断は本手動シナリオで担保）

---

## 12. 未確定事項

- なし（Phase 3 終了時点で全論点に採用案あり）。SSE の実配信・切断検知・上流エラーの実 HTTP 形は手動シナリオ（Phase 6）で確認する。
