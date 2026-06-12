# Petal - 画像アップロード UI ドラッグ＆ドロップ対応 設計

対応タスク: TSK（Notion）「画像アップロードUI: ドラッグ＆ドロップ対応」  
親プロジェクト: PRJ-8「Petal 画像レイアウト・UIの充実」

## 1. スコープ

### 対象

- 画像管理ページ（`frontend/src/app/(authenticated)/images/page.tsx`）の `UploadModal` 内ファイル選択 UI を、**ドラッグ＆ドロップ**に対応させる。
- 既存のファイル選択（クリック → OS ダイアログ）も継続して利用可能にする（D&D ゾーン内のクリックで OS ダイアログを開く動線に統合）。
- 不正ファイル（許可外 MIME・サイズ超過・複数ファイル投下時の余剰）に対するクライアント側エラー表示。

### 非対象

- バックエンド API の変更（`POST /images` の入力契約・S3 署名付き URL の挙動は据え置き）。
- 画像一覧ページからの直接 D&D（モーダルを開かずに一覧へ落とす動線）。これは別タスク「画像一覧ページの実装（グリッド表示）」のスコープ。
- ファイル選択ボタンのデザイン刷新は別タスク「画像アップロードUI: ファイル選択ボタンの整備」で扱う。本タスクは「D&D 領域とその中に内包されるファイル選択リンク」までを範囲とする。
- 複数ファイルの同時アップロード（既存仕様どおり 1 枚ずつ）。投下されたファイルが複数あった場合は **先頭 1 件のみ**採用し、残りは無視（エラーは出さず helperText で「最初の 1 件を採用しました」を表示）。

## 2. 要件（Notion チケット）への対応

| 要件 | 実現方法 |
| ---- | -------- |
| ドラッグ＆ドロップでアップロード画像を選択できる | D&D 用 `<div>` に `onDragOver` / `onDragLeave` / `onDrop` を実装。`DataTransfer.files` から `File` を取得し、既存 `setFile` を呼ぶ |
| 既存のファイル選択もできる | D&D 領域内に「ファイルを選択」リンクを残し、クリックで隠した `<input type="file">` を起動 |
| ドラッグ中のホバー状態を視覚的にフィードバック | `isDragOver` ローカル state を持ち、true のときに枠線色・背景色をハイライト |
| 複数ファイル同時ドロップに対応 | 仕様上は 1 件のみ採用（上記非対象に明記）。`files[0]` を `setFile` し helperText 補足 |
| 画像以外のファイルが落とされた場合はエラー表示 | 既存 `isAllowedMime` / `MAX_IMAGE_SIZE_BYTES` のバリデーションをドロップ時にも適用し、`Alert` で表示 |

## 3. 既存設計との関係

- 上位設計 [12_image-management.md](12_image-management.md) — 画像アップロードのバックエンド契約・許可 MIME・サイズ上限はそのまま使用。
- 共有定数 [frontend/src/lib/image-constants.ts](../frontend/src/lib/image-constants.ts) — `ALLOWED_IMAGE_MIME_TYPES` / `MAX_IMAGE_SIZE_BYTES` を継続利用。
- design-system — `FormField`・`Alert`・`Button` を引き続き使用。D&D 領域は design-system のコンポーネントを増やさず、本ページ内のローカル要素として実装する（汎用化は需要が出てから）。

整合性に関わる新規 DB スキーマ／API 変更／トランザクション境界はなく、[00_rules.md §4](00_rules.md) の DB-外部 API 整合性ルールは本タスクでは適用対象外。

## 4. UI 仕様

### 4.1 D&D ゾーンの構造

`UploadModal` 内の `FormField label="ファイル"` の children を以下に置き換える:

```tsx
<div
  role="button"
  tabIndex={0}
  onClick={() => fileInputRef.current?.click()}
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fileInputRef.current?.click();
    }
  }}
  onDragOver={handleDragOver}
  onDragLeave={handleDragLeave}
  onDrop={handleDrop}
  className={dropZoneClassName(isDragOver, !!file)}
>
  <input
    ref={fileInputRef}
    type="file"
    accept={ALLOWED_IMAGE_MIME_TYPES.join(',')}
    onChange={(e) => handleFiles(e.target.files)}
    className="hidden"
  />
  {file ? (
    <div>
      <p className="text-sm">{file.name}</p>
      <p className="text-xs text-zinc-500">{formatSize(file.size)}</p>
    </div>
  ) : (
    <div className="text-center">
      <p className="text-sm">ここに画像をドラッグ＆ドロップ</p>
      <p className="text-xs text-zinc-500">またはクリックしてファイルを選択</p>
    </div>
  )}
</div>
```

### 4.2 視覚状態

| 状態 | スタイル要点 |
| ---- | ------------ |
| 通常 | 破線ボーダー（`border-dashed border-zinc-300`）、背景透明、十分なパディング（`py-8`） |
| ホバー（ドラッグ中） | ボーダー色を primary 系に切り替え、背景に淡色 `bg-blue-50` を入れる |
| ファイル選択済み | 実線ボーダー＋ファイル名・サイズ表示 |
| ドラッグ中＋選択済み | ホバー扱いを優先（差し替えを示唆） |

色トークンは Tailwind の既存ユーティリティを使用し、design-system のトークン定義の改修はしない。

### 4.3 アクセシビリティ

- D&D ゾーンに `role="button"` と `tabIndex={0}` を付与。Enter / Space でファイル選択ダイアログを起動。
- スクリーンリーダ向けに `aria-label="画像ファイルをドラッグ＆ドロップまたはクリックして選択"` を付与。

## 5. ロジック仕様

### 5.1 state

`UploadModal` 内に追加:

- `isDragOver: boolean`
- `fileInputRef: React.RefObject<HTMLInputElement>`

### 5.2 ハンドラ

```ts
function handleFiles(list: FileList | null) {
  setError(null);
  if (!list || list.length === 0) return;
  const picked = list[0];
  if (!isAllowedMime(picked.type)) {
    setError(`対応していないファイル形式です: ${picked.type || '不明'}（JPEG/PNG/GIF/WebP のみ）`);
    return;
  }
  if (picked.size > MAX_IMAGE_SIZE_BYTES) {
    setError(`ファイルサイズが上限 (${formatSize(MAX_IMAGE_SIZE_BYTES)}) を超えています`);
    return;
  }
  setFile(picked);
}

function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
  e.preventDefault();
  setIsDragOver(true);
}
function handleDragLeave(e: React.DragEvent<HTMLDivElement>) {
  e.preventDefault();
  setIsDragOver(false);
}
function handleDrop(e: React.DragEvent<HTMLDivElement>) {
  e.preventDefault();
  setIsDragOver(false);
  handleFiles(e.dataTransfer.files);
}
```

- 既存 `handleSubmit` 内のバリデーションは保険として残す（D&D 経由・通常入力経由ともに二重チェックされる）。

## 6. 完了条件

- [ ] `UploadModal` 内で画像ファイルをドロップするとプレビュー（ファイル名・サイズ）が表示され、`アップロード` ボタンで従来どおり S3 へ PUT される。
- [ ] ドラッグ中はゾーンの視覚スタイルがホバー状態に切り替わる（離脱・ドロップで解除）。
- [ ] D&D ゾーン内のクリック／Enter／Space で OS のファイル選択ダイアログが開く。
- [ ] 許可外 MIME（例: `application/pdf`）をドロップすると赤色 `Alert` でエラー表示される。
- [ ] サイズ上限超過ファイルをドロップするとエラー表示される。
- [ ] 複数ファイル同時ドロップ時、先頭ファイルのみが採用される。
- [ ] `pnpm --filter frontend build` が通る。

## 7. 手動動作確認シナリオ

1. 画像管理ページ（`/images`）で「画像をアップロード」を押し、モーダルを開く。
2. デスクトップから JPEG ファイルを D&D ゾーンへドラッグ → ホバー色に変化することを目視確認。
3. ドロップ → ファイル名・サイズが表示される。タイトル入力 → 「アップロード」→ 一覧に反映。
4. PDF をドロップ → エラー表示（許可外 MIME）。
5. 11 MiB の画像をドロップ → エラー表示（サイズ超過）。
6. JPEG 2 枚を同時にドロップ → 先頭の 1 枚のみ採用される。
7. D&D ゾーンを **クリック** → OS のファイル選択ダイアログが開く。Tab で D&D ゾーンにフォーカス → Enter でも開く。
8. 「キャンセル」でモーダルを閉じ、再度開いたとき初期状態に戻っている。
