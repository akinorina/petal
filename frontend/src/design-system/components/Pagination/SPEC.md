# Pagination

リスト / 検索結果のページ送り。3 variant で用途を切り分ける。

## Variants

| variant | 用途 |
| --- | --- |
| `numbered` (default) | ページ番号 + 前後 + 省略 (検索結果・テーブル) |
| `simple` | 前後ボタンと現在 / 総数のみ (狭い場所) |
| `load-more` | 「さらに表示」ボタンで追加読込 (タイムライン・フィード) |

## Anatomy

```text
numbered:  [<] [1] [...] [4] [5] [6] [...] [20] [>]
                              ↑ aria-current="page"

simple:    [<]  5 / 10  [>]

load-more: [   さらに表示   ]
```

## Props

| prop | type | default | 説明 |
| --- | --- | --- | --- |
| `variant` | `'numbered' \| 'simple' \| 'load-more'` | `'numbered'` | |
| `size` | `'sm' \| 'md'` | `'md'` | ボタンの高さ 28/36 |
| `page` | `number` | — | 1-indexed の現在ページ |
| `totalPages` | `number` | — | numbered / simple で必須 |
| `onChange` | `(page) => void` | — | ページ変更時 |
| `loadMoreLabel` | `ReactNode` | `'さらに表示'` | load-more のボタンラベル |
| `onLoadMore` | `() => void` | — | load-more のハンドラ |
| `hasMore` | `boolean` | `true` | load-more で残データの有無 (false で disabled) |

## アクセシビリティ

- ルート: `<nav aria-label="pagination">`
- 現在ページのボタンに `aria-current="page"`
- 各ボタンに `aria-label`（"前のページ" / "次のページ" / "N ページ目"）
- simple variant の数値表示には `aria-live="polite"` を付与（ページ変更を SR に伝える）

## 使用ルール（Do / Don't）

### ✅ Do

- ページ数 5 以下なら numbered で全表示、それ以上は省略付き numbered
- ヘッダーだけの狭い場所は `simple` を使う
- 連続スクロール体験を提供したいなら `load-more`、画面遷移なら `numbered`

### ❌ Don't

- 1 ページしかない時に表示しない
- 前後ボタンだけで現在位置が分からない設計にしない（必ず status を出す）
- load-more と無限スクロールを同居させない（重複）

## 使用するトークン

- 色: `text.primary`, `text.secondary`, `text.tertiary`, `accent.default`, `accent.hover`, `surface.raised`, `color-neutral-100`, `border.default`, `focus.ring`
- スペース: `space-2`, `space-5`
- 角丸: `radius.md`
- タイポ: `font.sans`, `font-size.xs/sm`, `font-weight.medium/semibold`
- モーション: `duration.fast`, `easing.out`

## 関連

- **Button (B-1)** — load-more は専用スタイルだが Button と整合
- **Breadcrumb (E-5)** — 別軸のナビゲーション
