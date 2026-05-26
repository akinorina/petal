# Select

プルダウンから 1 つを選択する Molecule。**カスタム実装**（Popover + `role="listbox"`）で、見た目の一貫性と option の表現力（アイコン / description）を確保。

## 実装方針（決定）

**カスタム版**を採用。理由:
- デザイン一貫性が最優先（OS ピッカーは見た目が制御できない）
- アイコン / description / 任意レンダリングを許容したい
- Phase 3 で Popover を実装済み、Floating UI 基盤を流用できる

トレードオフ:
- モバイルでは OS ピッカーより操作性は劣る（要許容）
- 大量項目（数百〜）には Combobox（Phase 5）を別途用意する

## Anatomy

```
[trigger button: value/placeholder + chevron]
        ↓ (click / Enter / Space / ArrowDown)
[menu (Popover): list of options]
   ├── [leading? + label + description?  + ✓ (selected)]
   ├── ...
```

## Props

| prop | type | default | 説明 |
| --- | --- | --- | --- |
| `options` | `SelectOption<V>[]` | — | **必須** |
| `value` / `defaultValue` | `V \| null` | `null` | controlled / uncontrolled |
| `onChange` | `(value: V) => void` | — | 選択時 |
| `placeholder` | `string` | `'選択してください'` | 未選択時表示 |
| `size` | `'sm' \| 'md' \| 'lg'` | `'md'` | Input と整合 (32/40/48 px) |
| `hasError` | `boolean` | `false` | 赤枠 + `aria-invalid` |
| `disabled` | `boolean` | `false` | |
| `isFullWidth` | `boolean` | `true` | 100% 幅 |
| `name` | `string` | — | 指定すると hidden input が出力され、form submit に参加 |
| `id`, `aria-*`, `required` | — | — | FormField から自動配線 |

### SelectOption

```ts
interface SelectOption<V extends string = string> {
  value: V;
  label: string;
  description?: string;
  leading?: ReactNode;  // 左アイコン等
  disabled?: boolean;
}
```

## 動作 / アクセシビリティ

- **trigger**: `<button>` + `aria-haspopup="listbox"` + `aria-expanded`、Enter/Space/ArrowDown/ArrowUp で開く
- **menu**: `role="listbox"`、Floating UI の portal にレンダー、auto-flip + viewport クリッピング
- **option**: `role="option"` + `aria-selected` + `aria-disabled`
- **キーボード**:
  - ↑ / ↓: option を移動（roving tabindex、loop 有効）
  - Enter / Space: 選択
  - Esc / 外側クリック: 閉じる
  - **typeahead**: 文字キー入力で先頭一致の option を選択。閉じている時は即時値変更
- **focus**: 開くと選択済み option（なければ 0 番目）が active になる。閉じると trigger に focus が戻る
- **maxHeight**: viewport に応じて 320px まで（Floating UI `size` middleware）

## 使用ルール（Do / Don't）

### ✅ Do

- 選択肢 5 〜 〜 30 個程度に。少ない（2 〜 4）なら [Radio](radio.md) を検討
- 多数（50+）なら typeahead で十分か検討、足りなければ Combobox（Phase 5）
- 必須項目は FormField で `isRequired` を渡す（trigger に `aria-required` 配線）
- フォーム送信時は `name` を指定（hidden input 経由でネイティブ submission に参加）

### ❌ Don't

- option の label に長文を入れない（trigger は 1 行で省略）。詳細は description に
- ネイティブ `<select>` の代わりに使うだけならコスト高い → 単純なら [`<select>`](https://developer.mozilla.org/) を直接使ってもよい
- マルチセレクトには使わない（複数選択は別 UI、将来 MultiSelect で）

## 使用するトークン

- 色: `surface.raised`, `surface.sunken`, `border.default`, `border.strong`, `border.subtle`, `text.primary`, `text.tertiary`, `accent.default`, `accent.subtle.bg/fg`, `color-neutral-100`, `feedback.danger.default`, `focus.ring`
- スペース: `space-1` 〜 `space-4`
- 角丸: `radius.md`, `radius.sm`
- 影: `shadow.lg`
- タイポ: `font.sans`, `font-size.xs/sm/base`
- モーション: `duration.fast`, `easing.out`

## 外部依存

- `@floating-ui/react` — Popover と共通。`useListNavigation` / `useTypeahead` / `size` middleware に依存

## 関連

- **FormField (C-1)** — Select を子に置いてラベル / エラーを統合
- **Input (B-2)** — trigger は Input と同サイズ・同見た目
- **Popover (D-5)** — 基盤コンポーネント（同 Floating UI 上）
- **Radio (C-4)** — 選択肢が少ない場合の代替
