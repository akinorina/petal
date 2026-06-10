# TSK-108: 会話スレッド/メッセージの永続化

- Notion: [会話スレッド/メッセージの永続化を実装する](https://app.notion.com/p/37b9ca7d99dc8101a81bd8e45ea963cf)
- プロジェクト: PRJ-16（Petal LLMチャット実装）
- 規模: L / 重要度: HIGH / 完了予定: 2026-06-11

---

## 0. 課題シート（Notion 転記）

### 一行サマリ

会話スレッドとメッセージを PostgreSQL に永続化し、所有者本人のみが読み書きできるドメイン/リポジトリを実装する（論理削除対応）。

### 背景・動機

PRJ-16 では会話履歴を DB 永続化し、再ログイン後も閲覧できることを要求している。petal の論理削除・所有者プライバシー方針に沿って、チャット API が使う永続化層を先に用意する。

### 完了条件（課題シート原文）

- 会話スレッド・メッセージの TypeORM エンティティと migration を `backend/database/migrations/` に追加している
- ドメインエンティティを Zod スキーマで不変条件定義し、コンストラクタで `parse()` している
- スレッド/メッセージの作成・取得・論理削除（`@DeleteDateColumn`）が repository/service で動作する
- スレッドが所有者（ユーザー）に紐付き、他人のスレッドを取得できない
- Application 層のユニットテストがある

### スコープ外

- LLM 生成処理（TSK-107 で実装済み）
- HTTP エンドポイント（controller）— チャット API タスクで実装
- フロントエンド

### 制約

- 削除は論理削除（物理削除しない）。`synchronize: false`、スキーマ変更は migration で管理
- DDD + オニオン、Domain は Infrastructure を参照しない、`any` 禁止、Zod
- 外部入力は Zod 検証、ドメインエンティティは Zod スキーマ + コンストラクタ `parse()`

### 不明点・迷い（→ 本設計で解決）

- スレッドとメッセージのテーブル分割・カラム定義 → 本設計 §3 / §4 で確定

---

## 1. スコープ

### 対象

- 既存 `backend/src/chat/` フィーチャへ、会話スレッド/メッセージの**永続化層**を追加する。
  - `domain/`: `ChatThread`（集約ルート）/ `ChatMessage`（集約内エンティティ）/ リポジトリ I/F
  - `application/`: `ChatThreadService`（ユースケース）+ 入力 Zod スキーマ
  - `infra/`: TypeORM エンティティ 2 種 + リポジトリ実装
- `chat_threads` / `chat_messages` の 2 テーブルを作る migration。
- Application 層のユニットテスト。

### 対象外

- LLM 生成（TSK-107 で実装済み・本タスクでは触らない）。
- HTTP エンドポイント・DTO・controller（別タスク）。
- フロントエンド。
- 既存 `chat/domain/llm-message.ts`（LLM 送信用 `ChatMessage` 型）の改変。**触らない**（§4 D6 参照）。

---

## 2. 制約

- DDD + オニオン。Domain は Infrastructure / TypeORM を import しない。リポジトリ I/F は domain、実装は infra。
- 削除はすべて論理削除（`@DeleteDateColumn`）。物理削除しない。`synchronize: false`。
- `any` 禁止、`strict`。外部入力は Zod 検証。ドメインエンティティは Zod スキーマ + コンストラクタ `parse()`。
- 既存パターン（`backend/src/image/` 一式）に揃える。新パターンを持ち込まない。

---

## 3. データモデル

集約は **ChatThread をルート、ChatMessage をその構成要素**とする（メッセージはスレッドに従属し、単独では存在しない）。

### テーブル: `chat_threads`

| カラム | 型 | 制約 |
| ------ | -- | ---- |
| id | uuid | PK, default `gen_random_uuid()` |
| owner_user_id | uuid | FK → `users(id)` `ON DELETE RESTRICT`, NOT NULL |
| title | varchar(255) | nullable |
| created_at | timestamptz | NOT NULL default `NOW()` |
| updated_at | timestamptz | NOT NULL default `NOW()` |
| deleted_at | timestamptz | nullable（論理削除） |

インデックス: `IDX_chat_threads_owner_created (owner_user_id, created_at DESC)` — 所有者別の新着順一覧用（`images` と同方針）。

### テーブル: `chat_messages`

| カラム | 型 | 制約 |
| ------ | -- | ---- |
| id | uuid | PK, default `gen_random_uuid()` |
| thread_id | uuid | FK → `chat_threads(id)` `ON DELETE RESTRICT`, NOT NULL |
| seq | bigint | NOT NULL（スレッド内連番、0 始まり） |
| role | varchar(20) | NOT NULL, CHECK `role IN ('system','user','assistant')` |
| content | text | NOT NULL（LLM 本文は長くなりうるため長さ上限なし） |
| created_at | timestamptz | NOT NULL default `NOW()` |
| updated_at | timestamptz | NOT NULL default `NOW()` |
| deleted_at | timestamptz | nullable（論理削除） |

制約・インデックス:

- `UQ_chat_messages_thread_seq UNIQUE (thread_id, seq)` — スレッド内 seq の一意性。
- 並び順は `(thread_id, seq ASC)` で決定的に取得する（UNIQUE 制約のインデックスを利用）。

### ER

```text
users 1 ──< chat_threads        （owner_user_id, ON DELETE RESTRICT）
chat_threads 1 ──< chat_messages（thread_id, ON DELETE RESTRICT）
```

---

## 4. 設計判断ログ

### D1: スレッドとメッセージを別テーブルに分割（採用）

- 採用: `chat_threads` と `chat_messages` の 2 テーブル。課題シート名「スレッド/メッセージ」と一致し、メッセージ追記が自然。
- 却下: 1 テーブルに JSON 配列で会話を持つ → 追記・部分取得・件数増大に弱く、論理削除の粒度も粗い。

### D2: メッセージ並び順は `seq` 列で保証（採用）

- 採用: `chat_messages.seq`（bigint, スレッド内連番 0 始まり）を持ち、`(thread_id, seq)` で一意・決定的に並べる。`seq` は Application 層が採番する（後述 §5 の `findMaxSeq`）。
- 却下: `created_at` のみ → チャットは短時間に複数メッセージが入り、同一タイムスタンプで順序が非決定的になりうる。
- 却下: `created_at + id` タイブレーク → UUID 順は意味的順序ではない。
- **採番の競合について**: `seq = (findMaxSeq の結果) + 1`。同一スレッドへの同時追記が起きると seq 衝突（UNIQUE 違反）の窓があるが、本機能は**所有者単独の 1 会話**が対象で同時追記はほぼ起きない。衝突時は UNIQUE 制約違反例外がそのまま上がる（サイレント破壊はしない）。将来 API/並行性要件が出たら採番をシーケンス/トランザクション化する（本タスクのスコープ外）。

### D3: スレッド論理削除時はメッセージも論理削除（採用 / トランザクション境界）

- 採用: スレッドを `softDelete` する際、配下メッセージにも `deleted_at` を立てる。所有者プライバシー方針に沿い、復元も一括。
- **DB 内 2 テーブルの同時更新**のため、`infra` のリポジトリ実装で **TypeORM トランザクション** に包む（`chat_messages` を先に soft delete → `chat_threads` を soft delete → COMMIT）。
- 外部副作用（Cognito/S3 等）は伴わないため、[specs/00_rules.md §4](specs/00_rules.md) の「DB→外部 API→COMMIT」境界は対象外。トランザクションは**純 DB 操作**であり、`infra` 内に閉じる（`DataSource` を `infra` でのみ参照し、Application 層へ漏らさない）。
- 集約ルート（ChatThread）のリポジトリが配下メッセージの永続化責務も持つ DDD 集約境界に一致するため、`softDeleteThread(id)` 1 メソッドで完結させる。

### D4: スレッドタイトルは nullable な `title` 列（採用）

- 採用: `varchar(255)` nullable。作成時 null 可。タイトル決定/自動生成ロジックは本タスクのスコープ外（別タスク）だが、永続化層では将来に備え列を用意する。
- 却下: NOT NULL → 本タスクにタイトル決定ロジックが無く、ダミー必須化になる。
- 却下: 列なし → 後で確実に migration 追加が必要。

### D5: role は `varchar(20) + CHECK`（採用）

- 採用: `varchar(20)` + `CHECK role IN ('system','user','assistant')`。`images.mime_type` と同方針。ドメインは既存 `ChatRoleSchema`（`llm-message.ts`）の値を流用し、`parse()` で検証。
- 却下: PostgreSQL enum 型 → 値追加時の migration が重く、`audit_action` 以外では未採用。

### D6: 永続化メッセージのドメイン型名と既存 `ChatMessage` の棲み分け（採用）

- 既存 `chat/domain/llm-message.ts` は LLM 送信用の DTO 型 `ChatMessage = { role, content }`（TSK-107）。本タスクの**永続化エンティティ**はクラス `ChatMessage`（id/threadId/seq/role/content/timestamps を持つ）。
- 両者は別ファイル（`domain/chat-message.ts` と `domain/llm-message.ts`）で、同一ファイルから同時に import しない限り名前衝突しない。本タスクの新規コードは `llm-message.ts` を import しないため衝突しない。
- `role` の値定義のみ既存 `ChatRoleSchema` を再利用して二重定義を避ける（`domain/chat-message.ts` が `llm-message.ts` の `ChatRoleSchema` を import）。
- 既存 `llm-message.ts` は改名・改変しない（TSK-107 の `ChatService` が依存しているため）。

---

## 5. レイヤー設計

### domain

- `domain/chat-thread.ts`
  - `ChatThreadSchema`（`id: uuid`, `ownerUserId: uuid`, `title: string().max(255).nullable()`, `createdAt/updatedAt: date`, `deletedAt: date().nullable()`）。
  - `class ChatThread`（コンストラクタで `parse`、`isOwnedBy(userId)` を持つ。`title`/`updatedAt`/`deletedAt` は可変、他は `readonly`）。
- `domain/chat-message.ts`
  - `ChatRoleSchema` を `./llm-message` から import して再利用。
  - `ChatMessageSchema`（`id: uuid`, `threadId: uuid`, `seq: number().int().nonnegative()`, `role: ChatRoleSchema`, `content: string()`, `createdAt/updatedAt: date`, `deletedAt: date().nullable()`）。
  - `class ChatMessage`（コンストラクタで `parse`）。
- `domain/chat-thread.repository.ts`
  - `export const CHAT_THREAD_REPOSITORY = Symbol('IChatThreadRepository')`
  - `interface IChatThreadRepository`:
    - `findById(id: string): Promise<ChatThread | null>`
    - `findAllByOwner(ownerUserId: string): Promise<ChatThread[]>`
    - `saveThread(thread: ChatThread): Promise<ChatThread>`
    - `findMessages(threadId: string): Promise<ChatMessage[]>`（seq ASC）
    - `findMaxSeq(threadId: string): Promise<number | null>`（メッセージ無しは null）
    - `addMessage(message: ChatMessage): Promise<ChatMessage>`
    - `softDeleteThread(id: string): Promise<void>`（メッセージも含めトランザクションで論理削除）

### application

- `application/chat-thread.schemas.ts`
  - `CreateThreadInputSchema`（`title: z.string().max(255).nullable().optional()`）、`type CreateThreadInput`。
  - `AddMessageInputSchema`（`role: ChatRoleSchema`, `content: z.string().min(1)`）、`type AddMessageInput`。
- `application/chat-thread.service.ts` — `class ChatThreadService`、`@Inject(CHAT_THREAD_REPOSITORY)`:
  - `createThread(currentUser, input): Promise<ChatThread>` — `id=randomUUID()`, `ownerUserId=currentUser.id`, `title=input.title ?? null`, now で生成し save。
  - `findThreadsForOwner(currentUser): Promise<ChatThread[]>`。
  - `findThreadForOwner(currentUser, id): Promise<ChatThread>` — 見つからない or 非所有者なら `NotFoundException`（image と同方針：存在秘匿）。
  - `addMessage(currentUser, threadId, input): Promise<ChatMessage>` — 所有者検証 → `findMaxSeq` で `seq` 採番（null→0, それ以外→max+1）→ `ChatMessage` 生成 → `addMessage`。
  - `findMessages(currentUser, threadId): Promise<ChatMessage[]>` — 所有者検証 → seq ASC で返す。
  - `removeThread(currentUser, id): Promise<void>` — 所有者検証 → `softDeleteThread`。

### infra

- `infra/chat-thread.entity.ts`（`@Entity({ schema: 'petal', name: 'chat_threads' })`、`@ManyToOne(UserEntity, onDelete RESTRICT)`、`@Index('IDX_chat_threads_owner_created', ['ownerUserId','createdAt'])`、`@CreateDateColumn`/`@UpdateDateColumn`/`@DeleteDateColumn`）。
- `infra/chat-message.entity.ts`（`@Entity({ schema: 'petal', name: 'chat_messages' })`、`thread_id` カラム + `@ManyToOne(ChatThreadEntity, onDelete RESTRICT)`、`seq: bigint`、`role: varchar(20)`、`content: text`、`@Index`/UNIQUE は migration 側で付与、timestamps + DeleteDateColumn）。`seq` は bigint のため TypeORM では string 入出力 → impl で `Number()`/`String()` 変換（`images.size_bytes` と同方式）。
- `infra/chat-thread.repository.impl.ts` — `implements IChatThreadRepository`。`@InjectRepository(ChatThreadEntity)` / `@InjectRepository(ChatMessageEntity)` と `private readonly dataSource: DataSource` を DI。
  - `findById`: thread を返す（メッセージは含めない。`findMessages` で別取得）。
  - `findAllByOwner`: `order: { createdAt: 'DESC' }`。
  - `findMessages`: `where: { threadId }, order: { seq: 'ASC' }`。
  - `findMaxSeq`: `repo.maximum('seq', { threadId })` 相当（TypeORM `maximum` が無ければ `createQueryBuilder().select('MAX(seq)')`）。bigint は string で返るため `Number()` 変換、null はそのまま。
  - `addMessage` / `saveThread`: `toEntity`→`save`→`toDomain`。
  - `softDeleteThread`: `this.dataSource.transaction(async (m) => { await m.softDelete(ChatMessageEntity, { threadId: id }); await m.softDelete(ChatThreadEntity, { id }); })`。
  - `toDomain`/`toEntity` を thread/message それぞれ用意。`role` は `ChatRoleSchema.parse` を通すか CHECK 済み前提で代入（DB 不正値ガードとして `image` の `isAllowedMime` 同様に検証）。

### module

- 既存 `chat/chat.module.ts` に追記:
  - `imports: [TypeOrmModule.forFeature([ChatThreadEntity, ChatMessageEntity])]`
  - `providers` に `{ provide: CHAT_THREAD_REPOSITORY, useClass: ChatThreadRepositoryImpl }` と `ChatThreadService` を追加。
  - `exports` に `ChatThreadService` を追加。
  - 既存 `LlmConfig` / `LLM_PROVIDER` / `ChatService` はそのまま維持。

---

## 6. migration

- ファイル: `backend/database/migrations/1746144006000-CreateChatTables.ts`（既存 `login_attempts`=…005000 の次）。
- `up`:
  - `CREATE TABLE "petal"."chat_threads" (...)` — PK / FK(owner_user_id→users RESTRICT)。
  - `CREATE INDEX "IDX_chat_threads_owner_created" ON ... (owner_user_id, created_at DESC)`。
  - `CREATE TABLE "petal"."chat_messages" (...)` — PK / FK(thread_id→chat_threads RESTRICT) / `CHECK (role IN (...))` / `CONSTRAINT UQ_chat_messages_thread_seq UNIQUE (thread_id, seq)`。
- `down`: messages → threads の順に `DROP TABLE IF EXISTS`、index は DROP（テーブル drop で同時に消えるが、images の down に合わせ index も明示 DROP）。
- 既存 migration（`CreateImagesTable`）の記述スタイル（生 SQL、`petal` スキーマ修飾、制約命名 `PK_`/`UQ_`/`FK_`/`CK_`/`IDX_`）に揃える。

---

## 7. 既存設計との差分

- DB スキーマ（[docs/10_architecture/05_database-schema.md](10_architecture/05_database-schema.md)）に `chat_threads` / `chat_messages` を追記し、ER 図テキストに 2 行追加。
- 既存 `chat` フィーチャ（TSK-107: LLM プロバイダ）に永続化層が加わる。`ChatModule` の providers/exports/imports が増える。LLM 側コードへの変更なし。
- 新パターンは導入しない（image フィーチャの写経 + 集約ルート 1 リポジトリ構成 + 純 DB トランザクション）。

---

## 8. 完了条件（具体化版）

- [ ] `backend/src/chat/domain/` に `chat-thread.ts` / `chat-message.ts` / `chat-thread.repository.ts` を追加（Zod スキーマ + `parse` + `isOwnedBy`）。
- [ ] `backend/src/chat/application/` に `chat-thread.service.ts` / `chat-thread.schemas.ts` を追加。
- [ ] `backend/src/chat/infra/` に `chat-thread.entity.ts` / `chat-message.entity.ts` / `chat-thread.repository.impl.ts` を追加。
- [ ] `chat/chat.module.ts` に TypeOrmModule.forFeature・リポジトリ provider・`ChatThreadService` を登録/export。
- [ ] `backend/database/migrations/1746144006000-CreateChatTables.ts` を追加（2 テーブル + FK + CHECK + UNIQUE + index）。
- [ ] スレッド作成・一覧・取得、メッセージ追加（seq 採番）・一覧、スレッド論理削除（メッセージ連鎖）が service で動作。
- [ ] 非所有者のスレッド/メッセージを取得・削除できない（`NotFoundException`）。
- [ ] `backend/src/chat/application/chat-thread.service.spec.ts` を追加（リポジトリ DI モック）。下記シナリオを網羅。
- [ ] `cd backend && pnpm build` が通る。`cd backend && pnpm test` が緑。`cd backend && pnpm lint` が通る。
- [ ] `docs/10_architecture/05_database-schema.md` を更新。
- [ ] `npx markdownlint-cli 'docs/**/*.md'` が通る。

### ユニットテストのシナリオ（`chat-thread.service.spec.ts`）

- `createThread`: title 指定あり/なし（null）でスレッドが生成され save される。`ownerUserId` が currentUser になる。
- `findThreadForOwner`: 所有者なら返す / 非所有者は `NotFoundException` / 不在は `NotFoundException`。
- `addMessage`: 既存メッセージ無し → seq=0 / 既存 max=2 → seq=3。非所有スレッドへは `NotFoundException`。`role`/`content` が反映される。
- `findMessages`: 所有者のみ取得でき、リポジトリの seq ASC 結果をそのまま返す。非所有者は `NotFoundException`。
- `removeThread`: 所有者なら `softDeleteThread` が呼ばれる。非所有者は `NotFoundException` で `softDeleteThread` 未呼出。

---

## 9. 手動動作確認シナリオ

HTTP エンドポイントはスコープ外のため、確認は migration とビルド/テストで行う。

1. `cd backend && pnpm migration:run` → `chat_threads` / `chat_messages` が作成される（`pnpm migration:show` で適用確認）。
2. `cd backend && pnpm migration:revert` → 2 テーブルが drop され、`...005000` まで戻る（revert 後に再度 `migration:run` で復帰できる）。
3. `cd backend && pnpm test` → `chat-thread.service.spec.ts` を含め緑。
4. `cd backend && pnpm build` → 型エラーなくビルド成功。

---

## 10. 未確定事項

- なし（Phase 3 終了時点で全論点に採用案あり）。タイトル自動生成・HTTP API・並行採番の堅牢化は後続タスクで扱う。
