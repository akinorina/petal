# Breadcrumb

階層ナビゲーション。現在地と上位階層へのリンクを示す。

## Anatomy

```
[ホーム] › [プロジェクト] › [design-system]
                                ↑ 最後は aria-current="page"
```

長い階層は `maxItems` で中央を `…` に折りたたむ。

## Props

| prop | type | default | 説明 |
| --- | --- | --- | --- |
| `items` | `BreadcrumbItem[]` | — | **必須** |
| `separator` | `ReactNode` | 矢印アイコン (chevron) | `"/"` 等のテキストも可 |
| `maxItems` | `number` | — | 超過時に折りたたみ |
| `itemsBeforeCollapse` | `number` | `1` | 折りたたみ時に先頭に残す件数 |
| `itemsAfterCollapse` | `number` | `1` | 折りたたみ時に末尾に残す件数 |

### BreadcrumbItem

| field | type | 説明 |
| --- | --- | --- |
| `label` | `ReactNode` | 表示ラベル |
| `href` | `string` | リンク先（省略可） |
| `onClick` | `(event) => void` | SPA ルーター連携用 |

## アクセシビリティ

- ルート: `<nav aria-label="breadcrumb">`
- 構造: `<ol>` + `<li>`（HTML 仕様の慣例）
- **最終項目に `aria-current="page"`** を付与
- セパレータは `aria-hidden`
- 折りたたみ `…` には `aria-label="省略された項目"` を付ける（簡易表現）

## 使用ルール（Do / Don't）

### ✅ Do

- 深い階層を持つ画面では常に表示し、迷子を防ぐ
- 最終項目はリンクにしない（現在地のため、`href` を渡さない）
- ラベルは短く（必要なら `text-overflow: ellipsis` で自動省略、max 32ch）

### ❌ Don't

- 1 階層しかない画面に表示しない（情報量がない）
- 主要ナビゲーションの代わりに使わない（補助）
- セパレータをコンテンツとして扱わない（装飾扱い）

## 使用するトークン

- 色: `text.primary`, `text.secondary`, `text.tertiary`, `focus.ring`
- スペース: `space-1`, `space-2`
- 角丸: `radius.sm`
- タイポ: `font.sans`, `font-size.sm`, `font-weight.medium`, `line-height.snug`
- モーション: `duration.fast`, `easing.out`

## 関連

- **TopBar (E-2)** — Breadcrumb の置き場所
- **Link (B-4)** — 個別リンクの基礎
