# Petal - 画像一覧ページ グリッド表示 設計

対応タスク: Notion「画像一覧ページの実装（グリッド表示）」  
親プロジェクト: PRJ-8「Petal 画像レイアウト・UIの充実」

## 1. スコープ

### 対象

- 画像管理ページ `/images`（`frontend/src/app/(authenticated)/images/page.tsx`）を、テキストカード中心の現行表示から **サムネイル中心のグリッド表示** に刷新する。
- 各サムネイルは `GET /images/:id/download-url`（既存）が返す署名付き URL を `<img>` の `src` に使って表示する。
- 1 ページあたり **12 件**（3 列 × 4 行）を表示し、design-system `Pagination`（`variant="numbered"`）でページ送りする（クライアントサイドページング）。
- 画像 0 件時は既存 `EmptyState` を維持。
- **一覧ページ上に直接ドラッグ＆ドロップ**するとアップロードモーダルがファイル付きで開く動線を追加する（前タスクの非対象だった "list-page direct D&D" を本タスクで実装）。
- アップロード成功時は再読込し、新規画像が表示される **1 ページ目**へ自動遷移する（一覧は作成日時降順のため新規は先頭に来る）。

### 非対象

- 画像詳細ページの刷新（次タスク「画像詳細ページの実装」）。
- バックエンドの一覧 API のページング化（クライアントサイドで完結。将来サーバページングが必要になったら別タスクで `findAll` に `page`/`limit` を追加）。
- サムネイル専用エンドポイントや S3 リサイズ（画像本体をそのまま表示。将来パフォーマンス課題が出たら別タスク）。
- ソート・絞り込み UI。
- 無限スクロール（Pagination 採用のため不要）。

## 2. 既存設計との関係

- [docs/12_image-management.md](12_image-management.md) — バックエンド契約（`GET /images` 一覧、`GET /images/:id/download-url`）。本タスクで変更なし。
- [docs/44_image-upload-drag-drop.md](44_image-upload-drag-drop.md) — `UploadModal` 内 D&D。本タスクの一覧ページ全体 D&D とは別領域。両者は競合せず（モーダルが開いていれば一覧の D&D は背面）。
- [docs/45_image-upload-file-select-button.md](45_image-upload-file-select-button.md) — モーダル内ファイル選択ボタン。`UploadModal` に `initialFile?: File` プロパティを追加する点で本タスクで小改修。
- [docs/46_default-page-images.md](46_default-page-images.md) — `/images` がデフォルトページ。本タスクで初期表示の品質を引き上げる。
- DB / 外部 API / トランザクション境界の影響なし（[00_rules.md §4](00_rules.md) 対象外）。

## 3. UI 仕様

### 3.1 ページ全体構造

```text
┌─────────────────────────────────────────────────────────────┐
│ 画像管理                                 [画像をアップロード] │
├─────────────────────────────────────────────────────────────┤
│ (Alert: error があれば表示)                                  │
├─────────────────────────────────────────────────────────────┤
│ [DropZoneOverlay] ─ ドラッグ中のみ前面に visible            │
│                                                              │
│  ┌──Thumb──┐  ┌──Thumb──┐  ┌──Thumb──┐                       │
│  │ <img>   │  │ <img>   │  │ <img>   │  ← 3 列グリッド       │
│  │  title  │  │  title  │  │  title  │                       │
│  └─────────┘  └─────────┘  └─────────┘                       │
│   …（最大 12 件）                                            │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│            ‹ 1 2 [3] 4 5 ›   ← Pagination (numbered)         │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 サムネイルカード（`<ImageThumbnail>`）

- 1:1 の正方形コンテナに `<img>` を `object-fit: cover` で表示。
- 画像クリックで `/images/[id]` 詳細ページへ遷移（`<NextLink>` で全体をラップ）。
- 画像下部にタイトル（`image.title || image.originalFilename`）。長すぎる場合は 2 行で truncate。
- 右上に小さな「削除」アイコンボタン（既存仕様維持）。クリック伝播は止めて削除モーダルを開く。
- 署名付き URL 取得中: スケルトン背景（`bg-zinc-100 animate-pulse`）。
- 署名付き URL 取得失敗: 「読み込み失敗」テキストを中央に表示。再読込ボタンを置く（`refetch` 経由）。

### 3.3 ページネーション

- `variant="numbered"`、`size="md"`。
- 表示: 「全 N 件中 X〜Y 件」テキスト（任意・design-system 範囲外）はスコープ外。Pagination ボタンのみ。
- ページ送りで `currentPage` を変更。グリッドは現在ページの 12 件のみ render。
- 件数が `pageSize` 以下の場合は Pagination を非表示。

### 3.4 一覧ページ全体 D&D

- ページコンポーネントの最外側に `onDragEnter` / `onDragOver` / `onDragLeave` / `onDrop` を持たせる。
- ドラッグ中は半透明オーバーレイ（`fixed inset-0`）に「ここに画像をドロップしてアップロード」を表示。
- ドロップ時:
  1. 先頭ファイルを取り出す。
  2. MIME / サイズ検証（既存 `handleFiles` のロジックをページフックに移送 or 共通ヘルパに切り出し）。
  3. 検証 OK → `setModal({ type: 'upload', initialFile: file })` でモーダルを開く。
  4. 検証 NG → `setError(...)` でページ上部にエラーを表示。
- モーダル側は `initialFile` があれば `useState<File | null>(initialFile ?? null)` で初期化。

### 3.5 アップロード後の挙動

- `useImagesApi.upload` は既存どおり `reload()` で一覧を更新。
- 一覧は作成日時降順（バックエンドの `(owner_user_id, created_at DESC)` インデックス順）で返るため、新規画像は配列の先頭に挿入される。
- ページ位置補正: アップロード成功時は `setCurrentPage(1)` を呼び **1 ページ目** に戻す。ユーザーは投稿直後の画像をすぐ確認できる。

## 4. ロジック仕様

### 4.1 ページフック `use-images-page.ts` の変更

新規 state:

```ts
const [currentPage, setCurrentPage] = useState(1);
const [isPageDragOver, setIsPageDragOver] = useState(false);
```

新規ヘルパ（`validateImageFile`）を共通切り出し（または `lib/image-constants.ts` に追加）してページ／モーダル双方で再利用する:

```ts
export type FileValidationResult =
  | { ok: true; file: File; mimeType: ImageMimeType }
  | { ok: false; message: string };

export function validateImageFile(file: File): FileValidationResult;
```

- MIME と `MAX_IMAGE_SIZE_BYTES` を検証する。
- 既存 `UploadModal` 内のインライン検証もこのヘルパに置き換える（重複コード除去）。

ページフック追加 API:

| 名前 | 役割 |
| ---- | ---- |
| `currentPage` | 表示中ページ番号 |
| `setCurrentPage(n)` | ページ切替 |
| `pageSize` | 12（定数） |
| `pagedImages` | 現在ページの 12 件 |
| `totalPages` | `Math.max(1, Math.ceil(images.length / pageSize))` |
| `isPageDragOver` | 全体オーバーレイ表示制御 |
| `handlePageDragEnter / Over / Leave / Drop` | 全体 D&D ハンドラ |
| `handleUploadSuccess()` | 成功後に最終ページへ遷移＋モーダル閉じる |

### 4.2 サムネイル URL 取得

- `ImageThumbnail` コンポーネント内で `useEffect` により `imageApi.getDownloadUrl(image.id)` を呼ぶ。
- 取得結果は `useState<{ url: string; expiresAt: number } | null>(null)`。
- URL の有効期限（5 分）の管理は本タスクでは「タブを長時間放置したら次のページ送り or マウント時に再取得される」前提で**特別な再取得タイマーは設けない**（実用上 5 分でユーザーが画面を捨てる確率は十分高い。問題化すれば別タスク）。
- N+1 リクエストになる懸念は実数 12 件で許容範囲。並列度は `Promise` の自然並列に任せる。

## 5. 完了条件

- [ ] 画像が `<img>` サムネイル付きの 3 列グリッドで表示される。
- [ ] 1 ページに最大 12 件、`Pagination` で送れる。12 件以下なら Pagination は非表示。
- [ ] 各サムネイル全体クリックで詳細ページへ遷移。
- [ ] サムネイル右上の削除ボタンで削除モーダルが開く（クリック伝播はカード遷移と分離）。
- [ ] 一覧ページ全体に画像ファイルを D&D するとオーバーレイが表示され、ドロップでアップロードモーダルがファイル付きで開く。
- [ ] 0 件時は `EmptyState` を表示。
- [ ] アップロード成功時、1 ページ目に自動遷移し新規画像が先頭に表示される。
- [ ] サムネイル URL 取得失敗時のフォールバック UI が表示される。
- [ ] `pnpm --filter frontend build` が通る。

## 6. 手動動作確認シナリオ

1. `/images` を表示し、画像が **3 列のサムネイルグリッド**になっていることを確認。
2. 画像を 13 件以上アップロードし、Pagination が表示され「‹ 1 2 ›」のように動作することを確認。
3. 各サムネイルをクリック → 該当画像の詳細ページへ遷移。
4. サムネイル右上の削除ボタンを押す → 削除確認モーダルが開き、カード遷移は発生しない。削除後は一覧再読込。
5. 画像ファイルをページの**サムネイル外領域**へドラッグ → 半透明オーバーレイが出現。ドロップ → アップロードモーダルがファイル付きで開き、そのままアップロードできる。
6. 不正なファイル（PDF）をページにドロップ → 上部に MIME エラーが表示され、モーダルは開かない。
7. 画像 0 件のユーザーで `/images` を開く → `EmptyState` 表示。
8. 2 ページ目を表示中に新規アップロード → 完了後に 1 ページ目へ自動遷移し、新規画像が先頭に表示される。
9. サムネイル URL 取得失敗（DevTools で `/images/*/download-url` をブロック）→ 「読み込み失敗」テキストと再読込ボタンが表示される。
