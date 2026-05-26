# AppShell

ページ全体の骨組み。TopBar / SideNav / Main / Footer を CSS Grid で配置するレイアウトプリミティブ。スキップリンク内蔵。

## Anatomy

```
┌──────────────────────────────────┐
│           TopBar (top)            │
├──────────┬───────────────────────┤
│ SideNav  │                       │
│ (side)   │   Main (<main>)       │
│          │                       │
│          ├───────────────────────┤
│          │   Footer (<footer>)   │
└──────────┴───────────────────────┘
```

各スロットは省略可能。組み合わせに応じて CSS Grid のテンプレートが切り替わる。

## Props

| prop | type | default | 説明 |
| --- | --- | --- | --- |
| `topBar` | `ReactNode` | — | 上部 |
| `sideNav` | `ReactNode` | — | 左側（モバイルでは [Sheet](sheet.md) に置換する設計） |
| `footer` | `ReactNode` | — | 下部 |
| `children` | `ReactNode` | — | `<main>` 内のコンテンツ |
| `mainId` | `string` | `'main'` | スキップリンクのターゲット ID |
| `disableSkipLink` | `boolean` | `false` | スキップリンク非表示（推奨: 残す） |

## アクセシビリティ

- ルート: 純粋な `<div>`（grid container）
- メイン: `<main id="main" tabIndex={-1}>` (main landmark)
- フッター: `<footer>` (contentinfo landmark)
- TopBar / SideNav は内側で `<header>` / `<nav>` を持つ前提
- **Skip link**: 通常は画面外、Tab で focus すると左上にスライドイン。クリックで `<main>` へジャンプ
- main の `tabIndex={-1}` により、スキップリンクから飛んだ後にキーボードフォーカスが正しく当たる

## レスポンシブ

`@media (max-width: 768px)` で SideNav を畳むスタイルは**意図的に提供しない**。消費側で：

- SideNav を `<Sheet side="left">` 内に入れて開閉するメニューボタンを TopBar.start に置く
- もしくは `sideNav={undefined}` にして CSS テンプレートを自動で切り替える

## 使用ルール（Do / Don't）

### ✅ Do

- アプリの最上位 1 箇所に置く
- スキップリンクは残す（A11y 必須）
- main の幅は子要素 (Card / Text 等) の max-width で調整

### ❌ Don't

- AppShell をネストしない
- 動的に grid template を変更しない（レイアウトジャンプ）
- スキップリンクを CSS で完全に消さない（focus 時には可視化）

## 使用するトークン

- 色: `surface.base / raised`, `text.primary`, `focus.ring`
- スペース: `space-2`, `space-3`
- 角丸: `radius.md`
- タイポ: `font.sans`, `font-size.sm`, `font-weight.medium`
- モーション: `duration.fast`, `easing.out`（スキップリンク）

## 関連

- **TopBar (E-2)**
- **SideNav (E-3)**
- **Sheet (D-4)** — モバイル時の SideNav 代替
