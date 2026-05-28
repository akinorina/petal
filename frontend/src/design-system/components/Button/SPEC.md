# Button

最も使われる Atom。CTA、フォーム送信、ダイアログ操作などすべての「アクションを実行する瞬間」を担う。

## 目的

ユーザーの主体的なアクションを表現する。リンク（ページ遷移）とは明確に区別される: Button は「何かを実行する」、Link は「別の場所へ移動する」。

## Anatomy

```text
[leftIcon?] [label] [rightIcon?]
```

- 上記要素を中央寄せで配置
- アイコンと label の間は `space-2` (8px)
- isLoading 時は spinner がオーバーレイし label を visibility:hidden

## Variants

| variant | 用途 | 色 |
| --- | --- | --- |
| `primary` (default) | 画面の主要 CTA。Coral アクセント | `accent.default` |
| `secondary` | 副次的アクション。罫線つき中立 | `surface.raised` + `border.default` |
| `ghost` | さらに弱いアクション。ホバー時のみ背景出現 | transparent |
| `danger` | 破壊的操作。`solid` 強度の深紅 | `feedback.danger.solid` |
| `link` | ボタンと同じ振る舞いの「リンクっぽい」表現。テキストのみ | `text.link` + 下線 |

| size | height | font-size | 用途 |
| --- | --- | --- | --- |
| `sm` | 32px | sm (14px) | ツールバー・密度の高い UI |
| `md` (default) | 40px | sm (14px) | 標準。ほとんどの場面 |
| `lg` | 48px | base (16px) | モバイル主要 CTA・余裕のある画面 |

## States

| state | 表現 |
| --- | --- |
| `rest` | デフォルト |
| `hover` | 背景色を `--accent-hover` 等へ。75ms ease-out |
| `press` (`:active`) | 背景色を `--accent-active` へ + `transform: scale(0.97)` |
| `focus-visible` | `outline: 2px solid var(--focus-ring); outline-offset: 2px;` |
| `disabled` | `opacity: 0.5; cursor: not-allowed;`、interactive 状態無効 |
| `loading` | disabled として扱い、spinner を表示 + `aria-busy="true"`、label は visibility:hidden で幅を保持 |

## Props (API)

| prop | type | default | 説明 |
| --- | --- | --- | --- |
| `variant` | `'primary' \| 'secondary' \| 'ghost' \| 'danger' \| 'link'` | `'primary'` | バリエーション |
| `size` | `'sm' \| 'md' \| 'lg'` | `'md'` | サイズ |
| `isLoading` | `boolean` | `false` | ローディング表示 |
| `isFullWidth` | `boolean` | `false` | width: 100% |
| `leftIcon` | `ReactNode` | — | label 左にアイコン |
| `rightIcon` | `ReactNode` | — | label 右にアイコン |
| `children` | `ReactNode` | — | label |
| `...HTMLButtonAttributes` | — | — | `onClick`, `disabled`, `type`, `aria-*` 等すべて転送 |

ref forwarded to underlying `<button>` element.

## 使用ルール（Do / Don't）

### ✅ Do

- 画面の最重要 CTA は `primary` を1つだけ。複数置かない（Quiet）
- 破壊的操作（削除、リセット）は必ず `danger`
- アイコンのみのボタンは `aria-label` を必須
- フォーム内の主要ボタンは `type="submit"`、それ以外は `type="button"`

### ❌ Don't

- `primary` と `danger` を同じ画面に複数並べない（混乱）
- `link` variant を見出しやリンクテキストの代わりに使わない（それは `<a>` を使う）
- アイコン + label の場合、アイコンを装飾以上の意味で使わない（情報はテキストで持つ）
- `disabled` を理由説明なしに使わない（なぜ disabled かは別途 Tooltip や HelperText で示す）

## アクセシビリティ

- **キーボード**: Tab で到達、Enter / Space で実行
- **focus-visible**: マウスクリック時はリング非表示、キーボードフォーカス時のみ表示
- **aria-busy**: `isLoading` 時に `true` を付与
- **aria-label**: アイコンのみのボタンに必須
- **disabled**: HTML 標準の `disabled` 属性を使用（aria-disabled より優先）
- **コントラスト**: primary/danger の白文字は AA(UI) を満たす。secondary/ghost のテキストは text-primary で AAA

## 使用するトークン

- 色: `accent.*`, `surface.raised`, `surface.sunken`, `border.default`, `text.primary`, `text.link`, `feedback.danger.solid*`, `focus.ring`
- スペース: `space-2`, `space-3`, `space-4`, `space-5`
- 角丸: `radius.md`
- タイポ: `font.sans`, `font-weight.medium`, `font-size.sm`, `font-size.base`
- モーション: `duration.instant`, `easing.out`

## 関連

- **Link** — ページ遷移の場合は Button ではなく Link を使う
- **IconButton** (将来) — アイコンのみで頻繁に使う場合は専用コンポーネント化を検討
- **ButtonGroup** (将来) — 隣接して使う場合
