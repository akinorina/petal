# TSK-122 チャットメッセージのマルチモーダル化と添付画像の永続化（設計書）

- Notion: <https://app.notion.com/p/3839ca7d99dc81e18249f2d74166d203>
- プロジェクト: PRJ-17（Petal LLM画像対応）<https://app.notion.com/p/3819ca7d99dc80e7babef670bc6292ae>
- 規模: L / 重要度: HIGH
- 関連: [docs/20_features/09_chat.md](20_features/09_chat.md)（LLM チャット現状仕様） / [docs/20_features/04_image-management.md](20_features/04_image-management.md)（画像管理）

## 1. 課題シート（Notion 転記・フリーズ）

### 一行サマリ

チャットメッセージを text＋image parts のマルチモーダル content へ拡張し、添付画像（petal.images 参照）をメッセージに紐付ける永続化スキーマ・migration を追加する。

### 背景・動機

PRJ-17（Petal LLM画像対応）の基盤タスク。現状 `ChatMessage.content` は string のみで画像を持てない。マルチモーダル対話の土台として、ドメイン型と永続化を先に整える。

### 完了条件

- `ChatMessage`／`llm-message` が text＋image parts のマルチモーダル content を Zod スキーマで表現（不変条件＋`parse()`）。
- 添付画像参照（petal.images への参照）をメッセージに複数紐付けて保存・取得できるエンティティ／repository。
- migration を追加し（`synchronize: false`・論理削除踏襲）、既存テキストメッセージと後方互換。
- application 層のユニットテストで保存・取得を担保。
- `cd backend && pnpm build` が通る。

### スコープ外

- provider への画像変換（base64 マッピング・vision 可否）= TSK-②。
- API／controller の拡張（image id 受け取り・認可・枚数検証・base64 構築・履歴の添付返却）= TSK-③。
- フロント = TSK-④。
- 枚数上限・サイズ上限の enforcement（最終決定と検証は TSK-③）。

### 制約

- DDD＋オニオン、フィーチャ優先構成。Domain は Infrastructure を参照しない。
- TypeScript `any` 禁止・`strict`、外部入力は Zod 検証。物理削除禁止（論理削除）。
- `synchronize: false`。スキーマ変更は migration ファイルで管理。

### 不明点・迷い

解決済み（永続化＝別テーブル / ワイヤ image part＝base64 保持型 / join 行＝image_id 参照のみ。Phase 3 で確定）。

## 2. スコープ

### 対象

- ドメイン: 永続化 `ChatMessage` に順序付き添付画像参照を追加。ワイヤ `llm-message` の content をマルチモーダル（text＋image parts）に拡張。
- 永続化: `chat_message_images` join テーブル（エンティティ＋ repository＋ migration）。
- テスト: repository／service の保存・取得・順序・後方互換。

### 対象外

- 上記「スコープ外」のとおり。

## 3. 設計判断ログ

### 判断 1: 添付画像参照の永続化 → 別テーブル `chat_message_images`（採用）

- **採用**: `petal.chat_message_images`（`message_id` FK→chat_messages RESTRICT / `image_id` FK→images RESTRICT / `position` / 日時 / `deleted_at`）。`chat_messages.content TEXT` は据え置き（後方互換）。正規化・FK 整合・順序・論理削除が素直で、画像の物理削除防止（RESTRICT）を DB で保証できる。
- 却下: `chat_messages` に JSON 列追加（FK 整合・検索性が劣り、画像 RESTRICT を担保できない）。
- 却下: `content` を JSON 化（既存 TEXT データ移行が必要で後方互換コスト大、FK も効かない）。

### 判断 2: join 行の保存情報 → `image_id` 参照のみ（採用）

- **採用**: 行は `message_id` / `image_id` / `position` / 日時 / `deleted_at` のみ。`mime_type`／`s3_key` 等は表示・送信時に `images` テーブルを join して解決（TSK-③）。二重管理・不整合を避ける。
- 却下: `mime_type`／`s3_key` を非正規化スナップショット保存（`images` と二重管理・不整合リスク）。

### 判断 3: ワイヤ `llm-message` の画像 part → base64 データ保持型（採用）

- **採用**: `ChatContentPart = { type:'text', text } | { type:'image', mediaType, data }`（`data` は base64）。`content` を `string | ChatContentPart[]` のユニオンにし、**string も許容**（後方互換）。provider（TSK-②）は base64 を各 API 形式へマップするだけで、S3／DB から切り離される。参照→base64 の解決は application（TSK-③）が担う。
- 却下: image part に `imageId` を持たせる（provider が S3 取得を担うことになり infra 隔離・責務分離が崩れる）。

### 判断 4: 永続化 `ChatMessage` の表現 → content（text）据え置き＋ `attachments` 配列（採用）

- **採用**: 永続 `ChatMessage` は `content: string`（本文テキスト）を据え置き、`attachments: ChatMessageImageRef[]`（順序付き、`imageId` の並び）を追加。配列の並び順を `position` として保存する。永続層はマルチモーダル parts を持たず「テキスト＋添付画像 id 群」で表す（base64 は持たない）。
- 却下: 永続 `content` 自体を parts 配列化（既存データ移行が必要・判断 1 と不整合）。
- 補足: ワイヤ（判断 3）と永続（判断 4）は別表現。永続＝「text＋image id」、ワイヤ＝「text/image(base64) parts」。両者の変換（id→base64）は TSK-③。

### 判断 5: provider のコンパイル互換 → テキスト正規化ヘルパーを 122 で導入（採用・スコープ境界）

- **採用**: 判断 3 で `ChatGenerationInput` の `content` がユニオンになるため、既存 3 provider（claude/gemini/openai）が型不整合になる。122 では共通ヘルパー `contentToText(content)`（domain）を導入し、各 provider は `content` をこれでテキストへ正規化してから従来どおり送る。**画像 part の実マッピング（base64→各 API 形式）と vision 可否は TSK-② が担当**。122 の provider 変更は「ユニオン型を受けてもビルド・テキスト挙動が不変」にする最小修正のみ。
- 根拠: 完了条件「llm-message がマルチモーダル content を Zod で表現」を**死蔵型でなく実型**として満たしつつ、画像意味づけは TSK-② に閉じる。現状 image part を生成する呼び出し元は無い（TSK-③ で追加）ため、122 では text 経路のみ実行される。
- 却下: 122 では `ChatGenerationInput.content` を string のまま据え置き、parts 型は未配線で定義のみ（完了条件「content を表現」を死蔵型でしか満たさず、TSK-② で配線時に再修正が要る）。

### 判断 6: スレッド論理削除時の添付行 → 同一トランザクションで soft-delete（採用）

- **採用**: 既存 `softDeleteThread` のトランザクション内で、対象スレッドのメッセージ群に紐づく `chat_message_images` も `softDelete` する（メッセージ→スレッドの既存順序の前に添付を落とす）。
- 根拠: 添付行はメッセージの従属。論理削除方針を踏襲し、孤立行を残さない。

## 4. データモデル

### 新規テーブル `petal.chat_message_images`

| カラム | 型 | 説明 |
| ------ | -- | ---- |
| id | UUID（PK, default gen_random_uuid） | 行 id |
| message_id | UUID NOT NULL | FK → `petal.chat_messages(id)` ON DELETE RESTRICT |
| image_id | UUID NOT NULL | FK → `petal.images(id)` ON DELETE RESTRICT |
| position | INT NOT NULL | メッセージ内の表示・送信順（0 始まり） |
| created_at / updated_at | TIMESTAMPTZ NOT NULL DEFAULT NOW() | 日時 |
| deleted_at | TIMESTAMPTZ | 論理削除（`@DeleteDateColumn`） |

- 制約: `UQ_chat_message_images_message_position`（message_id, position）でメッセージ内の順序を一意化。
- 索引: `IDX_chat_message_images_message`（message_id）でメッセージ別取得。
- FK は両方 ON DELETE RESTRICT（既存 chat / image 方針に一致。画像は参照される限り物理削除不可）。

`chat_messages`・`chat_threads`・`images` は変更なし。

## 5. ドメイン型

### 5.1 永続 `ChatMessage`（`chat/domain/chat-message.ts`）

- `ChatMessageImageRefSchema = z.object({ imageId: z.uuid(), position: z.number().int().nonnegative() })`。
- `ChatMessageSchema` に `attachments: z.array(ChatMessageImageRefSchema).default([])` を追加。
- クラス `ChatMessage` に `readonly attachments: ChatMessageImageRef[]` を追加（コンストラクタで `parse()` 済み値を代入）。
- 既存メッセージ（添付なし）は `attachments: []` として扱う（後方互換）。

### 5.2 ワイヤ `llm-message`（`chat/domain/llm-message.ts`）

- `ChatTextPartSchema = z.object({ type: z.literal('text'), text: z.string() })`。
- `ChatImagePartSchema = z.object({ type: z.literal('image'), mediaType: z.string().min(1), data: z.string().min(1) })`（`data` は base64）。
- `ChatContentPartSchema = z.discriminatedUnion('type', [ChatTextPartSchema, ChatImagePartSchema])`。
- `ChatMessageSchema`（ワイヤ）の `content` を `z.union([z.string(), z.array(ChatContentPartSchema).min(1)])` に変更。
- domain ヘルパー `contentToText(content: string | ChatContentPart[]): string` を追加（string はそのまま、配列は text part を結合・image part は無視）。**画像の実マッピングは TSK-②。**

## 6. 永続層（repository / entity）

### 6.1 エンティティ `ChatMessageImageEntity`（`chat/infra/chat-message-image.entity.ts`・新規）

- §4 の列を TypeORM デコレータで定義。`@ManyToOne(() => ChatMessageEntity, { onDelete: 'RESTRICT' })`／`@ManyToOne(() => ImageEntity, { onDelete: 'RESTRICT' })`、`@JoinColumn`。`@DeleteDateColumn`。
- `position` は `@Column({ type: 'int' })`。

### 6.2 `ChatThreadRepositoryImpl` の拡張

- DI: `@InjectRepository(ChatMessageImageEntity)` を追加。
- `addMessage(message)`: **トランザクション**でメッセージ本体を保存後、`message.attachments` を `position` 昇順に `chat_message_images` 行として一括保存。保存後ドメインへ戻す際 attachments も復元。
- `findMessages(threadId)`: メッセージ取得後、対象メッセージ群の添付行を取得（`message_id IN (...)`, `position ASC`）し、各メッセージへ map して `toMessageDomain` に attachments を渡す。N+1 を避けるためまとめて取得。
- `softDeleteThread(id)`: 既存トランザクション内で、スレッドのメッセージ id 群に紐づく `chat_message_images` を `softDelete` → メッセージ → スレッドの順。
- `toMessageDomain` / `toMessageEntity` に attachments の往復を追加。

## 7. API 仕様

変更なし（122 では API は触らない）。`POST/GET/PATCH/DELETE/SSE` は現状どおり。image id 受け取り・履歴の添付返却は TSK-③。

## 8. トランザクション境界

- `addMessage`: chat_messages（1 行）＋ chat_message_images（0..N 行）を 1 トランザクションで保存（全成功 or 全ロールバック）。
- `softDeleteThread`: 既存トランザクションに chat_message_images の soft-delete を追加。

## 9. 既存設計との差分

- ドメイン: `chat-message.ts`（attachments 追加）/ `llm-message.ts`（parts スキーマ＋union＋`contentToText`）。
- infra: `chat-message-image.entity.ts`（新規）/ `chat-thread.repository.impl.ts`（attachments 永続化・取得・削除）。
- infra(provider): `claude.client.ts` / `gemini.client.ts` / `openai-compatible.client.ts` を `contentToText` 経由に最小修正（判断 5）。
- module: `chat.module.ts` の `TypeOrmModule.forFeature` に `ChatMessageImageEntity` を追加。
- migration: `backend/database/migrations/<ts>-CreateChatMessageImages.ts`（新規）。
- ドキュメント: 122 では `docs/20_features/09_chat.md` への反映は TSK-⑤（仕上げ）に委ねる（本設計書のみ追加）。

## 10. 完了条件（具体化版）

- [ ] `ChatMessage` が `attachments`（順序付き image 参照）を Zod 検証付きで保持する。
- [ ] `llm-message` の `content` が `string | ChatContentPart[]`（text/image(base64) parts）を Zod で表現し、`contentToText` が text を取り出す。
- [ ] `chat_message_images` の migration が up/down で通り、既存テキストメッセージ（添付 0 件）と後方互換。
- [ ] `addMessage` が添付付きメッセージをトランザクション保存し、`findMessages` が position 順で添付を復元する。
- [ ] `softDeleteThread` がスレッドの添付行も論理削除する。
- [ ] repository／service のユニットテストが「添付あり保存→取得で順序復元」「添付なし（後方互換）」「論理削除で添付も落ちる」を網羅。
- [ ] `cd backend && pnpm lint && pnpm test && pnpm build` が通る。

## 11. 未確定事項

なし（Phase 2・3 ですべて解決）。枚数上限・サイズ上限は TSK-③ の責務（122 では非対象）。

---

## 12. 実装計画（Phase 4）

（Phase 4 で追記）
