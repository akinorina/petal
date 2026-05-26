# Sheet

画面端から出現する Dialog の親戚。**モバイルメニュー / 詳細パネル / 選択肢シート** に最適。

## Dialog との違い

| | Sheet | Dialog |
| --- | --- | --- |
| **配置** | 画面端 (上下左右) | 画面中央 |
| **slide 方向** | side prop で決定 | scale + translate |
| **典型例** | モバイルメニュー、詳細パネル、bottom sheet | 確認、フォーム、規約 |
| **大きさ** | side ごとに幅 or 高さ | max-width で全方向制約 |

API は Dialog と意図的に揃えてある。

## Anatomy

```
<Sheet side="right" size="md">
  <Sheet.Trigger><Button>...</Button></Sheet.Trigger>
  <Sheet.Content>
    <Sheet.Header>
      <Sheet.Title>...</Sheet.Title>
      <Sheet.Description>...</Sheet.Description>
    </Sheet.Header>
    <Sheet.Body>...</Sheet.Body>
    <Sheet.Footer>
      <Sheet.Close><Button>キャンセル</Button></Sheet.Close>
      <Sheet.Close><Button variant="primary">OK</Button></Sheet.Close>
    </Sheet.Footer>
  </Sheet.Content>
</Sheet>
```

## Props

| prop | type | default | 説明 |
| --- | --- | --- | --- |
| `side` | `'top' \| 'right' \| 'bottom' \| 'left'` | `'right'` | 出現方向 |
| `size` | `'auto' \| 'sm' \| 'md' \| 'lg' \| 'full'` | `'md'` | 幅 (left/right) or 高さ (top/bottom)。`auto` で内容に合わせる、`full` で 100% |
| `open`, `defaultOpen`, `onOpenChange` | — | — | controlled / uncontrolled |
| `closeOnOverlayClick` | `boolean` | `true` | オーバーレイクリックで閉じる |

### Size 早見表 (px / vh)

| size | left/right (width) | top/bottom (height) |
| --- | --- | --- |
| `sm` | 320 | 30vh (max 320) |
| `md` | 480 | 50vh (max 520) |
| `lg` | 640 | 75vh |
| `full` | 100vw | 100vh |
| `auto` | content | content (max 90vh) |

## アクセシビリティ

- Dialog と同等: `role="dialog"` + `aria-modal`、`aria-labelledby` (Title) + `aria-describedby` (Description) 自動配線
- focus trap、開いた時に最初の focusable へ focus、閉じた時に trigger に戻る
- Esc / オーバーレイクリックで閉じる
- 背景スクロール抑制 (`FloatingOverlay lockScroll`)
- アニメーション: 登場 300ms / 退場 200ms、`prefers-reduced-motion` で抑制

## 使用ルール（Do / Don't）

### ✅ Do

- モバイルの詳細表示・ナビゲーションには `bottom` / `left` を選ぶ (親指で届く)
- デスクトップの詳細パネルには `right` + `size lg` を選ぶ
- 選択肢シート (action sheet) は `bottom` + `size auto`

### ❌ Don't

- 確認ダイアログには使わない → [Dialog](dialog.md)
- 中央配置にしない (機能が被るだけ)
- Sheet 同士をネストしない (focus 管理が崩れる)

## 使用するトークン

- 色: `surface.raised`, `border.subtle`, `text.primary`, `text.secondary`
- スペース: `space-1` 〜 `space-5`
- 角丸: `radius.lg` (画面外側辺は角丸なし)
- 影: `shadow.xl`
- タイポ: `font.sans`, `font-size.sm/lg`, `font-weight.semibold`, `line-height.snug/normal/relaxed`

## 外部依存

- `@floating-ui/react` — Dialog と同じ基盤

## 関連

- **Dialog (D-3)** — 中央モーダル
- **Popover (D-5)** — 軽量の小窓
- **ListItem (C-7)** — メニュー項目に
