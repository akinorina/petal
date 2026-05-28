# Tabs

複数のコンテンツを切り替えて 1 つを表示する Compound。`role="tablist"` + `tab` + `tabpanel` の WAI-ARIA Tabs パターン準拠。

## Anatomy

```text
<Tabs defaultValue="a">
  <Tabs.List ariaLabel="...">
    <Tabs.Tab value="a">A</Tabs.Tab>
    <Tabs.Tab value="b">B</Tabs.Tab>
  </Tabs.List>
  <Tabs.Panel value="a">A コンテンツ</Tabs.Panel>
  <Tabs.Panel value="b">B コンテンツ</Tabs.Panel>
</Tabs>
```

## Props

### Tabs

| prop | type | default | 説明 |
| --- | --- | --- | --- |
| `value` / `defaultValue` | `string` | `''` | アクティブな tab の value |
| `onChange` | `(value) => void` | — | 切替時 |
| `variant` | `'line' \| 'pill'` | `'line'` | 下線型 / segmented 型 |
| `orientation` | `'horizontal' \| 'vertical'` | `'horizontal'` | 並び方向 |

### Tabs.List

| prop | type | default | 説明 |
| --- | --- | --- | --- |
| `ariaLabel` | `string` | — | tablist の `aria-label`（推奨） |

### Tabs.Tab

| prop | type | 説明 |
| --- | --- | --- |
| `value` | `string` | グループ内ユニーク |
| `disabled` | `boolean` | 矢印キー移動でも飛ばされる |

### Tabs.Panel

| prop | type | default | 説明 |
| --- | --- | --- | --- |
| `value` | `string` | — | 対応する Tab の value |
| `keepMounted` | `boolean` | `false` | 非アクティブパネルを DOM に残す（フォーム状態保持） |

## アクセシビリティ (WAI-ARIA Tabs パターン)

- `Tabs.List` → `role="tablist"` + `aria-orientation`
- `Tabs.Tab` → `role="tab"` + `aria-selected` + `aria-controls`
- `Tabs.Panel` → `role="tabpanel"` + `aria-labelledby`
- **キーボード**:
  - `←` / `→` (horizontal) または `↑` / `↓` (vertical): 隣のタブへ
  - `Home` / `End`: 先頭 / 末尾へ
  - `Tab`: tablist 全体から panel へ
- **roving tabindex**: アクティブな tab だけ `tabIndex=0`、他は `-1`
- アニメーションなし（コンテンツ切替）= reduced-motion でも変化なし

## 使用ルール（Do / Don't）

### ✅ Do

- ラベルは短く (1-2 語)
- パネル間の関連性が高い時に使う (同じ被写体の別ビュー)
- フォーム入力を分割する場合は `keepMounted` を有効に
- 1 グループ 3〜7 タブを目安に

### ❌ Don't

- ページ遷移代わりに使わない (URL も変わらない、SPA ルーターを使う)
- ネストしない (UX 崩壊)
- 隠したい設定を Tabs に押し込まない (重要なら表に出す)

## 使用するトークン

- 色: `text.primary`, `text.secondary`, `accent.default`, `surface.raised`, `border.subtle`, `color-neutral-100`, `focus.ring`
- スペース: `space-1`, `space-2`, `space-3`, `space-4`
- 角丸: `radius.sm`, `radius.md`
- 影: `shadow.sm` (pill active)
- タイポ: `font.sans`, `font-size.sm`, `font-weight.medium`
- モーション: `duration.fast`, `easing.out`

## 関連

- **Link (B-4)** — ページ間遷移はこちら
- **Card (C-6)** — Tabs を内包する
