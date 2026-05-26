# Radio / RadioGroup

複数候補から **1 つだけ** 選択する Atom + その束ね役。`<input type="radio">` をベースに視覚カスタムし、グループ内の矢印キー移動はブラウザ標準動作を活用する。

## 目的

- 排他選択（プラン / 配信方法 / 表示密度 など）
- 同じ `name` を持つグループ内で 1 つだけが選択される

## Anatomy

```
RadioGroup
  ├── legend (label)
  └── items
       ├── Radio [circle + dot]  label  description?
       ├── Radio
       └── Radio
```

- `<fieldset>` + `<legend>` を採用し、ラベルとグループの関連付けを HTML 構造で表現
- `Radio` 単体使用も可（`name` を手動指定）

## Props

### Radio

| prop | type | default | 説明 |
| --- | --- | --- | --- |
| `value` | `string` | — | **必須**。グループ内のユニーク値 |
| `label` | `ReactNode` | — | ラベル |
| `description` | `ReactNode` | — | ラベル下の補助テキスト |
| `size` | `'sm' \| 'md'` | `'md'` | 16px / 18px |
| `hasError` | `boolean` | — | 視覚的エラー（通常は RadioGroup から継承） |
| `checked`, `defaultChecked`, `onChange`, `name`, `disabled` 等 | — | — | HTML `<input>` 標準属性 |

### RadioGroup

| prop | type | default | 説明 |
| --- | --- | --- | --- |
| `label` | `ReactNode` | — | `<legend>` 文言 |
| `isLabelHidden` | `boolean` | `false` | legend を sr-only に |
| `isRequired` | `boolean` | `false` | `*` 表示 + `aria-required` |
| `name` | `string` | auto | `<input>` の `name` 属性。省略時は `useId` で自動生成 |
| `value`, `defaultValue`, `onChange(value, event)` | — | — | 値を集約管理（Context で各 Radio に配布） |
| `disabled` | `boolean` | — | グループ全体を無効化（`<fieldset disabled>`） |
| `hasError` | `boolean` | — | グループ全体をエラー状態に |
| `size` | `'sm' \| 'md'` | — | 全 Radio のサイズを統一 |
| `orientation` | `'vertical' \| 'horizontal'` | `'vertical'` | 並び方向 |

## States

| state | 表現 |
| --- | --- |
| `unchecked` | 白背景 + `border-strong` 円 |
| `checked` | `accent-default` 塗り + 中央に白ドット（scale アニメーション） |
| `hover` | border が `accent-default` に |
| `focus-visible` | 2px outline (`focus-ring`) |
| `disabled` | opacity 0.5 |
| `error` | 円 / 塗りが `feedback-danger-default` |

## 使用ルール（Do / Don't）

### ✅ Do

- **必ず RadioGroup でくるむ**（A11y: legend が必須、Tab の移動単位がグループ）
- 選択肢が **2〜5 個** で全選択肢を常に見せたい時に使う
- 選択肢が増えるなら [Select (C-2)](select.md) を検討
- ON / OFF の 2 値なら [Switch (C-5)](switch.md) を使う

### ❌ Don't

- 単一の Radio をスタンドアロンで使わない（意味的に成立しない）
- Radio の `name` を手書きで揃えない → RadioGroup に任せる
- 矢印キー移動を JS で実装しない（ブラウザ標準動作で十分。同じ `name` の radio に focus を移すだけで動く）

## アクセシビリティ

- `<fieldset>` + `<legend>` でグループとラベルを HTML で関連付け
- 同じ `name` を持つ `<input type="radio">` 群は、ブラウザ標準で **矢印キーによる選択移動 + roving tabindex** が動く
- `hasError` 時は `fieldset` に `aria-invalid="true"`、各 input にも継承
- `isRequired` は `aria-required` を `fieldset` に付与（HTML `required` は radio では「グループ内 1 つ必須」を意味しないため利用しない）
- `focus-visible` 時のみアウトライン表示

## 使用するトークン

- 色: `surface.raised`, `border.strong`, `accent.default`, `feedback.danger.default`, `focus.ring`, `text.primary`, `text.tertiary`
- スペース: `space-1`, `space-2`, `space-3`, `space-5`
- タイポ: `font.sans`, `font-size.sm`, `font-size.xs`, `font-weight.medium`
- モーション: `duration.fast`, `easing.out`

## 関連

- **Checkbox (C-3)** — 複数選択
- **Switch (C-5)** — 2 値即時切替
- **FormField (C-1)** — エラー / 必須マーク / ヘルパー付与（単体 Radio を使う場合）
