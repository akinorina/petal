# Link

ページ遷移・外部リンク・ハッシュリンクのための anchor 要素ラッパー。

## 目的

「別の場所へ移動する」アクションを表現する。Button（実行する）とは明確に区別する。

色は **Coral を使わない**（[project decision](../README.md#カラーシステム)）。`text.link` (= `text.primary`) + 下線で表現。

## Variants

| variant | 用途 | スタイル |
| --- | --- | --- |
| `inline` (default) | 本文中・他テキストと並ぶリンク | regular weight |
| `standalone` | カード末尾の「詳しく見る →」等、独立した行 | medium weight、矢印推奨 |

## States

| state | 表現 |
| --- | --- |
| `rest` | underline-color = `border-strong` (薄め) |
| `hover` | underline-color = `text-primary` (濃く) |
| `focus-visible` | outline ring |
| `disabled` | opacity 0.5、cursor not-allowed、`aria-disabled="true"` |

## Props

| prop | type | default | 説明 |
| --- | --- | --- | --- |
| `variant` | `'inline' \| 'standalone'` | `'inline'` | スタイル |
| `isExternal` | `boolean` | `false` | 外部リンク。`target="_blank" rel="noopener noreferrer"` 自動付与 + 視覚アイコン |
| `isDisabled` | `boolean` | `false` | 無効化 |
| `...rest` | — | — | href, onClick, aria-* 等を `<a>` に転送 |

forwardRef → `HTMLAnchorElement`。

## 使用ルール

### ✅ Do

- ページ遷移・別ページへのリンクは Link を使う（Button ではない）
- 外部リンクは `isExternal` を必ず付ける（A11y: 「新しいタブで開きます」のアイコンが視覚と SR 両方に伝わる）
- ボタンと見分けがつくよう、Button の `variant="link"` とは用途を分ける（Link = 遷移、Button[variant=link] = アクション）

### ❌ Don't

- アクション（実行）に Link を使わない → Button を使う
- href なしで `onClick` のみで使わない → Button を使う
- 下線を消さない（読み手のスキャナビリティを損なう）

## アクセシビリティ

- 外部リンクは `aria-label` を補強（例: 「OpenAI（新しいタブで開きます）」）
- isDisabled は href を持たないことが望ましいが、視覚的には CSS で表現
- 画像のみのリンクは `aria-label` 必須

## 使用するトークン

- 色: `text.link`, `text.primary`, `border.strong`, `focus.ring`
- モーション: `duration.fast`, `easing.out`

## React Router など外部ライブラリとの統合

現状の Link は `<a>` のみ。React Router 等の `<Link>` と統合したい場合は、ユーザー側で薄いラッパーを書く想定:

```tsx
import { Link as RouterLink } from 'react-router';
import { Link } from '@akinori/design-system';

<Link asChild>
  <RouterLink to="/page">...</RouterLink>
</Link>
```

`asChild` パターンは将来検討（Phase 2 以降）。

## 関連

- **Button (B-1)** — アクション実行
- **Text (B-3)** — テキストの色・サイズ
