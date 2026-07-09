# AudioPlayer

非同期音声（署名 URL）の**純表示 shell**（`MediaThumb` の音声版）。取得ロジックは持たず、`src` / `isLoading` / `hasError` を親から受けて「読込中プレースホルダー / 失敗+再読込 / `<audio>` 再生」を切り替える controlled 部品。

## 目的

- 署名付き URL の取得を伴う音声再生の読込・失敗・表示の見た目を統一する
- 取得 state はアプリ側フックが所有し、DS は表示だけを担う（`MediaThumb` と対称）
- チャット添付音声などインライン再生の文脈で使い回す

## Anatomy

```text
<AudioPlayer
  src={url}          // 未確定なら undefined
  label="ファイル名" // <audio> の aria-label
  isLoading={false}
  hasError={false}
  onRetry={reload}
  onError={markError}
/>
```

## States

| state | 条件 | 表示 |
| --- | --- | --- |
| ready | `src` あり かつ `!isLoading` かつ `!hasError` | `<audio controls preload="metadata">` |
| loading | `!src` または `isLoading` | 高さ 32px の `surface-sunken` pulse プレースホルダー |
| error | `hasError` | インライン失敗表示（「読み込み失敗」＋`再読込`） |

## Props

| prop | type | default | 説明 |
| --- | --- | --- | --- |
| `src` | `string` | — | 再生する音声 URL。未確定は undefined |
| `label` | `string` | `'添付音声'` | `<audio>` の aria-label |
| `isLoading` | `boolean` | `false` | 取得中。プレースホルダーを表示 |
| `hasError` | `boolean` | `false` | 取得失敗。失敗表示を出す |
| `onRetry` | `() => void` | — | 「再読込」押下時のハンドラ |
| `onError` | `() => void` | — | `<audio>` の onError を親へ通知 |
| `className` | `string` | — | ルートへ付与するクラス |

## 使用ルール（Do / Don't）

### ✅ Do

- 取得 state はアプリ側フックに持たせ、props で流し込む
- `label` にファイル名など識別できる文言を渡す

### ❌ Don't

- コンポーネント内で fetch しない（presentational を保つ）
- 自前の `<audio>` を別に置かず、この shell を経由する

## アクセシビリティ

- `<audio>` に `aria-label`（`label`）を付与
- 失敗時の `再読込` は `<button>`（キーボード操作・フォーカスリング対応）

## 使用するトークン

- 面/文字: `surface.sunken`, `text.tertiary`, `text.link`, `border.strong`
- 余白: `space.2`
- 角丸: `radius.sm`
- 文字: `font-size.xs`, `font.sans`
- モーション: pulse 1.6s（`prefers-reduced-motion` で停止）

## 関連

- **MediaThumb** — 画像版の非同期純表示 shell
- **Skeleton** — 読込中プレースホルダー
