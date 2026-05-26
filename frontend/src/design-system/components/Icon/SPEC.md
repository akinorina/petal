# Icon

任意の SVG アイコンを統一されたサイズ・色・アクセシビリティで扱うラッパー。

## 設計方針

**特定のアイコンライブラリには依存しない**。children として任意の SVG（lucide-react / heroicons / 自作 SVG）を受け取り、サイズと色を統一する。

### 推奨アイコンライブラリ

**[Lucide](https://lucide.dev)**（旧 Feather Icons）

- 1.5px stroke で本デザインシステムの方針と一致
- MIT ライセンス、tree-shakable、軽量
- インストール: `pnpm add lucide-react`（各 app 側で）

ただし Lucide 以外でも問題ない。SVG であれば何でもラップ可能。

## Anatomy

```html
<span class="ds-icon ds-icon--md">
  <svg>...</svg>
</span>
```

SVG は `width: 100%; height: 100%; color: inherit;` で親に追従する。

## Props

| prop | type | default | 説明 |
| --- | --- | --- | --- |
| `size` | `'xs' \| 'sm' \| 'md' \| 'lg' \| 'xl'` | `'md'` | 12 / 16 / 20 / 24 / 32 px |
| `color` | `'current' \| 'primary' \| 'secondary' \| 'tertiary' \| 'accent' \| 'danger' \| 'success' \| 'warning' \| 'info'` | `'current'` | semantic 色 |
| `label` | `string` | — | 指定すると `role="img" aria-label`、未指定なら `aria-hidden="true"` |
| `children` | `ReactNode` | — | SVG 要素 |
| `className` | `string` | — | 追加クラス |

## 使用ルール

### ✅ Do

- **意味のあるアイコン**には `label` を必ず付ける（クリッカブル要素のラベル代わり等）
- **装飾的アイコン**（隣にテキストがある場合）は `label` 省略 → 自動で `aria-hidden`
- stroke ベースのアイコンを優先（Lucide）。塗りベースを混在させない
- アイコンサイズは親要素のフォントサイズと一致させる（icon-text の視覚バランス）

### ❌ Don't

- 同じアイコンを異なる stroke 幅で使わない
- 色をインライン style で直接指定しない（color prop か `currentColor` 経由）
- 重要な情報（数値・状態）をアイコンだけで伝えない（テキスト併記）

## サイズの目安

| size | px | 用途 |
| --- | --- | --- |
| `xs` | 12 | バッジ内・補助 |
| `sm` | 16 | 本文・小ボタン |
| `md` (default) | 20 | 標準ボタン・ListItem |
| `lg` | 24 | 大ボタン・主要ナビ |
| `xl` | 32 | エンプティステート・ヘッダー |

## 使用するトークン

- 色: `text.primary`, `text.secondary`, `text.tertiary`, `accent.default`, `feedback.*.default`
- spacing は使用元コンポーネントが決める

## 関連

- **Button (B-1)** — `leftIcon` / `rightIcon` に Icon を渡せる
- **Spinner (B-6)** — ローディング表示用の特殊アイコン
