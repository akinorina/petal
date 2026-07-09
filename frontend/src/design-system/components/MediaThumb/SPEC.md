# MediaThumb

非同期メディア（署名 URL の画像など）の**純表示 shell**。取得ロジックは持たず、`src` / `isLoading` / `hasError` を親から受けて「読込中プレースホルダー / 失敗+再読込 / 画像表示」を切り替える controlled 部品。

## 目的

- 署名付き URL の取得を伴う画像サムネイルの読込・失敗・表示の見た目を統一する
- 取得 state（fetch・成否・再取得）はアプリ側フックが所有し、DS は表示だけを担う（Spinner / Skeleton と同じ presentational 哲学）
- チャット添付・ライブラリサムネ・原寸プレビューなど、枠のサイズが異なる文脈で使い回す

## Anatomy

```text
<MediaThumb
  src={url}          // 未確定なら undefined
  alt="ファイル名"
  isLoading={false}
  hasError={false}
  onRetry={reload}
  onError={markError}
  imgClassName="..." // <img> のクラス（省略時は親枠いっぱい）
/>
```

- 成功時のラッパーは `display: contents` でレイアウトに透明。`<img>` が親の枠へ直接収まる
- `loading` / `error` 時のみ親枠いっぱいのボックスを描画する

## States

| state | 条件 | 表示 |
| --- | --- | --- |
| ready | `src` あり かつ `!isLoading` かつ `!hasError` | `<img src alt onError>` |
| loading | `!src` または `isLoading` | `surface-sunken` の pulse プレースホルダー |
| error | `hasError` | 中央寄せの失敗ボックス（「読み込み失敗」＋`再読込`） |

## Props

| prop | type | default | 説明 |
| --- | --- | --- | --- |
| `src` | `string` | — | 表示する画像 URL。未確定（取得中）は undefined |
| `alt` | `string` | （必須） | `<img>` の alt テキスト |
| `isLoading` | `boolean` | `false` | 取得中。プレースホルダーを表示 |
| `hasError` | `boolean` | `false` | 取得/デコード失敗。失敗ボックスを表示 |
| `onRetry` | `() => void` | — | 「再読込」押下時のハンドラ |
| `onError` | `() => void` | — | `<img>` の onError を親へ通知 |
| `imgClassName` | `string` | 親枠いっぱい | `<img>` に付与するクラス |

`HTMLAttributes<HTMLDivElement>` を継承（`className` などをルートへ透過）。

## 使用ルール（Do / Don't）

### ✅ Do

- 取得 state（fetch・成否・再取得）はアプリ側フックに持たせ、props で流し込む
- 親要素で表示枠のサイズ（`w`/`h` や `aspect-square`）を決める
- `hasError` 復帰は `onRetry` で親の再取得をトリガする

### ❌ Don't

- コンポーネント内で fetch しない（presentational を保つ）
- 生カラー・生数値を `imgClassName` で上書きして DS の配色を崩さない

## アクセシビリティ

- `<img>` に `alt` を必須化
- 失敗時の `再読込` は `<button>`（キーボード操作・フォーカスリング対応）

## 使用するトークン

- 面/文字: `surface.sunken`, `text.tertiary`, `text.link`, `border.strong`
- 余白: `space.1`
- 文字: `font-size.xs`, `font.sans`
- モーション: pulse 1.6s（`prefers-reduced-motion` で停止）

## 関連

- **AudioPlayer** — 音声版の非同期純表示 shell
- **Skeleton** — 読込中プレースホルダー（形状模倣）
- **Avatar** — 画像 + フォールバックの表示
