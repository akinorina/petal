# Petal - 画像アップロード ファイル選択ボタン整備 設計

対応タスク: Notion「画像アップロードUI: ファイル選択ボタンの整備」  
親プロジェクト: PRJ-8「Petal 画像レイアウト・UIの充実」

## 1. スコープ

### 対象

- 画像管理ページ（`frontend/src/app/(authenticated)/images/page.tsx`）の `UploadModal` 内 D&D ゾーンに、**design-system の `Button`**（`variant="secondary"`）として「ファイルを選択」ボタンを明示的に配置する。
- ボタン押下で OS のファイル選択ダイアログを開き、選択結果は D&D 経由と同じ `handleFiles` パイプラインで処理する。
- ファイル選択済みの状態では「ファイルを変更」ボタンに変化し、再選択を促す。

### 非対象

- D&D 自体の挙動変更（ホバー色・複数ファイル時の挙動・MIME / サイズ検証）はそのまま。
- 画像一覧ページからの直接アップロード動線（別タスク）。
- design-system に新規コンポーネントを追加することはしない（既存 `Button` のみ使用）。

## 2. 背景

[docs/44_image-upload-drag-drop.md](44_image-upload-drag-drop.md) の D&D 実装では、外側 `<div>` 自体を `role="button"` として扱い「クリックでファイル選択ダイアログ起動」を兼用していた。これは以下の課題がある:

- ボタンであることが視覚的に弱く、ユーザーが「クリック可能」と気付きにくい。
- design-system の `Button` を経由しないため、フォーカススタイル・サイズ・色がアプリ標準と揃わない。
- D&D ゾーンとボタンを単一要素に圧縮することで、a11y セマンティクスが不正確（drop target なのに role="button"）。

本タスクは D&D 領域とボタンを意味的に分離し、design-system に準拠した押下可能なボタンを内包させる。

## 3. 既存設計との関係

- [docs/44_image-upload-drag-drop.md](44_image-upload-drag-drop.md) — D&D 実装。本タスクで「外側 `<div>` から `role="button"` / クリック・キーボードハンドラを除去」する形に更新。`handleFiles` パイプラインは流用。
- [docs/12_image-management.md](12_image-management.md) — バックエンド契約に変更なし。
- design-system `Button`（[frontend/src/design-system/components/Button/Button.tsx](../frontend/src/design-system/components/Button/Button.tsx)） — `variant="secondary"` / `size="md"` を使用。

DB / 外部 API / トランザクション境界の影響なし（[00_rules.md §4](00_rules.md) の対象外）。

## 4. UI 仕様

### 4.1 D&D ゾーン構造（更新後）

```tsx
<div
  onDragOver={handleDragOver}
  onDragLeave={handleDragLeave}
  onDrop={handleDrop}
  className={dropZoneClass}
>
  <input
    ref={fileInputRef}
    type="file"
    accept={ALLOWED_IMAGE_MIME_TYPES.join(',')}
    onChange={(e) => handleFiles(e.target.files)}
    className="hidden"
  />

  {file ? (
    <div className="flex flex-col items-center gap-2">
      <p className="text-sm font-medium">{file.name}</p>
      <p className="text-xs text-zinc-500">{formatSize(file.size)}</p>
      <Button type="button" variant="secondary" size="sm" onClick={openFileDialog}>
        ファイルを変更
      </Button>
      <p className="text-xs text-zinc-400">またはここに別の画像をドロップ</p>
    </div>
  ) : (
    <div className="flex flex-col items-center gap-3">
      <p className="text-sm">ここに画像をドラッグ＆ドロップ</p>
      <Button type="button" variant="secondary" size="sm" onClick={openFileDialog}>
        ファイルを選択
      </Button>
      <p className="text-xs text-zinc-500">JPEG / PNG / GIF / WebP（10 MiB まで）</p>
    </div>
  )}
</div>
```

### 4.2 主な差分（44 → 45）

| 項目 | 44 (現在) | 45 (本タスク) |
| ---- | --------- | ------------- |
| 外側 `<div>` の `role` | `"button"` | 無し（純粋な drop target） |
| 外側 `<div>` の `tabIndex` | `0` | 削除 |
| 外側 `<div>` の `onClick` / `onKeyDown` | あり（ファイル選択起動） | 削除 |
| 外側 `<div>` の `aria-label` | あり | 削除 |
| ファイル選択トリガ | div 全体クリック | 内包する design-system `Button` |
| `cursor-pointer` クラス | 外側 div に付与 | 削除（ボタンが pointer を持つ） |
| 「ファイルを変更」UI | ヘルパ文言のみ | 明示的な小ボタン |

### 4.3 アクセシビリティ

- `Button` がフォーカス可能要素を担保するため、Tab フォーカスは Button に到達する。Enter / Space は Button のネイティブ挙動で OS ダイアログを起動。
- D&D 機能はマウス操作に依存するため a11y 上の必須要件ではない（キーボードユーザーは Button 経由で同等の操作が可能）。

## 5. 完了条件

- [ ] `UploadModal` 内に design-system `Button` の「ファイルを選択」が表示される。
- [ ] ボタン押下で OS のファイル選択ダイアログが開く。
- [ ] 選択した画像は D&D 経由と同じ検証・state 更新を通る（既存 `handleFiles` を再利用）。
- [ ] ファイル選択後はボタンが「ファイルを変更」に切り替わり、再選択できる。
- [ ] 外側 `<div>` から `role="button"` / `tabIndex` / `onClick` / `onKeyDown` / `aria-label` が削除されている。
- [ ] D&D 自体（ホバー色・ドロップ受領・複数ファイル時の先頭採用）は従来どおり動作。
- [ ] `pnpm --filter frontend build` が通る。

## 6. 手動動作確認シナリオ

1. `/images` で「画像をアップロード」を押下 → モーダルを開く。
2. D&D ゾーン内に「ファイルを選択」ボタンが design-system スタイル（secondary）で表示されている。
3. ボタン押下 → OS のファイル選択ダイアログが開く。
4. JPEG を選択 → ファイル名・サイズが表示され、ボタンが「ファイルを変更」に切り替わる。
5. 「ファイルを変更」を押下 → 再度 OS のダイアログが開く。別画像で選択 → 表示が差し替わる。
6. D&D ゾーンへの画像ドロップが従来どおり動作する（ホバー色変化・先頭ファイル採用・エラー表示）。
7. Tab キーで Button にフォーカスが行き、Enter で OS ダイアログが開く。
