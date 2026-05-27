# Petal - 画像詳細ページの実装 設計

対応タスク: Notion「画像詳細ページの実装」  
親プロジェクト: PRJ-8「Petal 画像レイアウト・UIの充実」

## 1. スコープ

### 対象

- 画像詳細ページ `/images/[id]`（`frontend/src/app/(admin)/images/[id]/page.tsx`）を、PRJ-8 で整えた design-system 規約に揃えて再構成する。
- 既存実装にあった以下の課題を解消する:
  - メタ情報セクションが `<dl>/<dt>/<dd>` 手書きで、他ページ（`Card` + `FormField`）と統一感がない
  - 削除確認に **ブラウザネイティブ `confirm()`** を使っている（一覧ページは design-system `Dialog`）
  - `formatSize` がページ内に再定義されている（`lib/image-constants.ts` の `formatImageSize` を再利用すべき）
  - メタ情報の縦ラベル＋値レイアウトのため、一覧ページに比べてスペース利用効率が劣る
- 画像本体は引き続き大きく表示し、ダウンロード／削除動線を分かりやすく配置する。
- 一覧ページへの戻り導線（`← 一覧に戻る`）は維持。

### 非対象

- メタ情報の **編集 UI**（タイトル・説明の編集 API は別タスクで検討。本タスクは閲覧専用）。
- 画像のフルスクリーンビューワ／拡大縮小・前後画像ナビゲーション。
- バックエンドの API 追加・変更。
- design-system への新規コンポーネント追加。

## 2. 既存設計との関係

- [docs/12_image-management.md](12_image-management.md) — `GET /images/:id` / `GET /images/:id/download-url` / `DELETE /images/:id` を使用。API 契約は無変更。
- [docs/47_image-list-grid.md](47_image-list-grid.md) — 一覧ページでサムネイル化済み。詳細ページはサムネイル → 大画像表示への遷移先。
- `frontend/src/lib/image-constants.ts` — `formatImageSize` ヘルパを再利用。重複ロジック削除。
- design-system `Card` / `FormField` / `Dialog` / `Button` / `Alert` を利用。
- DB / 外部 API / トランザクション境界の影響なし（[00_rules.md §4](00_rules.md) 対象外）。

## 3. UI 仕様

### 3.1 ページ構造（変更後）

```text
┌──────────────────────────────────────────────────────────┐
│ ← 一覧に戻る                          [ダウンロード] [削除] │
├──────────────────────────────────────────────────────────┤
│ (Alert: error があれば)                                   │
├──────────────────────────────────────────────────────────┤
│   ┌──────────────────────────────────────┐                │
│   │                                      │                │
│   │            <img preview>             │  ← Card 内に    │
│   │      (max-h: 70vh, object-contain)   │     中央配置     │
│   │                                      │                │
│   └──────────────────────────────────────┘                │
├──────────────────────────────────────────────────────────┤
│ ┌─ Card (詳細情報) ─────────────────────────────────────┐ │
│ │  [FormField: タイトル]      [FormField: ファイル名]    │ │
│ │  [FormField: 形式]          [FormField: サイズ]        │ │
│ │  [FormField: アップロード日時][FormField: 更新日時]    │ │
│ │  [FormField: 説明]                       (full width)  │ │
│ └────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

### 3.2 画像プレビュー

- 親 `Card`（`padding="none"`、`bg-zinc-50`）の中央に `<img>` を配置。
- `max-h-[70vh] w-auto mx-auto`、`object-contain` で**画像のアスペクト比を維持**したまま縦長・横長どちらも安全に収まるようにする（現状の `60vh` から `70vh` に拡大）。
- 読み込み中は背景色のみの状態を許容（スケルトン UI は非対象。プレビュー URL 取得は親フックが完了してから render するため）。

### 3.3 メタ情報セクション

`<dl>` を廃止し、**`FormField` ベースの 2 カラム grid** に置き換える:

```tsx
<Card padding="md">
  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
    <FormField label="タイトル">
      <ReadonlyText value={image.title || '—'} />
    </FormField>
    <FormField label="ファイル名">
      <ReadonlyText value={image.originalFilename} />
    </FormField>
    <FormField label="形式">
      <ReadonlyText value={image.mimeType} />
    </FormField>
    <FormField label="サイズ">
      <ReadonlyText value={formatImageSize(image.sizeBytes)} />
    </FormField>
    <FormField label="アップロード日時">
      <ReadonlyText value={formatDateTime(image.createdAt)} />
    </FormField>
    <FormField label="更新日時">
      <ReadonlyText value={formatDateTime(image.updatedAt)} />
    </FormField>
    <div className="sm:col-span-2">
      <FormField label="説明">
        <ReadonlyText value={image.description || '—'} multiline />
      </FormField>
    </div>
  </div>
</Card>
```

- `ReadonlyText` はページローカルの小コンポーネント（design-system に追加しない）。
  - `text-sm whitespace-pre-wrap break-words` のみのスタイル。
  - `multiline` 指定時は `min-h` を持たせて空白でも視覚的に存在感を保つ。
- 日時は新規ヘルパ `formatDateTime` でローカル化（`toLocaleString('ja-JP', { dateStyle: 'medium', timeStyle: 'short' })`）。ページローカル定数で十分。

### 3.4 削除確認

- 既存の `window.confirm` を廃止し、一覧ページと同じ design-system `Dialog` ベースの `ConfirmModal` を詳細ページにも置く。
- 「削除」ボタン押下で `isConfirmingDelete: true` に。Dialog 内「削除する」で実削除、「キャンセル」で閉じる。

### 3.5 ダウンロード

- 現行どおり `window.open(url, '_blank', 'noopener')` で署名付き URL を開く。挙動変更なし。

### 3.6 エラー表示

- `error && !image`: 既存どおりページ全体エラー（戻るリンク + Alert）。
- `image` 取得済みで操作中エラー: 上部に `Alert variant="danger"` を出す（変更なし）。

## 4. ロジック仕様

### 4.1 ページフック `use-image-detail-page.ts` の変更

- `isConfirmingDelete: boolean` state と `setIsConfirmingDelete` を追加。
- `requestDelete()` を追加: モーダルを開くだけ。
- 既存 `handleDelete` を `confirmDelete()` にリネームし、ネイティブ `confirm()` を削除（モーダル経由で呼ばれる前提）。

### 4.2 削除後の挙動

- 削除成功 → `router.push('/images')`。一覧ページに戻る（既存挙動維持）。

### 4.3 重複ロジックの除去

- ページ内の `formatSize` を削除し、`@/lib/image-constants` の `formatImageSize` を import。
- `formatDateTime` をページローカルに定義（用途が詳細ページ限定のため、共通化は不要）。

## 5. 完了条件

- [ ] `/images/[id]` で画像が `max-h-[70vh]` の Card 内に中央配置で表示される。
- [ ] メタ情報が `Card` + `FormField` ベースの 2 カラム grid（説明だけフル幅）で表示される。
- [ ] 「削除」押下で design-system `Dialog` の確認モーダルが開き、「削除する」で削除→一覧に戻る。
- [ ] 「ダウンロード」で署名付き URL が新規タブで開く。
- [ ] ページ内 `formatSize` の重複定義が削除され、`formatImageSize` が再利用されている。
- [ ] エラー時の戻る導線とエラー表示が動作する。
- [ ] `pnpm --filter frontend build` が通る。

## 6. 手動動作確認シナリオ

1. `/images` で任意のサムネイルをクリック → `/images/[id]` が開き、画像が大きく中央表示される。縦長・横長どちらも崩れない。
2. メタ情報が 2 カラムで `FormField` ラベル付き表示。タイトル・説明が空のレコードは「—」が表示される。
3. 「ダウンロード」押下 → 新規タブで画像が開く。
4. 「削除」押下 → design-system Dialog が開く。「キャンセル」で閉じる、「削除する」で削除して `/images` に戻る。
5. 削除直後の一覧ページで該当画像が消えている。
6. 無効な ID の URL（例: `/images/00000000-0000-0000-0000-000000000000`）→ ページ全体エラー（404 メッセージ）+ 「← 一覧に戻る」リンクが表示される。
