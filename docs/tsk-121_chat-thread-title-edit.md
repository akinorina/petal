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

## 12. 実装計画（Phase 4）

### 12.1 変更・追加ファイル

#### バックエンド（ファイル一覧）

- `backend/src/chat/application/chat-thread.schemas.ts`（変更）: `UpdateThreadInputSchema` / `UpdateThreadInput` を追加。
- `backend/src/chat/application/chat-thread.schemas.spec.ts`（新規）: `UpdateThreadInputSchema` の正規化・検証テスト。
- `backend/src/chat/controller/chat.dto.ts`（変更）: `UpdateThreadRequestDto` を追加。
- `backend/src/chat/application/chat-thread.service.ts`（変更）: `updateThreadTitle` を追加。
- `backend/src/chat/application/chat-thread.service.spec.ts`（変更）: `updateThreadTitle` の describe を追加。
- `backend/src/chat/controller/chat.controller.ts`（変更）: `PATCH threads/:id`（`updateThread`）を追加（`Patch` を import）。
- `backend/openapi.json`（再生成）: `pnpm openapi:export` で更新。

#### フロント（ファイル一覧）

- `frontend/src/lib/openapi/schema.d.ts`（再生成）: `pnpm openapi:gen` で更新。
- `frontend/src/lib/api/chat.ts`（変更）: `chatApi.updateThread(threadId, body)` を追加。
- `frontend/src/lib/api-hooks/use-chat-api.ts`（変更）: `useChatActionsApi` に `updateThreadTitle(threadId, title)` を追加。
- `frontend/src/components/chat/use-editable-thread-title.ts`（新規）: 編集状態・楽観更新フック。
- `frontend/src/components/chat/EditableThreadTitle.tsx`（新規）: インライン編集プレゼンテーション。
- `frontend/src/components/chat/index.ts`（変更）: `EditableThreadTitle` を公開。
- `frontend/src/app/(authenticated)/chat/[threadId]/page.tsx`（変更）: ヘッダを `<EditableThreadTitle>` に置換。
- `frontend/src/app/(authenticated)/chat/[threadId]/use-chat-thread-page.ts`（変更）: `title`（`string | null`）・`isLoading`・`reload` を返す。

#### ドキュメント（ファイル一覧）

- `docs/20_features/09_chat.md`（変更）: API 表に `PATCH /chat/threads/:id`、フロント節にタイトル編集部品を追記し「タイトル編集は別タスク」を更新。

### 12.2 migration・環境変数・依存追加

- migration: **不要**（既存 `title` カラムを使用）。
- 環境変数: **不要**。
- 依存追加: **不要**（`Patch`/`zod`/`openapi-fetch` の `PATCH` は既存導入済み）。

### 12.3 実装方針メモ（確定仕様）

- `UpdateThreadInputSchema`:

  ```ts
  export const UpdateThreadInputSchema = z.object({
    title: z
      .string()
      .nullable()
      .transform((v) => {
        if (v === null) return null;
        const trimmed = v.trim();
        return trimmed === '' ? null : trimmed;
      })
      .pipe(z.string().max(255).nullable()),
  });
  ```

  - `title` は **必須**（省略時は検証エラー）。trim 後の空文字は `null`。max 255 は trim 後に適用。
- `ChatThreadService.updateThreadTitle(currentUser, id, title)`:
  `findThreadForOwner` で取得・認可 → `thread.title = title`（正規化済み）→ `saveThread(thread)` を返す。
- コントローラは既存 `createThread` と同じく `safeParse` → 失敗で `BadRequestException(flatten())`、成功で `result.data.title` をサービスへ渡し `toThreadResponse` を返す。
- フロント編集フック `useEditableThreadTitle({ threadId, title, onSaved })`:
  - `displayTitle = (pending !== undefined ? pending : title) ?? '無題の会話'`（`pending: string | null | undefined`）。
  - `startEdit`: `draft = title ?? ''`、編集状態 ON。
  - `submit`: `normalized = draft.trim() === '' ? null : draft.trim()` → 編集状態 OFF・`pending=normalized`（楽観）→ `updateThreadTitle` → `onSaved()`（threads reload）→ `pending=undefined`。例外時は `pending=undefined`（props へ復帰）＋ `error` を設定。
  - `Error.message` をエラー表示に使う（`ApiError` も `Error` を継承）。
- `EditableThreadTitle`:
  - `isLoading` 時は空ヘッダ（プレースホルダ）。
  - 表示状態: `Text as="h1" variant="heading-md"` をタップで編集開始（`button` 化）＋ 補助の「編集」テキストボタン（`aria-label="タイトルを編集"`）。`error` は `Alert variant="danger"` で下に表示。
  - 編集状態: `Input`（`value=draft`・`maxLength=255`・`autoFocus`・`aria-label="スレッドのタイトル"`）＋「完了」`Button`・「キャンセル」`Button variant="secondary"`。Enter=確定（`preventDefault`）/ Esc=キャンセル。保存中は両ボタン `disabled`。
- 編集アイコンは name レジストリ式でないため Icon は使わず「編集」テキストボタンにする（依存を増やさない）。

### 12.4 作業順序（コミット単位・各完了確認）

1. **`feat(tsk-121): チャットスレッドのタイトル更新 API を追加`**
   - schemas / dto / service / controller / 両 spec を追加。`pnpm openapi:export` で `openapi.json` 再生成・コミット。
   - 完了確認: `cd backend && pnpm lint && pnpm test && pnpm build` がパス。`openapi.json` に `patch` の `/chat/threads/{id}` が出力されている。
2. **`feat(tsk-121): フロントにタイトル更新 API 配線を追加`**
   - `pnpm openapi:gen` で `schema.d.ts` 再生成。`lib/api/chat.ts` ＋ `use-chat-api.ts` を変更。
   - 完了確認: `cd frontend && pnpm lint && pnpm build` がパス（型解決）。
3. **`feat(tsk-121): チャット詳細ページにタイトルのインライン編集を追加`**
   - `EditableThreadTitle` ＋ フック新設、barrel 公開、詳細ページ・同居フックを変更。
   - 完了確認: `cd frontend && pnpm lint && pnpm build` がパス。手動シナリオ（§10）を確認。
4. **`docs(tsk-121): LLM チャットのタイトル編集を機能ドキュメントへ反映`**
   - `docs/20_features/09_chat.md` を更新。
   - 完了確認: markdownlint がパス。

### 12.5 テスト方針

- バックエンド application 層をユニットテストで担保（既存方針）。
  - `chat-thread.schemas.spec.ts`: `UpdateThreadInputSchema` が「通常文字列はそのまま」「前後空白を trim」「空文字・空白のみは null」「null は null」「trim 後 255 は OK / 256 は失敗」「title 欠落は失敗」を網羅。
  - `chat-thread.service.spec.ts`: `updateThreadTitle` が「所有者のタイトルを更新し saveThread を 1 回呼ぶ」「title=null も反映」「非所有は NotFoundException で saveThread 未呼出」を網羅。
- フロントはユニットテスト基盤を持たない（既存どおり）。手動動作確認シナリオ（§10）で担保。

### 12.6 想定外時の判断ルール

- **AI 単独判断 OK**: 軽微な既存コードリファクタ、本設計書スコープ内の追加実装、命名・クラス付与の微調整。
- **中断して要相談**:
  - データモデル変更（`title` 以外のカラム追加・migration 発生）。
  - API 仕様変更（PATCH 以外の方式採用、パス・ステータス・レスポンス形変更）。
  - トランザクション境界変更。
  - 設計判断ログ（§3）を覆す変更。
  - `saveThread` 再利用が UPDATE 時に既存値（owner/createdAt 等）を破壊する等、想定差異が判明した場合。

### 12.7 事前解決済みの判断ポイント

- 編集 UI 方式 → インライン編集（タイトルタップ＋「編集」テキストボタン）。
- 空タイトル → `null` 保存・「無題の会話」表示。
- 正規化の置き場所 → Zod transform（trim・空→null・max 255 は trim 後）。
- repository → 既存 `saveThread` 再利用（新メソッド無し）。
- 部品配置 → `components/chat/` に再利用部品＋非公開フック。
- 表示更新 → 楽観更新＋ threads reload（失敗時 props へロールバック＋Alert）。
- 編集アイコン → Icon 非使用、「編集」テキストボタン。
- 「チャット実行ページ」 → 新規ページは送信後 `/chat/[id]` 遷移で詳細ページ編集を満たす（専用 UI 不要）。
- フロントテスト → 基盤なし、手動確認で担保。
