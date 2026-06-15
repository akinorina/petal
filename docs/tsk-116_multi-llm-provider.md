# TSK-116: 複数 LLM プロバイダー対応（Claude / Gemini / OpenAI / LocalLLM）

- Notion: [ClaudeAPI, GeminiAPI, OpenAI Compatible API に対応したい](https://app.notion.com/p/3809ca7d99dc80d8a7c8d9969c096afa)
- プロジェクト: PRJ-16（Petal LLMチャット実装）
- 関連: [TSK-107 LLM プロバイダー抽象とローカル接続クライアント](tsk-107_llm-provider-and-local-client.md)（本タスクの土台）
- 規模: L / 重要度: MID

---

## 0. 課題シート（Notion 転記）

### 一行サマリ

Local LLM への接続と同様に、Claude や Gemini にも接続したい（容易に切り替えたい）。

### 背景・動機

現在は OpenAI 互換 API でローカルサーバの LLM へ接続している。今後 Claude / Gemini へも接続したく、これら複数の LLM への API 接続を簡単に切り替えられる仕組みを作りたい。

### 完了条件（議論で具体化・§10 が正）

- Claude / Gemini / OpenAI（本家）/ LocalLLM の 4 つに接続できる
- 4 つを同時に設定でき、内部で任意の 1 つまたは複数へアクセスできる基盤を持つ
- Chat 機能はそのうち 1 つを環境変数で指定して使う

### スコープ外

- **思考の深さ（effort: quick/balanced/deep）の問いかけ単位制御** — 魅力的だが本タスクには含めない。別 TSK で provider 中立の `ReasoningEffort` 概念として追加する（§8 / §12）。
- 思考過程（thinking ブロック）の画面表示・ストリーミング表示
- ランタイム（UI）からの provider 選択。Chat の provider は env 固定。
- ユーザーごとの API キー保存（キーは backend env のみ）

### 制約

- 接続経路はバックエンドプロキシ固定。秘密情報を `NEXT_PUBLIC_*` に置かない。
- DDD + オニオン、フィーチャ優先構成、`any` 禁止、`strict` 維持、外部入力に Zod、pnpm 固定。
- 外部 SDK 呼び出しは `infra/` に隔離。

### 不明点・迷い（→ 本設計で解決）

- 「LLM を切り替える」という単一概念に、性質の違う 2 軸が潰れていた → **軸1=どの provider（env 固定）/ 軸2=思考の深さ（別 TSK）** に分離して解決（§4 D1）。
- OpenAI 互換を 1 つとして扱うか → **OpenAI（本家）と LocalLLM を別 provider として扱う**（§4 D2）。

---

## 1. スコープ

### 対象

- 論理 provider を **4 つ**に拡張: `claude` / `gemini` / `openai` / `local`。
- infra アダプタ:
  - `ClaudeClient`（`@anthropic-ai/sdk`・新規）
  - `GeminiClient`（`@google/genai`・新規）
  - `OpenAiCompatibleClient`（既存・per-instance config を受ける形に小改修）→ `openai` と `local` の **2 インスタンス**で共用。
- application 層に **`LlmProviderRegistry`**（設定済み provider を全部保持し id で引ける基盤）を新設。
- 各 provider を **provider 別の環境変数**で個別定義し、Zod で検証。`.envs/.env.*.example` を更新。
- DI 配線を「単一 `LLM_PROVIDER` バインド」から「レジストリ + 有効 provider 解決」へ置換。
- application 層のユニットテスト（レジストリ・有効 provider 解決）。

### 対象外（このタスクで実装しない）

- effort / 思考の深さ制御（別 TSK）。`ChatGenerationInput` に effort は足さない。
- 思考過程の表示。`ChatChunk` に thinking を混ぜない。
- フロントエンドの変更（Chat 送信は従来どおり `content` のみ。provider/effort 選択 UI なし）。
- Chat の永続化・SSE・エラー分類の本流ロジック変更（既存を維持）。

## 2. 制約

- DDD + オニオン。依存方向は外→内。`domain` は `infra`/SDK を import しない。
- 外部 SDK（`openai` / `@anthropic-ai/sdk` / `@google/genai`）呼び出しは `infra/` に隔離。`application` から SDK を直接触らない。
- `any` 禁止、`strict` 維持。外部入力（env・SDK レスポンス）は Zod で検証。
- 秘密情報（API キー）は backend env のみ。`NEXT_PUBLIC_*` に置かない。
- pnpm のみ。依存追加は `pnpm --filter backend add @anthropic-ai/sdk @google/genai`。

## 3. 採用技術（確定事項サマリ）

| 論点 | 採用 |
| --- | --- |
| provider 抽象 | 既存 `LlmProvider` インターフェース（`listModels`/`generateStream`/`generate`）を**変更せず**温存 |
| Claude 接続 | 公式 `@anthropic-ai/sdk`（Messages API・ストリーミング） |
| Gemini 接続 | 公式 `@google/genai`（`generateContentStream`） |
| OpenAI / Local | 既存 `OpenAiCompatibleClient` を 2 インスタンスで共用（baseURL/key/model 違い） |
| provider 切替基盤 | application 層 `LlmProviderRegistry`（id→provider の Map） |
| Chat の provider 選択 | env `LLM_PROVIDER` で 1 つを指定（デプロイ時固定） |
| env 検証 | `infra/llm.config.ts` の Zod スキーマを provider 別に拡張 |

## 4. 設計判断ログ

### D1: 「切り替え」を 2 軸に分離。本タスクは軸1（provider 選択・env 固定）のみ

- **採用**: 「どの provider を使うか（軸1）」と「どれくらい深く考えさせるか（軸2 = effort）」を別概念として分離。本タスクは軸1のみ実装し、Chat の provider は env で固定。軸2 は別 TSK。
- **理由**: 2 軸を 1 つの「切り替え」に潰すと設計が混乱する。軸2（effort）は Claude 固有機能ではなく **provider 中立のユーザー意図**であり、足すなら `domain` に中立概念として入れ各アダプタが native へ翻訳する形が正しい。これは provider 基盤（軸1）が固まってから独立に足せるため、スコープを切る。
- **却下**: effort も同時実装。`ChatChunk`/`ChatGenerationInput` の拡張・フロントセレクタ・各アダプタの翻訳が増え、provider 基盤の完成が遅れる。価値はあるが今の主目的（複数 LLM 接続基盤）と分離可能。

### D2: OpenAI（本家）と LocalLLM を別 provider として扱う

- **採用**: 論理 provider を 4 つにし、OpenAI（`api.openai.com`）と LocalLLM（OpenAI 互換ローカル）を別 id（`openai` / `local`）で個別の env を持たせる。
- **理由**: 同時に両方を設定し使い分けたいため、設定単位（env・既定モデル・接続先）が独立している必要がある。プロトコルは同じでも「別々のモノ」として扱うのがユーザーのメンタルモデル。
- **影響**: infra 実装クラスは 3 種類（Claude/Gemini/OpenAI 互換）。`openai` と `local` は `OpenAiCompatibleClient` を **設定違いの 2 インスタンス**で共用 → クラス重複を避けつつ論理分離を実現。
- **却下**: OpenAI 互換を 1 つに統合。設定が 1 組になり「本家と Local を同時に持つ」要件を満たせない。

### D3: provider 切替は application 層の `LlmProviderRegistry`

- **採用**: 設定済みの provider を起動時に全部生成して `Map<ProviderId, LlmProvider>` で保持するレジストリを application 層に新設。`get(id)` で任意の provider を取り出せ、複数 id を取り出して**並行アクセス（fan-out）も可能**（= 1 つまたは複数の LLM へアクセスする将来機能の基盤）。Chat は `getActive()`（env `LLM_PROVIDER` 指定）で 1 つを使う。
- **理由**: 「内部で切り替え、リクエスト単位に 1 つまたは複数の LLM へアクセスできる基盤」という要求を、オニオンを崩さず application 層に閉じ込められる。レジストリは active を 1 つに制約せず、設定済みの全 provider を等しく id で引けるため、1 つ選ぶ用途も複数同時に呼ぶ用途も同じ API で satisfied。具象（infra クライアント）の生成はレジストリが担い、`OpenAiCompatibleClient` の 2 インスタンス化も自然に書ける。
- **却下**: 既存どおり `LLM_PROVIDER` シンボルに具象 1 つを `useClass` で固定。複数 provider 同時保持・id 引きができず要求を満たせない。

### D4: 既存 `LlmProvider` インターフェースは変更しない

- **採用**: `domain/llm-provider.ts` の `LlmProvider`（`listModels`/`generateStream`/`generate`）は無改修。Claude/Gemini アダプタもこれに適合させる。
- **理由**: TSK-107 が「後からリモートを足せるよう」設計した抽象点をそのまま使う。`ChatService`/`ChatCompletionService` から上流（履歴・SSE・永続化）は一切変更不要。
- **却下**: インターフェースに effort 等を足す。軸2 スコープ外であり、足すと OpenAI 互換に無い概念が漏れる。effort 導入時に中立概念として別途設計する。

### D5: 既存 `LLM_*` env を `LOCALLLM_*` へリネーム（破壊的・要運用更新）

- **採用**: 現行 `LLM_BASE_URL`/`LLM_API_KEY`/`LLM_MODEL`（= local 用）を `LOCALLLM_BASE_URL`/`LOCALLLM_API_KEY`/`LOCALLLM_MODEL` にリネーム。新たに provider 別キーと選択キー `LLM_PROVIDER` を追加。
- **理由**: 「provider 別に独立定義」を一貫させるため。`LLM_*` を local 専用のまま残すと命名が非対称で混乱する。
- **影響**: **破壊的変更**。デプロイ済み env（`.envs/.env.dev`・`.env.prod` 等の gitignore 秘密ファイル）は運用者が手で更新する必要がある。`.env.*.example` を更新し、移行を明記する（§8 / §11 シナリオ 5）。
- **却下**: `LLM_*` を local のエイリアスとして後方互換維持。実装に分岐が増え、命名の一貫性も崩れる。1 デプロイ 1 度の env 更新で済むため破壊的変更を許容。

### D6: 起動時の堅牢性（未設定でも boot 可）を維持

- **採用**: レジストリは「必須 env が揃っている provider」のみ実体を生成。`getActive()` が返す有効 provider は、env 不完全でも**生成は成功し、初回利用時に明確なエラー**を投げる（既存 `OpenAiCompatibleClient` の遅延エラー方針を踏襲）。
- **理由**: TSK-107 同様「LLM 未設定でもアプリ起動は妨げない」を守る。serverless 環境で env 欠落時にアプリ全体が落ちるのを防ぐ。
- **却下**: 起動時（DI 解決時）に未設定で throw。boot 耐性が下がる。

## 5. データモデル（domain）

`domain/llm-provider.ts` に provider 識別子を追加。インターフェースは無改修。

```ts
// domain/llm-provider.ts（追記）
export const ProviderIdSchema = z.enum(['claude', 'gemini', 'openai', 'local']);
export type ProviderId = z.infer<typeof ProviderIdSchema>;

// 既存（無改修）
export const LLM_PROVIDER = Symbol('LLM_PROVIDER');           // 有効 provider を束ねる（factory で解決）
export interface LlmProvider {
  listModels(): Promise<LlmModel[]>;
  generateStream(input: ChatGenerationInput): AsyncGenerator<ChatChunk>;
  generate(input: ChatGenerationInput): Promise<ChatResult>;
}

// 追加
export const LLM_PROVIDER_REGISTRY = Symbol('LLM_PROVIDER_REGISTRY');
```

- `ChatGenerationInput` / `ChatChunk` / `ChatResult` / `LlmModel` は**無改修**（effort 非対応のため）。

## 6. アーキテクチャ・公開面

### infra（具象アダプタ・`LlmProvider` 実装）

各クライアントは「自分の設定オブジェクト」を受け取る軽量クラス。`@Injectable` ではなくレジストリが `new` する（2 インスタンス化と per-provider config のため）。

```text
infra/
  openai-compatible.client.ts  … 既存を小改修。constructor(config: OpenAiCompatConfig)
                                  OpenAiCompatConfig = { baseUrl?: string; apiKey: string; defaultModel?: string }
                                  openai / local の 2 インスタンスで共用
  claude.client.ts             … 新規。@anthropic-ai/sdk。constructor(config: ClaudeConfig)
                                  ClaudeConfig = { apiKey: string; defaultModel?: string; maxTokens?: number }
  gemini.client.ts             … 新規。@google/genai。constructor(config: GeminiConfig)
                                  GeminiConfig = { apiKey: string; defaultModel?: string }
  llm.config.ts                … Zod スキーマを provider 別に拡張（§7）
```

- **ClaudeClient**:
  - `generateStream`: `client.messages.stream({ model, max_tokens, system, messages, stream })` を `for await`。`content_block_delta` の `text_delta` を `ChatChunk{delta}` に変換、終端で `{delta:'', done:true, finishReason, model}`。
  - `temperature` は転送しない（Opus 4.8/4.7 は 400）。`max_tokens` は必須のため `input.maxTokens ?? config.maxTokens ?? 8192`。
  - `system` ロールのメッセージは Anthropic の `system` フィールドへ分離、残りを user/assistant にマップ（現状の Chat 履歴は system 無しだが堅牢に扱う）。
  - `thinking` は渡さない（effort スコープ外・既定 OFF）。
  - `listModels`: `client.models.list()` → `LlmModelSchema` で検証しマップ（`ownedBy` は無いため null）。
- **GeminiClient**:
  - `generateStream`: `ai.models.generateContentStream({ model, contents, config:{ systemInstruction } })`。role を `assistant→model` に変換、`contents:[{role, parts:[{text}]}]`。チャンクの text を `ChatChunk{delta}`。
  - `listModels`: `ai.models.list()` → マップ。
  - ※ `@google/genai` の正確なメソッド/フィールド名は Phase 5 で公式ドキュメントに照合（§13 中断条件）。
- **OpenAiCompatibleClient**: 既存ロジック維持。constructor が共有 `LlmConfig` ではなく `OpenAiCompatConfig` を受ける形に変更（[openai-compatible.client.ts:20](../backend/src/chat/infra/openai-compatible.client.ts#L20) 周辺）。

### application

```text
application/
  llm-provider.registry.ts     … 新規。LlmProviderRegistry（@Injectable）
  chat.service.ts              … 無改修（@Inject(LLM_PROVIDER) のまま）
  chat-completion.service.ts   … 無改修
  chat-error.ts                … 原則無改修（§ エラー分類）
```

```ts
@Injectable()
export class LlmProviderRegistry {
  private readonly providers: Map<ProviderId, LlmProvider>;
  private readonly activeId: ProviderId;

  constructor(config: LlmConfig) {
    // 必須 env が揃った provider を生成して Map へ。
    // active(LLM_PROVIDER 指定)は env 不完全でも生成し、初回利用時に明確エラー（遅延）。
  }
  get(id: ProviderId): LlmProvider;       // 未登録なら明確エラー（将来のリクエスト単位アクセス用）
  getActive(): LlmProvider;               // Chat が使う 1 つ
  has(id: ProviderId): boolean;
  availableIds(): ProviderId[];
}
```

### DI 配線（chat.module.ts）

```ts
providers: [
  LlmConfig,
  LlmProviderRegistry,
  { provide: LLM_PROVIDER_REGISTRY, useExisting: LlmProviderRegistry },
  { provide: LLM_PROVIDER, useFactory: (reg: LlmProviderRegistry) => reg.getActive(), inject: [LlmProviderRegistry] },
  ChatService, ChatThreadService, ChatCompletionService,
  { provide: CHAT_THREAD_REPOSITORY, useClass: ChatThreadRepositoryImpl },
],
```

- これにより [chat.service.ts:13](../backend/src/chat/application/chat.service.ts#L13)（`@Inject(LLM_PROVIDER)`）以下は**無改修**で有効 provider を受け取る。

### HTTP / フロント

- 変更なし。送信は `content` のみ（[chat.schemas.ts](../backend/src/chat/application/chat.schemas.ts)）、provider/モデルは env 既定。

## 7. 環境変数（provider 別・Zod 検証）

`infra/llm.config.ts` の `LlmEnvSchema` を以下へ拡張。`LlmConfig` は provider 別 config と有効 id を公開。

| 変数 | provider | 要否 | 既定 / 備考 |
| --- | --- | --- | --- |
| `LLM_PROVIDER` | 共通 | 任意 | `claude\|gemini\|openai\|local`。既定 `local`（後方互換） |
| `CLAUDE_API_KEY` | claude | claude 利用時必須 | — |
| `CLAUDE_MODEL` | claude | 任意 | 既定モデル。例 `claude-opus-4-8` |
| `GEMINI_API_KEY` | gemini | gemini 利用時必須 | — |
| `GEMINI_MODEL` | gemini | 任意 | 既定モデル |
| `OPENAI_API_KEY` | openai | openai 利用時必須 | — |
| `OPENAI_MODEL` | openai | 任意 | 既定モデル。例 `gpt-4o` |
| `OPENAI_BASE_URL` | openai | 任意 | 既定 `https://api.openai.com/v1` |
| `LOCALLLM_BASE_URL` | local | local 利用時必須 | 例 `http://localhost:1234/v1` |
| `LOCALLLM_API_KEY` | local | 任意 | 既定 `not-needed` |
| `LOCALLLM_MODEL` | local | 任意 | 既定モデル |

- 空文字は `undefined` に正規化（既存 [llm.config.ts:27-31](../backend/src/chat/infra/llm.config.ts#L27-L31) の方針踏襲）。
- 「必須」は **その provider が active のとき**に初回利用時エラーで担保（遅延・D6）。env 全欠落でも boot する。

## 8. 既存設計との差分

- infra に `ClaudeClient` / `GeminiClient` を追加。`OpenAiCompatibleClient` の constructor を per-instance config に小改修。
- application に `LlmProviderRegistry` を追加。`chat.module.ts` の DI を単一バインドからレジストリ + factory へ置換。
- `domain/llm-provider.ts` に `ProviderId` / `LLM_PROVIDER_REGISTRY` を追加（`LlmProvider` IF は無改修）。
- 依存追加: `@anthropic-ai/sdk`, `@google/genai`。
- **env 破壊的変更**: `LLM_BASE_URL`/`LLM_API_KEY`/`LLM_MODEL` → `LOCALLLM_*`。provider 別キー + `LLM_PROVIDER` を追加。`.envs/.env.local.example`・`.env.dev.example`・`.env.prod.example` を更新。デプロイ済み env は運用者が手更新。
- migration なし（永続化に変更なし）。
- `ChatChunk`/`ChatGenerationInput`/`ChatService`/`ChatCompletionService`/フロントは無改修。
- `docs/10_architecture/02_backend-architecture.md` の chat フィーチャ記述を「複数 LLM provider 対応」に更新。
- **将来差分（別 TSK・effort）**: `ChatGenerationInput` に provider 中立 `ReasoningEffort('quick'|'balanced'|'deep')` を足し、各アダプタが native（Claude=effort+thinking / Gemini=thinkingBudget / OpenAI 互換=無視）へ翻訳。フロントに effort セレクタを追加。本タスクの抽象はこの拡張を阻害しない。

## 9. トランザクション境界

DB への新規副作用なし。LLM 呼び出し（外部副作用）のみで、既存の永続化フローも変更しないため、トランザクション境界は不要。

## 10. 完了条件（実装視点の具体化）

- [ ] `domain/llm-provider.ts` に `ProviderId`(Zod) と `LLM_PROVIDER_REGISTRY` があり、`LlmProvider` IF は無改修
- [ ] `infra/claude.client.ts`（`@anthropic-ai/sdk`）が `LlmProvider` を実装し、stream/listModels/generate が動く
- [ ] `infra/gemini.client.ts`（`@google/genai`）が `LlmProvider` を実装し、stream/listModels/generate が動く
- [ ] `OpenAiCompatibleClient` が per-instance config で `openai`/`local` の 2 用途に使える
- [ ] `application/llm-provider.registry.ts` が設定済み provider を保持し `get`/`getActive`/`has`/`availableIds` を提供
- [ ] `application` から各 SDK を直接 import していない（`infra` 経由のみ）。`domain` は SDK/infra を import しない
- [ ] `chat.module.ts` が `LLM_PROVIDER` を `getActive()` で解決し、`ChatService` 以下が無改修で動く
- [ ] `LLM_PROVIDER=claude|gemini|openai|local` の切替で、それぞれ実 API にストリーミング接続できる（手動シナリオ §11）
- [ ] env を Zod で検証。active provider の env 不完全時は初回利用で明確なエラー、全欠落でも boot 可
- [ ] `.envs/.env.local.example`・`.env.dev.example`・`.env.prod.example` を provider 別キーへ更新
- [ ] `llm-provider.registry.spec.ts` がレジストリの解決ロジックを検証（全緑）
- [ ] `pnpm --filter backend build` / `pnpm --filter backend test` が通る
- [ ] `npx markdownlint-cli 'docs/**/*.md'` が通る

## 11. 手動動作確認シナリオ

> 確認用の使い捨てスクリプト（`backend/scripts/llm-smoke.ts`）を一時作成し、NestJS 文脈で `LlmProviderRegistry` / `ChatService` を解決して実行。確認後 `.trash/` へ退避（コミットしない）。

1. **Local（後方互換）**: `LLM_PROVIDER=local` + `LOCALLLM_BASE_URL` 設定で、`ChatService.generateStream` が従来どおりストリーム応答。
2. **Claude**: `LLM_PROVIDER=claude` + `CLAUDE_API_KEY`/`CLAUDE_MODEL` で、実 Claude API からストリーム応答が届く。
3. **Gemini**: `LLM_PROVIDER=gemini` + `GEMINI_API_KEY`/`GEMINI_MODEL` で、実 Gemini API からストリーム応答が届く。
4. **OpenAI（本家）**: `LLM_PROVIDER=openai` + `OPENAI_API_KEY`/`OPENAI_MODEL` で、実 OpenAI API からストリーム応答が届く。
5. **env 移行**: 旧 `LLM_*` のみ設定 + `LLM_PROVIDER` 未設定（既定 local）かつ `LOCALLLM_*` 未設定の場合、active=local の初回利用で「LocalLLM 未設定」の明確なエラーが出る（旧キーは読まない＝移行が必要と分かる）。
6. **レジストリ id 引き・複数アクセス**: `registry.availableIds()` が設定済み provider の id を返し、`registry.get('claude')` 等で個別取得できる。さらに複数 id を取り出し（例 claude と gemini）同一入力で並行に `generate` を呼べる（1 つまたは複数アクセス基盤の確認）。

（ユニットテストではレジストリ解決とモック provider を検証。実接続は手動シナリオで担保。）

## 12. 未確定事項

- `@google/genai` の正確な API バインディング（`generateContentStream` のチャンク形・`models.list` の戻り）→ Phase 5 で公式ドキュメント照合（§13 中断条件）。
- Gemini SDK エラーの `status` 露出有無 → 既存 `classifyLlmError` のダックタイピング（`status`）で拾えるか Phase 5 で確認。拾えなければアダプタ内で正規化。
- effort（軸2）は本タスク対象外（別 TSK）。

---

## 13. 実装計画（Phase 4 確定）

ドライラン結果: 影響範囲は chat フィーチャ内に完全に閉じている（`LlmConfig`/`OpenAiCompatibleClient` の利用箇所は `chat.module.ts` とクライアント自身のみ。外部消費者なし）。未解決の判断ポイントはなし。

### 13.1 変更・追加ファイル

#### 追加（backend/src/chat/）

- `infra/claude.client.ts` … `ClaudeClient implements LlmProvider`（`@anthropic-ai/sdk`）
- `infra/gemini.client.ts` … `GeminiClient implements LlmProvider`（`@google/genai`）
- `application/llm-provider.registry.ts` … `LlmProviderRegistry`（@Injectable）
- `application/llm-provider.registry.spec.ts` … レジストリのユニットテスト

#### 変更（backend/src/chat/）

- `domain/llm-provider.ts` … `ProviderIdSchema`/`ProviderId` と `LLM_PROVIDER_REGISTRY` を追加（`LlmProvider` IF は無改修）
- `infra/llm.config.ts` … `LlmEnvSchema` を provider 別に全面拡張。`LlmConfig` は `activeProviderId` / `isConfigured(id)` / 各 provider config を公開
- `infra/openai-compatible.client.ts` … constructor を `OpenAiCompatConfig`（`{ baseUrl?, apiKey, defaultModel?, label }`）受けに改修。`@Injectable` 除去（レジストリが `new`）。遅延エラーはレジストリ側に移譲
- `chat.module.ts` … `LLM_PROVIDER` を `useFactory: reg.getActive()` へ。`LlmProviderRegistry` と `LLM_PROVIDER_REGISTRY` を providers に追加

#### 変更（その他）

- `backend/package.json` … `@anthropic-ai/sdk` / `@google/genai` 依存追加
- `backend/.envs/.env.local.example` / `.env.dev.example` / `.env.prod.example` … `LLM_*` を provider 別キー + `LLM_PROVIDER` へ更新
- `docs/10_architecture/02_backend-architecture.md` … chat 行更新（コミット済み）
- `docs/tsk-116_multi-llm-provider.md` … 本実装計画（§13）

### 13.2 migration・環境変数・依存

- **migration**: なし（永続化に変更なし）。
- **依存追加**: `pnpm --filter backend add @anthropic-ai/sdk @google/genai`（最新安定版・caret 範囲）。
- **環境変数**: §7 のとおり。`LLM_*`（旧 local 用）は廃止し `LOCALLLM_*` へリネーム（破壊的・運用者が手更新）。

### 13.3 作業順序（コミット単位・各完了確認）

各コミットでビルド緑を維持する。config 形・クライアント・module は相互依存するため、配線切替は 1 コミットにまとめる。

1. **依存追加**: `@anthropic-ai/sdk` / `@google/genai`。確認: `pnpm --filter backend build`。
2. **domain 追加**: `domain/llm-provider.ts` に `ProviderIdSchema`/`ProviderId`/`LLM_PROVIDER_REGISTRY`（additive）。確認: build。
3. **provider 基盤の配線一式**（1 コミット）:
   - `infra/llm.config.ts` 全面拡張
   - `infra/openai-compatible.client.ts` を `OpenAiCompatConfig` 受けへ改修
   - `infra/claude.client.ts` / `infra/gemini.client.ts` 新規
   - `application/llm-provider.registry.ts` 新規
   - `chat.module.ts` をレジストリ + factory 配線へ置換
   - 確認: `pnpm --filter backend build`（DI 解決）+ `pnpm --filter backend test`（既存 `chat.service.spec.ts` が緑のまま＝上流無改修の証跡）。
4. **レジストリのテスト**: `application/llm-provider.registry.spec.ts`。確認: `pnpm --filter backend test`。
5. **env example + 設計書整合**: 3 つの `.env.*.example` を provider 別キーへ更新。確認: build / test / `npx markdownlint-cli 'docs/**/*.md'`。

### 13.4 テスト方針

- `llm-provider.registry.spec.ts`: ダミー `ConfigService`（`get` をモック）から `LlmConfig` を構築し、レジストリの解決を検証。**実 API には接続しない**。
  - 複数 provider 設定時、`availableIds()` が設定済み id を返す。
  - `get('claude')` 等が対応する `LlmProvider` 実体を返す（`instanceof` で確認）。
  - `getActive()` が `LLM_PROVIDER` 指定の provider を返す。
  - active provider が未設定（必須 env 欠落）時、`getActive()` は遅延スタブを返し、メソッド呼び出しで provider 固有の明確なエラーを投げる。
  - 未登録 id への `get()` は明確なエラー。
- infra クライアント（SDK ラッパー）はユニットテスト対象外（[testing-strategy](40_processes/02_testing-strategy.md)）。実接続は手動シナリオ §11（Phase 6・実 API キー必要）で担保。
- **スモークスクリプトは Phase 5 では作らない**（subagent は API キーを持たないため）。Phase 5 完了条件は build + unit test + lint の通過。

### 13.5 想定外時の判断ルール

#### 標準セット

- **AI 単独判断 OK**: 軽微な既存コードリファクタ、設計書スコープ内の追加実装。
- **中断して要相談**: データモデル変更、API 仕様変更、トランザクション境界変更、外部 API 想定差異、設計判断ログを覆す変更。

#### TSK-116 固有（中断条件）

- `@google/genai` の `generateContentStream` / `models.list` のシグネチャ・チャンク形（`chat.text` / `contents:[{role,parts:[{text}]}]` / `config.systemInstruction`）が本設計の想定と乖離 → **中断**（外部 API 想定差異）。型レベルで追従可能な軽微差なら SDK 型に従い AI 判断で続行。
- `@anthropic-ai/sdk` の `messages.stream` / `models.list` が想定（§6）と乖離 → 同上。
- Gemini SDK エラーが `status` を露出せず既存 `classifyLlmError` で `LLM_GENERATION_FAILED` に落ちる場合 → `GeminiClient` 内で SDK エラーを `{status}` 形へ正規化して throw（軽微追従・AI 判断可）。露出形が不明で設計判断が必要なら中断。
- `LlmProvider` IF・`ChatChunk`・`ChatGenerationInput`・`ChatService` 上流を変更する必要が生じたら → **中断**（スコープ・設計判断を覆す）。
- 実 LLM への接続確認は subagent では不可（API キー無し）。**build + unit test + lint の通過を完了条件**とし、実接続は Phase 6 の手動シナリオに委ねる。

### 13.6 事前解決済みの判断ポイント

| # | 判断ポイント | 解決 |
| --- | --- | --- |
| 1 | provider 別 config の公開形 | `LlmConfig` が `activeProviderId` / `isConfigured(id)` / `claudeConfig`・`geminiConfig`・`openaiConfig`・`localConfig` を公開 |
| 2 | `LLM_PROVIDER` 既定 | `local`（後方互換） |
| 3 | env 検証方針 | 全 provider キーを optional で `parse`、空文字→undefined 正規化。「必須」は active 利用時の遅延エラーで担保（boot は妨げない） |
| 4 | 「configured」判定 | claude=`CLAUDE_API_KEY` / gemini=`GEMINI_API_KEY` / openai=`OPENAI_API_KEY` / local=`LOCALLLM_BASE_URL` の有無。レジストリは configured な provider のみ実体生成 |
| 5 | active が未 configured | レジストリが provider 固有メッセージを投げる遅延スタブを返す（boot 維持・利用時エラー） |
| 6 | infra クライアントの DI | `@Injectable` 除去しレジストリが `new`。Nest provider はレジストリのみ |
| 7 | OpenAI/Local の共用 | `OpenAiCompatibleClient` を 2 インスタンス。`openai`= baseURL 既定 `https://api.openai.com/v1`、`local`= `LOCALLLM_BASE_URL` 必須。`label` を config に持たせエラーメッセージを正確化 |
| 8 | Claude `max_tokens` | 必須のため `input.maxTokens ?? 8192`（定数既定。専用 env は設けない） |
| 9 | Claude `temperature` | 転送しない（Opus 4.8/4.7 は 400） |
| 10 | Claude system ロール | `role:'system'` のメッセージを `system` フィールドへ分離、残りを user/assistant にマップ |
| 11 | Claude `thinking` | 渡さない（effort スコープ外・既定 OFF） |
| 12 | Claude 終端チャンク | `stream.finalMessage()` から `model`/`stop_reason` を取り `{delta:'', done:true, finishReason, model}` |
| 13 | Claude `listModels` | `client.models.list()` → `LlmModelSchema.parse({id, ownedBy:null})` |
| 14 | Gemini role 変換 | `assistant→model`、`system`→`config.systemInstruction`（複数は `\n\n` 連結） |
| 15 | Gemini stream | `const stream = await ai.models.generateContentStream(...)` を `for await`、`chunk.text` を delta。終端は `candidates[0].finishReason` |
| 16 | Gemini `listModels` | `ai.models.list()` を走査。`name`（`models/` 接頭辞を除去）を `id`、`ownedBy:null` |
| 17 | 既定モデル文字列（example 記載） | Claude=`claude-opus-4-8` / Gemini=`gemini-2.5-flash` / OpenAI=`gpt-4o`（example の参考値。運用者が変更可） |
| 18 | env 移行 | 旧 `LLM_*` は読まない。`.env.*.example` を全更新し移行を明記。デプロイ済み env は運用者更新 |
| 19 | スモーク確認 | Phase 5 では作らない。完了条件は build/test/lint。実接続は Phase 6 手動 |
| 20 | コミット分割 | config↔client↔module の相互依存のため配線は 1 コミットに集約（§13.3-3） |
