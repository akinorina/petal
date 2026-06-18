# TSK-123 LLM provider クライアントの画像変換と vision 対応可否判定（設計書）

- Notion: <https://app.notion.com/p/3839ca7d99dc819596aaed5d53934345>
- プロジェクト: PRJ-17（Petal LLM画像対応）<https://app.notion.com/p/3819ca7d99dc80e7babef670bc6292ae>
- 規模: L / 重要度: HIGH
- 関連: [docs/20_features/09_chat.md](20_features/09_chat.md)（LLM チャット現状仕様） / [docs/tsk-122_chat-multimodal-persistence.md](tsk-122_chat-multimodal-persistence.md)（先行・マルチモーダル content 型）

## 1. 課題シート（Notion 転記・フリーズ）

### 一行サマリ

Claude／Gemini／OpenAI 各クライアントで画像 parts を base64（各 API 形式）へ変換し、provider ごとの vision 対応可否判定と非対応 provider への送信 block 機構を追加する。

### 背景・動機

PRJ-17 の provider 層タスク。全 4 provider 対応とし、base64 埋め込みで画像を送る。Local 等 vision 非対応への画像付き送信は送信前にエラーで block する方針。

### 完了条件

- Claude（image block）／Gemini（inlineData）／OpenAI（image_url の data URL）へ画像 parts を base64 で変換して送信できる。
- provider ごとの vision 対応可否を設定／判定する仕組みがある。
- vision 非対応 provider に画像付き content を渡すと送信前に明確なエラーになる。
- 変換ロジックは各 infra クライアントに隔離（application から SDK を直接触らない）。
- ユニットテストで各 provider 変換と非対応エラーを担保。`cd backend && pnpm build` が通る。

### スコープ外

- API／controller の受け取り・認可・枚数検証（TSK-③）。
- 永続化・ドメイン型（TSK-①・完了済み）。
- vision 非対応エラーの HTTP ステータス分類（`classifyLlmError` 拡張は TSK-③）。

### 制約

- 外部 SDK 呼び出しは infra 隔離。`any` 禁止・Zod 検証。接続先 URL・上流本文など秘密情報をエラーに含めない。

### 不明点・迷い

解決済み（vision 判定＝provider 別静的既定＋env 上書き / 公開＝interface に supportsVision＋内部 guard / エラー＝専用クラス。Phase 3 で確定）。

## 2. スコープ

### 対象

- domain: `LlmProvider` に `supportsVision()` を追加。`VisionUnsupportedError` を新設。画像 part 検出ヘルパー。
- infra: 3 クライアント（claude/gemini/openai-compatible）の content マッピングを画像 part 対応に拡張＋vision guard。`llm.config.ts` に vision 可否設定を追加。`UnconfiguredProvider` の interface 追従。
- env: `OPENAI_VISION` / `LOCALLLM_VISION` を追加（`.env.example` 更新）。
- テスト: 各 provider の純粋マッパー・supportsVision・非対応 guard。

### 対象外

- 上記「スコープ外」のとおり。

## 3. 設計判断ログ

### 判断 1: vision 対応可否の判定 → provider 別の静的既定＋env 上書き（採用）

- **採用**: `claude`/`gemini` は常に `true`。OpenAI 互換の 2 つは config の `supportsVision`（`openai` 既定 `true` / `local` 既定 `false`）で持ち、env `OPENAI_VISION` / `LOCALLLM_VISION` で上書き可能。運用者が local モデルの実態に合わせられ、モデル名パースの脆さを避ける。
- 却下: 全 provider env フラグ（claude/gemini も既定値が要り冗長）。
- 却下: モデル名ヒューリスティック（モデル追加で崩れ、local の任意モデル名で判定不能）。

### 判断 2: 公開とエラー block の置き場所 → interface に `supportsVision()` ＋ 各 provider 内部 guard（採用）

- **採用**: `LlmProvider` に `supportsVision(): boolean` を追加（application/TSK-③ が送信前チェック可能）。加えて各 provider の `generateStream` 冒頭で「画像 part を含む & 非対応」を検出したら **SDK 生成・ネットワーク呼び出し前に** `VisionUnsupportedError` を throw（多層防御）。
- 却下: 内部 guard のみ（application からの事前チェック手段が無く、TSK-③ でストリーム開始前 HTTP 化がしづらい）。
- 補足: claude/gemini は `supportsVision()` が常に true のため guard は発火しないが、一貫性のため全 provider に同じ guard を置く（低コスト）。

### 判断 3: vision 非対応エラーの型 → 専用クラス `VisionUnsupportedError`（採用）

- **採用**: `chat/domain/` に `VisionUnsupportedError extends Error` を新設。provider が throw、TSK-③ が `instanceof` で 4xx（クライアント起因）にマップしやすい。`classifyLlmError`（上流エラー分類）と明確に区別できる。
- 却下: 汎用 Error＋code 文字列（TSK-③ での判別がダックタイピングになり脆い）。
- メッセージ: `この LLM (<表示名>) は画像入力に対応していません。` のように **表示名（label）のみ**含め、接続先 URL・キー等の秘密情報は含めない。

### 判断 4: マッピングの実装形 → 各クライアントに純粋関数を export して隔離＋テスト（採用）

- **採用**: 各クライアントファイルに content→SDK parts の **純粋関数を export**（`toClaudeMessages` 等）し、インスタンスメソッドはそれを呼ぶ。SDK を起動せずユニットテスト可能にする。マッピングは infra 内に隔離（application は触らない）。
- 却下: private メソッドのまま（SDK 起動なしに変換だけを単体テストできない）。

### 判断 5: 文字列 content の後方互換 → 従来どおり文字列で送る（採用）

- **採用**: `content` が `string` のメッセージ（既存履歴・テキスト送信）は従来どおり各 SDK にプレーン文字列／単一 text として渡す。`ChatContentPart[]` のときのみ parts 配列を組み立てる。system ロールは画像を持てないため従来どおり `contentToText` でテキスト化。
- 根拠: 既存テキストチャットの挙動・トークン形を変えない。

## 4. データモデル

変更なし（DB マイグレーション不要）。env を 2 つ追加（§7）。

## 5. ドメイン

- `chat/domain/llm-provider.ts`: `LlmProvider` interface に `supportsVision(): boolean` を追加。
- `chat/domain/vision-unsupported.error.ts`（新規）: `VisionUnsupportedError extends Error`（`name='VisionUnsupportedError'`、引数に provider 表示名）。
- `chat/domain/llm-message.ts`: 画像 part 検出ヘルパー `hasImageContent(messages: { content: string | ChatContentPart[] }[]): boolean`（純粋・テスト可）を追加。

## 6. infra（provider クライアント・config）

### 6.1 `llm.config.ts`

- `LlmEnvSchema` に boolean-ish の `OPENAI_VISION` / `LOCALLLM_VISION` を optional で追加。env 文字列は `'true'|'1'` を true、`'false'|'0'` を false としてパース（`z.enum([...]).transform`）。空文字は既存どおり undefined 正規化。
- `OpenAiCompatConfig` に `supportsVision: boolean` を追加。`openaiConfig` は `this.env.OPENAI_VISION ?? true`、`localConfig` は `this.env.LOCALLLM_VISION ?? false`。

### 6.2 各クライアント

共通: `generateStream` 冒頭で `if (!this.supportsVision() && hasImageContent(input.messages)) throw new VisionUnsupportedError(<label>)`（SDK 生成前）。`supportsVision()` を実装。

- `claude.client.ts`: `supportsVision()=>true`。`splitMessages` を拡張し、`content` が配列なら `Array<Anthropic.TextBlockParam | Anthropic.ImageBlockParam>` を組む（text→`{type:'text',text}`、image→`{type:'image',source:{type:'base64',media_type,data}}`）。`media_type` は SDK のリテラル型へ cast（`as`、`any` 不使用。形式検証は TSK-①/③）。文字列はそのまま。system は `contentToText`。
- `gemini.client.ts`: `supportsVision()=>true`。`mapMessages` の `parts` を text→`{text}` / image→`{inlineData:{mimeType:mediaType,data}}` で組む。文字列は単一 `{text}`。
- `openai-compatible.client.ts`: `supportsVision()=> this.config.supportsVision`。`messages.map` の `content` を、配列なら `Array<ChatCompletionContentPart>`（text→`{type:'text',text}`、image→`{type:'image_url',image_url:{url:'data:<mediaType>;base64,<data>'}}`）、文字列はそのまま。

### 6.3 `UnconfiguredProvider`（application/llm-provider.registry.ts）

- `supportsVision(): boolean => false` を追加（interface 追従。利用時は従来どおり明確エラー）。

## 7. 環境変数

| 変数 | 既定 | 説明 |
| ---- | ---- | ---- |
| `OPENAI_VISION` | `true` | OpenAI（本家）provider の画像入力対応可否（`true`/`false`） |
| `LOCALLLM_VISION` | `false` | LocalLLM provider の画像入力対応可否（モデルに合わせて運用者が設定） |

- `.env.local.example` / `.env.dev.example` に追記。秘密情報ではないが `NEXT_PUBLIC_*` には置かない（backend のみ）。

## 8. トランザクション境界

なし（DB 非依存）。

## 9. 既存設計との差分

- domain: `llm-provider.ts`（`supportsVision`）/ `vision-unsupported.error.ts`（新規）/ `llm-message.ts`（`hasImageContent`）。
- infra: `claude.client.ts` / `gemini.client.ts` / `openai-compatible.client.ts`（画像マッピング＋guard＋supportsVision）/ `llm.config.ts`（vision env・config）。
- application: `llm-provider.registry.ts` の `UnconfiguredProvider` に `supportsVision`。
- env: `.env.local.example` / `.env.dev.example`。
- ドキュメント: `docs/20_features/09_chat.md` への反映は TSK-⑤（仕上げ）に委ねる（本設計書のみ追加）。
- `ChatCompletionService` / `classifyLlmError` は**変更しない**（HTTP 化・分類は TSK-③）。

## 10. 完了条件（具体化版）

- [ ] claude/gemini/openai の純粋マッパーが text＋image parts を各 SDK 形式（image block / inlineData / image_url data URL）へ base64 変換する。
- [ ] `LlmProvider.supportsVision()` が claude/gemini=true、openai=env（既定 true）、local=env（既定 false）を返す。
- [ ] 非対応 provider（local 既定）の `generateStream` に画像付き content を渡すと、SDK 呼び出し前に `VisionUnsupportedError` を throw する。
- [ ] エラーメッセージに接続先 URL・キー等の秘密情報を含めない。
- [ ] 文字列 content（既存テキスト）の送信挙動が不変（後方互換）。
- [ ] ユニットテストで各 provider 変換・supportsVision・非対応 guard・`hasImageContent` を網羅。
- [ ] `cd backend && pnpm lint && pnpm test && pnpm build` が通る。

## 11. 未確定事項

なし（Phase 2・3 ですべて解決）。vision 非対応エラーの HTTP 分類は TSK-③ の責務。

---

## 12. 実装計画（Phase 4）

### 12.1 変更・追加ファイル

#### コミット 1: vision 対応可否判定と非対応 block

- `backend/src/chat/domain/llm-provider.ts`（変更）: `LlmProvider` interface に `supportsVision(): boolean` を追加。
- `backend/src/chat/domain/vision-unsupported.error.ts`（新規）: `VisionUnsupportedError extends Error`（`name` 設定、コンストラクタに provider 表示名）。
- `backend/src/chat/domain/llm-message.ts`（変更）: `hasImageContent(messages: { content: string | ChatContentPart[] }[]): boolean` を追加。
- `backend/src/chat/infra/llm.config.ts`（変更）: `LlmEnvSchema` に `OPENAI_VISION` / `LOCALLLM_VISION`（boolean-ish・optional）。`OpenAiCompatConfig` に `supportsVision: boolean`。`openaiConfig`=`?? true`、`localConfig`=`?? false`。
- `backend/src/chat/infra/claude.client.ts` / `gemini.client.ts` / `openai-compatible.client.ts`（変更）: `supportsVision()` 実装（claude/gemini=true、openai-compat=`config.supportsVision`）＋ `generateStream` 冒頭に guard（`!supportsVision() && hasImageContent(input.messages)` → `throw new VisionUnsupportedError(label)`、SDK 生成前）。
- `backend/src/chat/application/llm-provider.registry.ts`（変更）: `UnconfiguredProvider.supportsVision(): boolean => false`。
- `backend/.envs/.env.local.example` / `.env.dev.example`（変更）: `OPENAI_VISION` / `LOCALLLM_VISION` を追記。
- テスト（新規/変更）:
  - `backend/src/chat/domain/llm-message.spec.ts`（変更・追記）: `hasImageContent`（string のみ false / image part あり true / text part のみ false）。
  - `backend/src/chat/domain/vision-unsupported.error.spec.ts`（新規）: name・message に表示名を含み秘密情報を含まない。
  - `backend/src/chat/infra/openai-compatible.client.spec.ts`（新規）: `supportsVision()` が config を反映 / 非対応時 `generateStream` の最初の `next()` が `VisionUnsupportedError` を投げる（ネットワーク非発生）。
- 完了確認: `cd backend && pnpm lint && pnpm test && pnpm build`。

#### コミット 2: 画像 part の base64 変換

- `backend/src/chat/infra/claude.client.ts`（変更）: 純粋関数 `toClaudeContent(content): string | Array<Anthropic.TextBlockParam | Anthropic.ImageBlockParam>` を export。`splitMessages` がこれを使う。image→`{type:'image',source:{type:'base64',media_type: mediaType as Anthropic.Base64ImageSource['media_type'], data}}`。文字列はそのまま。system は `contentToText`。
- `backend/src/chat/infra/gemini.client.ts`（変更）: 純粋関数 `toGeminiParts(content): Part[]` を export。text→`{text}`、image→`{inlineData:{mimeType:mediaType,data}}`。文字列は `[{text}]`。
- `backend/src/chat/infra/openai-compatible.client.ts`（変更）: 純粋関数 `toOpenAiContent(content): string | ChatCompletionContentPart[]` を export。image→`{type:'image_url',image_url:{url:`data:${mediaType};base64,${data}`}}`、text→`{type:'text',text}`。文字列はそのまま。
- テスト（新規）:
  - `backend/src/chat/infra/claude.client.spec.ts` / `gemini.client.spec.ts`（新規）＋ openai のマッパーケース追記: text＋image 混在 content が各 SDK 形式へ正しく変換される。文字列 content は従来形のまま。
- 完了確認: `cd backend && pnpm lint && pnpm test && pnpm build`。

### 12.2 migration・環境変数・依存追加

- migration: **不要**。
- 環境変数: `OPENAI_VISION`（既定 true）/ `LOCALLLM_VISION`（既定 false）を追加。`.env.example` 2 ファイル更新。
- 依存追加: **不要**（既存 SDK の型を使用）。

### 12.3 実装方針メモ（確定仕様）

- boolean-ish env パース: `z.enum(['true','false','1','0']).transform((v) => v === 'true' || v === '1')`。想定外値は startup で fail fast（既存の env 検証方針）。空文字は既存どおり undefined 正規化（getter 側で `?? 既定`）。
- guard は各 `generateStream` の**最初**（`resolveModel`/`this.client` アクセス前）に置き、ネットワーク前に throw する。`generate()` は `generateStream` 経由のため自動的に同 guard を通る。
- Claude `media_type` は SDK リテラル型へ `as` cast（`any` 不使用）。mediaType の形式検証は TSK-①/③ の責務（本タスクは通過のみ）。
- 文字列 content は全 provider で従来挙動（後方互換）。system ロールは画像非対応のため `contentToText`。

### 12.4 作業順序（コミット単位・各完了確認）

1. **`feat(tsk-123): provider の vision 対応可否判定と非対応 block を追加`** — §12.1 コミット 1。完了確認: backend lint/test/build パス。
2. **`feat(tsk-123): provider の画像 part を base64 で各 API 形式へ変換`** — §12.1 コミット 2。完了確認: backend lint/test/build パス。

### 12.5 テスト方針

- domain（`hasImageContent` / `VisionUnsupportedError`）と各 provider の**純粋マッパー**＋`supportsVision`＋非対応 guard をユニットテストで担保。
- マッパーを export 純粋関数化することで SDK・ネットワーク非依存で変換を検証（判断 4）。

### 12.6 想定外時の判断ルール

- **AI 単独判断 OK**: SDK の正確なフィールド名差異の調整（例: Gemini `inlineData` の Blob フィールド名）、命名・cast の微調整、設計書スコープ内の追加実装。
- **中断して要相談**:
  - vision 判定方式（判断 1）・公開/エラー方針（判断 2,3）を覆す必要。
  - `ChatCompletionService`／`classifyLlmError`／API への波及が必要と判明（TSK-③ 越境）。
  - 永続化・ドメイン content 型の変更が必要と判明（TSK-① 越境）。
  - SDK が base64 image をサポートせず方式変更が要る場合。

### 12.7 事前解決済みの判断ポイント

- vision 判定 → provider 別静的既定＋env 上書き（判断 1）。
- 公開/ block → interface `supportsVision()` ＋ 各 provider 内部 guard（判断 2）。
- エラー型 → 専用 `VisionUnsupportedError`、表示名のみ・秘密情報なし（判断 3）。
- マッピング実装 → 各クライアントに純粋関数を export してテスト（判断 4）。
- 文字列 content → 後方互換で従来送信（判断 5）。
- env boolean パース → 厳格 enum＋transform、fail fast。
- media_type → SDK リテラル型へ cast、形式検証は本タスク対象外。
- `ChatCompletionService`/`classifyLlmError`/API → **非変更**（HTTP 分類は TSK-③）。

## 13. 手動動作確認シナリオ

1. `LLM_PROVIDER=local`（vision 非対応既定）で画像付き content を送ると、SDK 呼び出し前に `VisionUnsupportedError` になる（ユニットテストで担保、必要なら手動確認）。
2. `LOCALLLM_VISION=true` を設定すると local でも guard を通過する（supportsVision が反映）。
3. 既存のテキストのみチャット（claude/gemini/openai/local）が従来どおり動作（後方互換）。
4. （TSK-③ 連携後に実機確認）claude/gemini/openai に画像 part 付き content を渡すと各 API 形式へ base64 変換されて送信される。
