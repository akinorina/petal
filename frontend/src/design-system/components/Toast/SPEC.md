# Toast

画面の角に短時間表示される一時的な通知。**ToastProvider + useToast フック** で命令的に表示する。

## Alert との違い

[alert.md](alert.md) の表を参照。短時間の操作完了通知が Toast、永続的・状況解消まで残るものが Alert。

## セットアップ

アプリのルートに ToastProvider を 1 つ置く:

```tsx
import { ToastProvider } from 'design-system';

<ToastProvider position="top-right">
  <App />
</ToastProvider>
```

任意の子で:

```tsx
import { useToast } from 'design-system';

const Save = () => {
  const toast = useToast();
  return (
    <Button onClick={async () => {
      await save();
      toast.show({ title: '保存しました', variant: 'success' });
    }}>
      保存
    </Button>
  );
};
```

## API

### `<ToastProvider>` props

| prop | type | default | 説明 |
| --- | --- | --- | --- |
| `position` | 6 種 (`top/bottom` × `left/center/right`) | `'top-right'` | 配置 |
| `maxVisible` | `number` | `5` | 同時表示上限。超過時は古い順に削除 |

### `useToast()` 戻り値

| メソッド | 説明 |
| --- | --- |
| `show(options): id` | 表示。返り値の id で後から dismiss 可能 |
| `dismiss(id)` | 指定 Toast を閉じる |
| `dismissAll()` | 全 Toast を閉じる |

### `ToastOptions`

| field | type | default | 説明 |
| --- | --- | --- | --- |
| `id` | `string` | auto | カスタム ID (同じ ID で重複表示防止に使える) |
| `title` | `ReactNode` | — | 太字見出し |
| `description` | `ReactNode` | — | 本文 |
| `variant` | `'neutral' \| 'info' \| 'success' \| 'warning' \| 'danger'` | `'neutral'` | 左ボーダー色 |
| `duration` | `number` | `4000` (ms) | 自動消失までの ms。`Infinity` or `0` で手動閉じのみ |
| `action` | `ReactNode` | — | 右側のアクション (Undo Button 等) |

## アクセシビリティ

- viewport は portal 経由で `<body>` 直下にレンダー、`aria-live="polite"` + `aria-relevant="additions"`
- 個別 Toast の role:
  - `danger`: `role="alert"` + `aria-live="assertive"` (即座に読み上げ)
  - その他: `role="status"` + `aria-live="polite"` (現在の読み上げ後)
- **自動消失でも `閉じる` ボタンを常時提供** (スクリーンリーダーユーザー・hover でフォーカスしたユーザー向け)
- Esc キーで現在 focus 中の Toast を閉じる

## 使用ルール（Do / Don't）

### ✅ Do

- 操作の完了通知 (保存、送信、コピー、削除と Undo)
- 5 秒以内に読み終わる短文に
- 重要な情報は Toast **だけ** に置かない (見落とす可能性) → Inline でも表示

### ❌ Don't

- 大量の同時表示はしない (maxVisible で制限済み)
- リンクやフォームなど操作が必要なものを入れない → [Popover](popover.md) や [Dialog](dialog.md)
- エラーの詳細を Toast で長文表示しない → Alert に

## 使用するトークン

- 色: `surface.raised`, `border.subtle`, `text.primary`, `text.secondary`, `text.tertiary`, 各 feedback の `default`, `color-neutral-100`, `focus.ring`
- スペース: `space-2`, `space-3`, `space-4`
- 角丸: `radius.md`, `radius.sm`
- 影: `shadow.lg`
- タイポ: `font.sans`, `font-size.sm`, `font-weight.semibold`, `line-height.snug/normal`
- モーション: `duration.normal`, `duration.fast`, `easing.out` (reduced-motion で抑制)

## 関連

- **Alert (D-2)** — 永続表示の通知
- **Button (B-1)** — Undo 等のアクションに
