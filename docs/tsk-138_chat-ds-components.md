# TSK-138 チャット独自コンポーネントを design-system へ複製・統一し再統合する

- Notion: [TSK-138](https://app.notion.com/p/3989ca7d99dc816ca557ce6584eb6cb6)
- 重要度: MIDDLE / 規模: L
- 分離元: TSK-134（[docs/tsk-134_chat-design-tokens.md](tsk-134_chat-design-tokens.md), PR #109）

## 課題サマリ（Notion 課題シート転記・フリーズ済み）

- **一行サマリ**: petal の独自コンポーネント（chat/\* 等）のうち一般的に再利用できるものを design-system リポジトリ（Lunaris）へ複製・デザイン/コンポーネントルールを統一し、`design-system:sync` で petal の `frontend/src/design-system` に取り込み直す。
- **背景・動機**: TSK-134（チャットの配色を DS トークンへ統一）の完了条件2として提示されたが、別リポジトリ（akinorina/design-system）・別 PR をまたぐ大きめの作業のため分離。chat 周辺の色は既に DS トークンへ統一済み。次はコンポーネント自体の共通化で完全な統一感を出す。
- **完了条件（Notion 原文）**:
  1. 再利用可能なものを選定し design-system リポジトリへ複製（.tsx + .css + index.ts + SPEC.md + stories）する。
  2. デザイン・コンポーネントルール（トークン利用・`:where()` 詳細度0 等）を既存 DS コンポーネントに揃えて統一化する。
  3. `design-system:sync` で petal の `frontend/src/design-system` へ取り込み直し、petal 側の呼び出しを新 DS コンポーネントへ置換する。
- **スコープ外**: TSK-134 で対応済みの chat 周辺の生 Tailwind 色→DS トークン置換（再度はやらない）。
- **制約**: DS 配布モデル（standalone + copy, `frontend/scripts/sync-design-system.sh`）に従う。別リポジトリ・別 PR をまたぐ。
- **不明点・迷い**: 「どのコンポーネントを再利用可能として抽出するか」→ 本設計書 §スコープ / §設計判断ログで確定。

## スコープ

### 対象（DS へ headless 抽出する 4 コンポーネント = セットA）

design-system リポジトリ（`/Users/akinori/develop/design-system`, `akinorina/design-system`）へ新規追加する:

| DS コンポーネント | 抽出元（petal） | 種別 | ディレクトリ |
| --- | --- | --- | --- |
| `ChatBubble` | ChatConversation.tsx の inline `MessageBubble` | 会話バブル（純表示） | `src/components/ChatBubble/` |
| `ChatComposer` | ChatConversation.tsx の入力行 | 入力コンポーザ（キー処理内包） | `src/components/ChatComposer/` |
| `MediaThumb` | ImageThumb.tsx の 読込/失敗/再読込 UI | 非同期画像の純表示 shell | `src/components/MediaThumb/` |
| `AudioPlayer` | AudioPlayer.tsx の 読込/失敗/再読込 UI | 非同期音声の純表示 shell | `src/components/AudioPlayer/` |

各コンポーネントは DS 規約に従い `<Name>.tsx` + `<Name>.css` + `index.ts` + `<Name>.stories.tsx` を持ち、仕様書 `components/<name>.md` を追加する。

### 対象（petal 側 再統合）

上記を `design-system:sync` で `frontend/src/design-system/components/` に取り込み、petal の chat/\* を新 DS 部品を使うアダプタへ再構成する（§API 仕様の petal アダプタ節）。

### 対象外

- petal 固有の DTO・ルート・上限に依存する層（`AttachmentPreviewList` / `AudioAttachmentPreviewList` / `ImageAttachmentPicker` / `AudioAttachmentPicker` / `MessageAttachments` / `MessageAudioAttachments` / `ChatPanel` / `ChatConversation` オーケストレータ / `EditableThreadTitle`）は petal に残す。ただし内部で新 DS 部品（ChatBubble/ChatComposer/MediaThumb/AudioPlayer）を利用する形に置換する。
- `MarkdownContent.*`（既に DS トークン運用済み・chat 専用の Markdown 描画）は DS へ移さない。
- TSK-134 で対応済みの生 Tailwind 色置換（再度やらない）。
- 機能変更・レイアウト再設計・DOM 構造の意味的変更（見た目は現状=TSK-134 後を厳密に維持する）。

## 制約

- DS 側コンポーネントは既存 DS 規約に厳密に揃える:
  - `.tsx`: `forwardRef`（DOM を持つ表示要素）、`ds-<name>` の BEM クラス、props はオブジェクト1つ、`any` 禁止。
  - `.css`: 全セレクタを `:where()` でラップ（詳細度0）し、色・余白・角丸・モーションは全て `var(--token)` 経由。生カラー・生数値の直書き禁止。
  - `.stories.tsx`: 既存 stories 形式（`Meta`/`StoryObj`、`title: 'Group/Name'`、`dist/tokens.js` の `v` を利用）。
  - `index.ts`: named export（コンポーネント + 型）。
- DS には**非同期/データ取得ロジックを持ち込まない**（既存の Spinner/Skeleton と同じく純表示）。署名 URL 取得は petal 側フックが担う（§設計判断ログ 判断2）。
- petal 側の見た目は TSK-134 後の現状を**ピクセル等価**で維持する（トークンのマッピングは TSK-134 の完全マッピング表を正とする）。
- DS 配布モデル（standalone + copy）に従い、petal への取り込みは必ず `pnpm design-system:sync`（= `sync-design-system.sh all`）経由で行う。手動コピーしない。
- 別リポジトリ・別 PR をまたぐ（§既存設計との差分 / リポ間運用）。

## 設計判断ログ

### 判断1: 抽出スコープ =「セットA（会話 + メディア表示核）」を採用

- **採用案**: `ChatBubble` + `ChatComposer` + `MediaThumb` + `AudioPlayer` の 4 点を DS 化。
- **理由**: この 4 点は petal の DTO・ルート・上限に依存せず純表示に落とせ、かつ「会話の見た目」と「添付メディアの見た目」という統一感の主眼を最も広くカバーする。L 規模に収まり DS の presentational 哲学に整合する。
- **却下案 B（最小: Bubble+Composer のみ）**: メディア表示（サムネ/プレイヤー）の統一を落とすため「完全な統一感」という動機を部分的にしか満たさない。→ 却下。
- **却下案 C（最大: + RemovableMediaList/SelectableGrid/List/ImageLightbox/InlineEditText）**: petal 固有 DTO（ImageResponseDto 等）・ルート（/images）・上限（MAX_\*）への依存が濃く、DTO 非依存化の抽象コストとリスクが高く L を大きく超える。分割が妥当。→ 却下（将来タスクへ）。

### 判断2: MediaThumb / AudioPlayer の非同期は「controlled（純表示）」を採用

- **採用案**: DS 部品は `src?` / `isLoading?` / `hasError?` / `onRetry?` / `onError?` を props で受ける純表示。読込スケルトン・失敗+再読込のマークアップだけを DS が持つ。署名 URL 取得の state（fetch・成否・再取得）は **petal 側フック** `useSignedImageUrl` / `useSignedAudioUrl` が所有し、DS へ流し込む。
- **理由**: DS には非同期/データ取得の前例が無く、全コンポーネントが presentational。取得ロジックを DS へ入れると純度が崩れ、petal 固有 API（`useImageDownloadApi`）への結合を DS に持ち込むことになる。controlled なら再利用価値の核（読込/失敗/再読込 UI）だけを DS 化でき、Spinner/Skeleton と同型を保てる。
- **却下案 B（loader 注入 `load: () => Promise<string>`）**: 振る舞いごと再利用できるが、presentational な DS に非同期パターンを新規導入する副作用が大きい。→ 却下。
- **却下案 C（src 直渡しのみ）**: 読込/失敗/再読込 UI を DS が持たず再利用価値が薄い。→ 却下。

### 判断3: ChatComposer はキー処理（Enter/Shift+Enter/IME）を内包

- **採用案**: DS `ChatComposer` が「Enter 送信 / Shift+Enter 改行 / IME 変換中は送信しない / 空文字・disabled 時は送信抑止」を内包し `onSubmit` を公開。`value` / `onChange` / `onSubmit` / `actions`（左スロット）/ `previews`（入力欄上スロット）/ `placeholder` / `disabled` / `rows` / `submitLabel` を受け、内部で DS `Textarea` と送信 `Button` を組む。
- **理由**: Enter/IME 送信の入力振る舞いはチャット入力の再利用価値の核であり、presentation に密接。petal は `onSubmit` に送信処理を渡すだけで済む。
- **却下案 B（レイアウトのみ）**: キー処理が petal に残り、再利用時に各所で再実装が必要。→ 却下。

### 判断4: ChatBubble の送信者区別は `variant: 'sent' | 'received'`

- **採用案**: ドメイン中立な `variant='sent'|'received'` で「配置（右/左）＋配色（accent-subtle チント / surface-sunken ニュートラル面）」を同時に決める。`children` に本文、任意で添付を子として置く。`sent` は `white-space: pre-wrap`（プレーンテキスト前提）、`received` はリッチ内容想定。
- **理由**: 現状の user=coral チント / assistant=ニュートラルの統一ルール（右=accent）を1プロップで表現でき最も単純。petal は `variant={isUser ? 'sent' : 'received'}` を渡すだけ。
- **却下案 B（align + tone 分離）**: 自由度は上がるが「右=accent」の統一ルールが弱まり組み合わせ爆発。→ 却下。
- **却下案 C（完全 unstyled）**: DS としての見た目統一が弱まる。→ 却下。

## データモデル

変更なし（表示コンポーネントのみ。DB・永続化に触れない）。

## API 仕様（コンポーネント prop 契約）

本タスクの「API」は各コンポーネントの prop 契約。DS 側の見た目は TSK-134 後の petal 現状を厳密再現する（クラス→`var()` へ機械的に移送）。

### DS: `ChatBubble`

```ts
export type ChatBubbleVariant = 'sent' | 'received';
export interface ChatBubbleProps extends HTMLAttributes<HTMLDivElement> {
  variant: ChatBubbleVariant;
  children?: ReactNode;
}
```

- ルート: `flex`（`sent`→`justify-content: flex-end` / `received`→`flex-start`）。
- バブル: `max-width: 80%`、`border-radius: var(--radius-xl)`（=16px。現状 `rounded-2xl`=16px と等価。`--radius-2xl` は 20px で不一致のため使わない）、`padding: var(--space-2) var(--space-4)`（8px/16px）、`font-size: var(--font-size-sm)`（14px）。
  - `sent`: `background: var(--accent-subtle-bg)`、`color: var(--accent-subtle-fg)`、`white-space: pre-wrap`。
  - `received`: `background: var(--surface-sunken)`、`color: var(--text-primary)`。
- 現状 petal クラス（`max-w-[80%] rounded-2xl px-4 py-2 text-sm` / `bg-accent-subtle-bg text-accent-subtle-fg` / `bg-surface-sunken text-text-primary`）と等価。

### DS: `ChatComposer`

```ts
export interface ChatComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  /** 入力行の左に並べる任意アクション（例: 画像/音声添付ボタン）。 */
  actions?: ReactNode;
  /** 入力欄の上に差し込む任意スロット（例: 添付プレビュー列）。 */
  previews?: ReactNode;
  placeholder?: string;
  disabled?: boolean;
  rows?: number;          // default 2
  submitLabel?: ReactNode; // default 「送信」
  className?: string;
}
```

- 振る舞い（判断3）: `Enter`（`!shiftKey && !isComposing`）で `onSubmit`。`Shift+Enter` は改行。送信ボタン click でも `onSubmit`。`disabled` または `value.trim()===''` のとき送信抑止（Enter・ボタン両方）。
- 構造: 上枠線 + `surface-raised` 背景の外枠（現状 `border-t border-border-subtle bg-surface-raised pt-3`）内に、`previews` → 入力行（`actions` + DS `Textarea` + 送信 `Button`）を縦に並べる。
- 内部で DS `Textarea`・`Button` を利用（`ds-` 依存はコピー同梱の DS 内で解決）。

### DS: `MediaThumb`

```ts
export interface MediaThumbProps extends HTMLAttributes<HTMLDivElement> {
  src?: string;
  alt: string;
  isLoading?: boolean;   // src 未確定（取得中）
  hasError?: boolean;    // 取得/デコード失敗
  onRetry?: () => void;  // 「再読込」押下
  onError?: () => void;  // <img> の onError（デコード失敗）を親へ通知
  /** <img> に付与するクラス（既定 h-full w-full object-cover 相当）。 */
  imgClassName?: string;
}
```

- 表示分岐（現状 ImageThumb と等価）:
  - `hasError` → 中央寄せの失敗ボックス（「読み込み失敗」＋`再読込`ボタン、`onRetry`）。背景 `surface-sunken`、文字 `text-tertiary`。
  - `!src || isLoading` → `animate-pulse` の `surface-sunken` プレース（読込中）。
  - それ以外 → `<img src alt onError={onError}>`。
- `再読込` ボタンは DS 内では `ds-link ds-link--inline` 相当のリンク表現（DS Link のクラスを利用）。

### DS: `AudioPlayer`

```ts
export interface AudioPlayerProps {
  src?: string;
  label?: string;        // <audio> の aria-label
  isLoading?: boolean;
  hasError?: boolean;
  onRetry?: () => void;
  onError?: () => void;
  className?: string;
}
```

- 表示分岐（現状 AudioPlayer と等価）:
  - `hasError` → インライン失敗表示（「読み込み失敗」＋`再読込`）。
  - `!src || isLoading` → `h-8` の `animate-pulse` `surface-sunken` プレース。
  - それ以外 → `<audio controls preload="metadata" src aria-label onError>`。

### petal アダプタ（再統合）

新規 petal フック（DS の外・petal 内、`frontend/src/components/chat/` 配下）:

```ts
// use-signed-image-url.ts
export function useSignedImageUrl(imageId: string, src?: string):
  { src?: string; isLoading: boolean; hasError: boolean; retry: () => void; onError: () => void };
// use-signed-audio-url.ts（音声版・対称）
```

- 現 `ImageThumb`/`AudioPlayer` の fetch state（`fetchedUrl` / `loadError` / `reloadKey` + `useImageDownloadApi().getDownloadUrl`）をそのままフックへ移送。`src` 指定時は取得スキップ（現状踏襲）。
- petal `ImageThumb` → `useSignedImageUrl` + DS `MediaThumb`（`imgClassName` に現 `className` を橋渡し）へ薄いアダプタ化。
- petal `AudioPlayer`（同名）→ `useSignedAudioUrl` + DS `AudioPlayer`（別名 import）へアダプタ化。
- petal `ChatConversation` の inline `MessageBubble` → DS `ChatBubble`、入力行 → DS `ChatComposer`（`actions` に画像/音声ボタン、`previews` に既存 `AttachmentPreviewList`/`AudioAttachmentPreviewList`、`onSubmit` に既存 `handleSend`）へ置換。
- 添付リスト/ピッカー/`ChatPanel`/`EditableThreadTitle` の外形・props は不変（内部が新 DS 部品を使うだけ）。

## トランザクション境界

該当なし（DB・外部副作用を伴わない、フロントエンド表示コンポーネントのみ）。

## 既存設計との差分

- **リポ間運用（2 リポ・2 PR）**: design-system と petal をまたぐため、petal 単一 PR 前提のワークフローを拡張する。
  - design-system リポ: 作業ブランチを切り、4 コンポーネント（+ stories + spec + COMPONENTS.md ロードマップ追記）を追加・コミットし、`akinorina/design-system` へ PR。
  - petal リポ: 別ブランチで本設計書コミット → `pnpm design-system:sync`（ローカル DS 作業ツリーから取り込み）→ アダプタ再構成をコミットし、petal へ PR。
  - `design-system:sync` は `DS_PATH=../../design-system`（= `/Users/akinori/develop/design-system` ローカル作業ツリー）を読むため、DS 側の追加が**ローカルに存在すれば** petal へ同期できる（DS PR のマージ完了を待つ必要はない。ただし DS PR はマージ想定）。
- DS: 非同期表示（署名 URL 取得を伴うメディア）の presentational 化パターン（controlled + 親フック）を初導入する。DS には取得ロジックを持ち込まない方針は既存 Spinner/Skeleton と整合。
- petal: chat/\* が「表示 + fetch 一体」から「DS 表示部品 + petal 取得フック（アダプタ）」へ分離される。見た目は不変。

## 完了条件（具体化版）

- [ ] design-system リポに `ChatBubble` / `ChatComposer` / `MediaThumb` / `AudioPlayer` の 4 コンポーネントが、各 `.tsx` + `.css`(`:where()`+`var()`) + `index.ts` + `.stories.tsx` + `components/<name>.md` 付きで追加されている。
- [ ] DS 側 4 コンポーネントの `.css` に生カラー・生数値の直書きが無く、全セレクタが `:where()` でラップされている（既存 Card.css 等と同型）。
- [ ] design-system で `pnpm typecheck` / `pnpm lint` / `pnpm build:tokens` が通る。
- [ ] `COMPONENTS.md` のロードマップに 4 コンポーネントが追記されている。
- [ ] petal で `pnpm design-system:sync` を実行後、`frontend/src/design-system/components/{ChatBubble,ChatComposer,MediaThumb,AudioPlayer}/` が取り込まれている（`.stories.tsx` は除外される＝sync 仕様）。
- [ ] petal の `ImageThumb`/`AudioPlayer`/`ChatConversation` が新 DS 部品を使うアダプタへ置換され、`use-signed-image-url.ts`/`use-signed-audio-url.ts` が追加されている。
- [ ] petal で `pnpm lint` / `pnpm build` が通る。
- [ ] 見た目が TSK-134 後と等価（バブル・コンポーザ・サムネ・プレイヤーの配色/配置に退行が無い）。

## 手動動作確認シナリオ

前提: DS 側は `cd /Users/akinori/develop/design-system && pnpm storybook` で 4 コンポーネントの stories を確認。petal 側は `cd frontend && pnpm dev` でログイン後 `/chat`（新規会話）を開く。

1. **DS Storybook**: `ChatBubble`(sent/received)、`ChatComposer`(Enter 送信/Shift+Enter 改行/空時 送信無効)、`MediaThumb`(loading/error/ready)、`AudioPlayer`(loading/error/ready) の各ストーリーが破綻なく表示・操作できる。ライト/ダーク両テーマで確認。
2. **petal 会話**: テキスト送信 → ユーザーバブルが淡い coral チント（右寄せ）、アシスタントがニュートラル面（左寄せ）。TSK-134 後と同一の見た目。
3. **petal コンポーザ**: Enter で送信・Shift+Enter で改行・IME 変換確定の Enter で誤送信しない・空文字/送信中は送信ボタンが無効。
4. **petal 画像**: 画像添付 → 入力欄上プレビュー・バブル内サムネ・原寸 Dialog のいずれも `MediaThumb` 経由で読込中プレース→表示、失敗時に「再読込」で再取得できる。
5. **petal 音声**: 音声添付 → プレビュー行・バブル内音声が `AudioPlayer` 経由で再生でき、失敗時に「再読込」が効く。
6. **退行なし**: `/chat` の既存操作（添付選択 Dialog、送信失敗 Alert、スレッドタイトル編集）が従来どおり動作する。

## 未確定事項

なし（抽出 4 点・非同期の層・コンポーザ振る舞い・バブル API を本設計で確定）。実装分解と作業順序は下記「実装計画」で確定済み。

---

## 実装計画（Phase 4）

本タスクは **2 リポジトリ**にまたがる。design-system 側を先に完成させてから petal 側で sync・再統合する。

### 対象リポジトリ・ブランチ

- **design-system**: `/Users/akinori/develop/design-system`（`akinorina/design-system`）。作業ブランチ **`feat/chat-media-components`**（`main` から作成）。
- **petal**: `/Users/akinori/develop/petal`。作業ブランチ **`feat/tsk-138-chat-ds-components`**（本設計書コミット済み）。

### 変更・追加ファイル

#### design-system リポ（新規）

- `src/components/MediaThumb/MediaThumb.tsx` / `MediaThumb.css` / `index.ts` / `MediaThumb.stories.tsx`
- `src/components/AudioPlayer/AudioPlayer.tsx` / `AudioPlayer.css` / `index.ts` / `AudioPlayer.stories.tsx`
- `src/components/ChatBubble/ChatBubble.tsx` / `ChatBubble.css` / `index.ts` / `ChatBubble.stories.tsx`
- `src/components/ChatComposer/ChatComposer.tsx` / `ChatComposer.css` / `index.ts` / `ChatComposer.stories.tsx`
- `components/mediathumb.md` / `audioplayer.md` / `chatbubble.md` / `chatcomposer.md`（仕様書。sync が SPEC.md へコピーするため小文字ファイル名必須）
- `COMPONENTS.md`（ロードマップに「Chat / Media」グループを追記）

#### petal リポ

- 新規（sync で取込）: `frontend/src/design-system/components/{MediaThumb,AudioPlayer,ChatBubble,ChatComposer}/`（`.tsx` + `.css` + `index.ts` + `SPEC.md`。`.stories.tsx` は sync 仕様で除外）
- 新規: `frontend/src/components/chat/use-signed-image-url.ts` / `use-signed-audio-url.ts`
- 変更: `frontend/src/components/chat/ImageThumb.tsx`（アダプタ化）
- 変更: `frontend/src/components/chat/AudioPlayer.tsx`（アダプタ化・DS を別名 import）
- 変更: `frontend/src/components/chat/ChatConversation.tsx`（inline MessageBubble → DS `ChatBubble`、入力行 → DS `ChatComposer`）

### migration・環境変数・依存追加

- なし（DB・環境変数・新規 npm 依存いずれも無し。DS/petal とも既存依存で完結）。

### DS 側 CSS トークン移送表（ピクセル等価の正）

現状 petal クラス → DS `.css`（全て `:where()` ラップ）。値は現状と等価。

| 用途 | 現状(Tailwind) | DS CSS |
| --- | --- | --- |
| バブル角丸 | `rounded-2xl`(16px) | `border-radius: var(--radius-xl)`(16px。`--radius-2xl`=20px は使わない) |
| バブル余白 | `px-4 py-2` | `padding: var(--space-2) var(--space-4)` |
| バブル文字 | `text-sm` | `font-size: var(--font-size-sm)` |
| sent バブル | `bg-accent-subtle-bg text-accent-subtle-fg` + `whitespace-pre-wrap` | `background:var(--accent-subtle-bg); color:var(--accent-subtle-fg); white-space:pre-wrap` |
| received バブル | `bg-surface-sunken text-text-primary` | `background:var(--surface-sunken); color:var(--text-primary)` |
| メディア読込中 | `animate-pulse bg-surface-sunken` | `background:var(--surface-sunken)` + 自前 `@keyframes ds-media-thumb-pulse`（Skeleton 同型・`prefers-reduced-motion` 対応） |
| メディア失敗面 | `bg-surface-sunken text-text-tertiary` | `background:var(--surface-sunken); color:var(--text-tertiary)` |
| 失敗ミニラベル | `text-[10px]`（ImageThumb） | `font-size: var(--font-size-xs)`（12px。10px の生値は DS 規約違反のため最寄りトークンへ。稀な失敗表示で許容差 ≤2px） |
| 再読込リンク | `ds-link ds-link--inline` | 自前 `.ds-media-thumb__retry`/`.ds-audio-player__retry`（`ds-link` 非依存。`color:var(--text-link)` + underline） |
| コンポーザ外枠 | `border-t border-border-subtle bg-surface-raised pt-3` | `border-top:1px solid var(--border-subtle); background:var(--surface-raised); padding-top:var(--space-3)` |
| 送信ボタン | DS `Button`(primary) | 自前 `.ds-chat-composer__submit`（primary 相当をトークンで再現） |
| textarea | DS `Textarea` | 自前 `.ds-chat-composer__textarea`（DS Input と同トークンで再現） |

### 作業順序（コミット単位 + 完了確認）

#### フェーズ 5-A: design-system リポ（`feat/chat-media-components`）

各コミット後に `cd /Users/akinori/develop/design-system && pnpm typecheck && pnpm lint && pnpm build:tokens` を通す。

1. **DS-1** `feat: MediaThumb / AudioPlayer（非同期メディアの純表示 shell）を追加`
   - MediaThumb・AudioPlayer の 4 ファイル一式。上表どおりトークン移送、controlled props（`src?`/`isLoading?`/`hasError?`/`onRetry?`/`onError?`）。
   - 完了確認: typecheck/lint 通過。stories が loading/error/ready を表現。
2. **DS-2** `feat: ChatBubble / ChatComposer を追加`
   - ChatBubble（`variant` sent/received、上表移送）。ChatComposer（自己完結・Enter/Shift+Enter/IME/空・disabled 抑止、`value/onChange/onSubmit/actions/previews/placeholder/disabled/rows/submitLabel`）。
   - 完了確認: typecheck/lint 通過。stories で Enter 送信・改行・空時無効を確認可能。
3. **DS-3** `docs: 4 コンポーネントの仕様書と COMPONENTS.md ロードマップを追加`
   - `components/*.md` 4 本（既存フォーマット: 目的/Anatomy/Variants/States/Props/使用ルール/A11y/トークン/関連）。`COMPONENTS.md` に追記。
   - 完了確認: `pnpm build-storybook` が通る（最終）。`npx markdownlint`（DS の `.markdownlint.json`）が通る。

#### フェーズ 5-B: petal リポ（`feat/tsk-138-chat-ds-components`）

各コミット後に `cd frontend && pnpm lint`。最終に `bash .claude/skills/skill-workflow/scripts/verify.sh all`。

1. **P-1** `chore(tsk-138): 新規DSコンポーネントをsyncで取込`
   - `frontend/` から 4 コンポーネントを**個別 sync**（絶対 DS_PATH・tokens は再syncしない）:

     ```bash
     DS_PATH=/Users/akinori/develop/design-system DS_TARGET=src/design-system \
       bash scripts/sync-design-system.sh component ChatBubble   # 以下 ChatComposer / MediaThumb / AudioPlayer
     ```

   - 完了確認: `frontend/src/design-system/components/{ChatBubble,ChatComposer,MediaThumb,AudioPlayer}/` に `.tsx`+`.css`+`index.ts`+`SPEC.md` があり `.stories.tsx` が無い。`git status` の差分が当該 4 ディレクトリのみ。
2. **P-2** `refactor(tsk-138): ImageThumb/AudioPlayerを取得フック+DS表示部品へ分離`
   - `use-signed-image-url.ts`/`use-signed-audio-url.ts` 追加（現 fetch state を移送、`src` 指定時は取得スキップ）。petal `ImageThumb`→`useSignedImageUrl`+DS`MediaThumb`、petal `AudioPlayer`→`useSignedAudioUrl`+DS`AudioPlayer`（`import { AudioPlayer as DsAudioPlayer }`）。
   - 完了確認: `pnpm lint`。サムネ/プレイヤーの読込中・失敗・再読込・表示が従来どおり（型チェック通過）。
3. **P-3** `refactor(tsk-138): 会話バブル/入力欄をDS ChatBubble/ChatComposerへ置換`
   - `ChatConversation.tsx`: inline `MessageBubble` → `<ChatBubble variant={isUser?'sent':'received'}>`（本文・添付・pending「…」は children）。入力行 → `<ChatComposer value onChange onSubmit={handleSend} actions={画像/音声Button} previews={Attachment/AudioAttachmentPreviewList} disabled={isStreaming}>`。Enter/IME 送信ロジックは ChatComposer へ委譲し petal 側の重複を削除。
   - 完了確認: `pnpm lint` + `pnpm build`。`/chat` の見た目・送信・添付が退行なし。
4. **最終検証**: `bash .claude/skills/skill-workflow/scripts/verify.sh all` 通過（backend/frontend build + docs markdownlint）。加えて DS リポで `pnpm typecheck && pnpm lint && pnpm build-storybook` 通過。

### テスト方針

- 自動テストは対象外（表示コンポーネント・ロジック等価移送）。
- 機械検証: 上記各コミットの完了確認 + `verify.sh all`（petal）+ DS リポの typecheck/lint/build-storybook。
- 手動確認は §手動動作確認シナリオ（Storybook + petal `/chat`）を Phase 6 でユーザー評価。

### Phase 5 実行方式（サブエージェント）

- petal は **worktree 隔離 + バックグラウンド**で実行。DS リポは別リポのため**共有チェックアウト `/Users/akinori/develop/design-system` の `feat/chat-media-components` ブランチ**で作業する（worktree 化しない）。
- worktree では相対 `../../design-system` が壊れるため、sync は**必ず絶対 `DS_PATH=/Users/akinori/develop/design-system`** で実行する。
- DS リポ・petal リポとも**コミットのみ**。push / PR 作成は Phase 6 でユーザー承認後にメインスレッドが行う（サブエージェントは push しない）。

### 想定外時の判断ルール

- **AI 単独判断 OK**: 上表どおりのトークン移送、現状ロジックの等価な関数/フック抽出、自明な整形・未使用 import 削除、stories のサンプルデータ作成。
- **中断して要相談**:
  - DS に必要トークンが存在せず生値直書きが避けられない（失敗ミニラベルの font-size-xs 代替は除く＝解決済み）。
  - 現状の見た目をトークンで等価再現できない箇所を発見。
  - ChatComposer を自己完結で組めず cross-component import が不可避と判明（判断=自己完結を覆す必要）。
  - prop 契約（§API 仕様）や設計判断ログ（判断1〜4）を変更する必要が生じた。
  - 既存 DS コンポーネント本体の改変が必要。
  - `sync` が当該 4 ディレクトリ以外に想定外の大量差分を生む。
- **タスク固有**: 置換後に `/chat` の見た目が現状（TSK-134 後）から視認できるレベルで変化する場合は、勝手に別値へ調整せず中断して相談。

### 事前解決済みの判断ポイント

- 抽出=セットA 4 点 / 非同期=controlled（petal フック所有）/ Composer=キー処理内包 / Bubble=`variant sent/received`（判断1〜4）。
- ChatComposer=**自己完結**（独自 `ds-chat-composer__textarea`/`__submit`、cross-import しない）。
- 非同期 state は petal `useSignedImageUrl`/`useSignedAudioUrl` が所有。DS は取得ロジックを持たない。
- 再読込リンクは各 DS コンポーネント**独自クラス**（`ds-link` 非依存＝コピー単位自己完結）。
- pulse は各コンポーネント**自前 keyframe**（Skeleton 同型・`prefers-reduced-motion: reduce` で停止）。
- sync は 4 コンポーネント**個別**・**絶対 DS_PATH**・tokens 再sync なし（petal 差分を最小化）。
- 仕様書は `components/<lowercase>.md`（sync が `SPEC.md` へコピー）。
- petal `AudioPlayer` の名前衝突 → DS を `DsAudioPlayer` として別名 import。
- 日本語デフォルトラベル（`送信`/`読み込み中`/`読み込み失敗`/`再読込`）は既存 DS（Spinner/Link の日本語）に倣い許容。
- 失敗ミニラベルの `text-[10px]` → `var(--font-size-xs)`（12px）へ寄せる（許容差 ≤2px）。
- `MarkdownContent.*` は petal 据え置き（DS へ移さない）。
- radius は `--radius-xl`(16px) を使用（`--radius-2xl`=20px は不使用）。
