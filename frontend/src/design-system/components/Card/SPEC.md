# Card

コンテンツを区画化する汎用 Molecule。情報のグルーピングや、リスト中の 1 項目を独立した塊として見せたいときに使う。

## 目的

- ダッシュボードのウィジェット枠
- 設定画面の項目をグループ化
- 一覧画面の各エンティティ表示
- 任意の compound: Header / Body / Footer

## Anatomy

```
<Card>
  <Card.Header>...</Card.Header>
  <Card.Body>...</Card.Body>
  <Card.Footer>...</Card.Footer>
</Card>
```

- Compound は任意。`<Card>` 直下に自由なコンテンツを置いてもよい
- セクションを使うと、親 Card の padding を継承しつつ、セクション間に区切り線が入る
- `padding="none"` を指定したときだけ、Header/Body/Footer 各々に独自 padding が入る（画像つきカード等）

## Props

### Card

| prop | type | default | 説明 |
| --- | --- | --- | --- |
| `variant` | `'outlined' \| 'elevated'` | `'outlined'` | 枠線のみ / 影付き |
| `padding` | `'sm' \| 'md' \| 'lg' \| 'none'` | `'md'` | 16 / 20 / 24 / 0 px |
| `isInteractive` | `boolean` | `false` | クリック可能化（`role="button"` + Enter/Space で onClick 発火 + hover/active/focus 視覚） |
| `onClick` | `(event) => void` | — | クリック時。`isInteractive` 時は Enter/Space からも発火 |
| `...rest` | — | — | `<div>` の標準属性をすべて転送 |

`forwardRef<HTMLDivElement>`。

### Card.Header / Card.Body / Card.Footer

すべて `<div>` の標準属性 + `children` を受ける。

## Variants

| variant | 見た目 | 用途 |
| --- | --- | --- |
| `outlined` | `border-subtle` の 1px 枠 | 情報の境界を控えめに |
| `elevated` | `shadow-sm` の影 | コンテンツを浮き上がらせる、注目させる |

## States（`isInteractive` 時のみ）

| state | 表現 |
| --- | --- |
| `hover` | `shadow-md` + border = `border-default` |
| `active` | `translateY(1px)` + `shadow-sm` |
| `focus-visible` | 2px outline (`focus-ring`) |

`prefers-reduced-motion` 時はトランジションを抑制、active の transform も無効化。

## 使用ルール（Do / Don't）

### ✅ Do

- 1 画面に Card が並ぶ場合は variant を統一する（混在すると視覚ノイズになる）
- カード内に主要 CTA が 1〜2 個ある UI は Footer に置く
- 画像をカード上部に置きたいときは `padding="none"` + 子に div で padding を当てる

### ❌ Don't

- 影 (`elevated`) と枠 (`outlined`) を組み合わせて主張を強くしない（Quiet 原則）
- Card の中に Card をネストしない（情報階層が分かりにくくなる）
- `isInteractive` のカード内にさらに button / link を置かない（クリック領域が衝突する）

## アクセシビリティ

- 非インタラクティブ時は role なし（純粋な装飾コンテナ）
- `isInteractive` 時は `role="button"` + `tabIndex=0` + Enter/Space ハンドラ
- `focus-visible` 時のみアウトライン表示
- 中にリンクや button を置く場合は `isInteractive` を使わない（ネスト不可なため）

## 使用するトークン

- 色: `surface.raised`, `border.subtle`, `border.default`, `focus.ring`, `text.primary`
- スペース: `space-3`, `space-4`, `space-5`, `space-6`
- 角丸: `radius.lg`
- 影: `shadow.sm`, `shadow.md`
- タイポ: `font.sans`
- モーション: `duration.fast`, `easing.out`

## 関連

- **ListItem (C-7)** — リストの 1 項目（より密度の高い表現）
- **Tag / Badge (C-8)** — カード上のメタ情報
