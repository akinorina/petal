# Divider

セクションを視覚的に分ける区切り線。

## Variants

| prop | values | default | 説明 |
| --- | --- | --- | --- |
| `orientation` | `'horizontal' \| 'vertical'` | `'horizontal'` | 方向 |
| `variant` | `'subtle' \| 'default'` | `'subtle'` | `border.subtle` / `border.default` |
| `children` | `ReactNode` | — | 中央ラベル（horizontal のみ） |

vertical の場合、親が flex で `align-items: stretch` だと自動で高さに追従。

## Anatomy

```text
horizontal:        ──────────────
horizontal+label:  ───── ラベル ─────
vertical:          │
```

## 使用ルール

### ✅ Do

- セクション間の自然な区切りに（リスト項目間、フォームの section 間など）
- 余白だけで十分なら使わない（Quiet 原則）

### ❌ Don't

- 装飾目的だけで使わない
- 太い線で強調しない（border-strong は使わない、それは意味的に強い区切り）

## アクセシビリティ

- `role="separator"`、orientation 属性で SR に方向を伝える
- 装飾的な場合は `aria-hidden="true"` を上書き可

## 使用するトークン

- 色: `border.subtle`, `border.default`
- フォント（label）: `font-size.xs`, `text.tertiary`

## 関連

- **空白だけで分ける**ことも検討（Quiet 原則）
