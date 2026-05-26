# FormField

Label + 入力要素 + HelperText + ErrorMessage の標準ラッパー。

## 目的

フォーム入力に必要な周辺要素（ラベル・補助テキスト・エラーメッセージ）を Atom (Input / Textarea / Select 等) と結合し、`id` / `htmlFor` / `aria-describedby` / `aria-invalid` / `aria-required` を **自動配線**する。

実装者が A11y 属性を手書きで揃える必要をなくし、フォーム体験を一貫させる。

## Anatomy

```
[label (required mark?)]
[input element (child)]
[helper-text]   ← errorMessage が無いときのみ
[error-message] ← errorMessage が有るときのみ
```

子は **1 つの React 要素のみ**（`Children.only` で検証）。`Input` / `Textarea` / 将来の `Select` / `Checkbox` 等を渡す。

## Props

| prop | type | default | 説明 |
| --- | --- | --- | --- |
| `label` | `ReactNode` | — | **必須**。ラベル |
| `isRequired` | `boolean` | `false` | `*` マーク表示 + `required` / `aria-required` 付与 |
| `helperText` | `ReactNode` | — | ラベル下の補助テキスト |
| `errorMessage` | `ReactNode` | — | エラーメッセージ。指定があれば error 状態として扱う |
| `isLabelHidden` | `boolean` | `false` | ラベルを視覚的に隠す（sr-only。SR には残る） |
| `id` | `string` | auto | 子要素 / label に紐付ける id。省略時は `useId` で自動生成 |
| `children` | `ReactElement` | — | **必須**。1 つの入力要素 |

## 自動配線される子の props

| 子に注入される prop | 値 |
| --- | --- |
| `id` | 親で決定した `controlId` (子で明示指定があれば優先) |
| `aria-describedby` | `helperText` / `errorMessage` の id をスペース連結 |
| `aria-invalid` | `errorMessage` があれば `true` |
| `aria-required` | `isRequired` の時 `true` |
| `required` | `isRequired` をそのまま |
| `hasError` | `errorMessage` があれば `true`（Input 系の視覚状態切替に利用） |

すべて子で明示指定があればそちらが優先される（escape hatch）。

## 使用ルール（Do / Don't）

### ✅ Do

- ラベルは**常に**渡す（A11y 必須）。視覚的に出したくない場合は `isLabelHidden` を使う
- `errorMessage` は実際にエラーがある時だけ渡す（空文字を渡すと error 表示扱いになる）
- helper と error は併存しない設計（error 優先）。継続表示したい場合は helper 側に含める

### ❌ Don't

- `<FormField>` の中に複数子要素を入れない（`Children.only` で実行時エラー）
- 子の `id` を手で `<label htmlFor>` と合わせない（FormField が面倒を見る）
- ラベルなしのフォーム入力を作るために `isLabelHidden` を使う（ラベル文言は必ず指定する）

## アクセシビリティ

- `<label htmlFor>` と入力要素の `id` が常に一致
- error は `role="alert"` で **入力中の変更を SR に通知**
- helper / error は `aria-describedby` で入力要素にリンク
- 必須マーク `*` は装飾扱い (`aria-hidden`)。意味は `aria-required` で伝える
- `isLabelHidden` は **sr-only パターン**（display:none ではない）

## 使用するトークン

- 色: `text.primary`, `text.tertiary`, `feedback.danger.default`
- スペース: `space-1`, `space-2`
- タイポ: `font.sans`, `font-size.sm`, `font-size.xs`, `font-weight.medium`, `line-height.snug`, `line-height.normal`

## 関連

- **Input (B-2)** — もっとも標準的な子要素
- **Select (C-2)** — 同じく子要素として使う
- **Checkbox / Radio (C-3 / C-4)** — Checkbox 単体はラベル内蔵のため FormField は使わない場合が多い。グループとして使う場合は将来 `FieldGroup` を検討
