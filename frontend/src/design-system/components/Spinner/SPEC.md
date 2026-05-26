# Spinner

ローディング・処理中を表すアイコン。

## 設計

- 単純な円形ボーダー回転アニメーション（CSS のみ、SVG なし）
- `prefers-reduced-motion: reduce` 時は静止 + 薄い不透明度に置き換え

## Props

| prop | type | default | 説明 |
| --- | --- | --- | --- |
| `size` | `'sm' \| 'md' \| 'lg' \| 'xl'` | `'md'` | 16 / 20 / 24 / 32 px |
| `color` | `'current' \| 'primary' \| 'secondary' \| 'accent'` | `'current'` | 色 |
| `label` | `string` | `'読み込み中'` | SR 読み上げ。`role="status"` で読まれる |

## 使用ルール

### ✅ Do

- 単独使用時は `role="status"` で読み上げ可能
- Button 内では Button 側が aria-busy を制御するので Spinner の label は省略可
- 800ms linear infinite で全システム統一（[motion.json](../tokens/motion.json) の `loader` pattern）

### ❌ Don't

- spinner だけで状態を表現しない（「保存しています…」等のテキストを併記）
- 5 秒以上回り続ける場合は Skeleton or プログレスバーに置き換え検討

## アクセシビリティ

- `role="status"` + `aria-live="polite"` で出現時に読み上げ
- `prefers-reduced-motion` 時は静的な円表示（CSS で自動切替）

## 使用するトークン

- 色: `text.primary`, `text.secondary`, `accent.default`
- モーション: 800ms linear（`duration.slower` + `easing.linear`）

## 関連

- **Button (B-1)** — `isLoading` 内蔵
- **Skeleton (D-6)** — コンテンツ形状を保ったローディング
