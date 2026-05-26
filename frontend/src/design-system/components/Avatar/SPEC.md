# Avatar / AvatarGroup

ユーザー識別の Molecule。画像があれば画像、なければ名前のイニシャル、それもなければ汎用アイコンへとフォールバックする。

## 目的

- ユーザー / メンバー / 著者の視覚的識別
- リスト / コメント / カードのヘッダー
- 共同編集中のメンバー表示（`AvatarGroup`）

## Anatomy

```
<Avatar>          → 単独表示
<AvatarGroup>     → 複数を重ね合わせ、残りは +N
  <Avatar />
  <Avatar />
</AvatarGroup>
```

優先順位（フォールバック）:

1. `src` が指定され、画像が読み込めた → 画像
2. `fallback` が指定 → そのノード（アイコン等）
3. `name` から **イニシャル** を算出（色も name から決定的に選ぶ）
4. 何もなければ汎用ユーザーアイコン

## Avatar Props

| prop | type | default | 説明 |
| --- | --- | --- | --- |
| `src` | `string` | — | 画像 URL。`onError` で自動フォールバック |
| `alt` | `string` | `name` または `''` | 画像 alt。装飾用途なら明示的に `""` |
| `name` | `string` | — | イニシャル算出 + 色決定 |
| `fallback` | `ReactNode` | — | name から算出する代わりに直接ノードを表示 |
| `size` | `'xs'(24) \| 'sm'(32) \| 'md'(40) \| 'lg'(48) \| 'xl'(64)` | `'md'` | px |
| `shape` | `'circle' \| 'rounded'` | `'circle'` | rounded は `radius.md` |

## AvatarGroup Props

| prop | type | default | 説明 |
| --- | --- | --- | --- |
| `children` | `ReactNode` | — | Avatar 群 |
| `max` | `number` | — | 表示数。超過分は `+N` Avatar として表示 |
| `size` | `AvatarSize` | — | 全 Avatar にサイズを強制適用 |

各 Avatar は重なり合い (`margin-left: -8px`)、白枠 (`surface-raised`) で境界を作る。

## イニシャル / 色のルール

- 1 単語（"Tanaka"）→ 最初の 2 文字（"TA"）を大文字
- 2 単語以上（"Akinori Nakata"）→ 各単語の頭文字（"AN"）を大文字
- 色は `name` のハッシュから 6 色のパレットを決定的に選択（同じ名前 → 同じ色）。配色は warm neutral + feedback subtle 系で、ブランド調和を維持

## 使用ルール（Do / Don't）

### ✅ Do

- 画像 URL を渡す場合は `alt` も渡す（装飾なら `alt=""`）
- リストや行内に複数並べるなら `AvatarGroup` で重ね、`max` で省略
- ListItem の `leading` として使うと UI が引き締まる

### ❌ Don't

- Avatar 単体をクリック可能にしない（必要なら親要素を `<button>` に）
- 名前のないユーザーで色を意図的に選ばない（汎用アイコンを使う）
- AvatarGroup の中に Avatar 以外を入れない（重ね合わせ計算が崩れる）

## アクセシビリティ

- 画像 Avatar: `alt` 必須（装飾扱いなら `alt=""` を**明示**して SR にスキップさせる）
- イニシャル表示: 自動で `aria-label`（`alt ?? name`）を付与
- フォールバックアイコン（無名）: `aria-hidden="true"`
- AvatarGroup の "+N" にも `alt="他 N 人"` 付与

## 使用するトークン

- 色: `surface.raised`, `color-neutral-200`, `color-neutral-700`, `color-coral-100/700`, `color-success-50/700`, `color-info-50/700`, `color-warning-50/700`, `color-danger-50/700`, `text.primary`
- 角丸: `radius.md`（rounded shape）
- タイポ: `font.sans`, `font-size.xs/sm/base/lg`, `font-weight.semibold`

## 関連

- **ListItem (C-7)** — leading として Avatar を置く
- **Tag (C-8)** — メタ情報を Avatar 横に並べる
