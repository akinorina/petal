# EmptyState

データがない / 検索結果がない / エラーが発生した、といった状況を**説明し、次のアクションを促す**コンポーネント。

## 設計指針 (Approachable 原則)

「データがありません」だけで終わらせない。常に **次にすべき何か** をユーザーに示す。

- ✅ "まだメモがありません。最初のメモを書いて、思考の整理をはじめましょう。" + [新規メモを作成]
- ❌ "メモがありません。" だけ

## Anatomy

```text
[illustration: icon または画像]
[title]
[description]
[primaryAction] [secondaryAction]
```

## Props

| prop | type | default | 説明 |
| --- | --- | --- | --- |
| `title` | `ReactNode` | — | **必須**。状況の見出し |
| `description` | `ReactNode` | — | 説明文。max 44ch で折返し |
| `illustration` | `ReactNode` | — | アイコン / イラスト（`aria-hidden`） |
| `primaryAction` | `ReactNode` | — | 主アクション（次の一歩） |
| `secondaryAction` | `ReactNode` | — | 副アクション（代替手段） |
| `size` | `'sm' \| 'md' \| 'lg'` | `'md'` | パディング / フォントサイズ |

## 文言ガイド (Approachable 原則)

| 状況 | ❌ | ✅ |
| --- | --- | --- |
| データなし | データなし | まだメモがありません |
| 検索なし | 結果なし | 「xxx」に一致する結果が見つかりませんでした |
| エラー | エラーが発生しました | 一時的な接続エラーが発生しました。もう一度お試しください |

- **具体的に**: 何が起きているかを述べる
- **親切に**: 何ができるかを案内する
- **責めない**: ユーザーの操作を否定しない（"無効な入力" より "正しい形式は…"）

## 使用ルール（Do / Don't）

### ✅ Do

- 必ず CTA（次のアクション）を提供する
- Card や Section の中に配置し、画面全体に余白を取る
- description は 1〜2 文に収める

### ❌ Don't

- "—" や "No data" だけで終わらせない
- 装飾だけのために illustration を入れない（意味のあるアイコンに）
- 主アクションを 2 つ以上並べない（迷わせる）

## アクセシビリティ

- ルート要素に `role="status"` を付与（SR が状況を読み上げる）
- `illustration` は装飾扱い (`aria-hidden`)。意味は title + description で伝える
- CTA ボタンは [Button](button.md) を使い、focus / キーボード操作を保証

## 使用するトークン

- 色: `text.primary`, `text.secondary`, `text.tertiary`
- スペース: `space-1`, `space-2`, `space-3`, `space-4`, `space-5`, `space-6`, `space-8`, `space-10`
- タイポ: `font.sans`, `font-size.base/lg/xl/sm`, `font-weight.semibold`, `line-height.snug/relaxed`

## 関連

- **Card (C-6)** — EmptyState を内包する
- **Skeleton (D-6)** — ローディング中の表示（empty とは別状況）
- **Button (B-1)** — CTA
