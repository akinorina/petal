# Switch

ON / OFF を **即時切り替え**するためのトグル。設定画面に最適。

## 目的

ユーザー操作で即座に反映される 2 値の設定（通知 ON/OFF、ダークモード、バックグラウンド同期など）。Checkbox との明確な使い分けが鍵。

## Checkbox との使い分け

| | Switch | Checkbox |
| --- | --- | --- |
| **意味** | 設定の即時反映 | 値の選択 |
| **反映タイミング** | 切り替えた瞬間 | フォーム送信時 |
| **典型例** | 設定画面のトグル | 規約同意、チェックリスト、複数選択 |
| **UI 周り** | 単独で並ぶことが多い | フォーム内で他の入力と並ぶ |

迷ったら: 「これを切り替えたら**すぐに何かが起きる**？」が Yes → Switch。

## Anatomy

```text
labelPosition="right" (default):
  [track + thumb]  [label]
                   [description?]

labelPosition="left" (設定行 UI 向け):
  [label]                              [track + thumb]
  [description?]
```

- 内部は `<input type="checkbox" role="switch">`（type は HTML 仕様、role で意味付け）

## Props

| prop | type | default | 説明 |
| --- | --- | --- | --- |
| `label` | `ReactNode` | — | ラベル |
| `description` | `ReactNode` | — | 補助テキスト |
| `size` | `'sm' \| 'md'` | `'md'` | sm = 32×18 / md = 40×22 |
| `labelPosition` | `'right' \| 'left'` | `'right'` | 設定行 UI なら `left` |
| `disabled`, `checked`, `defaultChecked`, `onChange`, `name`, `value` 等 | — | — | HTML `<input>` 標準属性 |

`forwardRef<HTMLInputElement>`。

## States

| state | 表現 |
| --- | --- |
| `off` | track = `border-strong`、thumb は左 |
| `on` | track = `accent-default`、thumb は右（150ms ease-out スライド） |
| `hover (off)` | track = `text-tertiary` |
| `hover (on)` | track = `accent-hover` |
| `focus-visible` | 2px outline (`focus-ring`) |
| `disabled` | opacity 0.5 |

`prefers-reduced-motion` 時はスライドアニメーションを 1ms に縮める。

## 使用ルール（Do / Don't）

### ✅ Do

- 設定画面の「すぐ反映される」二択に使う
- 状態がラベル文言ですぐ分かるようにする（"通知を受け取る" など肯定形）
- 設定行 UI では `labelPosition="left"` で右端配置にし、リスト体験を統一

### ❌ Don't

- フォーム送信のためには使わない（Checkbox が適切）
- "On / Off" や "Yes / No" のような二択ラジオ代わりに使わない
- 切り替えに副作用（ダイアログ・確認）を挟むなら Switch ではなくボタンを使う（即時性が崩れる）
- ラベルなしで配置しない（何を切り替えるか不明）

## アクセシビリティ

- `role="switch"` + `aria-checked` を持つ（`type="checkbox"` の checked から自動派生）
- ネイティブ input なので Space キーでトグル、Tab で focus 可能
- ラベルクリックでもトグル（`<label>` ラッピング）
- `focus-visible` 時のみアウトライン表示
- `prefers-reduced-motion` で thumb/track アニメーションを抑制

## 使用するトークン

- 色: `surface.raised`, `border.strong`, `text.tertiary`, `accent.default`, `accent.hover`, `focus.ring`, `text.primary`
- スペース: `space-1`, `space-3`
- 影: `shadow.sm`（thumb）
- タイポ: `font.sans`, `font-size.sm`, `font-size.xs`
- モーション: `duration.fast` (150ms), `easing.out`

## 関連

- **Checkbox (C-3)** — フォーム送信、複数選択
- **Radio (C-4)** — 排他選択
