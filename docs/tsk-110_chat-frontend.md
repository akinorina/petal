# TSK-110: フロントのチャット画面と API 連携

- Notion: [フロントのチャット画面と API 連携を実装する](https://app.notion.com/p/37b9ca7d99dc81d2b078fb30dda5f8a5)
- プロジェクト: PRJ-16（Petal LLMチャット実装）
- 規模: L / 重要度: HIGH / 完了予定: 2026-06-13

---

## 0. 課題シート（Notion 転記）

### 一行サマリ

`(admin)` 配下にチャット画面を追加し、ストリーミング表示・履歴閲覧・エラー表示を
backend chat API（TSK-109）と連携させて実装する。

### 背景・動機

PRJ-16 のユーザー接点。TSK-107/108/109 で実装したチャット API を使い、画像管理画面と
同じ「ページ + フック」構成でチャット UI を提供する。

### 完了条件（課題シート原文 → 本設計での確定）

- [ ] `(admin)` 配下にチャットページ（`page.tsx`）を追加し、ステート/副作用を
      `use-<page>-page.ts` フックに切り出している
- [ ] `lib/api` + `lib/api-hooks` にチャット API クライアント/フックを追加している
- [ ] ~~モデル選択 UI からモデルを選び~~ → **スコープ外に降格**（§1 参照）。送信→ストリーミング表示ができる
- [ ] 会話履歴を閲覧でき（スレッド一覧 / 再表示）、再ログイン後も残る
- [ ] エラー時にエラー表示ができる（~~リトライ~~ は **スコープ外に降格**、§1 参照）
- [ ] `frontend` の `pnpm build` が通る

### スコープ外（課題シート明記 + 本設計で追加）

- 画像/音声添付 UI（PRJ-16 対象外）
- 詳細オプション調整 UI（temperature 等）
- **モデル選択 UI**（追加。理由は §1）
- **リトライ機能**（追加。理由は §1）

### 制約

- ページは View に専念させ、ロジックは同居フックへ（1 ページ 1 フック）
- 秘密情報をフロントに含めない。既存 Tailwind/コンポーネント規約に準拠

### 関連資料

- プロジェクト: PRJ-16（Petal LLMチャット実装）
- バックエンド設計: [tsk-109_chat-send-receive-api.md](tsk-109_chat-send-receive-api.md)（API 契約の一次情報）
- フロントエンドアーキテクチャ: [docs/10_architecture/03_frontend-architecture.md](10_architecture/03_frontend-architecture.md)
- 参考実装: `frontend/src/app/(admin)/images/`（page + use-images-page）, `frontend/src/lib/api-hooks/`

---

## 1. スコープと Phase 2 での確定事項

### 対象

`(admin)` 配下にチャット機能を追加する。`images/` 同様、ページは View・ロジックは同居フック、
API アクセスは `lib/api` + `lib/api-hooks` に分離する。

### 対象外（このタスクで実装しない）— Phase 2 で確定

- **モデル選択 UI**: 課題シートは「モデルを選び」と書くが、TSK-109 は **モデル一覧 API も
  モデル指定パラメータも公開していない**（[tsk-109 D6](tsk-109_chat-send-receive-api.md)：
  送信は `{ content }` のみ、サーバ既定 `LLM_MODEL` 固定）。バックエンド改変は本タスクの
  スコープ外のため、**モデル選択はスコープ外に降格**（ユーザー確認済み 2026-06-11）。
  バックエンド拡張は将来 TSK で対応する。
- **リトライ機能**: TSK-109 には regenerate エンドポイントが無く、`POST /messages` は毎回
  ユーザーメッセージを保存する。同一 content の再送は履歴にユーザーメッセージを重複させる。
  この副作用を避けるため、**リトライはスコープ外に降格**（ユーザー確認済み 2026-06-11）。
  エラーは表示のみ行う。
- バックエンド（`backend/`）の改変全般（chat API は TSK-109 で実装済み・改変しない）。

### バックエンド API 契約（TSK-109・改変しない）

ベースパス `/chat`、全エンドポイント要認証（`Authorization: Bearer`）。

| メソッド | パス | 概要 | レスポンス |
| --- | --- | --- | --- |
| POST | `/chat/threads` | スレッド作成（body `{ title? }`） | `201` `ChatThreadResponseDto` |
| GET | `/chat/threads` | 自分のスレッド一覧（新着順） | `200` `ChatThreadResponseDto[]` |
| GET | `/chat/threads/{id}/messages` | メッセージ一覧（seq 昇順） | `200` `ChatMessageResponseDto[]` |
| POST | `/chat/threads/{id}/messages` | 送信 + ストリーム（body `{ content }`） | `200` `text/event-stream` |
| DELETE | `/chat/threads/{id}` | スレッド論理削除 | `204` |

- 非所有/不在スレッドは全て `404`。
- `ChatThreadResponseDto = { id, ownerUserId, title: string|null, createdAt, updatedAt }`
- `ChatMessageResponseDto = { id, threadId, seq, role: 'system'|'user'|'assistant', content, createdAt, updatedAt }`
- SSE イベント（fetch の ReadableStream で消費、`EventSource` 不可）:
  - `event: delta` / `data: {"type":"delta","delta":"..."}`
  - `event: done` / `data: {"type":"done","messageId":..,"seq":..,"finishReason":..}`
  - `event: error` / `data: {"type":"error","code":..,"message":..,"retryable":..}`（ストリーム開始後）
- ストリーム開始前エラーは **HTTP ステータス + JSON ボディ** `{ code, message, retryable }`（400/404/429/502）。

---

## 2. 制約

- ページ（`page.tsx`）は View に専念、ロジックは同居 `use-<page>-page.ts` へ（1 ページ 1 フック）。
- UI レイヤから `@/lib/api` / `@/lib/openapi` を直接呼ばず、必ず `lib/api-hooks/` 経由
  （[frontend-architecture](10_architecture/03_frontend-architecture.md)）。
- `any` 禁止・`strict`。デザインシステム（`@/design-system`）と Tailwind 規約に準拠。
- 秘密情報をフロントに置かない（トークンは既存の `auth-session` 経由でのみ扱う）。
- SSE は `apiClient`（openapi-fetch）では消費できないため、`lib/api` の **生 fetch ラッパ**
  で実装する（既存 `uploadToPresignedUrl` が `lib/api/image.ts` で生 fetch を使う前例に倣う）。
- 型は OpenAPI 生成（`pnpm openapi:gen` で `backend/openapi.json` → `schema.d.ts`）。chat DTO は
  まだ生成されていないため Phase 5 C0 で再生成する（§10 / §13.2）。

---

## 3. 採用技術・既存資産

| 論点 | 採用 |
| --- | --- |
| レイアウト/ルーティング | **一覧ページ + スレッドページ（images 踏襲）**: `/chat`（一覧）+ `/chat/[threadId]`（会話）+ `/chat/new`（新規会話） |
| 新規スレッド作成 | **初回送信時に遅延作成**（`/chat/new` で最初の送信時に `POST /threads` → `POST /messages`） |
| エラー表示 | Alert で表示のみ（リトライなし。§1） |
| SSE 消費 | `lib/api/chat.ts` の生 fetch + ReadableStream パーサ（`Authorization` ヘッダ、401 で 1 回 refresh リトライ） |
| トークン解決 | 既存 `auth-session` の `getAccessToken` / `refreshAccessToken`、BASE_URL は `resolveApiBaseUrl`（`http.ts` の `BASE_URL`） |

既存資産（再利用）:

- `lib/api-hooks/use-api-resource.ts`（取得系の共通土台 `useApiResource<T>`）
- `lib/api/shared.ts`（`apiClient` / `unwrap` / `ApiError`）
- `lib/auth-session.ts`（`getAccessToken` / `refreshAccessToken`）, `lib/http.ts`（`BASE_URL`）
- `@/design-system`（`Button` / `Alert` / `Input` / `Textarea` / `Dialog` / `EmptyState` / `Text` ほか）
- `app/(admin)/layout.tsx`（TopBar ナビ。チャットリンクを追加）

---

## 4. 設計判断ログ

### D1: ルーティングは「一覧 `/chat` + 会話 `/chat/[threadId]` + 新規 `/chat/new`」（採用）

- **採用**: images の `page` + `[id]` 構成を踏襲し、`/chat`（スレッド一覧）/ `/chat/[threadId]`
  （既存会話）に加え、遅延作成のための `/chat/new`（空の会話）を置く。
- **理由**: ユーザー選択（Phase 3）。images と同じ 2 ページ構成に揃え、フックの責務を
  ページ単位に閉じる。遅延作成（D2）には threadId が未確定の入力画面が要るため `/chat/new`
  を分離する。
- **却下（サイドバー + 1 画面 / ChatGPT 風）**: images と構成が乖離し、クエリパラメータでの
  スレッド保持が必要になる。本リポジトリの既存パターン踏襲を優先。

### D2: 新規スレッドは「初回送信時に遅延作成」（採用）

- **採用**: `/chat/new` は空の入力画面を表示するだけ。最初の送信時に `POST /chat/threads`
  でスレッドを作成し、続けて `POST /chat/threads/{id}/messages` を実行する。ストリーム完了後に
  `router.replace('/chat/{id}')` で URL を確定スレッドへ置換する。
- **理由**: ユーザー選択（Phase 3）。送信しなければ空スレッドが残らない。
- **実装上の要点**: 作成した `threadId` は **ローカル変数で保持**し、ストリーム中は state
  （`useChatMessagesApi` のキー）へ載せない。これにより新規ページではストリーム中に
  メッセージ取得 API を発火させず（楽観的描画のみ）、作成直後スレッドの取得レースを避ける。
  `router.replace` は **ストリーム完了後**に行う（途中で遷移するとページ unmount により
  fetch が abort され、ストリームが切れるため）。
- **却下（ボタンで即時作成）**: 送信前に離脱すると空スレッドが一覧に残る。

### D3: ストリーミング描画は「サーバ取得メッセージ + 楽観的ストリーミングバブル」（採用）

- **採用**: 会話の確定メッセージは `GET /messages` の結果を描画。送信中は
  「楽観的ユーザーバブル」+「ストリーミング中のアシスタントバブル（delta を逐次連結）」を
  上乗せ表示する。**ストリーム終了後（done / error いずれも）に `GET /messages` を再取得**して
  楽観表示をサーバ確定状態へ置換する。
- **理由**: TSK-109 は「ユーザーメッセージ保存 → 生成 → アシスタント保存（中断時は部分保存）」
  を行う。終了後にサーバ再取得すれば、`seq`/`id`/部分保存の有無をフロントで推測せずに済み、
  常に正しい履歴を表示できる（リトライが無いので楽観確定での id 推測も不要）。
- **却下（楽観確定のみ・再取得しない）**: 部分保存・空生成・id 採番をフロントで推測する分岐が
  増え、サーバとの不整合リスクが残る。1 回の追加 GET で堅牢性を取る。
- **新規ページの例外**: `/chat/new` ではストリーム終了後に再取得せず `router.replace` で
  `/chat/{id}` へ遷移する。遷移先 `[threadId]` ページがマウント時に `GET /messages` で
  確定履歴を読むため、再取得は遷移で代替される。

### D4: SSE は `lib/api/chat.ts` の生 fetch で消費（採用）

- **採用**: `streamChatMessage(threadId, content, handlers, signal)` を `lib/api/chat.ts` に置き、
  `fetch(POST /chat/threads/{id}/messages)` のレスポンス `body.getReader()` を読んで SSE フレーム
  （`event:` / `data:` + 空行区切り）をパースし、`onDelta` / `onDone` / `onError` を呼ぶ。
- **理由**: openapi-fetch（`apiClient`）はストリームレスポンスを扱えない。生 fetch なら
  `Authorization` ヘッダ認証（TSK-109 D1 の前提）がそのまま効く。`uploadToPresignedUrl` が
  `lib/api/image.ts` で生 fetch を使う前例に倣う（UI からは api-hooks 経由で呼ぶので層は保たれる）。
- **トークン/401**: `getAccessToken()`（無ければ `refreshAccessToken()`）でトークンを得て付与。
  レスポンス `401` の場合のみ `refreshAccessToken()` で 1 回だけ再試行（`apiClient` の
  `authMiddleware` と同等の挙動を SSE 用に最小実装）。
- **エラー振り分け**: `res.ok===false`（開始前エラー）→ JSON `{ code, message, retryable }` を
  読み `onError`。ストリーム中の `event: error` → `onError`。ネットワーク例外 → 汎用
  `{ code:'NETWORK', message:'通信に失敗しました', retryable:true }` を `onError`。
- **却下（`@/lib/openapi` 拡張）**: openapi-fetch はストリーム非対応。

### D5: 会話オーケストレーションは共有フック `use-chat-conversation.ts`（採用）

- **採用**: `/chat/new` と `/chat/[threadId]` は「メッセージ描画 + 入力 + 送信ストリーミング」が
  共通。これを chat 機能ディレクトリ直下の共有フック `use-chat-conversation.ts` に集約し、
  両ページの `use-*-page.ts` から利用する。プレゼンテーションは共有コンポーネント
  `ChatConversation.tsx`（メッセージリスト + コンポーザ + Alert）に集約する。
- **理由**: 送信ストリーミングのロジック重複を避ける。`use-chat-conversation.ts` は `.ts` のため
  App Router のルートにはならない（routable は `page.tsx`/`layout.tsx` 等のみ）。各ページは
  `use-*-page.ts`（1 ページ 1 フック）で共有フックをラップし、ページ固有の差（新規=作成+遷移、
  既存=再取得）だけを与える。
- **却下（各ページに送信ロジックを直書き）**: 約 40 行の SSE オーケストレーションが二重化する。

---

## 5. データモデル / 型

新規の永続化モデルは無い。型は **OpenAPI 生成物（`schema.d.ts`）から取得**する。

```ts
import type { Schemas } from '@/lib/openapi/client';
type ChatThread = Schemas['ChatThreadResponseDto'];
type ChatMessage = Schemas['ChatMessageResponseDto'];
```

SSE ハンドラ用のローカル型（`lib/api/chat.ts`）:

```ts
export type ChatStreamHandlers = {
  onDelta: (delta: string) => void;
  onDone: (info: { messageId: string | null; seq: number | null; finishReason: string | null }) => void;
  onError: (err: { code: string; message: string; retryable: boolean }) => void;
};
```

---

## 6. 画面・コンポーネント仕様

### `/chat`（スレッド一覧）

- `GET /chat/threads` を `useChatThreadsApi` で取得し、新着順に一覧表示。
- 各行: タイトル（`title` が `null` なら「無題の会話」）+ 作成日時。クリックで `/chat/{id}` へ。
- ヘッダに「新規チャット」ボタン → `/chat/new` へ遷移。
- 行ごとに削除ボタン → 確認ダイアログ（images の `ConfirmModal` 同等）→ `DELETE /chat/threads/{id}`
  → 一覧 reload。
- 空状態は `EmptyState`（「会話はまだありません」+ 新規チャットアクション）。
- ローディング/エラーは images と同じ表示（`読み込み中...` / `Alert`）。

### `/chat/new`（新規会話）と `/chat/[threadId]`（既存会話）

両者とも共有 `ChatConversation` を描画する。

- メッセージリスト: `user`（右寄せ）/ `assistant`（左寄せ）バブル。`system` は表示しない。
- ストリーミング中: 楽観的ユーザーバブル + ストリーミング中アシスタントバブル（delta 連結、
  カーソル/「…」表示）。`isStreaming` 中は入力欄を送信不可（多重送信防止）。
- コンポーザ: `Textarea` + 送信ボタン。空文字は送信不可。`Enter` 送信は任意（`Shift+Enter` 改行、
  実装は最小で可。判断は §13.6）。
- エラー: `Alert variant="danger"` でメッセージ表示（リトライなし）。
- `[threadId]` 初期表示: `GET /chat/threads/{id}/messages` を取得して描画。404 は「会話が見つかりません」表示。

---

## 7. シーケンス

### 既存スレッドへの送信（`/chat/[threadId]`）

```text
page mount → GET /chat/threads/{id}/messages → 描画
user 送信(content):
  楽観: messages に user バブル追加, isStreaming=true, streamingText=''
  streamChatMessage(id, content, handlers):
    fetch POST /chat/threads/{id}/messages (Authorization, body {content})
    res.ok=false → onError(JSON {code,message,retryable})   // 開始前エラー(404/502/429/400)
    res.ok=true  → reader で SSE 読取:
      delta → streamingText += delta
      done  → onDone(info)
      error → onError(info)                                  // 開始後エラー
  finally: isStreaming=false; await reload(GET messages); 楽観状態クリア
```

### 新規送信（`/chat/new`）

```text
user 送信(content):
  let id = await createThread()    // POST /chat/threads {} → 201, id をローカル変数で保持
  楽観: messages=[user バブル], isStreaming=true
  streamChatMessage(id, content, handlers)  // 上と同じ。描画は楽観のみ
  finally: isStreaming=false; router.replace('/chat/'+id)   // 遷移先が GET messages で確定描画
```

---

## 8. トランザクション境界

- フロントには DB トランザクションは無い。バックエンドのトランザクション境界は
  [tsk-109 §8](tsk-109_chat-send-receive-api.md) に従う（ユーザーメッセージ保存とアシスタント
  メッセージ保存は独立の 2 書込）。フロントはストリーム終了後の `GET /messages` 再取得で
  サーバ確定状態に同期する（D3）ため、フロント側に整合性ロジックは持たない。

---

## 9. 既存設計との差分

- `frontend/src/app/(admin)/chat/` を新設（`page` / `new` / `[threadId]` + 各 `use-*-page.ts` +
  共有 `use-chat-conversation.ts` + `ChatConversation.tsx`）。
- `frontend/src/lib/api/chat.ts`（REST ラッパ + SSE 生 fetch）と `frontend/src/lib/api/index.ts`
  への re-export を追加。
- `frontend/src/lib/api-hooks/use-chat-api.ts`（`useChatThreadsApi` / `useChatMessagesApi` /
  `useChatActionsApi`）を追加。
- `frontend/src/app/(admin)/layout.tsx` の TopBar ナビに「チャット」リンクを追加（全ロール表示。
  画像と同じ位置）。
- `frontend/src/lib/openapi/schema.d.ts` を再生成（chat DTO/パスを追加）。
- バックエンド・migration・環境変数の変更は **なし**。
- `docs/10_architecture/03_frontend-architecture.md` のディレクトリ構成に `chat/` を追記
  （任意・軽微。§13.1）。
- `tsk-107/108/109` 同様、本設計書は `docs/` 直下に置く（AGENTS.md のドキュメント表は
  カテゴリ単位の登録のため個別 tsk 行の追記は不要 = 既存 tsk-10x と同じ運用）。

---

## 10. 完了条件（実装視点の具体化）

- [ ] `cd frontend && pnpm openapi:gen` を実行し `schema.d.ts` に chat 型/パスが含まれる。
- [ ] `lib/api/chat.ts`: `chatApi`（`createThread` / `listThreads` / `listMessages` /
      `removeThread`）+ `streamChatMessage(threadId, content, handlers, signal)`。`lib/api/index.ts`
      から re-export。
- [ ] `lib/api-hooks/use-chat-api.ts`: `useChatThreadsApi`（threads/isLoading/error/setError/reload/remove）
      / `useChatMessagesApi(threadId|null)`（null は空・無 fetch）/ `useChatActionsApi`
      （createThread / streamMessage を memo 化）。
- [ ] `app/(admin)/chat/page.tsx` + `use-chat-page.ts`: スレッド一覧 + 新規ボタン + 削除。
- [ ] `app/(admin)/chat/new/page.tsx` + `use-chat-new-page.ts`: 遅延作成 + ストリーム + 完了後遷移。
- [ ] `app/(admin)/chat/[threadId]/page.tsx` + `use-chat-thread-page.ts`: 既存会話の取得 + 送信ストリーム + 再取得。
- [ ] 共有 `app/(admin)/chat/use-chat-conversation.ts` と `ChatConversation.tsx`。
- [ ] `layout.tsx` に「チャット」ナビ追加。
- [ ] モデル選択 UI・リトライ UI は作らない（スコープ外）。
- [ ] `cd frontend && pnpm build` が通る。`cd frontend && pnpm lint` が通る。
- [ ] `docs/` の `.md` 変更があれば `npx markdownlint-cli 'docs/**/*.md'` が通る。

---

## 11. 手動動作確認シナリオ

> 前提: backend（TSK-109）+ OpenAI 互換サーバ（`LLM_*` 設定済み）をローカル起動。
> frontend を `pnpm --filter frontend dev` で起動し、ログイン済み。

1. **ナビ**: TopBar の「チャット」→ `/chat` が開き、スレッド一覧（または空状態）が表示される。
2. **新規 + ストリーム**: 「新規チャット」→ `/chat/new`。「こんにちは」を送信 → アシスタント応答が
   逐次（ストリーミング）表示される。完了後 URL が `/chat/{id}` に変わる。
3. **履歴再表示**: `/chat` に戻ると新スレッドが一覧に出る。クリックで会話が seq 順に再表示される。
4. **永続化（再ログイン）**: ログアウト→再ログイン→`/chat`→該当スレッドに会話が残っている。
5. **エラー表示**: `LLM_BASE_URL` を到達不能にして送信 → `Alert` にエラーメッセージが出る
   （開始前 502）。アプリがクラッシュしない。
6. **入力検証**: 空文字は送信ボタンが無効。
7. **削除**: 一覧でスレッド削除 → 確認 → 一覧から消える（再読込しても消えている）。
8. **認可**: （任意）別ユーザーで他人のスレッド URL を直接開く → 「会話が見つかりません」（404）。

---

## 12. 未確定事項

- なし（Phase 3 終了時点で全論点に採用案あり）。SSE 実配信・遷移・エラー実 HTTP は手動シナリオ
  （§11）で確認する。

---

## 13. 実装計画（Phase 4）

### 13.1 変更・追加ファイル

追加:

- `frontend/src/lib/api/chat.ts` … `chatApi`（REST）+ `streamChatMessage`（SSE 生 fetch）+ `ChatStreamHandlers`。
- `frontend/src/lib/api-hooks/use-chat-api.ts` … `useChatThreadsApi` / `useChatMessagesApi` / `useChatActionsApi`。
- `frontend/src/app/(admin)/chat/page.tsx` / `use-chat-page.ts` … スレッド一覧。
- `frontend/src/app/(admin)/chat/new/page.tsx` / `use-chat-new-page.ts` … 新規会話。
- `frontend/src/app/(admin)/chat/[threadId]/page.tsx` / `use-chat-thread-page.ts` … 既存会話。
- `frontend/src/app/(admin)/chat/use-chat-conversation.ts` … 共有会話フック（D5）。
- `frontend/src/app/(admin)/chat/ChatConversation.tsx` … 共有プレゼンテーション。

変更:

- `frontend/src/lib/api/index.ts` … `chat` の re-export を追加。
- `frontend/src/app/(admin)/layout.tsx` … TopBar ナビに「チャット」リンク追加。
- `frontend/src/lib/openapi/schema.d.ts` … `pnpm openapi:gen` で再生成（生成物・コミット対象）。
- `docs/10_architecture/03_frontend-architecture.md` … ディレクトリ構成に `chat/` を追記（軽微）。

### 13.2 migration・環境変数・依存・OpenAPI

- **migration / 環境変数 / 依存追加**: なし。
- **OpenAPI**: `backend/openapi.json` は TSK-109 で chat を含み済み（確認済み）。フロントは
  `cd frontend && pnpm openapi:gen`（`backend/openapi.json` → `schema.d.ts`）を **C0** で実行。
  DB 接続不要（既存 json を変換するだけ）のため **バックグラウンド worktree で実行可能**。

### 13.3 作業順序（コミット単位・各完了確認）

各コミット末尾で `cd frontend && pnpm build`（C0 は生成のみ→ビルドは C1 以降で担保）。

1. **C0 型生成**: `cd frontend && pnpm openapi:gen`。確認: `schema.d.ts` に `"/chat/threads"` と
   `ChatThreadResponseDto` が含まれる（`grep`）。
2. **C1 api 層**: `lib/api/chat.ts` + `lib/api/index.ts` 追記。確認: `pnpm build`。
3. **C2 api-hooks 層**: `lib/api-hooks/use-chat-api.ts`。確認: `pnpm build`。
4. **C3 共有 UI**: `chat/use-chat-conversation.ts` + `chat/ChatConversation.tsx`。確認: `pnpm build`。
5. **C4 ページ**: `chat/page.tsx`+`use-chat-page.ts` / `chat/new/*` / `chat/[threadId]/*`。確認: `pnpm build`。
6. **C5 ナビ + docs**: `layout.tsx` にナビ追加、`03_frontend-architecture.md` 追記。
   確認: `pnpm build` + `npx markdownlint-cli 'docs/**/*.md'`。

最後に `cd frontend && pnpm lint` を通し、`git status` で lint 自動修正の取りこぼしが無いか確認。

### 13.4 テスト方針

- 本リポジトリのフロントには自動テスト基盤が無い（images/users 等もユニットテストなし）。
  **新規の自動テストは追加しない**。品質は `pnpm build`（型）+ `pnpm lint` + §11 手動シナリオで担保。

### 13.5 想定外時の判断ルール

**AI 単独判断 OK**: images/既存フロントパターン踏襲上の軽微な調整、デザインシステム
コンポーネントの選択、Tailwind クラスの調整、命名の微修正、import 整理、SSE パーサの細部、
ストリーミングバブルの見た目。

**中断して最終報告に記録（質問せず停止）**:

- バックエンド（`backend/`）の改変が必要になった（API 契約・DTO・SSE 形が §1 表と食い違う等）。
- `backend/openapi.json` に chat の型/パスが存在しない、または `pnpm openapi:gen` が失敗する。
- API 契約（§1 表 / SSE イベント形）を変えないと実装できないと判明した。
- スコープ外に降格した「モデル選択」「リトライ」を復活させる必要が生じた。
- ルーティング方針（D1）/ 遅延作成（D2）/ ストリーム後再取得（D3）を覆す必要が生じた。
- 既存の認証/トークン機構（`auth-session` / openapi `authMiddleware`）の改変が必要になった。

### 13.6 事前解決済みの判断ポイント

| # | 判断ポイント | 解決 |
| --- | --- | --- |
| 1 | SSE 消費方式 | `lib/api/chat.ts` の生 fetch + `body.getReader()` + `TextDecoder`。フレームは空行区切り、各行 `event:`/`data:` をパースし `data:` の JSON を `type` で分岐（D4） |
| 2 | トークン付与 | `getAccessToken()`→無ければ`refreshAccessToken()`。付与は `Authorization: Bearer`。`resolveApiBaseUrl()`/`http.ts` の `BASE_URL` を使う |
| 3 | 401 ハンドリング | レスポンス `401` のみ `refreshAccessToken()` で 1 回だけ再 fetch（`authMiddleware` 同等）。再度 401 はエラー扱い |
| 4 | 開始前エラー | `res.ok===false` 時にボディ JSON `{code,message,retryable}` を読み `onError`。JSON で無ければ `{code:'HTTP_'+status, message: statusText, retryable: status>=500}` |
| 5 | ネットワーク例外 | `fetch`/読取の throw を catch し `onError({code:'NETWORK', message:'通信に失敗しました', retryable:true})` |
| 6 | 新規ページの threadId | 作成 id は **ローカル変数**で保持しストリーム中は state へ載せない。完了後 `router.replace('/chat/'+id)`（D2） |
| 7 | ストリーム後の同期 | 既存ページ: `await reload()`（GET messages）。新規ページ: `router.replace`（遷移先が取得）。done/error いずれでも実施（D3） |
| 8 | 楽観状態のクリア | reload 完了後に `streamingText=''`・楽観ユーザーバブル除去。`isStreaming` は finally で false |
| 9 | useChatMessagesApi(null) | fetcher を `threadId ? listMessages(threadId) : Promise.resolve([])` にし、`useApiResource` の自動取得で空配列を返す（新規ページで無駄な取得をしない） |
| 10 | role 表示 | `user` 右・`assistant` 左バブル。`system` は描画しない（現状 system メッセージは無いが防御的に除外） |
| 11 | title 表示 | `title ?? '無題の会話'`（TSK-108 でタイトル自動生成はスコープ外のため多くは null） |
| 12 | 一覧の更新 | 送信完了後の一覧反映は不要（一覧ページは開くたび reload）。削除後のみ `reload()` |
| 13 | 多重送信防止 | `isStreaming` 中は送信ボタン無効・`send` を早期 return |
| 14 | Enter 送信 | `Enter` で送信 / `Shift+Enter` で改行（最小実装）。IME 変換中（`isComposing`）は送信しない |
| 15 | unmount 時の中断 | `AbortController` を保持し、会話ページ unmount（`useEffect` クリーンアップ）で `abort()`。backend は切断で部分保存（TSK-109 D4） |
| 16 | 削除確認 UI | images の `ConfirmModal` と同等の `Dialog` をチャット一覧ページ内にローカル定義 |
| 17 | エラー文言 | `onError` の `message`（日本語汎用、backend 由来）をそのまま `Alert` に表示。無ければ「エラーが発生しました」 |
| 18 | ナビの表示条件 | 「チャット」リンクは全ロール表示（画像と同じ。admin 限定にしない） |
| 19 | 型の出所 | `Schemas['ChatThreadResponseDto']` / `Schemas['ChatMessageResponseDto']`（C0 生成後に利用可能） |
| 20 | api-hooks 経由 | `use-chat-conversation.ts` / ページは `lib/api-hooks` のみ参照し `lib/api`/`lib/openapi` を直接呼ばない（`streamMessage` も `useChatActionsApi` 経由で公開） |
