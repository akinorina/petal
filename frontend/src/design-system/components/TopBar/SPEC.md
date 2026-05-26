# TopBar

ページ上部のグローバルナビゲーション。`start` / `center` / `end` の 3 スロット構造。

## Anatomy

```
[start: logo/title]    [center: nav/search]    [end: actions/avatar]
```

3 スロットは固定構造で、レスポンシブ要件があれば center を non-mobile のみ表示するなど消費側で工夫する。

## Props

| prop | type | default | 説明 |
| --- | --- | --- | --- |
| `start` | `ReactNode` | — | 左スロット (logo, title, menu button) |
| `center` | `ReactNode` | — | 中央スロット (nav, search) |
| `end` | `ReactNode` | — | 右スロット (actions, avatar) |
| `variant` | `'default' \| 'sticky' \| 'transparent'` | `'default'` | sticky で `position: sticky; top: 0`、transparent で背景透過 |
| `ariaLabel` | `string` | `'global navigation'` | nav landmark のラベル |
| `children` | `ReactNode` | — | 渡すと start/center/end を無視し完全カスタムレイアウト |

## アクセシビリティ

- 外枠: `<header>` (banner landmark)
- 内側: `<nav aria-label="...">` (navigation landmark)
- センター nav (Tabs 等) を入れる場合は重複しないよう `Tabs.List` の aria-label と TopBar の ariaLabel を区別

## 使用ルール（Do / Don't）

### ✅ Do

- 高さは 56px 固定 (デザイン一貫性のため)
- end には最大 3 〜 4 要素まで (詰め込みすぎない)
- transparent はヒーロー / LP の最上部に限定

### ❌ Don't

- 同じページに TopBar を 2 つ置かない
- スクロールに合わせて変形 (隠す等) させない (Quiet 原則)
- 検索 + ナビ + 多数アクションを同時に詰め込まない (情報過多)

## 使用するトークン

- 色: `surface.raised`, `border.subtle`, `text.primary`
- スペース: `space-2`, `space-4`, `space-5`
- 高さ: 56px (固定)

## 関連

- **AppShell (E-1)** — TopBar を含むページ全体のレイアウト
- **Tabs (E-4)** — center に置くナビ
- **Avatar (C-9)** — end に置くユーザー識別
