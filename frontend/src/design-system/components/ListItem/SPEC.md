# ListItem

リストの 1 行を構成する Molecule。leading / content / trailing の 3 スロットで構成し、密度高めにメニュー・ナビゲーション・データ行を表現する。

## 目的

- ナビゲーション（サイドメニュー、設定一覧）
- リスト UI（メール、通知、検索結果）
- 選択リスト（受信トレイのフォルダ等）

## Anatomy

```text
[leading: icon / avatar / checkbox]  [content: title + subtitle]  [trailing: chevron / badge / action]
```

`leading` / `trailing` は任意。`title` は必須。

## Props

| prop | type | default | 説明 |
| --- | --- | --- | --- |
| `title` | `ReactNode` | — | **必須**。主要文言（1 行で省略） |
| `subtitle` | `ReactNode` | — | 補助文言（1 行で省略） |
| `leading` | `ReactNode` | — | 左スロット |
| `trailing` | `ReactNode` | — | 右スロット |
| `size` | `'sm' \| 'md'` | `'md'` | min-height 40 / 56px |
| `isSelected` | `boolean` | `false` | 選択状態（`accent-subtle-bg`） |
| `hasDivider` | `boolean` | `false` | 行末に区切り線を表示 |
| `as` | `'div' \| 'button' \| 'a'` | `'div'` | 要素種別。`button`/`a` で interactive 化 |
| `href` | `string` | — | `as="a"` の必須 |
| `onClick`, `disabled` | — | — | `as="button"` 時に有効 |
| `...rest` | — | — | 各要素の標準属性を転送 |

`forwardRef`（Anchor / Button / Div いずれかに）。

## States

| state | 表現 |
| --- | --- |
| `rest` | 透明背景 |
| `hover` (interactive) | `surface-hover` |
| `active` (interactive) | `surface-active` |
| `focus-visible` (interactive) | 内側 2px outline (`focus-ring`) |
| `selected` | `accent-subtle-bg` / `accent-subtle-fg` |

## 使用ルール（Do / Don't）

### ✅ Do

- リスト全体は `<Card padding="none">` 等でくるみ、`hasDivider` で行を区切る
- ナビゲーションリンクには `as="a"`、コマンド実行には `as="button"`
- 選択中の項目は `isSelected` で表現（aria-current / aria-pressed が自動付与）
- trailing にチェブロンを置くなら遷移可能性を示唆する（=リンク）

### ❌ Don't

- title を 2 行以上にしない（リスト密度が崩れる）→ どうしても必要なら別コンポーネントを検討
- ListItem 内に focusable な子要素（button / link）を置かない（フォーカスが衝突）。アクションが必要なら trailing に menu を出す
- `as="div"` のまま onClick を渡さない（A11y NG）

## アクセシビリティ

- `as="button"` → `<button type="button">` + Space/Enter で標準起動
- `as="a"` → `<a>`。`isSelected` 時に `aria-current="true"`
- `as="button"` で `isSelected` → `aria-pressed="true"`
- `focus-visible` 時のみ outline 表示（マウスクリックでは出ない）
- 1 行省略のため title が切れる場合は `title` 属性または Tooltip で補完すること（消費側責任）

## 使用するトークン

- 色: `text.primary`, `text.tertiary`, `surface.hover`, `surface.active`, `border.subtle`, `accent.subtle.bg`, `accent.subtle.fg`, `focus.ring`
- スペース: `space-2`, `space-3`, `space-4`
- タイポ: `font.sans`, `font-size.sm`, `font-size.xs`, `font-weight.medium`, `line-height.snug`, `line-height.normal`
- モーション: `duration.fast`, `easing.out`

## 関連

- **Card (C-6)** — ListItem を束ねる外枠（`padding="none"`）
- **Avatar (C-9)** — leading として使う
- **Tag / Badge (C-8)** — trailing として使う
