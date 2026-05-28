# Alert / Banner

ページ / セクション内に**永続表示**する通知。一時的なものは [Toast](toast.md) を使う。

## Toast との違い

| | Alert | Toast |
| --- | --- | --- |
| **配置** | ページ内 (flow に含まれる) | 画面の角 (overlay) |
| **継続** | 永続 (手動で閉じるか、状況解消まで) | 自動消失 (デフォルト 4 秒) |
| **典型例** | 入力エラー、未認証警告、メンテ告知 | 保存完了、送信エラー |
| **アクション** | 任意 (主アクション併設) | 任意 (Undo 等) |
| **A11y role** | `status` (通常) / `alert` (緊急時 / danger) | `status` (assertive は danger) |

## Anatomy

```text
[icon]  [title]               [action]  [×]
        [body (children)]
```

## Props

| prop | type | default | 説明 |
| --- | --- | --- | --- |
| `variant` | `'info' \| 'success' \| 'warning' \| 'danger'` | `'info'` | 配色 + デフォルトアイコン |
| `tone` | `'subtle' \| 'solid'` | `'subtle'` | subtle = `*-subtle-bg` + 左ボーダー、solid = 飽和色 |
| `title` | `ReactNode` | — | 太字見出し |
| `children` | `ReactNode` | — | 本文 |
| `action` | `ReactNode` | — | 右側のアクション (Button 等) |
| `isClosable` | `boolean` | `false` | × ボタン表示 |
| `onClose` | `() => void` | — | × クリック時 |
| `icon` | `ReactNode \| false` | variant のデフォルト | カスタムまたは非表示 |
| `isUrgent` | `boolean` | `false` | true / `variant="danger"` で role=`alert` + `aria-live="assertive"` |

## Variants

| variant | デフォルト用途 | 色 |
| --- | --- | --- |
| `info` | お知らせ・ヒント・進捗 | info-subtle / info-default |
| `success` | 成功・完了 | success-subtle / success-default |
| `warning` | 注意・期限切れ予告 | warning-subtle / warning-default |
| `danger` | エラー・障害・データ損失リスク | danger-subtle / danger-default |

## アクセシビリティ

- **role**: 通常 `status` (polite)、`isUrgent=true` または `variant="danger"` で `alert` (assertive)
- アイコンは装飾扱い (`aria-hidden`)、意味は title / body で伝える
- × の `aria-label="閉じる"` を自動付与
- `focus-visible` 時のみ outline 表示

## 使用ルール（Do / Don't）

### ✅ Do

- 状況が解消されるまで残すべき通知に使う (未認証、未保存、メンテ告知)
- 1 ページに 1〜2 個まで (多すぎると注意の効力が薄れる)
- danger の場合は具体的な解決策を併記する (Approachable 原則)

### ❌ Don't

- 短時間の操作完了通知に使わない → [Toast](toast.md)
- ページ内に同一の Alert を複数並べない (要約してまとめる)
- solid + danger を多用しない (緊急時のみに留める)

## 使用するトークン

- 色: 各 feedback の `default` / `subtle.bg` / `subtle.fg`, `surface.raised`, `text.primary`, `focus.ring`
- スペース: `space-3`, `space-4`
- 角丸: `radius.md`, `radius.sm`
- タイポ: `font.sans`, `font-size.sm`, `font-weight.semibold`, `line-height.snug/normal`
- モーション: `duration.fast`, `easing.out`

## 関連

- **Toast (D-1)** — 一時的通知
- **Dialog (D-3)** — ユーザーの明示的なアクションが必要な確認
- **EmptyState (D-7)** — 「データなし」「エラー」状態の全画面表示
