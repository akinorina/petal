# TSK-114 チャット UI の Markdown 表示

チャット会話 UI のアシスタントメッセージ（ストリーミング中含む）を Markdown としてレンダリングする。
ユーザーメッセージは従来どおりプレーンテキスト表示を維持する。

- 原典タスク: TSK-114 / Notion: <https://app.notion.com/p/37c9ca7d99dc8012a517ecb24090f140>
- 関連: [09_chat.md](20_features/09_chat.md)（チャット機能全体） /
  [tsk-113_chat-ui-componentization.md](tsk-113_chat-ui-componentization.md)（`<ChatPanel>` 部品化） /
  [03_frontend-architecture.md](10_architecture/03_frontend-architecture.md)

## Notion 課題シート（転記）

> **一行サマリ**
> チャット UI のメッセージが Markdown テキストデータの際、実際に Markdown 表示したい。
>
> **背景・動機**
> チャット UI の会話表示部分について、LLM 出力が Markdown テキストデータだとしても、現在の
> チャット UI はプレーンテキストだとしてそのまま表示する。これを Markdown 表示するようにしたい。
>
> **完了条件**
> プレーンテキストはそのまま表示する。Markdown テキストが Markdown 表示される。
>
> **スコープ外 / 制約**: なし
>
> **不明点・迷い**
> Markdown 表示するための NPM モジュールが複数あるならメジャーなものから選択したい。
> 別件だが、ユーザーメッセージの背景色（青）がデザインシステムに合致していないので修正したい。
> （→ Phase 2 で解決: ライブラリは react-markdown 採用、背景色修正は本タスクのスコープ外・別タスク化）

## 課題サマリ

会話 UI のメッセージ描画は [ChatConversation.tsx](../frontend/src/components/chat/ChatConversation.tsx) の
`MessageBubble` に閉じており、現在は `whitespace-pre-wrap` のプレーンテキスト表示。LLM は見出し・リスト・
コードブロック・表などの Markdown を頻繁に出力するため、アシスタントメッセージ（確定済み + ストリーミング中）
を react-markdown で整形表示する。ユーザーメッセージは「書いたとおりに表示される」期待を守るため
プレーンテキスト表示のまま変更しない。

## スコープ

### 対象

- アシスタントメッセージ（`role: 'assistant'`）の Markdown レンダリング（確定メッセージ + ストリーミング中テキスト）。
- GFM 拡張（表・打ち消し線・タスクリスト・自動リンク）対応。
- Markdown 要素のスタイリング（チャットバブル内に収まるコンパクトな密度で、デザイントークン準拠）。
- 関連ドキュメント更新（[09_chat.md](20_features/09_chat.md)）。

### 対象外

- ユーザーメッセージの Markdown 表示（プレーンテキスト維持。理由は D2）。
- ユーザーバブル背景色（`bg-blue-600`）のデザインシステム準拠修正（別タスクとして起票）。
- シンタックスハイライト（コードブロックは等幅・背景色のみ。highlight.js 等の導入は将来タスク）。
- コピー用ボタン・数式（KaTeX）・Mermaid 等の拡張表示。
- バックエンド・API・DB・送信/ストリーミングの挙動変更。

## 制約

- フロントエンドのみの変更。送信・ストリーミング・エラー・スクロール追従の挙動にリグレッションを出さない。
- `any` 不使用 / `strict` 維持。UI レイヤの規約は [03_frontend-architecture.md](10_architecture/03_frontend-architecture.md) に従う。
- 生 HTML はレンダリングしない（XSS 安全側。react-markdown のデフォルト挙動を維持）。

## 設計判断ログ

### D1: ライブラリ — react-markdown + remark-gfm（採用）

- **採用**: `react-markdown`（+ `remark-gfm`）。React 向けデファクト（週 DL 数最大級）。HTML 文字列を
  経由せず React 要素として描画するため `dangerouslySetInnerHTML` 不要で XSS に安全。ストリーミング中の
  逐次再レンダリングとも相性が良い。GFM（表・打ち消し線・タスクリスト・自動リンク）は `remark-gfm` で対応。
  LLM 出力は表を多用するため GFM は実質必須。
- **却下（marked + DOMPurify）**: パースは高速だが出力が HTML 文字列のためサニタイズと React 統合が自前になる。
- **却下（markdown-it）**: プラグイン豊富だが同じく HTML 文字列方式で、サニタイズ・React 統合が自前になる。

### D2: 適用対象 — アシスタントのみ（採用）

- **採用**: `role: 'assistant'` のメッセージとストリーミング中テキストのみ Markdown 表示。ユーザーメッセージは
  従来どおり `whitespace-pre-wrap` のプレーンテキスト。
  - ユーザーが普通の文章のつもりで書いた `#` / `1.` / `*` 等が見出し・リスト・斜体に変換される事故を防ぎ、
    完了条件「プレーンテキストはそのまま表示する」を確実に満たす。
  - Markdown では単一改行が無視されるため、チャット入力の改行期待（Shift+Enter 改行がそのまま見える）と衝突する。
  - ChatGPT / Claude 等の主要チャット製品と同じ構成。
  - なお表示はプレーンでも、入力テキストはそのまま LLM へ送信されるため、ユーザーが書いた Markdown 記法を
    LLM が構造として解釈することには影響しない。
- **却下（ユーザー・アシスタント両方）**: `remark-breaks` 併用で改行問題は緩和できるが、記号の意図せぬ整形は残る。

### D3: スタイリング — 専用 CSS ファイル（採用）

- **採用**: `MarkdownContent.css` を 1 枚作り、`.chat-markdown` スコープ配下でデザイントークン
  （`--space-*` / `--font-size-*` / `--radius-*` 等）を使って h1〜h6 / p / ul / ol / code / pre / blockquote /
  table / a / hr を装飾する。design-system の `Button.css` と同じパターン。チャットバブル内に収まる
  コンパクトな密度（見出しは控えめなサイズ差、段落間は小さめの余白）に調整しやすく、依存追加なし。
- **却下（@tailwindcss/typography）**: `prose` クラスは汎用ブログ向けの余白・サイズでチャットバブル内では
  大きすぎ、デザイントークンと非連動。上書き調整が結局必要になる。
- **却下（components マッピング）**: react-markdown の `components` prop で全要素に Tailwind クラスを
  個別指定する案。型安全だが要素数ぶんの React コードが肥大化する。

### D4: ストリーミング中の表示 — 受信中も Markdown 表示（採用）

- **採用**: ストリーミング中テキストも同じ Markdown レンダラで描画（デルタ受信のたびに再パース）。
  完了時に表示がガラッと切り替わらず一貫する。ChatGPT 等と同じ挙動。メッセージ長程度の再パースは
  性能上問題ない。書きかけの記法（閉じていないコードフェンス等）が一瞬崩れて見える瞬間はあるが許容する。
- **却下（受信中はプレーン表示）**: 実装はわずかに単純だが、完了時に見た目が一気に変わるチラツキが出る。

### D5: コンポーネント構成 — `components/chat/` 内の非公開部品 `MarkdownContent`（採用）

- **採用**: `components/chat/MarkdownContent.tsx`（+ 同名 .css）を新設し、`MessageBubble` の assistant 分岐
  から使う。tsk-113 の方針（公開 API は `<ChatPanel>` のみ、内部部品は barrel から export しない）を維持。
- **却下（ChatConversation 内へ直書き）**: ファイルが肥大化し、スタイル CSS の置き場も不自然になる。
- **却下（design-system へ配置）**: 現時点でチャット専用のスタイル密度であり、汎用部品化は利用箇所が
  増えてから検討する（YAGNI）。

### D6: リンク・HTML の扱い（採用）

- リンクは `target="_blank"` + `rel="noopener noreferrer"` で新規タブに開く（チャット文脈を失わないため）。
  react-markdown の `components` prop で `a` のみ上書きする。
- 生 HTML は描画しない（react-markdown デフォルト。`rehype-raw` は導入しない）。

## コンポーネント API

```tsx
// frontend/src/components/chat/MarkdownContent.tsx（内部部品・barrel 非公開）
import './MarkdownContent.css';

type MarkdownContentProps = {
  /** Markdown ソーステキスト（アシスタントメッセージ本文）。 */
  content: string;
};

export function MarkdownContent({ content }: MarkdownContentProps): JSX.Element;
// 実装: <div className="chat-markdown"><ReactMarkdown remarkPlugins={[remarkGfm]} components={{ a: ... }}>{content}</ReactMarkdown></div>
```

### `MessageBubble` の変更（ChatConversation.tsx）

- assistant バブル: `whitespace-pre-wrap` のテキスト描画 → `<MarkdownContent content={message.content} />`。
  `whitespace-pre-wrap` は Markdown 描画と干渉する（改行・空白の二重解釈）ため assistant 側からは外す。
- user バブル: 変更なし（`whitespace-pre-wrap` プレーンテキスト維持）。
- ストリーミングバブル: 既存どおり `MessageBubble` に `pending` で渡るため、assistant 分岐に乗って
  自動的に Markdown 表示になる。pending インジケータ（`…`）は Markdown コンテンツの後ろに併置する。

### `MarkdownContent.css` のスタイル方針

- スコープ: `.chat-markdown` 配下の要素セレクタ（`:where()` で詳細度 0。Button.css と同じ流儀）。
- 密度: チャットバブル内向けのコンパクト設定。
  - 見出し: h1/h2 でも `--font-size-lg` 程度に抑え、太字 + 上下マージン小。
  - 段落・リスト: `--space-2` 前後の間隔。リストはインデント + マーカー表示（Tailwind リセットの打ち消し）。
  - インラインコード: 等幅 + `--color-neutral-*` 系の背景 + `--radius-sm`。
  - コードブロック（pre）: 等幅 + 背景 + 横スクロール（`overflow-x: auto`）。バブルの `max-w-[80%]` 内に収める。
  - 表: 罫線 + ヘッダ背景。バブル幅を超える場合は横スクロール。
  - blockquote: 左ボーダー + 控えめな文字色。
  - a: アクセントカラー（`--accent-default`）+ 下線。
- 値は既存デザイントークン（`tokens/styles.css`）のみ使用し、生の色値・px 直書きを避ける。

## 既存設計との差分

| 項目 | Before | After |
| --- | --- | --- |
| assistant メッセージ表示 | `whitespace-pre-wrap` プレーンテキスト | react-markdown（GFM）で整形描画 |
| ストリーミング中表示 | プレーンテキスト | 同じ Markdown レンダラで逐次描画 |
| user メッセージ表示 | プレーンテキスト | 変更なし |
| 依存 | — | `react-markdown` / `remark-gfm` 追加 |
| `components/chat/` 構成 | 4 ファイル + barrel | `MarkdownContent.tsx` / `.css` 追加（barrel 非公開のまま） |

- `use-chat-conversation.ts` / `use-chat-panel.ts` / `ChatPanel.tsx` / バックエンドは変更なし。

## 完了条件（具体化版）

- [ ] `frontend/src/components/chat/MarkdownContent.tsx` と `MarkdownContent.css` が存在し、barrel（`index.ts`）からは export されていない。
- [ ] assistant メッセージ（確定 + ストリーミング中）が Markdown 整形表示される: 見出し・箇条書き・番号リスト・太字/斜体・インラインコード・コードブロック・表（GFM）・リンクが描画される。
- [ ] Markdown 記法を含まないプレーンテキストの assistant メッセージは、従来と同等の見た目（段落テキスト）で表示される。
- [ ] user メッセージは従来どおりプレーンテキスト（`whitespace-pre-wrap`）で表示され、`#` 等が整形されない。
- [ ] Markdown 内リンクは新規タブで開く（`rel="noopener noreferrer"` 付き）。生 HTML（`<script>` 等）はタグが描画されない。
- [ ] 長いコードブロック・表がバブル幅（`max-w-[80%]`）を壊さず横スクロールで収まる。
- [ ] `pnpm --filter frontend build` と `pnpm --filter frontend lint` が通る。
- [ ] [09_chat.md](20_features/09_chat.md) のフロントエンド節が更新され、`npx markdownlint-cli 'docs/**/*.md'` が通る。

## 手動動作確認シナリオ

開発サーバ（frontend + backend + LLM エンドポイント）でログイン後、チャット画面（`/chat/new` または既存スレッド）で:

1. **Markdown 整形**: 「見出し・箇条書き・番号リスト・太字・インラインコード・コードブロック・表・リンクを全部使った Markdown のサンプルを出力して」と送信 → ストリーミング中から整形表示され、完了後も表・コードブロック含め正しく描画される。
2. **プレーンテキスト**: 「記号を使わず短い平文 1 文だけ返して」と送信 → 従来と同等の見た目で表示される。
3. **ユーザー側は非整形**: `# 見出しのつもり` と `1. 番号` を含むメッセージを送信 → 自分のバブルでは書いたとおりに表示される（見出し・リスト化されない）。
4. **リンク**: LLM 出力中の URL リンクをクリック → 新規タブで開き、チャット画面が維持される。
5. **横幅**: 長い行のコードブロックや列数の多い表を出力させる → バブルからはみ出さず横スクロールになる。ブラウザをスマフォ幅に狭めても破綻しない。
6. **リグレッション**: 送信・ストリーミング・完了後の確定同期・末尾への自動スクロール・エラー表示が従来どおり動く。

## 未確定事項

- なし。
