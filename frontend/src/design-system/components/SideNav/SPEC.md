# SideNav

サイドバーナビゲーション。3 variant（full / compact / icon-only）で密度を切り替える。Compound: SideNav / Section / Item。

## Anatomy

```text
<SideNav header={...} footer={...}>
  <SideNav.Section title="メイン">
    <SideNav.Item icon={...} label="..." isActive />
    <SideNav.Item icon={...} label="..." trailing={<Badge ... />} />
  </SideNav.Section>
</SideNav>
```

## Variants

| variant | 幅 | 用途 |
| --- | --- | --- |
| `full` (default) | 260px | ラベル + アイコン、デスクトップ標準 |
| `compact` | 200px | ラベルを短く、狭い画面向け |
| `icon-only` | 56px | アイコンのみ、ラベルは `aria-label`、section-title 非表示 |

折りたたみは消費側で variant を切り替える設計（状態管理を強制しない）。

## Props

### SideNav

| prop | type | default | 説明 |
| --- | --- | --- | --- |
| `variant` | `'full' \| 'compact' \| 'icon-only'` | `'full'` | |
| `ariaLabel` | `string` | `'sidebar navigation'` | nav landmark のラベル |
| `header` / `footer` | `ReactNode` | — | 上下固定領域 (logo, profile 等) |

### SideNav.Section

| prop | type | 説明 |
| --- | --- | --- |
| `title` | `ReactNode` | グループ見出し（icon-only では非表示） |

### SideNav.Item

| prop | type | 説明 |
| --- | --- | --- |
| `as` | `'a' \| 'button'` | `'a'` (デフォルト) はリンク、`'button'` はアクション |
| `href` | `string` | `as='a'` 時 |
| `icon` | `ReactNode` | 左アイコン |
| `label` | `ReactNode` | ラベル (icon-only では `aria-label` に変換される) |
| `isActive` | `boolean` | アクティブ。`as='a'` で `aria-current="page"`、`as='button'` で `aria-pressed="true"` |
| `trailing` | `ReactNode` | 右側 (Badge 等。icon-only では非表示) |

## アクセシビリティ

- ルート: `<nav aria-label="...">` (navigation landmark)
- リンク Item: `<a>` + `aria-current="page"` (アクティブ時)
- ボタン Item: `<button>` + `aria-pressed`
- **icon-only モード**: ラベルが `aria-label` に自動転送 (label が string の場合)
- `focus-visible` 内側 outline でレイアウト崩れを回避

## 使用ルール（Do / Don't）

### ✅ Do

- 主要 5 〜 12 項目を 2 〜 3 Section に分けて配置
- アイコンは必ず付ける（icon-only に切り替え可能にするため）
- 通知数 / バッジは trailing に
- モバイルでは [Sheet](sheet.md) (side='left') と組み合わせて開閉

### ❌ Don't

- 二段サイドバーを作らない (情報過多)
- icon-only で意味の伝わらないアイコンを使わない (ラベルが消えるため）
- アクティブ表示を 2 つ以上にしない (現在地は 1 つ)

## 使用するトークン

- 色: `surface.raised`, `border.subtle`, `text.primary`, `text.secondary`, `text.tertiary`, `accent.subtle.bg/fg`, `color-neutral-100`, `focus.ring`
- スペース: `space-1` 〜 `space-4`
- 角丸: `radius.md`
- タイポ: `font.sans`, `font-size.xs/sm`, `font-weight.medium/semibold`, `letter-spacing.wide`
- モーション: `duration.fast`, `easing.out`

## 関連

- **AppShell (E-1)** — SideNav を含むレイアウト
- **TopBar (E-2)** — 上部ナビ
- **Sheet (D-4)** — モバイル時の左スライドメニュー
- **ListItem (C-7)** — より汎用なリスト要素 (SideNav.Item は専用化版)
