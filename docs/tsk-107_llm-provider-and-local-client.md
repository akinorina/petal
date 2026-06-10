# TSK-107: LLM プロバイダー抽象とローカル(OpenAI 互換)接続クライアント

- Notion: [LLMプロバイダー抽象とローカル(OpenAI互換)接続クライアントを実装する](https://app.notion.com/p/3749ca7d99dc802aa499ca3a52770f01)
- プロジェクト: PRJ-16（Petal LLMチャット実装）
- 規模: L / 重要度: HIGH

---

## 0. 課題シート（Notion 転記）

### 一行サマリ

backend に LLM チャット用フィーチャ（`chat`）を新設し、LLM プロバイダーをインターフェースで抽象化したうえで、ローカル LLM（LM Studio 等 / OpenAI 互換 API）への接続クライアントを `infra/` に実装する。

### 背景・動機

PRJ-16 の土台。要求は「ローカル/リモートいずれにも接続できる仕様」だが、初版はローカル（OpenAI 互換）に絞る。後からリモート（Claude/GPT/Gemini）を足せるよう、最初にプロバイダー抽象を設計しておく必要がある。接続先 URL・API キー等の秘密情報は backend env のみに保持する（フロント露出禁止）。

### 完了条件（課題シート原文）

- `backend/src/chat/` にフィーチャモジュールを新設し、DDD/オニオン・フィーチャ構成に準拠している
- LLM プロバイダーをインターフェース（抽象）として定義し、ローカル実装をそれに適合させている
- OpenAI 互換 API への接続クライアントを `infra/` に隔離して実装している（`application` から SDK/HTTP を直接触らない）
- 接続先が公開するモデル一覧を取得できる
- テキスト生成（ストリーミング含む）が backend 単体で動作する
- 接続先 URL 等の環境変数を Zod でバリデーションし、`.env.example` に追記している
- Application 層のユニットテストがある

### スコープ外

- リモートプロバイダー（Claude/GPT/Gemini）の実接続（抽象点のみ用意）
- 会話の永続化（TSK で別管理）
- HTTP エンドポイント（controller）— 別タスクで実装
- フロントエンド

### 制約

- 接続経路はバックエンドプロキシ固定。秘密情報を `NEXT_PUBLIC_*` に置かない
- DDD + オニオン、フィーチャ優先構成、`any` 禁止、Zod 検証、pnpm（npm/yarn 禁止）
- 外部 SDK/HTTP 呼び出しは `infra/` に隔離

### 不明点・迷い（→ 本設計で解決）

- ストリーミングの内部表現 → **AsyncGenerator** に確定（§4 設計判断ログ D2）

---

## 1. スコープ

### 対象

- `backend/src/chat/` フィーチャの新設（`domain` / `application` / `infra` の 3 レイヤー + `chat.module.ts`）
- LLM プロバイダー抽象インターフェース（`domain`）の定義
- OpenAI 互換 API 接続クライアント（`infra`、公式 `openai` SDK 利用）
- モデル一覧取得・テキスト生成（非ストリーミング/ストリーミング両対応）
- 環境変数の Zod バリデーション（chat 専用 config プロバイダー） + `.env.example`（= `.envs/.env.local.example` 等）追記
- Application 層（`ChatService`）のユニットテスト

### 対象外（このタスクで実装しない）

- controller / HTTP エンドポイント（別 TSK）
- 会話・メッセージの永続化（別 TSK / TypeORM エンティティは作らない）
- リモートプロバイダーの具象実装（IF への適合点のみ用意）
- フロントエンド
- `ChatModule` を `AppModule` に組み込むか否かは「組み込む」（後述 §8）。ただし HTTP 公開はしない（controller 無し）。

## 2. 制約

- DDD + オニオン。依存方向は外→内。`domain` は `infra`/SDK を import しない。
- 外部 SDK（`openai`）呼び出しは `infra/` に隔離。`application` から SDK/HTTP を直接触らない。
- `any` 禁止、`strict` 維持。外部入力（env・SDK レスポンス）は Zod で検証。
- 秘密情報（API キー）は backend env のみ。`NEXT_PUBLIC_*` に置かない。
- pnpm のみ。依存追加は `pnpm --filter backend add openai`。

## 3. 採用技術（確定事項サマリ）

| 論点 | 採用 |
| --- | --- |
| HTTP クライアント | 公式 `openai` SDK（`baseURL` 上書きで OpenAI 互換エンドポイントへ接続） |
| ストリーム内部表現 | `AsyncGenerator<ChatChunk>`（フレームワーク非依存） |
| プロバイダー IF | `listModels()` / `generateStream()` / `generate()`（集約版）の 3 本 |
| env 検証 | chat 専用 config プロバイダー（`infra/llm.config.ts`）で Zod `parse()` |

## 4. 設計判断ログ

### D1: HTTP クライアントは公式 `openai` SDK（baseURL 上書き）

- **採用**: 公式 `openai` npm パッケージを `baseURL` 上書きで利用。LM Studio 等のローカル LLM は OpenAI 互換 API を公開するため、そのまま `client.models.list()` / `client.chat.completions.create({ stream })` が使える。
- **理由**: SSE ストリーミングのパース・モデル一覧・型定義を SDK が提供し、保守コストが低い。`infra/` に隔離すればオニオン依存方向違反にならない。
- **却下**: fetch 直書き + 自前 SSE パース。依存は増えないが、SSE パース・エラー処理・型を全て手実装する保守コストが見合わない。

### D2: ストリーミング内部表現は `AsyncGenerator`

- **採用**: `domain`/`application` の戻り値は `AsyncGenerator<ChatChunk>`。
- **理由**: フレームワーク非依存で `domain`/`application` が純粋に保てる。`for await` で全チャンク収集でき、テストが容易。controller は別タスクのため、ここで Nest/RxJS 依存を持ち込まない方が筋が良い。`openai` SDK の `stream` も `AsyncIterable` なので変換が自然。
- **却下**: RxJS `Observable`。rxjs は依存にあり Nest SSE と相性が良いが、`domain` 層に rxjs が侵入する。controllerスコープ外の本タスクでは恩恵が薄い。

### D3: プロバイダー IF は stream + 集約版の 2 系統 + モデル一覧

- **採用**: `LlmProvider` に `listModels()` / `generateStream()` / `generate()` を定義。`generate()` は内部で `generateStream()` を集約して `ChatResult` を返す（非ストリーミング用途）。
- **理由**: 完了条件の「テキスト生成（ストリーミング含む）」を両形態でカバー。集約は実装側で 1 度だけ書けばよく、利用側のボイラープレートを避けられる。
- **却下**: stream のみ。利用側が毎回集約コードを書く必要があり重複が出る。

### D4: env 検証は chat 専用 config プロバイダー + Zod

- **採用**: `chat/infra/llm.config.ts` に `LlmEnvSchema`（Zod）を置き、`ConfigService` から読んだ値を `parse()` する `LlmConfig`（`@Injectable`）を提供。`OpenAiCompatibleClient` はこの `LlmConfig` を DI で受け取る。
- **理由**: 既存の `ConfigService.getOrThrow` 直読みパターンを壊さず、chat フィーチャ内に Zod 検証を閉じ込められる。グローバル env スキーマ導入は影響範囲が本タスクのスコープを超える。
- **却下**: `ConfigModule.forRoot({ validate })` へ全 env の Zod スキーマを導入。一貫性は高いが既存 env 全体に影響し、スコープ外。

### D5: domain にエンティティ（TypeORM）を作らない

- **採用**: 会話/メッセージの永続化はスコープ外のため、`domain` にはエンティティ（値オブジェクト）+ プロバイダー IF のみ置き、TypeORM エンティティ・リポジトリは作らない。`ChatModule` も `TypeOrmModule.forFeature` を import しない。
- **理由**: 永続化は別 TSK。物理/論理削除や migration は本タスクで不要。
- **影響**: migration 追加なし。

## 5. データモデル（domain の値オブジェクト・型）

すべて `domain/` に Zod スキーマ + `z.infer` 型で定義（永続化しないため class エンティティではなく型 + スキーマで足りる。外部入力＝SDK レスポンス検証に Zod を使う）。

```text
chat/domain/
  llm-message.ts        … ChatRole, ChatMessage, ChatMessageSchema
  llm-generation.ts     … ChatGenerationInput(Schema), ChatChunk, ChatResult
  llm-model.ts          … LlmModel, LlmModelSchema
  llm-provider.ts       … LlmProvider インターフェース + LLM_PROVIDER DI シンボル
```

- `ChatRole = 'system' | 'user' | 'assistant'`（enum 相当の Zod `z.enum`）。
- `ChatMessage = { role: ChatRole; content: string }`。
- `ChatGenerationInput = { model?: string; messages: ChatMessage[]; temperature?: number; maxTokens?: number }`
  - `model` 省略時は `LlmConfig` の既定モデル（`LLM_MODEL`、未設定なら接続先既定）。
  - 入力スキーマ（`application` 層が外部から受ける用）は `application/chat.schemas.ts` にも置く（後述）。
- `ChatChunk = { delta: string; done: boolean; finishReason?: string | null; model?: string }`（ストリームの 1 片。`done: true` は終端マーカーで `delta` は空文字、`finishReason`/`model` は終端チャンクにのみ載る。これにより `generate()` が `generateStream()` を単一コードパスで集約できる — Phase 4 精緻化）。
- `ChatResult = { model: string; content: string; finishReason: string | null }`（集約結果）。
- `LlmModel = { id: string; ownedBy?: string | null }`（`/v1/models` の 1 件）。

### LlmProvider インターフェース（domain）

```ts
export const LLM_PROVIDER = Symbol('LLM_PROVIDER');

export interface LlmProvider {
  listModels(): Promise<LlmModel[]>;
  generateStream(input: ChatGenerationInput): AsyncGenerator<ChatChunk>;
  generate(input: ChatGenerationInput): Promise<ChatResult>;
}
```

## 6. API 仕様（フィーチャ内部の公開面）

HTTP エンドポイントは無し（controller スコープ外）。フィーチャの公開面は `ChatService`（`application`）と、`ChatModule` の `exports`。

### ChatService（application）

```ts
@Injectable()
export class ChatService {
  constructor(@Inject(LLM_PROVIDER) private readonly provider: LlmProvider) {}

  listModels(): Promise<LlmModel[]>;
  generate(input: ChatGenerationInput): Promise<ChatResult>;     // 非ストリーム
  generateStream(input: ChatGenerationInput): AsyncGenerator<ChatChunk>; // ストリーム
}
```

- `ChatService` は入力 `ChatGenerationInput` を `application/chat.schemas.ts` の Zod スキーマで `parse()` してから provider へ渡す（外部入力検証。controller が将来この service を呼ぶ前提）。
- 認可（所有者チェック等）はスコープ外（永続化が無く現時点で対象リソースが無いため）。将来 controller タスクで付与。

### OpenAiCompatibleClient（infra、`LlmProvider` 実装）

- `openai` SDK を `new OpenAI({ baseURL, apiKey })` で初期化（`LlmConfig` から取得）。
- `listModels()`: `client.models.list()` → SDK レスポンスを `LlmModelSchema.array()` 相当で検証してマップ。
- `generateStream()`: `client.chat.completions.create({ model, messages, temperature, max_tokens, stream: true })` の `AsyncIterable` を `for await` し、`choices[0].delta.content` を `ChatChunk{delta}` に変換。終端で `{delta:'', done:true}` を yield。
- `generate()`: `generateStream()` を集約（`delta` 連結）し `ChatResult` を返す。`finishReason` は最後のチャンク由来（取得できなければ `null`）。

## 7. シーケンス（ストリーム生成）

```text
caller → ChatService.generateStream(input)
  ChatService: input を Zod parse
  ChatService → LlmProvider.generateStream(input)
    OpenAiCompatibleClient → openai SDK chat.completions.create({stream:true})
    SDK ← OpenAI互換サーバ (SSE)
    for await chunk in stream:
      yield { delta: chunk.choices[0].delta.content ?? '', done:false }
    yield { delta:'', done:true }
  ChatService ← AsyncGenerator<ChatChunk>
caller: for await でチャンク消費
```

## 8. 既存設計との差分

- 新フィーチャ `chat` を追加（`image`/`user`/`auth`/`audit` に並ぶ 5 つ目）。
- `AppModule` の `imports` に `ChatModule` を追加（DI 解決のため）。HTTP は公開しない（controller 無し）。
- backend に依存 `openai` を追加（`package.json`）。
- 環境変数 `LLM_BASE_URL` / `LLM_API_KEY`（任意）/ `LLM_MODEL`（任意）を追加。`.envs/.env.local.example`・`.envs/.env.dev.example` に追記。
- env を Zod で検証する初の箇所（chat フィーチャ内に限定）。
- migration 追加なし（永続化なし）。
- `docs/10_architecture/02_backend-architecture.md` のフィーチャ一覧に `chat` 行を追記（責務: LLM チャット生成 / エンドポイント: なし（現時点））。

## 9. トランザクション境界

DB 永続化が無く外部副作用（LLM API 呼び出し）のみのため、トランザクション境界は不要（`runInTransaction` 不使用）。

## 10. 完了条件（実装視点の具体化）

- [ ] `backend/src/chat/{domain,application,infra}/` + `chat.module.ts` が存在し、§5 の型/IF/実装が揃う
- [ ] `LlmProvider` IF が `domain` にあり、`OpenAiCompatibleClient` が `infra` で実装し DI シンボル `LLM_PROVIDER` で束ねられる
- [ ] `application` から `openai` / `fetch` を直接 import していない（`infra` 経由のみ）
- [ ] `ChatService.listModels()` が接続先のモデル一覧を返す
- [ ] `ChatService.generate()` / `generateStream()` がテキスト生成（集約 / ストリーム）を返す
- [ ] `LlmEnvSchema`（Zod）で env を検証し、不正時は起動時/初期化時に明確なエラー
- [ ] `LLM_BASE_URL` 等を `.envs/.env.local.example` と `.envs/.env.dev.example` に追記
- [ ] `chat.service.spec.ts` が provider をモックして listModels/generate/generateStream を検証（全緑）
- [ ] `pnpm --filter backend build` と `pnpm --filter backend test` が通る
- [ ] `npx markdownlint-cli 'docs/**/*.md'` が通る

## 11. 手動動作確認シナリオ

> 前提: LM Studio 等の OpenAI 互換サーバをローカルで起動し、最低 1 つモデルをロード。`backend/.env`(symlink) に `LLM_BASE_URL=http://localhost:1234/v1` を設定。

本タスクは controller が無いため、確認用の使い捨てスクリプト（`backend/scripts/chat-smoke.ts`）を一時作成して NestJS アプリ文脈で `ChatService` を解決し実行する。確認後 `.trash/` へ退避する（コミットしない）。

1. **モデル一覧**: スクリプトで `chatService.listModels()` を呼び、配列に接続先のモデル ID が含まれること。
2. **非ストリーム生成**: `chatService.generate({ messages:[{role:'user', content:'こんにちは'}] })` が空でない `content` を返すこと。
3. **ストリーム生成**: `chatService.generateStream(...)` を `for await` し、複数チャンクが届き最後に `done:true` が来ること。
4. **env 不正**: `LLM_BASE_URL` を不正な値（非 URL）にすると Zod が検証エラーを投げること。

（ユニットテストでは provider をモックするため、上記の実接続確認は手動シナリオで担保）

## 12. 未確定事項

- なし（Phase 4 ドライランで最終確認）。

---

## 13. 実装計画（Phase 4）

### 13.1 変更・追加ファイル

#### 追加（backend/src/chat/）

- `domain/llm-message.ts` … `ChatRole`(`z.enum`) / `ChatMessageSchema` / `ChatMessage`
- `domain/llm-generation.ts` … `ChatGenerationInputSchema` / `ChatGenerationInput` / `ChatChunk` / `ChatResult`
- `domain/llm-model.ts` … `LlmModelSchema` / `LlmModel`
- `domain/llm-provider.ts` … `LLM_PROVIDER`(Symbol) / `LlmProvider`(interface)
- `application/chat.schemas.ts` … `ChatGenerationInputSchema` の再エクスポート用途は持たず、`application` 入力検証は domain の `ChatGenerationInputSchema` を利用（schemas ファイルは作らず domain に集約）。→ **作らない**
- `application/chat.service.ts` … `ChatService`
- `application/chat.service.spec.ts` … ユニットテスト（`LlmProvider` をモック）
- `infra/llm.config.ts` … `LlmEnvSchema`(Zod) / `LlmConfig`(@Injectable)
- `infra/openai-compatible.client.ts` … `OpenAiCompatibleClient implements LlmProvider`
- `chat.module.ts` … モジュール定義

#### 変更

- `src/app.module.ts` … `imports` に `ChatModule` 追加
- `package.json`（backend）… `openai` 依存追加
- `.envs/.env.local.example` / `.envs/.env.dev.example` … `LLM_*` 追記
- `docs/10_architecture/02_backend-architecture.md` … フィーチャ表に `chat`（コミット済み）

> 注: 入力検証スキーマは `domain/llm-generation.ts` の `ChatGenerationInputSchema` に集約し、`application/chat.schemas.ts` は作らない（§5 から変更。重複回避）。

### 13.2 migration・環境変数・依存

- **migration**: なし（永続化スコープ外）。
- **依存追加**: `pnpm --filter backend add openai`（最新安定版・caret 範囲）。
- **環境変数**（chat 専用 Zod 検証）:
  - `LLM_BASE_URL`（必須・URL。例 `http://localhost:1234/v1`）
  - `LLM_API_KEY`（任意・未設定時は SDK 用に `'not-needed'` を既定値とする。LM Studio 等は無視）
  - `LLM_MODEL`（任意・既定モデル。入力 `model` も `LLM_MODEL` も無ければ生成時に明示エラー）

### 13.3 作業順序（コミット単位・各完了確認）

1. **依存 + env config**: `openai` 追加、`infra/llm.config.ts`。確認: `pnpm --filter backend build`。
2. **domain**: `llm-message.ts` / `llm-generation.ts` / `llm-model.ts` / `llm-provider.ts`。確認: build。
3. **infra client**: `infra/openai-compatible.client.ts`（`LlmProvider` 実装）。確認: build。
4. **application**: `application/chat.service.ts`。確認: build。
5. **module 配線**: `chat.module.ts`（`LLM_PROVIDER`→`OpenAiCompatibleClient`、`LlmConfig`、`ChatService` を providers、`ChatService` を exports）+ `app.module.ts` に `ChatModule`。確認: build（DI 解決）。
6. **テスト**: `application/chat.service.spec.ts`。確認: `pnpm --filter backend test`。
7. **env example + 設計書整合**: `.envs/.env.local.example` / `.envs/.env.dev.example` 追記。確認: `pnpm --filter backend build` / `pnpm --filter backend test` / `npx markdownlint-cli 'docs/**/*.md'`。

### 13.4 テスト方針

- `chat.service.spec.ts`: `LLM_PROVIDER` を `useValue` でモック（`jest.Mocked<LlmProvider>` 相当）。
  - `listModels()` がモデル配列を返す。
  - `generate()` がモック provider の結果を返す。
  - `generateStream()` を `for await` で収集し、チャンク列と終端 `done:true` を検証。
  - 入力検証: 不正入力（`messages` 空 等）で Zod が throw すること。
- infra クライアント（SDK ラッパー）はテスト方針上スコープ外（[testing-strategy](40_processes/02_testing-strategy.md)）。手動シナリオ（§11）で担保。

### 13.5 想定外時の判断ルール

#### 標準セット

- **AI 単独判断 OK**: 軽微な既存コードリファクタ、設計書スコープ内の追加実装。
- **中断して要相談**: データモデル変更、API 仕様変更、トランザクション境界変更、外部 API 想定差異、設計判断ログを覆す変更。

#### TSK-107 固有

- `openai` SDK の最新版で `chat.completions.create` / `models.list` のシグネチャが本設計の想定（§6）と乖離していた場合 → **中断**（設計の外部 API 想定差異）。
- ストリームチャンクから `delta.content` を取得する形が SDK 型と異なる場合 → 軽微なら AI 判断で追従可（SDK 型に従う）。型レベルで設計を覆す必要があれば中断。
- ローカル LLM サーバが無いため infra の実接続確認は不可。**ビルド + ユニットテスト + lint の通過を完了条件とし、実接続は手動シナリオ（Phase 6）に委ねる**。スモークスクリプトは Phase 5 では作らない。

### 13.6 事前解決済みの判断ポイント

| # | 判断ポイント | 解決 |
| --- | --- | --- |
| 1 | `openai` のバージョン | 最新安定版を caret 範囲で追加 |
| 2 | `LLM_API_KEY` 未設定時 | SDK 初期化用に `'not-needed'` を既定 |
| 3 | `model` も `LLM_MODEL` も無い | 生成時に明示的 `Error`（日本語メッセージ）を throw |
| 4 | `generate()` の実装 | `generateStream()` を集約（delta 連結 + 終端チャンクの `model`/`finishReason`） |
| 5 | `ChatChunk` 形 | 終端チャンクに `finishReason`/`model` を載せる（§5 反映済み） |
| 6 | モデル一覧の検証 | SDK 応答の `data` を `LlmModelSchema.array()` で `parse` |
| 7 | 入力検証スキーマの置き場所 | `domain/llm-generation.ts` に集約。`application/chat.schemas.ts` は作らない |
| 8 | `.env.example` の実体 | `.envs/.env.local.example` と `.envs/.env.dev.example` の両方に追記 |
| 9 | ChatModule の AppModule 組込 | 組み込む（DI 解決のため）。controller 無しで HTTP 非公開 |
| 10 | migration | 追加しない（永続化スコープ外） |
| 11 | 認可 | スコープ外（対象リソース未存在）。将来 controller タスクで付与 |
