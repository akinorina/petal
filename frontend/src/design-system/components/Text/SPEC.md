# Text

タイポグラフィの semantic composites（`display-lg` 〜 `overline`）を型安全に使うラッパー。

## 目的

`<h1>` や `<p>` などの HTML 要素（意味）と、サイズ・ウェイト・字間（見た目）を**分離**する。

- `as` で論理的な HTML 要素を指定
- `variant` で視覚スタイルを指定

例: `<Text as="h2" variant="display-md">` は「論理的には h2 だが、見た目は大型ディスプレイテキスト」を意味する。

## Variants

semantic composites（[typography.json#$composites](../tokens/typography.json) と同期）:

| variant | size | line-height | letter-spacing | weight |
| --- | --- | --- | --- | --- |
| `display-lg` | 4xl (40) | tight (1.2) | tighter (-0.025em) | semibold |
| `display-md` | 3xl (32) | tight (1.2) | tight (-0.015em) | semibold |
| `heading-lg` | 2xl (24) | snug (1.3) | tight (-0.015em) | semibold |
| `heading-md` | xl (20) | snug (1.3) | normal | semibold |
| `heading-sm` | lg (18) | normal (1.5) | normal | semibold |
| `body-lg` | lg (18) | relaxed (1.7) | normal | regular |
| `body-md` (default) | base (16) | relaxed (1.7) | normal | regular |
| `body-sm` | sm (14) | normal (1.5) | normal | regular |
| `label` | sm (14) | normal (1.5) | normal | medium |
| `caption` | xs (12) | normal (1.5) | wide (+0.02em) | regular |
| `overline` | xs (12) | normal (1.5) | +0.06em | semibold, UPPERCASE |

## Color

| color | semantic token |
| --- | --- |
| `primary` (default) | `text.primary` |
| `secondary` | `text.secondary` |
| `tertiary` | `text.tertiary` — **本文には使わない**（AA fail）。キャプション・補助のみ |
| `inverse` | `text.inverse`（暗背景上） |

## Props

| prop | type | default | 説明 |
| --- | --- | --- | --- |
| `as` | `'p' \| 'span' \| 'div' \| 'h1'..'h6'` | `'p'` | 出力する HTML 要素 |
| `variant` | (上記表) | `'body-md'` | 視覚スタイル |
| `color` | (上記表) | `'primary'` | 色 |
| `align` | `'left' \| 'center' \| 'right'` | — | text-align |
| `truncate` | `boolean` | `false` | 1行省略 (`overflow:hidden; text-overflow:ellipsis`) |
| `lineClamp` | `number` | — | 複数行省略（`-webkit-line-clamp`） |
| `className` | `string` | — | 追加クラス |
| `style` | `CSSProperties` | — | インラインスタイル（マージ） |
| `...rest` | — | — | id, onClick 等を要素に転送 |

## 使用ルール（Do / Don't）

### ✅ Do

- 見出しは `as="h1"`〜`"h6"` でセマンティックに（SEO とスクリーンリーダー両面で）
- `variant` と `as` は独立して選ぶ（例: `<Text as="h3" variant="body-lg">` も可）
- `tertiary` は 12-14px の補助テキスト・キャプションでのみ使う

### ❌ Don't

- `tertiary` を本文（base/body-md）の色として使わない（コントラスト不足）
- `as="div"` の見出しは使わない（セマンティック損失）
- `variant` で見た目を変えても、`as` での論理階層を飛ばさない（h1→h3 はOK だが SR では順序確認）

## アクセシビリティ

- `as` でセマンティックを表現するため、見出しレベルの順序を守る
- `truncate` 使用時、全文は `title` 属性で補完するのが望ましい
- `aria-label` を要素に転送可能

## 使用するトークン

- フォント: `font-size.*`, `line-height.*`, `letter-spacing.*`, `font-weight.*`
- 色: `text.primary`, `text.secondary`, `text.tertiary`, `text.inverse`

## 関連

- **Link (B-4)** — リンクテキストは Link を使う（Text + a 手書きより）
- **Typography トークン** — variant の値はすべて `tokens/typography.json` から
