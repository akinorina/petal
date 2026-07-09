# ChatComposer

チャット入力コンポーザ（**自己完結**）。Enter 送信 / Shift+Enter 改行 / IME 変換中は送信しない / 空文字・disabled 時は送信抑止 のキー処理を内包する。textarea・送信ボタンは DS Input/Button と同じトークンで自前スタイルする。

## 目的

- チャット入力の再利用価値の核（Enter/IME 送信の振る舞い）を DS 側に閉じ込める
- アプリは `onSubmit` に送信処理を渡すだけでよい
- 添付ボタン（`actions`）やプレビュー列（`previews`）を差し込むスロットを提供する

## Anatomy

```text
<ChatComposer
  value={value}
  onChange={setValue}
  onSubmit={handleSend}
  actions={<>{添付ボタン}</>}   // 入力行の左スロット
  previews={<PreviewList />}    // 入力欄の上スロット
  placeholder="メッセージを入力"
  disabled={isStreaming}
  rows={2}
  submitLabel="送信"
/>
```

- 外枠: 上枠線 + `surface-raised` 背景 + 上パディング
- 縦積み: `previews` → 入力行（`actions` + textarea + 送信ボタン）

## Behavior

- `Enter`（`!shiftKey && !isComposing`）で `onSubmit`
- `Shift+Enter` は改行
- 送信ボタン click でも `onSubmit`
- `disabled` または `value.trim() === ''` のとき送信抑止（Enter・ボタン両方）

## Props

| prop | type | default | 説明 |
| --- | --- | --- | --- |
| `value` | `string` | （必須） | 入力値（制御コンポーネント） |
| `onChange` | `(value: string) => void` | （必須） | 入力変更 |
| `onSubmit` | `() => void` | （必須） | 送信（抑止条件を満たす場合のみ発火） |
| `actions` | `ReactNode` | — | 入力行の左に並べる任意アクション |
| `previews` | `ReactNode` | — | 入力欄の上に差し込む任意スロット |
| `placeholder` | `string` | — | textarea のプレースホルダー |
| `disabled` | `boolean` | `false` | 入力・送信を無効化 |
| `rows` | `number` | `2` | textarea の行数 |
| `submitLabel` | `ReactNode` | `'送信'` | 送信ボタンのラベル |
| `className` | `string` | — | ルートへ付与するクラス |

## 使用ルール（Do / Don't）

### ✅ Do

- 送信処理は `onSubmit` に集約し、Enter/IME のキー処理は本コンポーネントに委譲する
- 添付ボタンは DS `Button`（secondary 等）を `actions` に渡す

### ❌ Don't

- Enter/IME 送信ロジックをアプリ側で再実装しない（二重送信の原因）
- 送信中に `disabled` を渡し忘れない（多重送信の抑止）

## アクセシビリティ

- textarea・送信ボタンはネイティブ要素（キーボード操作・フォーカスリング対応）
- 送信ボタンは抑止条件下で `disabled`

## 使用するトークン

- 外枠: `border-subtle`, `surface-raised`, `space.3`
- textarea: `border-default`, `border-strong`, `radius.md`, `space.3`, `font-size.sm`, `text-primary`, `text-tertiary`, `line-height.relaxed`
- 送信ボタン: `accent-default`, `accent-hover`, `accent-active`, `accent-on-accent`, `radius.md`, `space.2`, `space.4`, `font-weight.medium`
- モーション: `duration.instant`（active scale、`prefers-reduced-motion` で停止）

## 関連

- **ChatBubble** — 会話の各発言バブル
- **Input / Textarea** — 単体の入力フィールド
- **Button** — 送信・添付ボタン
