# TSK-115 チャット UI のレイアウト修正

会話が長くなったときに **ページ全体ではなく会話枠内だけがスクロール** するようにし、
chat UI（**会話コンテンツ + 入力欄の 2 部構成**）が **利用可能領域いっぱいに追従** するよう整える。
スレッドタイトルは chat UI の外（ページ上部）に置く。

- 原典タスク: TSK-115 / Notion: <https://app.notion.com/p/37d9ca7d99dc8075ae1cd67137408a57>
- 関連: [09_chat.md](20_features/09_chat.md)（チャット機能全体） /
  [tsk-113_chat-ui-componentization.md](tsk-113_chat-ui-componentization.md)（`<ChatPanel>` 抽出） /
  [03_frontend-architecture.md](10_architecture/03_frontend-architecture.md)

## Notion 課題シート（転記）

> **一行サマリ**
> レイアウトを整えて、chat UI コンポーネントを綺麗にしたい。
>
> **背景・動機**
> 現在の chat UI は LLM との会話が長くなるとページ全体がスクロールする。理想は次のとおり:
>
> - chat UI コンポーネントの大きさは、その外側の要素の大きさが変わらない場合、変化しない。
> - 会話部分は ［chat UI 全体の高さ］-［タイトルの高さ］-［ユーザー入力欄の高さ］。
>   会話コンテンツが超える場合はその範囲内でスクロールさせる。
> - 会話コンテンツ表示部分がスクロールするときは、その枠にスクロールバーが表示されること
>   （GUI ウィンドウ全体がスクロールしないこと）。
>
> **完了条件 / スコープ外 / 制約**
> （Phase 2 で具体化 → 下記「スコープ」「完了条件」に反映）

**注（Phase 2/3 での要件確定）**: 上記の原典シートは当初「タイトル + 会話 + 入力欄」を
chat UI の内部構成として描いていたが、議論の結果 **chat UI は「会話コンテンツ + 入力欄」の
2 部構成** とし、**スレッドタイトルは chat UI の外（ページ上部）** に置くことで確定した。
以降の本文はすべてこの 2 部構成を正とする。

## 課題サマリ

現状、チャットページ（`/chat/new` `/chat/[threadId]`）は `<ChatPanel className="h-[70vh]">` を
`space-y-4` でラップしている。`<ChatPanel>`（= `ChatConversation`）は `flex h-full flex-col` +
メッセージリスト `flex-1 overflow-y-auto` だが、**メッセージリストの `flex-1` 要素に `min-h-0` が無い**
ため、Flexbox の「フレックスアイテムは内容より縮まない（`min-height: auto`）」仕様で内容が増えると
枠を突き破り、`<main>` → `<body>` がスクロールしてしまう（＝ページ全体スクロールの根本原因）。

本タスクでは (1) この内部スクロールのバグを直し、(2) chat UI（会話コンテンツ + 入力欄の 2 部構成）を
`h-[70vh]` 固定から **利用可能領域いっぱい（ビューポートから TopBar を除いた高さ）への追従** に変え、
(3) **ページ** を上から「スレッドタイトル → 戻るリンク → chat UI」の順に縦積みする
（この縦積みはページ側の構造であり、chat UI 自体はあくまで会話 + 入力欄の 2 部構成）。

ユーザー合意による最終構造（各チャットページ）:

```text
main（flex-1 + min-h-0 + overflow-y-auto）← 認証レイアウトを h-dvh flex 化して確保
  チャットページ root（flex h-full flex-col gap-4）
    - スレッドタイトル（thread=chat_threads.title / new=「新規チャット」）… 固定高（flex-none）
    - 「← 一覧に戻る」リンク … 固定高（flex-none）
    - <ChatPanel className="flex-1 min-h-0"> … 残り全部を埋め、内部だけスクロール
```

タイトルは chat UI コンポーネント **内部には持たせず**、ページ上部に置く（タイトル編集は別タスク）。

## スコープ

### 対象（フロントエンドのみ）

- `(authenticated)/layout.tsx` を `h-dvh` の flex 縦並びにし、`<main>` を
  `flex-1 + min-h-0 + overflow-y-auto` のスクロールコンテナにする。
- `ChatConversation.tsx` のメッセージリストに `min-h-0` を追加して内部スクロールを成立させる。
- `chat/new/page.tsx` / `chat/[threadId]/page.tsx` を「タイトル → 戻るリンク → ChatPanel」の
  3 段（`flex h-full flex-col`）に再構成し、`<ChatPanel>` を `flex-1 min-h-0` で渡す。
- `chat/[threadId]/use-chat-thread-page.ts` で `useChatThreadsApi()` から `threadId` 一致の
  スレッドを引き、`title`（null は「無題の会話」）を返す（**読み取り表示のみ**）。
- 関連ドキュメント更新（[09_chat.md](20_features/09_chat.md) フロントエンド節）。

### 対象外

- スレッドタイトルの **編集 UI / API**（別タスク）。本タスクは読み取り表示のみ。
- バックエンド・API・DB の変更（単体取得エンドポイント新設はしない。`GET /chat/threads` を流用）。
- スレッド一覧ページ `/chat` の変更（`<main>` 配下なのでレイアウト変更の恩恵は受けるが、ページ自体は無改修）。
- 送信・ストリーミング・空生成・切断・notFound・新規遷移の **挙動変更**（リグレッションを出さない）。
- chat UI 内部へのタイトル行追加（ユーザー判断で不採用。タイトルはページ側）。

## 制約

- フロントエンドのみ。`any` 不使用 / `strict` 維持。className 結合は既存同様の素朴結合（`cn` 未導入）。
- [03_frontend-architecture.md](10_architecture/03_frontend-architecture.md): UI レイヤは `@/lib/api` /
  `lib/openapi` を直接呼ばず `lib/api-hooks/` 経由。ページは View・ロジックは同居フックへ。
- 認証レイアウト変更は全認証ページ（画像・ユーザー・監査ログ・プロフィール）に波及する。
  これらのページで **本文が見切れず縦スクロールで全行到達できる** ことを手動確認する。
- Tailwind v4（`h-dvh` / `min-h-0` 利用可）。

## 設計判断ログ

### D1: 高さ実現方式 — 認証レイアウトを `h-dvh` flex 化（採用）

- **採用**: `(authenticated)/layout.tsx` のルート `<div>` を `flex h-dvh flex-col` にし、TopBar を
  自然高（`flex-none` 相当、56px）、`<main>` を `flex-1 min-h-0 overflow-y-auto` にする。
  これで `<main>` が唯一のスクロールコンテナになり、チャットページは `h-full` で main を満たすだけで
  「利用可能領域いっぱい」が **マジックナンバーなしで** 決まる。会話のスクロールは ChatPanel 内部に閉じる。
- **却下（chat ページのみ `calc`）**: `h-[calc(100dvh-56px-余白)]` で chat ページだけ高さを与える案。
  レイアウト非変更だが TopBar 高さ・`<main>` の `py-8` をマジックナンバーで二重管理することになり脆い。
- 影響: 全認証ページのスクロールが `<body>` から `<main>` に変わる。他ページは短いリスト主体のため
  実質影響は軽微だが、手動確認シナリオに含める。

### D2: スレッドタイトル取得 — 既存 `listThreads()` を id で絞り込み（採用）

- **採用**: スレッド単体取得 API は現状存在しない。`useChatThreadsApi()`（`GET /chat/threads`）の結果から
  `threadId` 一致のスレッドを `find` し、`title ?? '無題の会話'` を表示する。バックエンド変更不要。
- **却下（`GET /chat/threads/{id}` 新設）**: オーバーフェッチは無くなるが controller / usecase / repository
  などオニオン各層の追加でスコープが広がる。表示は一覧と同じ `title ?? '無題の会話'` で十分。
- 既知の軽微事項: 一覧の全件取得が走る（一覧は小規模）。初回ロード中はタイトルを空（高さ確保）にして
  「無題の会話」のちらつきを避ける。一致なし（不正 threadId）は「無題の会話」表示で、本体は ChatPanel が
  notFound を出す。

### D3: タイトルは chat UI 内部に持たせない（採用）

- **採用**: chat UI（`<ChatPanel>` / `ChatConversation`）は「会話 + 入力欄」のみ。タイトルはページ側の
  ヘッダとして配置する。ユーザー判断（タイトル編集は別タスクで、ページ側に置く方が編集 UI 追加時に素直）。
- これにより `<ChatPanel>` の公開 API（`ChatPanelProps`）は **変更なし**。`className` で高さを受け取る
  既存契約（TSK-113 D3）をそのまま使い、ページが `flex-1 min-h-0` を渡す。

## 既存設計との差分

| 項目 | Before | After |
| --- | --- | --- |
| 認証レイアウト | `<div class="min-h-full">` + `<main class="...px-4 py-8">`（body スクロール） | `<div class="flex h-dvh flex-col">` + `<main class="flex-1 min-h-0 overflow-y-auto ...">`（main スクロール） |
| chat UI の高さ | ページが `h-[70vh]` 固定で付与 | ページが `flex-1 min-h-0` で付与（利用可能領域いっぱい） |
| メッセージリスト | `flex-1 ... overflow-y-auto`（`min-h-0` 無し → 枠を突き破る） | `flex-1 min-h-0 ... overflow-y-auto`（枠内スクロール） |
| チャットページ構成 | 戻りリンク + 見出しを `space-y-4` で並べ ChatPanel | `flex h-full flex-col`: タイトル → 戻りリンク → ChatPanel |
| スレッドページのタイトル | なし（戻りリンクのみ） | `chat_threads.title`（null は「無題の会話」）を上部表示 |
| `<ChatPanel>` 公開 API | — | **変更なし**（`ChatPanelProps` 不変、`className` 契約のまま） |

- `ChatConversation.tsx` はメッセージリストへの `min-h-0` 追加のみ（送信・描画ロジックは無変更）。
- `use-chat-conversation.ts` / `use-chat-panel.ts` / `ChatPanel.tsx` / barrel は **無変更**。

## 完了条件（具体化版）

- [ ] 会話が長くなっても **ページ全体（body）はスクロールせず、会話枠内のみスクロール** する。
- [ ] 会話枠がスクロールするとき、その枠（ChatPanel 内）にスクロールバーが出る。
- [ ] chat UI が利用可能領域（ビューポート − TopBar）いっぱいに広がり、外側が変わらなければ高さが変わらない。
- [ ] 入力欄は常に最下部に固定で見える（会話量に依らず）。
- [ ] スレッドページ上部に `chat_threads.title`（null は「無題の会話」）が表示される。
- [ ] 新規ページ上部に「新規チャット」が表示される。両ページとも下に「← 一覧に戻る」リンク。
- [ ] 他の認証ページ（画像・ユーザー・監査ログ・プロフィール）が `<main>` 内スクロールで全行到達でき、見切れない。
- [ ] `pnpm --filter frontend build` と `pnpm --filter frontend lint` が通る。
- [ ] [09_chat.md](20_features/09_chat.md) のフロントエンド節が更新され、`npx markdownlint-cli 'docs/**/*.md'` が通る。

## 手動動作確認シナリオ

開発サーバ（`pnpm --filter frontend dev` + backend 稼働 + LLM エンドポイント）でログイン後:

1. **長い会話のスクロール**: 既存スレッドまたは新規で会話を十分長くする → 会話枠内だけがスクロールし、
   ページ全体（ブラウザのスクロールバー）は動かない。入力欄は常に最下部に見える。
2. **高さ追従**: ブラウザ高さを変える → chat UI がビューポート − TopBar の高さに追従する。横幅を
   スマフォ幅相当まで狭めても破綻しない。
3. **スレッドタイトル**: 一覧 `/chat` から既存スレッドを開く → 上部にそのスレッドのタイトル（無題なら
   「無題の会話」）→ その下に「← 一覧に戻る」→ その下に chat UI、の順で並ぶ。
4. **新規ページ**: `/chat/new` で上部に「新規チャット」→「← 一覧に戻る」→ chat UI。送信 → ストリーミング →
   完了後 `/chat/<id>` へ遷移し、タイトルと全文が確定描画される。
5. **送信系リグレッション**: 空入力は送信不可、ストリーミング中は入力/送信無効、切断（ページ遷移）でも
   エラーにならない（現状どおり）。notFound（でたらめ UUID）は「会話が見つかりません」。
6. **他ページ回帰**: `/images`・`/users`・`/audit-logs`・`/profile` を開き、内容が長い場合に `<main>`
   内スクロールで全行に到達でき、TopBar が常に最上部に残る。

## 未確定事項

- なし。

---

## 実装計画（Phase 4）

### 変更ファイル（追加・削除なし）

| ファイル | 変更内容 |
| --- | --- |
| `frontend/src/app/(authenticated)/layout.tsx` | ルート `<div>` を `flex h-dvh flex-col` に、TopBar に `shrink-0`、`<main>` を `mx-auto w-full max-w-5xl flex-1 min-h-0 overflow-y-auto px-4 py-8` に変更。 |
| `frontend/src/components/chat/ChatConversation.tsx` | メッセージリストの `flex-1 space-y-4 overflow-y-auto pb-4` に `min-h-0` を追加。 |
| `frontend/src/app/(authenticated)/chat/new/page.tsx` | ルートを `flex h-full flex-col gap-4` にし、上から「新規チャット」見出し → 戻りリンク → `<ChatPanel className="flex-1 min-h-0">` に再構成。 |
| `frontend/src/app/(authenticated)/chat/[threadId]/page.tsx` | ルートを `flex h-full flex-col gap-4` にし、上からスレッドタイトル → 戻りリンク → `<ChatPanel className="flex-1 min-h-0">` に再構成。`Text` を import。 |
| `frontend/src/app/(authenticated)/chat/[threadId]/use-chat-thread-page.ts` | `useChatThreadsApi()` から `threadId` 一致スレッドを引き `title` を返す（ロード中は空、null は「無題の会話」）。 |
| `docs/20_features/09_chat.md` | フロントエンド節を「ページが title→戻り→ChatPanel を縦積み・chat UI は利用可能領域いっぱい追従」に更新。`h-[70vh]` 記述を改める。 |

### migration・環境変数・依存追加

- なし（フロントエンドのみ。DB・env・依存追加なし）。

### 作業順序（コミット単位）

1. **コミット1: 認証レイアウトを `h-dvh` flex 化（`<main>` をスクロールコンテナに）**
   - `layout.tsx` のルート `<div>` / TopBar / `<main>` を変更。ローディング早期 return（`min-h-full` の中央寄せ）は変更しない。
   - 完了確認: `pnpm --filter frontend build` / `pnpm --filter frontend lint` 通過。手動で `/images` 等が `<main>` 内スクロールで全行到達できる。`git status` で lint 自動修正の取りこぼし無し。
2. **コミット2: chat UI を利用可能領域いっぱいに追従させ、内部スクロールを成立させる**
   - `ChatConversation.tsx` のメッセージリストに `min-h-0` 追加。
   - `chat/new/page.tsx` / `chat/[threadId]/page.tsx` を `flex h-full flex-col gap-4` の縦積み（タイトル → 戻りリンク → `<ChatPanel className="flex-1 min-h-0">`）に再構成。
   - `use-chat-thread-page.ts` でタイトルを取得して返す。
   - これらは見た目上相互依存（page が `flex-1 min-h-0` を渡して初めて `min-h-0` が効く）のため**同一コミット**にまとめる。
   - 完了確認: build / lint 通過。手動シナリオ 1〜5（長い会話の枠内スクロール・高さ追従・タイトル表示・送信系リグレッション）を確認。`git status` 確認。
3. **コミット3: ドキュメント更新**
   - `docs/20_features/09_chat.md` フロントエンド節を更新。
   - 完了確認: `npx markdownlint-cli 'docs/**/*.md'` 通過。

### テスト方針

- フロントエンドに会話 UI のユニットテストは存在しない（テストは backend application 層中心。[02_testing-strategy.md](40_processes/02_testing-strategy.md)）。本タスクはレイアウト（CSS クラス）変更主体で挙動を変えないため新規テストは追加しない。
- 担保は **型チェック / `frontend build` / `frontend lint` / 手動動作確認シナリオ 6 件** で行う。

### 想定外時の判断ルール

- **AI 単独判断 OK**: className 結合の素朴な実装、import 追加、`useChatThreadsApi` の戻り値からのタイトル導出、軽微な既存コードリファクタ、本設計書スコープ内の追加。
- **中断して要相談（質問せず停止し最終報告に記録）**:
  - `h-dvh` flex 化で他認証ページ（画像・ユーザー・監査ログ・プロフィール）に **本文見切れ等のリグレッション**が出て、`layout.tsx` 以外の各ページ改修が必要と判明した場合。
  - 送信・ストリーミング・空生成・切断・notFound・新規遷移のいずれかで **現状と異なる挙動**が避けられない場合。
  - `<ChatPanel>` の公開 API（`ChatPanelProps`）や `components/chat/` 内部実装（`ChatConversation` の `min-h-0` 追加を除く）の変更が必要になった場合。
  - スレッドタイトル取得のためにバックエンド / API / DB 変更が必要になった場合（= 単体取得 API 新設に踏み込む必要が出た場合）。

### 事前解決済みの判断ポイント

- **JP1（`<main>` の幅）**: flex column 化後も中央寄せを保つため `<main>` は `mx-auto w-full max-w-5xl ...`。`flex-1`/`min-h-0` は主軸（縦）、`w-full max-w-5xl mx-auto` は交差軸（横）を制御するので併存して問題ない。
- **JP2（TopBar の縮み防止）**: flex column 下で TopBar が縮まないよう className に `shrink-0` を付与（`admin-topbar shrink-0`）。高さは TopBar 内部の 56px。
- **JP3（chat ページ root の高さ解決）**: ページ root を `flex h-full flex-col gap-4`。`h-full` は `<main>`（`flex-1` で高さ確定）の content box に解決され、`gap-4` は現行 `space-y-4`（1rem）相当。
- **JP4（ChatPanel への className）**: ページは `<ChatPanel className="flex-1 min-h-0">` を渡す。`ChatConversation` root は `['flex h-full flex-col', className]` 結合で `flex-1 min-h-0` が乗り、loading/notFound 分岐（`[className, 'flex items-center justify-center']`）でも利用可能領域を埋めて中央表示になる。`ChatPanel.tsx` は無変更。
- **JP5（内部スクロールの成立）**: バグ修正は `ChatConversation` のメッセージリスト `flex-1` に `min-h-0` を足すこと。これで親（root の `flex-1 min-h-0`）→ リスト（`flex-1 min-h-0 overflow-y-auto`）の連鎖が成立し、リスト枠内だけがスクロールしスクロールバーが出る。コンポーザ（`border-t ... bg-white pt-3`）は最下部固定のまま。
- **JP6（タイトル取得とちらつき防止）**: `use-chat-thread-page.ts` は `useChatThreadsApi()` の `{ threads, isLoading }` を使い `const thread = threads.find((t) => t.id === threadId);`、返す `title` は `isLoading ? '' : (thread?.title ?? '無題の会話')`。ページは `<Text as="h1" variant="heading-md" className="flex-none">{title || ' '}</Text>` でロード中も高さを確保（レイアウトシフト防止）。不正 threadId は「無題の会話」表示で、本体は ChatPanel が notFound を出す。
- **JP7（new ページのタイトル）**: 新規ページはスレッド未確定のため見出しは固定文言「新規チャット」（既存 `Text as="h1" variant="heading-md"`）。構成順は thread ページと対称（タイトル → 戻りリンク → ChatPanel）。送信完了後は `onThreadCreated` で `/chat/<id>` へ遷移し、thread ページがタイトルを表示する。
- **JP8（戻りリンクの体裁）**: 「← 一覧に戻る」は既存どおり `NextLink className="ds-link ds-link--inline text-sm"`＋`flex-none`。new ページの現行「戻りリンクと見出しを `justify-between` で横並び」は廃し、縦積みに統一する。
