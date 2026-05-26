# Checkbox

複数選択 / オン/オフトグル / 同意確認用の Atom。**ネイティブ `<input type="checkbox">` をベース**にして視覚をカスタムし、A11y・キーボード操作・フォーム送信を標準のまま保つ。

## 目的

- 複数候補から複数選択（チェックリスト）
- ON / OFF の単発トグル（規約同意など）
- 親 - 子の階層的選択（`isIndeterminate`）

## Anatomy

```
[control (box + check icon)]  [label]
                              [description?]
```

- ラベルクリックでもトグルする (`<label>` でラッピング)
- 非表示の `<input>` が **実体**。`focus-visible` は box にリングを描画

## Props

| prop | type | default | 説明 |
| --- | --- | --- | --- |
| `label` | `ReactNode` | — | ラベル。省略時は `aria-label` 必須 |
| `description` | `ReactNode` | — | ラベル下の補助テキスト |
| `size` | `'sm' \| 'md'` | `'md'` | 16px / 18px |
| `isIndeterminate` | `boolean` | `false` | 中間状態。`checked` 値とは独立 |
| `hasError` | `boolean` | `false` | エラー状態（赤枠 + `aria-invalid`） |
| `disabled`, `checked`, `defaultChecked`, `onChange`, `name`, `value`, `required` 等 | — | — | HTML `<input>` 標準属性を全転送 |

`forwardRef<HTMLInputElement>`。

## States

| state | 表現 |
| --- | --- |
| `unchecked` | 白背景 + `border-strong` |
| `checked` | `accent-default` 塗り + 白チェックアイコン |
| `indeterminate` | `accent-default` 塗り + 白横線アイコン |
| `hover` | border が `accent-default` に |
| `focus-visible` | 2px outline (`focus-ring`) |
| `disabled` | opacity 0.5 + cursor not-allowed |
| `error` | border / 塗りが `feedback-danger-default` |

## 使用ルール（Do / Don't）

### ✅ Do

- **ラベルを必ず付ける**。視覚的に隠したい場合は `aria-label` を使う
- 親グループの状態を表すときは `isIndeterminate` を活用（select-all UI 等）
- フォーム送信値は `name` + `value` で。ネイティブのまま動く
- 規約同意などは Checkbox 単体ではなく [FormField](formfield.md) で囲み、エラー表記を統一する

### ❌ Don't

- 単一選択には Checkbox を使わない → [Radio](radio.md) を使う
- ON/OFF の即時設定切替は Checkbox より [Switch](switch.md) のほうが意図が伝わりやすい
- 中間状態をユーザーが直接トグルするインタラクションは作らない（親側で算出して反映する）

## アクセシビリティ

- ネイティブ `<input type="checkbox">` を使うため Space キーでトグル可能 (標準動作)
- ラベルクリックでもトグルする (`<label>` の標準仕様)
- `isIndeterminate` は DOM API (`input.indeterminate`) を `useEffect` で同期 (`aria-checked="mixed"` 相当)
- `hasError` 時は `aria-invalid="true"` 付与
- `focus-visible` 時のみアウトライン表示（マウスクリックではリングが出ない）

## 使用するトークン

- 色: `surface.raised`, `border.strong`, `accent.default`, `feedback.danger.default`, `focus.ring`, `text.primary`, `text.tertiary`
- スペース: `space-1`, `space-2`
- 角丸: `radius.sm`
- タイポ: `font.sans`, `font-size.sm`, `font-size.xs`, `line-height.snug`, `line-height.normal`
- モーション: `duration.fast`, `easing.out`

## 関連

- **Radio (C-4)** — 単一選択
- **Switch (C-5)** — 即時切替設定
- **FormField (C-1)** — エラー / 必須マーク / ヘルパー付与
