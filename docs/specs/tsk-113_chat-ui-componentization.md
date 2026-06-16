# TSK-113 チャット UI のコンポーネント化

LLM チャットの会話 UI を、任意の場所（モーダル・サイドバー・小スペース等）へ今後埋め込める
**自己完結した再利用コンポーネント** `<ChatPanel>` として `src/components/chat/` へ切り出す。

- 原典タスク: TSK-113 / Notion: <https://app.notion.com/p/37c9ca7d99dc8075b34ec8918775d9b9>
- 関連: [09_chat.md](20_features/09_chat.md)（チャット機能全体） /
  [tsk-110_chat-frontend.md](tsk-110_chat-frontend.md)（既存フロント） /
  [03_frontend-architecture.md](10_architecture/03_frontend-architecture.md)

## Notion 課題シート（転記）

> **一行サマリ**
> チャット UI 部分を一つの部品として、さまざまなところで今後利用したい。
>
> **背景・動機**
> 現在はメニューに「チャット」があり、LLM とのチャットをするための専用ページ（画面）がある。
> しかしながら、たとえば「ある画像に対して LLM と会話する」ように「コンテンツを中心に据えて、
> LLM と会話する」ような部品的な扱い方をする可能性がある。その場合、UI/UX 部分をモーダル
> ダイアログ上の一部として配置したり、サイドバーに埋め込んだり、ちょっとした隙間に埋め込む
> ことも考えられる。さらに、PC・タブレット・スマフォと端末の形状・画面の大きさもさまざまな
> ので、それらに臨機応変できるようなチャット UI を用意しておきたい。
>
> **完了条件 / スコープ外 / 制約**
> （Phase 2 で具体化 → 下記「スコープ」「完了条件」に反映）

## 課題サマリ

既存のチャット会話 UI は `app/(authenticated)/chat/` 配下に閉じており、専用ページからしか使えない。
プレゼン層 `ChatConversation` と送信フック `useChatConversation` は新規/既存ページ間で共有済みだが、
API アクセスフック（`useChatMessagesApi` 等）やページ固有ロジック（遷移・ローディング・notFound）と
ページ側で組み合わされており、単体では持ち出せない。本タスクはこれを **`threadId` を渡すだけで内部
配線まで完結する `<ChatPanel>`** として `src/components/chat/` に抽出・再配置し、既存ページを配線し直す。

## スコープ

### 対象

- 会話 UI を自己完結コンポーネント `<ChatPanel>` として `src/components/chat/` へ抽出（公開 API は `<ChatPanel>` のみ）。
- `<ChatPanel>` は親コンテナの高さに追従（`h-full` + 内部スクロール）し、幅は流動的に追従する。
- 既存ページ（`chat/new` / `chat/[threadId]`）を `<ChatPanel>` 経由に配線し直す。
- 関連ドキュメント更新（[09_chat.md](20_features/09_chat.md) / [03_frontend-architecture.md](10_architecture/03_frontend-architecture.md)）。

### 対象外

- 実際のモーダル/サイドバー/小スペースへの埋め込み実装（将来タスク。本タスクは「埋め込める形」にするまで）。
- 文脈注入（初期コンテキスト/システムプロンプト、「画像について会話」等）。バックエンド未対応のため別タスク。
- バックエンド・API・DB・スレッド一覧ページ（`/chat`）・送信/ストリーミング/エラーの挙動変更。
- `design-system/` への配置（`<ChatPanel>` は `lib/api-hooks` に依存するアプリ固有部品のため `components/` に置く）。

## 制約

- フロントエンドのみの変更。送信・ストリーミング・エラー・空生成・切断の挙動に **リグレッションを出さない**。
- [03_frontend-architecture.md](10_architecture/03_frontend-architecture.md) の規約を守る:
  - UI レイヤから `@/lib/api` / `lib/openapi` を直接呼ばず必ず `lib/api-hooks/` 経由。
  - ページは View に専念し、ロジックは同居フックへ。
- `any` 不使用 / `strict` 維持。className 結合は既存コード同様の素朴な結合（`cn` ヘルパは未導入）。

## 設計判断ログ

### D1: 配置先 — `src/components/chat/`（採用）

- **採用**: `src/components/chat/`。`<ChatPanel>` は `lib/api-hooks/use-chat-api` に依存するアプリ固有部品であり、
  純粋 UI プリミティブの集合である `design-system/` の責務（素材提供）に合わない。frontend-architecture の
  「`components/` = 共有コンポーネント」に合致する。
- **却下**: `design-system/components/Chat/`。API アクセス依存を design-system に持ち込むと層が崩れる。

### D2: 公開粒度 — 自己完結パネル `<ChatPanel>` のみ公開（採用）

- **採用**: `threadId`（または `mode="new"`）を渡せば内部で API 配線・送信・描画まで完結する単一の
  `<ChatPanel>` を公開。埋め込む側はドロップするだけ。プレゼン層 `ChatConversation` と送信フック
  `useChatConversation` は `components/chat/` 内に移設するが **内部実装**として非公開（barrel から export しない）。
- **却下（合成パーツ公開）**: `ChatConversation` + `useChatConversation` を公開し埋め込み側が合成する案。
  柔軟だが埋め込み毎に配線コードが必要で「ドロップするだけ」という目的に反する。将来高度な用途が出たら
  その時点で内部部品を公開すればよい（YAGNI）。

### D3: コンテナ追従 — 親高さを埋める（採用）

- **採用**: `<ChatPanel>` ルートを `flex h-full flex-col` とし、メッセージリストを `flex-1 overflow-y-auto`、
  コンポーザを最下部の固定ブロック（非 sticky）にする。**高さは埋め込み側が与える**（ページは `h-[70vh]`、
  モーダル/サイドバーはそれぞれの枠が与える）。現状の `minHeight: 60vh`（ビューポート基準）と `sticky bottom-0` を廃止。
- 幅は既存どおりバブルの `max-w-[80%]` 等で流動的に追従するため、`@container` クエリは現時点で不要
  （幅で再構成が必要なレイアウトを持たない）。将来必要になれば追加する。
- **却下（ビューポート基準）**: ユーザー選択により不採用。埋め込み枠と不一致になる。

### D4: 新規モードの遷移責務 — `onThreadCreated` コールバックで外出し（採用）

- 既存の新規ページは初回送信時に遅延 `createThread()` → ストリーム完了後に `router.replace('/chat/:id')` で
  確定スレッドへ遷移していた。`<ChatPanel>` に `next/navigation` を直接持たせると埋め込み再利用性を損なうため、
  遷移は `onThreadCreated?(threadId)` コールバックで **呼び出し側に外出し**する。新規ページはこのコールバックで
  従来どおり遷移する。挙動は現状と一致（リグレッションなし）。
- 既知の制約（将来課題）: `mode="new"` で `onThreadCreated` を遷移に使わず同じ場所に留まる埋め込みは、
  初回送信後に楽観バブルがクリアされ会話が空に戻る（現状の新規ページ実装と同じ）。スレッド作成後に自動で
  `thread` モードへ自己遷移する改善は **本タスクのスコープ外**（文脈注入を伴う埋め込みと併せて別タスク）。

## コンポーネント API

```ts
// src/components/chat/ChatPanel.tsx
export type ChatPanelProps = {
  /** 高さ・枠線・余白等は埋め込み側がここで指定する（例: 'h-[70vh]'）。 */
  className?: string;
} & (
  | { mode: 'thread'; threadId: string }
  | { mode: 'new'; onThreadCreated?: (threadId: string) => void }
);

export function ChatPanel(props: ChatPanelProps): JSX.Element;
```

- `mode: 'thread'`: 既存スレッドを表示。内部で `useChatMessagesApi(threadId)` により履歴取得、
  ストリーム完了後に `reload()` で確定同期。ローディング/notFound もパネル内で表現する。
- `mode: 'new'`: 新規会話。初回送信時に遅延作成し、完了後 `onThreadCreated(threadId)` を呼ぶ。
- barrel: `src/components/chat/index.ts` は `ChatPanel` と `ChatPanelProps` のみ export。

### 内部構成（components/chat/ 配下）

| ファイル | 役割 | 公開 |
| --- | --- | --- |
| `ChatPanel.tsx` | 自己完結パネル。ローディング/notFound/会話の出し分け | ○（公開） |
| `use-chat-panel.ts` | mode に応じて `useChatMessagesApi` + `useChatConversation` を配線し、描画 props を返す内部フック | ×（内部） |
| `ChatConversation.tsx` | 会話プレゼン（リスト + コンポーザ + Alert）。app から移設 | ×（内部） |
| `use-chat-conversation.ts` | 送信オーケストレーション + 楽観表示。app から移設（ロジック変更なし） | ×（内部） |
| `index.ts` | barrel（`ChatPanel` / `ChatPanelProps`） | ○ |

#### `use-chat-panel.ts` の配線

```ts
function useChatPanel(props: ChatPanelProps) {
  const threadId = props.mode === 'thread' ? props.threadId : null;
  const messagesApi = useChatMessagesApi(threadId);   // new は null → 空配列・fetch なし
  const actions = useChatActionsApi();
  const createdRef = useRef<string | null>(null);

  const resolveThreadId = useCallback(async () => {
    if (props.mode === 'thread') return props.threadId;
    const thread = await actions.createThread();
    createdRef.current = thread.id;
    return thread.id;
  }, [props, actions]);

  const onStreamSettled = useCallback(async (id: string) => {
    if (props.mode === 'thread') await messagesApi.reload();
    else props.onThreadCreated?.(id);
  }, [props, messagesApi]);

  const conversation = useChatConversation({ resolveThreadId, onStreamSettled });

  return {
    messages: conversation.buildMessages(messagesApi.messages), // new は messagesApi.messages=[]
    streamingText: conversation.streamingText,
    isStreaming: conversation.isStreaming,
    error: conversation.error ?? messagesApi.error,
    isLoading: messagesApi.isLoading && messagesApi.messages.length === 0,
    notFound: messagesApi.error !== null && messagesApi.messages.length === 0,
    send: conversation.send,
  };
}
```

- `mode: 'new'` では `messagesApi`（threadId=null）が fetch せず `messages=[]` / `error=null` / `isLoading=false`
  を返すため、`isLoading`/`notFound` は自然に false になり、既存新規ページの挙動（`buildMessages([])`）と一致する。

#### `ChatConversation` の高さ変更（D3）

- ルート: `flex flex-col`＋`minHeight: 60vh` → **`flex h-full flex-col`**（`className` を受け取り結合）。
- メッセージリスト: `flex-1 space-y-4 pb-4` → **`flex-1 space-y-4 overflow-y-auto pb-4`**（内部スクロール）。
- コンポーザ: `sticky bottom-0 ...` の **`sticky bottom-0` を除去**し最下部の固定ブロックに（`border-t ... bg-white pt-3` は維持）。
- メッセージ描画・コンポーザ・Enter 送信・IME・楽観バブル等のロジックは **変更しない**。

## 既存設計との差分

| 項目 | Before | After |
| --- | --- | --- |
| 会話 UI の所在 | `app/(authenticated)/chat/`（ページ固有配線） | `src/components/chat/`（自己完結 `<ChatPanel>`） |
| 公開単位 | `ChatConversation`（プレゼンのみ。API 配線はページ） | `<ChatPanel>`（API 配線込み） |
| 高さ | `minHeight: 60vh` + `sticky` コンポーザ | 親追従 `h-full` + 内部スクロール |
| 新規遷移 | ページフックが `router.replace` | `onThreadCreated` コールバック（ページが遷移） |
| ローディング/notFound | ページフックで判定・ページが描画 | パネル内で判定・描画（back link はページ） |

- 既存の `use-chat-conversation.ts` のロジックは無変更で移設。`ChatConversation.tsx` は高さ系クラスのみ変更。
- スレッド一覧ページ `chat/page.tsx` / `use-chat-page.ts` は **変更なし**。

## 完了条件（具体化版）

- [ ] `src/components/chat/`（`ChatPanel.tsx` / `use-chat-panel.ts` / `ChatConversation.tsx` / `use-chat-conversation.ts` / `index.ts`）が存在し、barrel が `ChatPanel` / `ChatPanelProps` のみ公開する。
- [ ] `app/(authenticated)/chat/ChatConversation.tsx` と `app/(authenticated)/chat/use-chat-conversation.ts` は移設により削除されている。
- [ ] `chat/new/page.tsx` と `chat/[threadId]/page.tsx` が `<ChatPanel>` 経由で描画し、各ページフックは `onThreadCreated` / `threadId` の供給に絞られている。
- [ ] `<ChatPanel>` が親の高さに追従し（`h-full` + 内部スクロール）、ページでは `h-[70vh]` で表示される。
- [ ] 送信・ストリーミング・空生成・切断・notFound・新規遷移の挙動が現状と一致（手動シナリオ全通過）。
- [ ] `pnpm --filter frontend build` と `pnpm --filter frontend lint` が通る。
- [ ] [09_chat.md](20_features/09_chat.md) の「フロントエンド」節と [03_frontend-architecture.md](10_architecture/03_frontend-architecture.md) のディレクトリ構成が更新され、`npx markdownlint-cli 'docs/**/*.md'` が通る。

## 手動動作確認シナリオ

開発サーバ（`pnpm --filter frontend dev` + backend 稼働 + LLM エンドポイント）で、ログイン後:

1. **新規送信**: `/chat/new` を開き、メッセージ送信 → ストリーミング表示 → 完了後に `/chat/<id>` へ遷移し全文が確定描画される。
2. **既存スレッド**: 一覧 `/chat` から既存スレッドを開く → 履歴が表示され、追加送信がストリーミング → 完了後も会話が保持される。
3. **空入力**: 空文字や空白のみは送信できない。ストリーミング中は入力/送信が無効。
4. **notFound**: 存在しない `threadId`（`/chat/<でたらめUUID>`）を開くと「会話が見つかりません」が表示され、「← 一覧に戻る」が機能する。
5. **高さ/スクロール**: 会話が長くなるとパネル内部でスクロールし、コンポーザは常に最下部に残る（ページ全体ではなくパネル内スクロール）。
6. **レイアウト追従**: ブラウザ幅を狭めても（スマフォ幅相当まで）コンポーザ・バブルが破綻しない。
7. **切断**: ストリーミング中にページ遷移（unmount）してもエラーにならない（backend 側で部分保存）。

## 未確定事項

- なし。

---

## 実装計画（Phase 4）

### 変更・追加・削除ファイル

#### 追加（`frontend/src/components/chat/`）

- `ChatPanel.tsx` — 公開コンポーネント。`useChatPanel` を呼び、loading / notFound / 会話を出し分け、`className` を転送。
- `use-chat-panel.ts` — 内部フック。mode に応じ `useChatMessagesApi` + `useChatActionsApi` + `useChatConversation` を配線。
- `index.ts` — barrel。`ChatPanel` と型 `ChatPanelProps` のみ export。

#### 移設（`git mv` で履歴保持）

- `app/(authenticated)/chat/ChatConversation.tsx` → `components/chat/ChatConversation.tsx`（高さ系クラス変更＋`className` prop 追加）。
- `app/(authenticated)/chat/use-chat-conversation.ts` → `components/chat/use-chat-conversation.ts`（ロジック無変更。`import` は絶対パス `@/...` のため移設後もそのまま有効）。

#### 変更

- `app/(authenticated)/chat/[threadId]/page.tsx` — `<ChatPanel mode="thread" threadId className="h-[70vh]">` を描画。back link は維持、loading/notFound 分岐は撤去（パネルが担当）。
- `app/(authenticated)/chat/[threadId]/use-chat-thread-page.ts` — `useParams` から `{ threadId }` を返すだけに縮退。
- `app/(authenticated)/chat/new/page.tsx` — `<ChatPanel mode="new" onThreadCreated className="h-[70vh]">` を描画。
- `app/(authenticated)/chat/new/use-chat-new-page.ts` — `router.replace('/chat/:id')` を行う `{ onThreadCreated }` を返すだけに縮退。
- `docs/20_features/09_chat.md`「フロントエンド」節 / `docs/10_architecture/03_frontend-architecture.md` のディレクトリ構成。

#### 削除

移設に伴い `app/(authenticated)/chat/ChatConversation.tsx` / `use-chat-conversation.ts` は消える（`git mv` の結果）。スレッド一覧 `chat/page.tsx` / `use-chat-page.ts` は変更なし。

### migration・環境変数・依存追加

- なし（フロントエンドのみ。DB・env・依存追加なし）。

### 作業順序（コミット単位）

1. **コミット1: `components/chat/` に ChatPanel を新設し会話 UI を移設、ページを配線し直す**
   - `git mv` で 2 ファイルを移設 → `ChatConversation.tsx` を編集（root を `flex h-full flex-col`＋`className` 受け取り、リストに `overflow-y-auto`、コンポーザの `sticky bottom-0` 除去）→ `use-chat-panel.ts` / `ChatPanel.tsx` / `index.ts` を追加 → 4 つのページ/フックを書き換え。
   - 移設とページ配線は相互依存（ページが移設ファイルを参照）のため **同一コミット**でビルドを緑に保つ。
   - 完了確認: `pnpm --filter frontend build` と `pnpm --filter frontend lint` が通る。`git status` で lint 自動修正の取りこぼしが無いことを確認。
2. **コミット2: ドキュメント更新**
   - `09_chat.md`「フロントエンド」節を `<ChatPanel>`（`components/chat/`）中心の記述へ更新。`03_frontend-architecture.md` のディレクトリ構成に `components/chat/`（ChatPanel）を追記し、`chat/` 配下の「共有 use-chat-conversation / ChatConversation」の記述を改める。
   - 完了確認: `npx markdownlint-cli 'docs/**/*.md'` が通る。

### テスト方針

- フロントエンドに会話 UI のユニットテストは存在せず（テストは backend application 層中心。[02_testing-strategy.md](40_processes/02_testing-strategy.md)）、本タスクは挙動を変えない移設・配線のため新規テストは追加しない。
- 担保は **型チェック / `frontend build` / `frontend lint` / 手動動作確認シナリオ7件**で行う。

### 想定外時の判断ルール

- **AI 単独判断 OK**: 移設に伴う import パス調整、`useCallback` 依存配列の最適化（下記 JP1）、className 結合の素朴な実装、軽微な既存コードリファクタ、本設計書スコープ内の追加。
- **中断して要相談（質問せず停止し最終報告に記録）**:
  - 送信・ストリーミング・空生成・切断・notFound・新規遷移のいずれかで **現状と異なる挙動**が避けられないと判明した場合。
  - `<ChatPanel>` の公開 API（props 形）を設計書と変えざるを得ない場合。
  - スレッド一覧ページ・backend・API・DB に変更が波及する場合。
  - `h-[70vh]` でページ表示が破綻し、レイアウト構造（admin layout 等）の変更が必要になった場合。

### 事前解決済みの判断ポイント

- **JP1（useCallback 依存）**: discriminated union の `props` 全体を依存配列に入れると毎レンダーで `resolveThreadId` / `onStreamSettled` の identity が変わる。`use-chat-panel.ts` 冒頭で
  `const threadId = props.mode === 'thread' ? props.threadId : null;`
  `const onThreadCreated = props.mode === 'new' ? props.onThreadCreated : undefined;`
  と取り出し、`useCallback` 依存は `[props.mode, threadId, actions]` / `[props.mode, onThreadCreated, messagesApi]` のように **個別フィールド**を使う。
- **JP2（className 転送）**: `ChatConversationProps` に `className?: string` を追加し root で `['flex h-full flex-col', className].filter(Boolean).join(' ')` のように結合（`cn` ヘルパは未導入なので既存同様の素朴結合）。`ChatPanel` は loading / notFound / 会話の各分岐に `className` を渡す。
- **JP3（notFound 表示）**: notFound 時も `className`（= ページの `h-[70vh]`）を適用したコンテナに `Alert variant="danger"`「会話が見つかりません」を表示。back link はページ側に常設。
- **JP4（loading 表示）**: loading 時は `className` を適用したコンテナを `flex items-center justify-center` にし「読み込み中...」を中央表示（既存文言踏襲）。
- **JP5（new モードの空表示）**: `mode: 'new'` では `useChatMessagesApi(null)` が fetch せず `messages=[]` / `error=null` / `isLoading=false` を返すため、`isLoading`/`notFound` は false、`buildMessages([])` で既存新規ページと一致。
- **JP6（コミット粒度）**: 移設ファイルを参照するページがあるため、移設・編集・ページ配線は**コミット1にまとめて**ビルドを緑に保つ（部分コミットでビルドを壊さない）。
- **JP7（ページフック縮退）**: thread/new のページフックは削除せず、`{ threadId }` / `{ onThreadCreated }` を返す薄いフックとして残す（frontend-architecture の「ページは View・ロジックはフック」を維持・対称性確保）。
