# Tag / Badge

短い情報を視覚的に強調する Molecule 群。`Tag` と `Badge` は **役割が異なる**ため意図的に使い分ける。

## Tag vs Badge

| | Tag | Badge |
| --- | --- | --- |
| **意味** | カテゴリ・属性・状態のラベル付与 | カウント / 状態通知 |
| **形** | 角丸長方形（pill 形） | 円形 / 小円ドット |
| **典型例** | "React"、"TypeScript"、"Online" | "3"（未読数）、ドット（要対応） |
| **インタラクション** | `isRemovable` で削除可能 | 表示のみ（クリックさせない） |
| **配置** | 文中・カード内・フィルター行 | アイコンの右上にかぶせる、リスト右端 |

## ─── Tag ───

### Anatomy

```
[leading?]  [label]  [×?]
```

### Props

| prop | type | default | 説明 |
| --- | --- | --- | --- |
| `variant` | `'neutral' \| 'success' \| 'warning' \| 'danger' \| 'info' \| 'accent'` | `'neutral'` | 配色 |
| `size` | `'sm' \| 'md'` | `'md'` | 11px / 12px |
| `leading` | `ReactNode` | — | 左アイコン |
| `isRemovable` | `boolean` | `false` | × ボタン表示 |
| `onRemove` | `() => void` | — | × クリック時 |
| `removeLabel` | `string` | `'削除'` | × の `aria-label` |

### Variants

すべて `*-subtle-bg` + `*-subtle-fg` の組み合わせで主張を抑える（Quiet 原則）。

### 使用ルール

- ✅ メタデータ表示（タグクラウド、属性、状態ラベル）
- ✅ 削除可能なフィルター UI（`isRemovable`）
- ❌ クリックで遷移しない（リンク用途なら [Link](link.md)、操作用途なら [Button](button.md)）
- ❌ 1 つのエンティティに 4 個以上のタグを並べない（視覚ノイズ）

## ─── Badge ───

### Anatomy

```
通常: [number] / [text]
ドット: [●]
```

### Props

| prop | type | default | 説明 |
| --- | --- | --- | --- |
| `variant` | `'neutral' \| 'success' \| 'warning' \| 'danger' \| 'info' \| 'accent'` | `'danger'` | 配色 |
| `count` | `number` | — | 数値表示。`max` 超で `"max+"` |
| `max` | `number` | `99` | 上限値 |
| `isDot` | `boolean` | `false` | 数値なしの小円のみ |
| `children` | `ReactNode` | — | カスタムテキスト（"NEW" 等） |

### 使用ルール

- ✅ 未読数・通知数の表示（アイコン右上にかぶせる）
- ✅ "NEW" / "BETA" の小ラベル
- ✅ ドット（数値不要、要注意だけ示したい）
- ❌ Badge を押せるようにしない（クリックなら別 UI）
- ❌ 1 画面に Badge を多用しない（注意喚起の効力が薄れる）

## アクセシビリティ

- Tag の削除 × ボタン: `aria-label` 必須（"削除" デフォルト、`removeLabel` で上書き可能）
- Badge のみで重要情報を伝えない（SR は数値だけ読む → 文脈は親要素で補完）
- Badge を装飾としてかぶせるなら親要素に `aria-label="3件の未読通知"` 等を付けるのが望ましい
- 色だけで意味を区別しない（label / icon と併用）

## 使用するトークン

- 色: 各 feedback color の `subtle-bg` / `subtle-fg`、`accent.subtle.*`、`color-neutral-100`, `text.tertiary`
- スペース: `space-1`, `space-2`
- 角丸: `radius.full`
- タイポ: `font.sans`, `font-size.xs`, `font-weight.medium`, `font-weight.semibold`

## 関連

- **Button (B-1)** — クリック操作が必要なラベルに
- **Link (B-4)** — 遷移するラベルに
- **ListItem (C-7)** — Badge を trailing に置く
