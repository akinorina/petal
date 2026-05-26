# Dialog / Modal

ユーザーの**明示的なアクション**が必要な、画面中央に表示されるモーダル。Floating UI の `FloatingFocusManager` + `FloatingOverlay` 基盤。

## Popover / Sheet との違い

| | Dialog | Popover | Sheet |
| --- | --- | --- | --- |
| **配置** | 画面中央 | trigger の周辺 | 画面端 (上下左右) |
| **モーダル** | yes (背面操作不可) | no | yes (typically) |
| **大きさ** | sm 〜 xl | 小 | sm 〜 full |
| **典型例** | 確認、フォーム、規約 | メニュー、フィルター | モバイルメニュー、詳細パネル |

## Anatomy

```
<Dialog>
  <Dialog.Trigger><Button>...</Button></Dialog.Trigger>
  <Dialog.Content>
    <Dialog.Header>
      <Dialog.Title>...</Dialog.Title>
      <Dialog.Description>...</Dialog.Description>  ← 任意
    </Dialog.Header>
    <Dialog.Body>...</Dialog.Body>
    <Dialog.Footer>
      <Dialog.Close><Button>キャンセル</Button></Dialog.Close>
      <Dialog.Close><Button variant="primary">OK</Button></Dialog.Close>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog>
```

`Dialog.Trigger` は省略可能（外部 `open` / `onOpenChange` で制御）。

## Props

### Dialog

| prop | type | default | 説明 |
| --- | --- | --- | --- |
| `open` | `boolean` | — | controlled |
| `defaultOpen` | `boolean` | `false` | uncontrolled 初期値 |
| `onOpenChange` | `(open) => void` | — | 開閉時 |
| `size` | `'sm' \| 'md' \| 'lg' \| 'xl'` | `'md'` | max-width 360/480/640/880 |
| `closeOnOverlayClick` | `boolean` | `true` | オーバーレイクリックで閉じるか |

### Dialog.Close

子の `onClick` をラップし、クリック時に Dialog を閉じる。

## 動作 / アクセシビリティ

- **role**: `dialog` + `aria-modal="true"` (FloatingPortal + FloatingFocusManager 自動)
- **aria-labelledby**: `Dialog.Title` の id と自動接続
- **aria-describedby**: `Dialog.Description` の id と自動接続
- **focus 管理**: 開くと最初の focusable へ focus、Tab を内部に閉じ込め、閉じると trigger に戻る
- **Esc**: 閉じる (`escapeKey: true`)
- **scroll lock**: `FloatingOverlay lockScroll` で背景スクロール抑制
- **アニメーション**: 登場 300ms ease-out (translateY + scale)、退場 200ms ease-in。`prefers-reduced-motion` で抑制

## 使用ルール（Do / Don't）

### ✅ Do

- 破壊的操作 (削除、破棄) の確認に使う
- 1 画面に 1 つに限定 (Dialog ネスト禁止)
- Title は短く明確に (1 行)、Description で補足
- Footer のアクションは **右寄せ・主アクションを右**

### ❌ Don't

- 単なる情報表示には使わない → [Toast](toast.md) / [Alert](alert.md)
- 長文 (規約・ヘルプ) は size lg/xl にして Body をスクロール、または別ページへ
- Dialog の中に Dialog を入れない (focus 管理が破綻)

## 使用するトークン

- 色: `surface.raised`, `border.subtle`, `text.primary`, `text.secondary`
- スペース: `space-1` 〜 `space-8`
- 角丸: `radius.lg`
- 影: `shadow.xl`
- タイポ: `font.sans`, `font-size.sm/lg`, `font-weight.semibold`, `line-height.snug/normal/relaxed`

## 外部依存

- `@floating-ui/react` — `FloatingOverlay` / `FloatingFocusManager` / `useDismiss` / `useTransitionStyles`

## 関連

- **Sheet (D-4)** — 画面端から出す Dialog の親戚
- **Popover (D-5)** — 軽量の小窓
- **Toast (D-1)** / **Alert (D-2)** — 通知用途
