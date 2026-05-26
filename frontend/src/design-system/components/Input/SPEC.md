# Input / Textarea

テキスト入力の Atom。フォームの基盤になる最重要パーツのひとつ。

## 目的

ユーザーからのテキスト入力を受け取る。HTML の `<input>` / `<textarea>` を最小限にスタイリングし、prefix/suffix スロット、エラー状態、3 サイズを統一 API で提供。

ラベル・ヘルパー・エラーメッセージとの結合は **FormField (C-1)** が担当。Input 単体ではラベルを持たない（責務分離）。

## Anatomy

```
[prefix?]  [input element]  [suffix?]
```

- `prefix` / `suffix` は ReactNode（アイコン、テキスト、ボタン等）
- フォーカスリングは wrapper の `:focus-within` で要素全体に出る

## Variants

| size | height (Input) | font-size | 用途 |
| --- | --- | --- | --- |
| `sm` | 32px | sm (14) | 密度の高い UI |
| `md` (default) | 40px | sm (14) | 標準 |
| `lg` | 48px | base (16) | モバイル・主要フォーム |

Textarea は高さ自動（最小 3 行）。

## States

| state | 表現 |
| --- | --- |
| `rest` | border = `border-default` |
| `hover` | border = `border-strong`（150ms ease-out） |
| `focus-within` | `outline: 2px solid var(--focus-ring); outline-offset: 2px;` + border = `border-strong` |
| `error` (hasError) | border = `feedback-danger-default`、focus 時 outline も同色 |
| `disabled` | opacity 0.5, cursor not-allowed, background = `surface-sunken` |
| `readonly` | 通常通り表示、入力不可。border は通常通り |

## Props

### Input

`extends HTMLInputAttributes<HTMLInputElement>` から `size` を Omit。

| prop | type | default | 説明 |
| --- | --- | --- | --- |
| `size` | `'sm' \| 'md' \| 'lg'` | `'md'` | サイズ |
| `hasError` | `boolean` | `false` | エラー状態 |
| `prefix` | `ReactNode` | — | 左スロット |
| `suffix` | `ReactNode` | — | 右スロット |
| `isFullWidth` | `boolean` | `true` | width: 100%（デフォルト ON） |
| `...rest` | — | — | type, value, onChange, placeholder, disabled, readOnly, required 等すべて転送 |

### Textarea

`extends HTMLTextareaAttributes<HTMLTextAreaElement>` から `size` を Omit。

| prop | type | default | 説明 |
| --- | --- | --- | --- |
| `hasError` | `boolean` | `false` | エラー状態 |
| `isFullWidth` | `boolean` | `true` | width: 100% |
| `...rest` | — | — | rows, value, onChange, placeholder 等すべて転送 |

両方とも `forwardRef`。

## 使用ルール（Do / Don't）

### ✅ Do

- **必ず label を関連付ける**（FormField 経由が標準）。視覚的に label 非表示でも `aria-label` を使う
- 必須項目は `required` 属性を付ける
- エラー時は `hasError={true}` と `aria-invalid="true"` + `aria-describedby` でエラーメッセージを参照
- type は適切なものを選ぶ（`email`, `url`, `tel`, `number` 等。モバイルキーボードが最適化される）

### ❌ Don't

- **placeholder をラベル代わりに使わない**（入力時に消えてラベル情報が失われる、A11y NG）
- アイコンだけ suffix に置いてその意味を視覚に頼らない（クリッカブルなら aria-label を）
- ボーダーやサイズを style props で上書きしない（トークンから外れる）

## アクセシビリティ

- focus-within で wrapper にリング、input 自身の outline は消す（視覚的にひとつのフォーカス対象に見せる）
- hasError は `aria-invalid` も同時に true にすること（FormField がやるが、Input 単体使用時は手動）
- placeholder のコントラスト: `text-tertiary` で AA(large) のみ。本文相当のものはラベル/ヘルパーで明示
- disabled は HTML 標準の `disabled`、readonly は `readOnly` を使う

## 使用するトークン

- 色: `surface.raised`, `surface.sunken`, `border.default`, `border.strong`, `text.primary`, `text.tertiary`, `feedback.danger.default`, `focus.ring`
- スペース: `space-2`, `space-3`, `space-4`
- 角丸: `radius.md`
- タイポ: `font.sans`, `font-size.sm`, `font-size.base`
- モーション: `duration.fast`, `easing.out`

## 関連

- **FormField (C-1)** — Label + Input + HelperText + ErrorMessage の標準ラッパー
- **Select (C-2)** — プルダウンの選択。Input と類似スタイル
