# Popover

クリックで開く小窓。**インタラクティブな内容**（入力フォーム、メニュー、フィルター UI 等）を置ける。位置計算には [Floating UI](https://floating-ui.com/) を使用し、自動回避 / portal / focus 管理を標準装備。

## Tooltip との違い

| | Popover | Tooltip |
| --- | --- | --- |
| **トリガー** | クリック | hover / focus |
| **内容** | インタラクティブ可（入力、ボタン、リスト） | 静的テキストのみ |
| **dismiss** | Esc / 外側クリック / Close ボタン | hover/focus 終了で自動 |
| **A11y role** | `dialog` | `tooltip` |
| **focus 管理** | 内部にトラップ可（`manageFocus`） | しない |

## Anatomy

```text
<Popover>
  <Popover.Trigger>
    <Button>開く</Button>
  </Popover.Trigger>
  <Popover.Content>
    任意の React ノード
    <Popover.Close>
      <Button>閉じる</Button>
    </Popover.Close>
  </Popover.Content>
</Popover>
```

## Props

### Popover

| prop | type | default | 説明 |
| --- | --- | --- | --- |
| `placement` | `'top' \| 'right' \| 'bottom' \| 'left'` (+ `-start` / `-end` 派生) | `'bottom'` | 初期配置。viewport からはみ出る場合は自動 flip |
| `offset` | `number` | `8` | trigger と content の間隔 (px) |
| `hasArrow` | `boolean` | `false` | 矢印表示 |
| `open` | `boolean` | — | controlled |
| `defaultOpen` | `boolean` | `false` | uncontrolled 初期値 |
| `onOpenChange` | `(open) => void` | — | 開閉時のコールバック |
| `dismissable` | `boolean` | `true` | Esc / 外側クリックで閉じるか |

### Popover.Trigger

子は単一要素のみ。クリックハンドラと `aria-expanded` / `aria-controls` が自動付与。

### Popover.Content

| prop | type | default | 説明 |
| --- | --- | --- | --- |
| `disablePortal` | `boolean` | `false` | true で in-place レンダー |
| `manageFocus` | `boolean` | `true` | 開いた直後に最初の focusable に focus、Tab を内部に閉じ込め |

### Popover.Close

子に `onClick` をラップし、クリック時に閉じる。フォームの送信ボタンや「キャンセル」に巻く。

## アクセシビリティ

- trigger: `aria-expanded` / `aria-haspopup="dialog"` / `aria-controls` を自動付与
- content: `role="dialog"`、`manageFocus` 時は focus trap + 開いた直後に最初の focusable へ focus
- `Esc` で閉じる、閉じる時 trigger に focus が戻る
- 外側クリック検出は Floating UI の `useDismiss`
- `prefers-reduced-motion` で fade-in アニメーションを 1ms に抑制

## 使用ルール（Do / Don't）

### ✅ Do

- 入力フォーム・複数選択・小さなメニュー・フィルター UI に
- インタラクティブな閉じる手段を提供する（Close ボタン / フォーム送信時 close）
- 短い操作で完結する内容に（長く操作させるなら Dialog を使う）

### ❌ Don't

- 大きいフォーム / 重要決定には使わない → [Dialog](dialog.md)
- hover で開くツールチップ用途には使わない → [Tooltip](tooltip.md)
- Popover の中にさらに Popover をネストしない（focus 管理が破綻）

## 使用するトークン

- 色: `surface.raised`, `border.subtle`, `text.primary`, `focus.ring`
- スペース: `space-3`, `space-4`
- 角丸: `radius.md`
- 影: `shadow.lg`
- タイポ: `font.sans`, `font-size.sm`, `line-height.normal`
- モーション: `duration.fast`, `easing.out`

## 外部依存

- `@floating-ui/react` — 位置計算 (auto-flip / shift / arrow)、focus 管理、dismiss

**注意:** standalone+copy 配布モデルではコピー先でも同パッケージのインストールが必要（Tailwind preset と同様の扱い）。README に明記する。

## 関連

- **Tooltip (C-10)** — hover の補助説明用（同じ Floating UI 基盤）
- **Select (C-2)** — Popover ベースのドロップダウン
- **Dialog (D-3)** — モーダル全画面ダイアログ
