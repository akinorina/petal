# TSK-121 LLM チャットのタイトルを編集できるようにする（設計書）

- Notion: <https://app.notion.com/p/3829ca7d99dc8063aa00d09b7cafe9f5>
- プロジェクト: PRJ（LLM チャット）
- 規模: M / 重要度: HIGH
- 関連: [docs/20_features/09_chat.md](20_features/09_chat.md)（LLM チャット機能の現状仕様）

## 1. 課題シート（Notion 転記・フリーズ）

### 一行サマリ

LLM チャットのスレッドタイトルを、チャット詳細ページのヘッダから**インライン編集**で更新・永続化できるようにする。

### 背景・動機

LLM とチャットする機能において、スレッドのタイトルを編集できるようにする。

- チャット一覧ページでは編集できなくてよい。
- チャット詳細・チャット実行ページでタイトル部分をタップ（編集ボタンタップでもよい）したら編集状態になり、完了ボタン押下で編集後文字列でタイトルを更新永続化する。

現状、スレッド `title` は DB・ドメイン・スキーマ上は存在する（`title: string | null`、max 255）が、**作成時は常に `null`**（`chatApi.createThread({})`）で編集手段が無く、一覧・詳細では `null` を「無題の会話」と表示している。

### 完了条件

- 詳細ページ `frontend/src/app/(authenticated)/chat/[threadId]/page.tsx` のヘッダのタイトル部分をタップ（または編集ボタン）すると、その場で入力欄になる。
- 完了ボタン（＋ Enter）で確定し、編集後の文字列でタイトルを永続化。再読込しても反映され、一覧 `/chat` にも反映される。
- キャンセル（Esc・キャンセルボタン）で編集前に戻せる。
- タイトルを空（空白のみ含む）にして確定した場合は `null` 保存とし、表示は「無題の会話」。
- 新規ページ `/chat/new` は初回送信でスレッド作成後 `/chat/[id]` へ `router.replace` するため、遷移先の詳細ページで上記編集が機能すれば「チャット実行ページ」要件を満たす（新規ページ単体での専用編集 UI は不要）。
- `cd backend && pnpm build` / `cd frontend && pnpm build` が通る。

### スコープ外

- タイトルの自動生成（最初のメッセージからの要約など）— 別タスク。
- 一覧ページ `/chat` でのインライン編集（タスク明記どおり不要）。
- メッセージ本文の編集。

### 制約

- 既存スキーマ `title: string | null`（max 255）を踏襲。DB マイグレーション不要。
- 破壊的操作なし・既存 API 互換（既存エンドポイントは変更しない）。
- 認可は所有者本人のみ（既存 `findThreadForOwner` を通す）。
- フロントは page=View / ロジックは同居フック、外部 SDK・API は `lib/api` 経由、という既存規約を踏襲。

### 不明点・迷い

解決済み（UI 方式＝インライン編集 / 空＝null / 自動生成＝スコープ外 / 部品配置＝再利用部品 / 反映＝楽観更新＋再取得）。

## 2. スコープ

### 対象

- バックエンド: スレッドタイトル更新 API（`PATCH /chat/threads/:id`）。
- フロント: 詳細ページヘッダのインライン編集 UI（再利用部品）＋ API 配線。

### 対象外

- 上記「スコープ外」のとおり。

## 3. 設計判断ログ

### 判断 1: タイトル更新 API の方式 → `PATCH /chat/threads/:id`（採用）

- **採用**: 部分更新セマンティクスに合致する `PATCH`。body `{ title: string | null }`、更新後の `ChatThreadResponseDto` を返す。既存の `@Controller('chat')` に追加。
- 却下: `PUT`（全フィールド置換の含意。タイトルのみ更新の意図と合わない）。
- 却下: 専用サブリソース `POST /chat/threads/:id/title`（既存 REST スタイル〔threads/messages〕と不揃い）。

### 判断 2: タイトル正規化（trim・空→null）の置き場所 → Zod スキーマの transform（採用）

- **採用**: `UpdateThreadInputSchema` の `title` を `trim` し、空文字なら `null` に変換、その後 max 255 検証。入力検証層で正規化を完結させ、サービス・ドメインは正規化済み値だけを扱う。
- 却下: サービス層で正規化（検証と正規化が分散する）。
- 補足: max 255 は **trim 後**の長さに適用する。

### 判断 3: repository は既存 `saveThread` を再利用（採用）

- **採用**: サービスで `findThreadForOwner` → ドメインの `thread.title` を更新 → 既存 `saveThread(thread)` で UPSERT。`updated_at` は `@UpdateDateColumn` が自動更新。`IChatThreadRepository` に新メソッドは追加しない。
- 却下: `updateThreadTitle(id, title)` を repository に新設（既存 `saveThread` で足りるため過剰）。
- 根拠: `ChatThread.title` は可変（`chat-thread.ts`）。`toThreadEntity` は id/owner/title のみ設定し、既存 `createThread` も同経路で UPSERT 実績がある。

### 判断 4: フロント部品配置 → 再利用部品として切り出し（採用）

- **採用**: `frontend/src/components/chat/` に `EditableThreadTitle.tsx`（プレゼンテーション）＋ `use-editable-thread-title.ts`（編集状態・楽観更新）を新設。詳細ページヘッダがこれを使う。barrel `components/chat/index.ts` から公開。`<ChatPanel>` と同じ「公開部品＋非公開フック」パターンに揃える。
- 却下: 詳細ページのフック `use-chat-thread-page.ts` に編集状態を集約（再利用性が低く、ヘッダ JSX が肥大）。

### 判断 5: 保存時の表示更新 → 楽観更新＋ threads 再取得（採用）

- **採用**: 確定と同時にローカル表示を即時反映（楽観）。裏で `PATCH` 実行後、`useChatThreadsApi` の `reload()` で一覧を再取得し正本へ収束。失敗時はローカル表示を正本（props）へ戻し、`Alert` でエラー表示。
- 却下: API 成功後に `reload()` のみ（保存→反映にラグが出てちらつく）。

## 4. データモデル

変更なし。既存 `petal.chat_threads.title`（nullable・max 255）をそのまま使う。**マイグレーション不要**。

## 5. API 仕様

### `PATCH /chat/threads/:id`（新規）

- 認証: Bearer（既存どおり）。
- 認可: 所有者本人のみ。非所有・不在は `NotFoundException`（404、存在秘匿）。
- リクエスト body: `{ "title": string | null }`
  - `UpdateThreadInputSchema = z.object({ title: <trim→空はnull→max255> .nullable() })`。
  - Zod 失敗時は `BadRequestException`（既存 `createThread` と同じく `safeParse` → `flatten()`）。
- レスポンス: `200` ＋ `ChatThreadResponseDto`（更新後）。
- 既存 DTO `ChatThreadResponseDto` を再利用。新規リクエスト DTO `UpdateThreadRequestDto { title?: string | null }` を Swagger 用に追加。

他エンドポイント（POST/GET/DELETE/SSE）は変更なし。

## 6. トランザクション境界

- 単一テーブル `chat_threads` の 1 行 UPDATE のみ。外部副作用なし。明示トランザクション不要（既存 `softDeleteThread` のような複数テーブル更新ではない）。

## 7. 既存設計との差分

- バックエンド
  - `ChatController` に `PATCH threads/:id`（`updateThread`）を追加。
  - `chat-thread.schemas.ts` に `UpdateThreadInputSchema` / `UpdateThreadInput` を追加。
  - `chat.dto.ts` に `UpdateThreadRequestDto` を追加。
  - `ChatThreadService` に `updateThreadTitle(currentUser, id, title)` を追加。
  - repository インターフェース・実装は変更なし（`saveThread` 再利用）。
- フロント
  - `lib/api/chat.ts` の `chatApi` に `updateThread(threadId, body)` を追加。
  - `lib/api-hooks/use-chat-api.ts` の `useChatActionsApi` に `updateThreadTitle(threadId, title)` を追加。
  - `components/chat/` に `EditableThreadTitle.tsx` ＋ `use-editable-thread-title.ts` を新設し、barrel から公開。
  - 詳細ページ `chat/[threadId]/page.tsx` のヘッダ `<Text as="h1">` を `<EditableThreadTitle>` に置換。`use-chat-thread-page.ts` は `title` に加え `reload`・`isLoading` を返すよう拡張。
  - OpenAPI クライアント再生成（`pnpm openapi:gen`）で `PATCH /chat/threads/{id}` の型を取り込む。
- ドキュメント
  - `docs/20_features/09_chat.md` の API 表に `PATCH /chat/threads/:id`、フロント節にタイトル編集部品を追記（「タイトル編集は別タスク」の記述を更新）。

## 8. UI 仕様（インライン編集）

- 表示状態: 見出し（`Text as="h1" variant="heading-md"`）としてタイトルを表示。タイトル自体がボタン（タップで編集へ）＋ 補助の編集アイコンボタンを併置。表示文字列は `title ?? '無題の会話'`。
- 編集状態: タイトル位置に `Input`（初期値＝現在タイトル、`null` のときは空）。「完了」「キャンセル」ボタンを併置。
  - 確定: 完了ボタン or Enter。`onSave(trim 前の生文字列)` を実行（正規化はサーバ側／表示は楽観値）。
  - キャンセル: キャンセルボタン or Esc。編集前へ戻す。
  - 楽観表示: 確定時、入力値（trim し空なら「無題の会話」相当）を即時表示。保存失敗時は props 値へ戻し `Alert` 表示。
  - ローディング中（threads 取得中）は編集不可（プレースホルダ表示）。
- アクセシビリティ: 編集ボタンに `aria-label`、Input に適切なラベル。

## 9. 完了条件（具体化版）

- [ ] `PATCH /chat/threads/:id` が所有者のタイトルを更新し更新後 DTO を返す。非所有は 404、バリデーション不正は 400。
- [ ] 空・空白のみのタイトルは `null` 保存され、一覧・詳細で「無題の会話」と表示。
- [ ] 256 文字以上は 400（trim 後 255 まで許容）。
- [ ] 詳細ページでタイトルをタップ→Input 化→完了/Enter で確定し、再読込・一覧でも反映。
- [ ] Esc／キャンセルで編集前に戻る。
- [ ] `ChatThreadService.updateThreadTitle` のユニットテストが正常系・非所有・正規化（空→null・trim）を網羅。
- [ ] `cd backend && pnpm build` / `cd backend && pnpm test` / `cd frontend && pnpm build` が通る。

## 10. 手動動作確認シナリオ

1. 既存スレッドの詳細ページを開く → タイトル（または編集ボタン）をタップ → Input になる。
2. 文字列を入力し「完了」→ 表示が即時更新される。`/chat` 一覧へ戻ると同じタイトルが出る。ブラウザ再読込しても保持。
3. タイトルを全消し（または空白のみ）→ 完了 → 「無題の会話」表示・一覧も同様。
4. 編集中に Esc／キャンセル → 元のタイトルに戻る（保存されない）。
5. 256 文字以上を入れて完了 → エラー表示（保存されない、表示は元に戻る）。
6. 新規チャットで 1 通送信 → `/chat/[id]` 遷移後にタイトル編集ができる。
7. （任意）他ユーザーのスレッド ID に対する PATCH が 404 になる（API レベル）。

## 11. 未確定事項

なし（Phase 2・3 ですべて解決）。

---

（実装計画は Phase 4 で本セクション以降に追記する）
