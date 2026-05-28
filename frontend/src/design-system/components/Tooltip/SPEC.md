# Tooltip

hover / focus 時に短い補助説明を表示する Overlay。**インタラクティブな内容は置けない**（Popover を使う）。

## Popover との違い

| | Tooltip | Popover |
| --- | --- | --- |
| **トリガー** | hover / focus | クリック |
| **内容** | 短い静的テキストのみ | 任意のインタラクティブ要素 |
| **dismiss** | hover/focus 終了で自動 | Esc / 外側クリック / Close ボタン |
| **role** | `tooltip` | `dialog` |
| **モバイル** | hover が無いため出ない | タップで開く |

## Anatomy

```text
<Tooltip content="...">
  <Button>...</Button>  ← 単一要素
</Tooltip>
```

子は **単一の React 要素**。`ref` と event handler が自動配線される。

## Props

| prop | type | default | 説明 |
| --- | --- | --- | --- |
| `content` | `ReactNode` | — | **必須**。ツールチップ本体 |
| `children` | `ReactElement` | — | **必須**。trigger 単一要素 |
| `placement` | `'top'\|'right'\|'bottom'\|'left'` (+ `-start`/`-end`) | `'top'` | 自動 flip 有効 |
| `openDelay` | `number` | `200` | hover/focus → 開くまでの ms |
| `closeDelay` | `number` | `0` | 閉じる遅延 ms |
| `hasArrow` | `boolean` | `true` | 矢印 |
| `offset` | `number` | `6` | trigger との間隔 px |
| `disabled` | `boolean` | `false` | true で完全に表示しない |

## アクセシビリティ

- `role="tooltip"` を自動付与、trigger には `aria-describedby` が Floating UI の `useRole` 経由で配線
- **キーボードフォーカスでも表示**（hover だけでなく Tab で開く）
- Esc で閉じる
- アニメーションは 120ms（in）/ 80ms（out）の opacity + translateY、`prefers-reduced-motion` は Floating UI の `useTransitionStyles` 既定動作で抑制
- `pointer-events: none` を設定。Tooltip 自体に hover しない

## 使用ルール（Do / Don't）

### ✅ Do

- アイコンボタンの label 補足（例: ⓘ → 「情報を表示」）
- truncate された text の全文表示
- 短い操作ヒント（"保存して閉じる" 等）

### ❌ Don't

- **重要情報を Tooltip だけに置かない**（モバイルでは見えない、A11y NG）
- インタラクティブな要素を入れない（リンク・ボタン・入力）→ [Popover](popover.md)
- 長文を入れない（max-width 260px、それを超えるなら別 UI を検討）
- disabled な要素に直接巻かない → `<button disabled>` は event を発しないため Tooltip が反応しない。ラッパー要素にかけるか、`aria-disabled` を使う

## モバイル / タッチデバイス

- hover が無いため Tooltip は基本的に出ない
- **重要情報なら別 UI**（ヘルプテキスト、Popover、ヘルプアイコン）で常時アクセス可能にする
- 補助情報の Tooltip はそのままで OK（タッチデバイスのユーザーは触れない）

## 使用するトークン

- 色: `color-neutral-900`（背景）, `surface.raised`（文字、反転）
- スペース: `space-2`
- 角丸: `radius.sm`
- 影: `shadow.md`
- タイポ: `font.sans`, `font-size.xs`, `font-weight.medium`, `line-height.snug`

## 外部依存

- `@floating-ui/react` — `useHover` / `useFocus` / `useTransitionStyles` を含む

## 関連

- **Popover (D-5)** — インタラクティブな小窓
- **Icon (B-5)** — アイコンボタンとセットでよく使う
