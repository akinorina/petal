# Petal - 端末カメラからの画像アップロード 設計

対応プロジェクト: PRJ-9「Petal 端末のカメラからの画像アップロード機能実装」

## 1. スコープ

### 対象

- `UploadModal`（`frontend/src/app/(authenticated)/images/page.tsx`）に「カメラで撮影」ボタンを追加し、OS 標準カメラを起動してそのまま画像をアップロードできるようにする。
- 撮影・ファイル選択双方に適用するアップロード前処理（EXIF Orientation 補正・リサイズ・圧縮）を共通ユーティリティとして実装する。
- 前処理後の Blob を既存アップロード API（`POST /images`）に送信し、成功後の遷移を既存と統一する。

### 非対象

- PWA 化（Service Worker・manifest は PRJ-10 スコープ）
- `getUserMedia` によるアプリ内カメラプレビュー・シャッター UI
- 動画撮影、連続撮影、複数枚同時アップロード
- フィルタ・トリミング・手動回転などの撮影後編集 UI（EXIF 自動補正のみ）
- バックエンド API の変更（`POST /images` 契約はそのまま）

## 2. 既存設計との関係

- [docs/44_image-upload-drag-drop.md](44_image-upload-drag-drop.md) — D&D の `handleFiles` パイプラインを本タスクの前処理後にも再利用する。
- [docs/45_image-upload-file-select-button.md](45_image-upload-file-select-button.md) — 「ファイルを選択」ボタンと「カメラで撮影」ボタンを並列配置する UI に更新する。
- [docs/12_image-management.md](12_image-management.md) — バックエンド契約（許可 MIME・サイズ上限）に変更なし。
- `frontend/src/lib/image-constants.ts` — `validateImageFile` / `ALLOWED_IMAGE_MIME_TYPES` / `MAX_IMAGE_SIZE_BYTES` を引き続き使用。前処理後のファイルも同バリデーションを通す。

DB スキーマ・API 仕様・トランザクション境界に変更なし（[00_rules.md §4](00_rules.md) の対象外）。

## 3. 実装設計

### 3.1 カメラ起動 input の追加

`UploadModal` 内に既存の `<input type="file">` と並べて、カメラ専用の `<input>` を隠し要素として追加する。

```tsx
// カメラ専用 input（カメラで撮影ボタンから発火）
<input
  ref={cameraInputRef}
  type="file"
  accept="image/*"
  capture="environment"
  onChange={(e) => handleFilesWithProcess(e.target.files)}
  className="hidden"
/>
```

- `capture="environment"` で背面カメラを初期に指定（PC ブラウザでは無視され、通常のファイル選択ダイアログが開く = 自動フォールバック）。
- `accept="image/*"` は既存バリデーションと整合させる。

### 3.2 UI 配置（UploadModal）

ファイル未選択状態の D&D ゾーン内に「ファイルを選択」と「カメラで撮影」を横並びに配置する。

```text
[ ここに画像をドラッグ＆ドロップ ]
[ ファイルを選択 ]  [ カメラで撮影 ]
JPEG / PNG / GIF / WebP（10 MiB まで）
```

ファイル選択済み状態では「ファイルを変更」「カメラで再撮影」に切り替える（既存の「ファイルを変更」ボタンと対称）。

### 3.3 アップロード前処理ユーティリティ

新規ファイル `frontend/src/lib/image-process.ts` を作成する。

```ts
processImageFile(file: File): Promise<File>
```

処理内容:

1. **EXIF Orientation 補正**
   - `FileReader` で ArrayBuffer として読み込み、EXIF バイナリを手動解析して Orientation タグ（0x0112）を取得する。
   - `canvas` に描画時に Orientation に応じた `ctx.transform()` を適用して正立方向に矯正する。
   - iOS Safari で横向き撮影した JPEG が正しく表示されない問題を解消する。
   - EXIF が存在しない・Orientation が 1（無補正）の場合はそのまま処理を続行する。

2. **リサイズ**
   - 長辺が `MAX_UPLOAD_LONG_EDGE`（= 2048 px）を超える場合、アスペクト比を保ったまま縮小する。
   - 長辺が 2048 px 以下の場合はリサイズしない。

3. **圧縮・再エンコード**
   - `canvas.toBlob({ type: 'image/jpeg', quality: UPLOAD_JPEG_QUALITY })` で再エンコードする。
   - `UPLOAD_JPEG_QUALITY` = 0.85。
   - 元ファイルが PNG / GIF / WebP の場合も JPEG に変換する（既存バリデーションの `mimeType` は処理後のものを使用）。

4. **返却**
   - 処理後の Blob を `new File([blob], filename, { type: 'image/jpeg' })` として返す。
   - 処理後ファイルサイズが `MAX_IMAGE_SIZE_BYTES` を超える場合は `throw` せず、後続の `validateImageFile` に委ねる。

定数は `image-constants.ts` に追記する:

```ts
export const MAX_UPLOAD_LONG_EDGE = 2048;
export const UPLOAD_JPEG_QUALITY = 0.85;
```

### 3.4 handleFiles パイプラインの変更

既存の `handleFiles(list: FileList | null)` を非同期化し、前処理を挟む。

```ts
async function handleFilesWithProcess(list: FileList | null) {
  setError(null);
  if (!list || list.length === 0) return;
  // 1. MIME / サイズ事前バリデーション（変換前）
  const pre = validateImageFile(list[0]);
  if (!pre.ok) { setError(pre.message); return; }
  // 2. 前処理（EXIF 補正・リサイズ・圧縮）
  const processed = await processImageFile(pre.file);
  // 3. 変換後バリデーション（サイズ上限チェック）
  const post = validateImageFile(processed);
  if (!post.ok) { setError(post.message); return; }
  setFile(post.file);
}
```

D&D (`handleDrop`) / ファイル選択 / カメラ撮影のすべてが `handleFilesWithProcess` を経由する。

既存の `handleFiles` 関数（同期版）は削除してよい。ページレベルの D&D（`handlePageDrop` in `use-images-page.ts`）はモーダルを開く経路のため前処理不要（モーダル内で処理する）。

### 3.5 アップロード送信

`handleSubmit` での `onUpload` 呼び出し時に渡す `mimeType` を処理後の `'image/jpeg'` とする。タイトル・説明フィールド・成功後遷移は変更なし。

## 4. ファイル変更一覧

| ファイル | 変更内容 |
| --- | --- |
| `frontend/src/lib/image-process.ts` | **新規追加**。`processImageFile` 関数 |
| `frontend/src/lib/image-constants.ts` | `MAX_UPLOAD_LONG_EDGE` / `UPLOAD_JPEG_QUALITY` 定数を追加 |
| `frontend/src/app/(authenticated)/images/page.tsx` | `UploadModal` に cameraInputRef・「カメラで撮影」ボタン追加、`handleFilesWithProcess` に変更 |

バックエンド / migrations / `.env.example` の変更なし。

## 5. デバイス・ブラウザ別の動作

| 環境 | 動作 |
| --- | --- |
| iOS Safari | 「カメラで撮影」押下で OS 標準カメラ（背面）が起動。撮影後に前処理が走りアップロード |
| Android Chrome | 「カメラで撮影」押下でカメラアプリが起動（または「カメラ」「ギャラリー」選択ダイアログ） |
| macOS / Windows Chrome | `capture` 属性が無視され、通常のファイル選択ダイアログが開く（自動フォールバック） |
| カメラ非搭載 / 権限拒否 | ブラウザ標準のエラー挙動に委ねる（独自エラーモーダルなし） |

## 6. 完了条件

- [ ] スマートフォン（iOS Safari / Android Chrome）で「カメラで撮影」ボタンから OS 標準カメラが起動し、撮影画像がアップロードされる。
- [ ] PC ブラウザ（macOS / Windows）で「カメラで撮影」を押すとファイル選択ダイアログが開き、Web カメラ画像または通常ファイルをアップロードできる。
- [ ] iOS 撮影画像の向きが正しく表示される（EXIF Orientation 補正済み）。
- [ ] アップロード後の遷移・一覧表示が既存のファイル選択アップロードと同一である。
- [ ] 既存のファイル選択 / D&D アップロード機能にデグレが発生していない。
- [ ] `pnpm --filter frontend build` が通る。

## 7. 手動動作確認シナリオ

1. `/images` で「画像をアップロード」ボタンを押下 → モーダルを開く。
2. D&D ゾーン内に「ファイルを選択」と「カメラで撮影」の 2 ボタンが表示されている。
3. **スマートフォン（iOS Safari）**: 「カメラで撮影」を押下 → OS 標準カメラが起動 → 撮影 → 横向き画像が正立で表示される → アップロード成功 → 一覧の 1 ページ目に表示される。
4. **スマートフォン（Android Chrome）**: 「カメラで撮影」を押下 → カメラアプリ（またはカメラ/ギャラリー選択）起動 → 撮影 → アップロード成功。
5. **PC ブラウザ**: 「カメラで撮影」を押下 → ファイル選択ダイアログが開く → 画像を選択 → アップロード成功。
6. 「ファイルを選択」ボタン・D&D での既存フローが従来どおり動作する。
7. 不正ファイル（PDF 等）を投下 → エラー表示される。
