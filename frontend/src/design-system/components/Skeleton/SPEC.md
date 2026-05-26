# Skeleton / SkeletonGroup

データ取得中に表示するプレースホルダー。コンテンツの**形状を模倣**することで、レイアウトジャンプを防ぎ、知覚的な体感速度を改善する。

## 目的

- API 取得中のリスト / カード / プロフィールのプレースホルダー
- 画像読込中のフォールバック
- 初回読込時のレイアウト維持

## Anatomy

```
<Skeleton shape="line"   width="60%" />
<Skeleton shape="circle" size={40} />
<Skeleton shape="rect"   height={120} />

<SkeletonGroup isLoading={loading} loadingContent={<...>}>
  <ActualContent />
</SkeletonGroup>
```

## Skeleton Props

| prop | type | default | 説明 |
| --- | --- | --- | --- |
| `shape` | `'line' \| 'circle' \| 'rect'` | `'line'` | line=text, circle=avatar, rect=画像/カード |
| `animation` | `'pulse' \| 'shimmer' \| 'none'` | `'shimmer'` | アニメーション種類 |
| `width` | `number \| string` | line/rect=`'100%'` | px or CSS 値 |
| `height` | `number \| string` | line=`'1em'`, rect=`120` | px or CSS 値 |
| `size` | `number \| string` | circle=`40` | circle 専用、直径 |

## SkeletonGroup Props

`isLoading` の真偽で表示を切り替えるラッパー。ローディング中は `aria-busy="true"` + `aria-live="polite"` を付与し、SR に状態を伝える。

| prop | type | 説明 |
| --- | --- | --- |
| `isLoading` | `boolean` | 真の間 `loadingContent` を表示 |
| `loadingContent` | `ReactNode` | Skeleton の組み合わせ |
| `children` | `ReactNode` | `isLoading=false` で表示する実コンテンツ |

## 使用ルール（Do / Don't）

### ✅ Do

- **実際のコンテンツの形に近づける**（width / height を実コンテンツに合わせる）
- 単独 Skeleton ではなく `SkeletonGroup` でラップし、A11y 属性を付ける
- 短時間（〜2 秒）の読み込みのみ。それ以上は Spinner + メッセージ表示を検討
- 同一画面に多数並べるときは `animation="pulse"` の方が控えめで Quiet 原則と合う

### ❌ Don't

- 文字数 / 行数が予測できない場合は適切な省略形を使う（80% / 60% など）
- ローディング中にレイアウトを大きくジャンプさせない（実コンテンツの寸法と揃える）
- 装飾アニメーションだけのために使わない（情報伝達がないなら表示しない）

## アクセシビリティ

- Skeleton 自身は `aria-hidden="true"`（SR は読み飛ばす）
- ローディング状態は **`SkeletonGroup` で `aria-busy` + `aria-live="polite"` を表現**
- `prefers-reduced-motion` で全アニメーションを停止（pulse/shimmer 両方）

## 使用するトークン

- 色: `color-neutral-200`
- 角丸: `radius.sm`, `radius.md`
- モーション: pulse 1.6s, shimmer 1.4s（reduced-motion で停止）

## 関連

- **Spinner (B-6)** — 短時間の読込・進行中表示
- **Card (C-6)** — Skeleton を中に入れて配置
- **EmptyState (D-7)** — データが空のときの表示（読込後の選択肢）
