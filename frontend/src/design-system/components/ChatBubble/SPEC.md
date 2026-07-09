# ChatBubble

会話の 1 発言を表す**純表示**バブル。`variant` で配置（右/左）と配色（accent チント / ニュートラル面）を同時に決める。本文・添付・pending 表示などは children として渡す。

## 目的

- チャット UI の「自分の発言 / 相手の発言」の見た目を 1 プロップで統一する
- ドメイン中立（`sent` / `received`）に保ち、アプリのロール判定（user/assistant 等）から切り離す

## Anatomy

```text
<ChatBubble variant="sent">本文（プレーンテキスト・改行保持）</ChatBubble>
<ChatBubble variant="received">
  <MarkdownContent ... />   // リッチ内容も children で置ける
</ChatBubble>
```

- ルート: flex コンテナ（`sent`→右寄せ / `received`→左寄せ）
- バブル本体: `max-width: 80%` の角丸ボックス

## Variants

| variant | 配置 | 配色 | 用途 |
| --- | --- | --- | --- |
| `sent` | 右寄せ | `accent-subtle-bg` / `accent-subtle-fg`、`white-space: pre-wrap` | 自分の発言（プレーンテキスト前提） |
| `received` | 左寄せ | `surface-sunken` / `text-primary` | 相手の発言（リッチ内容想定） |

## Props

| prop | type | default | 説明 |
| --- | --- | --- | --- |
| `variant` | `'sent' \| 'received'` | （必須） | 配置と配色を決める |
| `children` | `ReactNode` | — | 本文・添付・pending 表示など |

`HTMLAttributes<HTMLDivElement>` を継承（`className` などをルートへ透過）。

## 使用ルール（Do / Don't）

### ✅ Do

- アプリのロールを `variant={isUser ? 'sent' : 'received'}` へマッピングする
- 添付や pending インジケータは children としてバブル内に置く

### ❌ Don't

- 配置と配色を別々のプロップに分けない（右=accent の統一ルールを崩さない）
- 生カラーで配色を上書きしない

## アクセシビリティ

- 純表示のため role は付けない。会話リスト側で意味付け（見出し・時系列）を担う

## 使用するトークン

- 配色: `accent-subtle-bg`, `accent-subtle-fg`, `surface-sunken`, `text-primary`
- 余白: `space.2`, `space.4`
- 角丸: `radius.xl`
- 文字: `font-size.sm`, `font.sans`

## 関連

- **ChatComposer** — 会話の入力欄
- **Card** — 汎用のコンテンツ容器
