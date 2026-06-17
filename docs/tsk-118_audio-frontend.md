# TSK-118 音声のアップロード・一覧・再生・詳細・削除のフロントを実装する（設計書）

- Notion: https://app.notion.com/p/3819ca7d99dc8122bfb4d707b9ca20d0
- プロジェクト: PRJ-15 Petal 音声コンテンツ対応
- 規模: L / 重要度: HIGH
- 依存: TSK-117「音声管理のバックエンド API と DB を実装する」（`/audios` API ＋ OpenAPI 型）

> **着手前提（重要）**: 本フロント実装は TSK-117 が `backend/openapi.json` に `audios` 系パス/DTO を出力済みであることに依存する。
> TSK-117 マージ前は `frontend` 側で `pnpm openapi:gen` を実行しても `AudioResponseDto` 等の型が生成されず `pnpm build` が通らない。
> 本設計書（Phase 3）・実装計画（Phase 4）は TSK-117 完了前に確定でき、Phase 5（実装本体）は TSK-117 マージ後に着手する。

## 1. 課題シート（Notion 転記・フリーズ）

### 一行サマリ

画像のフロント（`frontend/src/app/(authenticated)/images/`）をミラーし、音声のファイルアップロード・一覧（リスト形式＋インライン再生）・詳細・ダウンロード・削除の UI を実装する。マイク録音は含まない（別 TSK）。

### 背景・動機

PRJ-15 のフロント土台。バックエンド TSK（`/audios` API ＋ OpenAPI 型）に依存する。一覧は画像の 3 列サムネイルグリッドとは異なり、音声に自然な **リスト（1 件 1 行）形式 ＋ 各行インライン再生** とする。

### 完了条件

- `frontend/src/lib/audio-constants.ts`（許可 MIME・サイズ上限 20MiB・`validateAudioFile`・サイズ整形）。
- `frontend/src/lib/api/audio.ts`（findAll / findById / create / getDownloadUrl / remove ＋ 署名付き URL への PUT は共通 `uploadToPresignedUrl` を再利用）。
- `frontend/src/lib/api-hooks/use-audios-api.ts`（一覧・アップロード・削除）＋ ダウンロード URL 取得フック。
- `frontend/src/app/(authenticated)/audios/page.tsx` ＋ 同居フック `use-audios-page.ts`: **リスト形式**で 1 件 1 行（タイトル・サイズ・日時）＋ 各行に `<audio controls>` インライン再生 ＋ Pagination ＋ ページ全体 D&D。
- `frontend/src/app/(authenticated)/audios/[id]/page.tsx` ＋ `use-audio-detail-page.ts`: メタ情報表示 ＋ 再生 ＋ ダウンロード ＋ 削除確認 Dialog。
- アップロードモーダル: ファイル選択 ＋ ドラッグ＆ドロップ（**録音は含めない**）。**アップロード前のクライアント変換は行わない**（そのまま PUT）。
- 共通レイアウト（`(authenticated)/layout.tsx`）のナビゲーションに「音声」リンクを追加。
- OpenAPI クライアント再生成（`pnpm openapi:gen`）。
- `cd frontend && pnpm build` が通る。

### スコープ外

- マイク録音（MediaRecorder）— 別 TSK。
- 波形表示・編集・タグ付け等の高度機能。

### 制約

- ページコンポーネントは View に専念し、状態・副作用・ハンドラは同居フック `use-<page>-page.ts` に切り出す（1 ページ 1 フック）。
- design-system コンポーネント（Button / Dialog / Pagination / EmptyState / FormField / Alert 等）を画像と同様に利用。
- 既存 `images/` のパターンを踏襲し、新パターンを持ち込まない。

### 不明点・迷い（Phase 3 で解決済み）

- 一覧のインライン再生は各行ごとにダウンロード URL を都度取得する（画像サムネイルと同方式）。→ 採用（判断 1）。
- 同時再生制御の要否。→ **1 件再生時に他を停止**（判断 2）。

## 2. 設計判断（Phase 3 議論結果）

### 判断 1: 一覧インライン再生のダウンロード URL は各行で都度取得【確定】

画像サムネイルと同方式で、行（`AudioRow`）マウント時に `getDownloadUrl(id)` を呼び `<audio src>` に渡す。一覧 API レスポンスに署名付き URL を含めない（TTL 管理・責務分離のため）。

- 理由: 画像 `ImageThumbnail` の確立パターンを踏襲。新パターンを持ち込まない制約に合致。
- 失敗時は行内に「読み込みに失敗しました／再読込」を表示（画像と同じ `reloadKey` パターン）。

### 判断 2: 同時再生制御 = 1 件再生時に他を停止【確定】

各行 `<audio>` の `onPlay` で、ページ内の他の再生中 `<audio>` を `pause()` する。実装は再生中要素を集約する仕組み（後述）で行う。

- 理由: 複数音声が重なる UX を避ける。実装は小さく、ブラウザ標準の `<audio controls>` を活かせる。
- 実装方式: ページ単位で `audioRefs` を集約する軽量コンテキスト or 親が保持する `Set<HTMLAudioElement>`。`AudioRow` は `onPlay={(e) => pauseOthers(e.currentTarget)}` を呼ぶ。`pauseOthers` は自分以外の登録済み audio を `pause()`。

### 判断 3: durationSeconds をアップロード前に計測して送信【確定】

TSK-117 バックエンドは `durationSeconds?`（任意・`number`）を受け付ける。フロントはアップロード前に再生時間を計測して送る。

- 実装: `audio-constants.ts` に `measureAudioDuration(file: File): Promise<number | null>` を追加。`URL.createObjectURL(file)` → `new Audio()` の `loadedmetadata` から `Math.round(audio.duration)` を取得。`Infinity`/`NaN`/非正値や計測失敗時は `null`。`finally` で `revokeObjectURL`。
- 一覧/詳細では `durationSeconds` を `mm:ss` 形式で表示（`null` は `—`）。
- 理由: 一覧・詳細での再生時間表示が有益。バックエンドが任意受け入れ済みで往復コスト最小。

### 判断 4: 一覧はリスト形式（1 件 1 行）【確定・課題シート由来】

画像の 3 列グリッドではなく `<ul>` の 1 件 1 行。各行: タイトル/ファイル名・サイズ・`durationSeconds`・アップロード日時 ＋ `<audio controls>` ＋ 詳細リンク ＋ 削除ボタン。

- ページサイズ: `AUDIOS_PAGE_SIZE = 12`（画像 `IMAGES_PAGE_SIZE` を踏襲）。クライアントページング（一覧 API は全件返す画像と同方式）。

## 3. データモデル（フロント型）

TSK-117 が生成する OpenAPI 型を `@/lib/openapi/client` 経由で使用（画像と同じ参照方法）。

- `Schemas['AudioResponseDto']`: `id` / `originalFilename` / `mimeType` / `sizeBytes` / `durationSeconds: number | null` / `title?` / `description?` / `createdAt` / `updatedAt`（TSK-117 設計書のレスポンス DTO に準拠。実体は再生成後の型で確定）。
- `Schemas['CreateAudioRequestDto']`: `originalFilename` / `mimeType`（音声 5 種 enum）/ `sizeBytes` / `durationSeconds?` / `title?` / `description?`。
- `AudioMimeType = Schemas['CreateAudioRequestDto']['mimeType']`。

> 型名は TSK-117 が出力する `openapi.json` を `pnpm openapi:gen` で再生成した実体に従う。万一 DTO 名が設計書と異なる場合は「想定外時のルール」に従い停止・報告する。

## 4. API 仕様（フロントラッパ）

`frontend/src/lib/api/audio.ts`（`image.ts` をミラー、`uploadToPresignedUrl` は共通再利用）:

| 関数 | 対応エンドポイント |
| --- | --- |
| `findAll()` | `GET /audios` |
| `findById(id)` | `GET /audios/{id}` |
| `create(body)` | `POST /audios` |
| `getDownloadUrl(id)` | `GET /audios/{id}/download-url` |
| `remove(id)` | `DELETE /audios/{id}` |

`uploadToPresignedUrl` は `@/lib/api`（`./image` 由来）からの再利用で重複を作らない。`api/index.ts` に `audioApi` を追加エクスポート。

## 5. トランザクション境界

フロントエンド実装のためアプリ内 DB トランザクションは無い。アップロードは 2 段（`POST /audios` でメタ作成 ＋ 署名付き URL 取得 → S3 へ PUT）で、画像と同じく**非トランザクショナル**。PUT 失敗時はメタだけが残り得るが、画像の既存挙動を踏襲し本 TSK では補償処理を追加しない（スコープ外・新パターン禁止）。

## 6. 既存設計との差分

| 項目 | 画像（既存） | 音声（本 TSK） |
| --- | --- | --- |
| 一覧レイアウト | 3 列サムネイルグリッド | リスト 1 件 1 行 ＋ 各行インライン再生 |
| プレビュー | `<img>` | `<audio controls>` |
| アップロード前変換 | `processImageFile`（リサイズ/JPEG 化） | **変換なし**（そのまま PUT） |
| 撮影入力 | カメラ `capture` input あり | **なし**（録音は別 TSK） |
| 追加メタ | — | `durationSeconds`（計測して送信・`mm:ss` 表示） |
| サイズ上限 | 10 MiB | 20 MiB |
| 許可 MIME | JPEG/PNG/GIF/WebP | mpeg/wav/webm/mp4/ogg |
| 同時再生制御 | 該当なし | 1 件再生時に他を停止 |

その他は images のパターンを完全踏襲（`useApiResource` 土台・同居フック・ページ全体 D&D・Pagination・削除確認 Dialog・詳細ページ構成）。

## 7. 完了条件（実装視点で具体化）

- `frontend/src/lib/audio-constants.ts`: `ALLOWED_AUDIO_MIME_TYPES`（5 種）・`MAX_AUDIO_SIZE_BYTES = 20 * 1024 * 1024`・`formatAudioSize`・`validateAudioFile`・`measureAudioDuration`・`formatDuration`（`mm:ss`）。
- `frontend/src/lib/api/audio.ts` ＋ `api/index.ts` エクスポート追加。
- `frontend/src/lib/api-hooks/use-audios-api.ts`（`useAudiosApi` ＋ `useAudioDownloadApi`）。
- `frontend/src/lib/api-hooks/use-audio-detail-api.ts`（`useAudioDetailApi`）。
- `frontend/src/app/(authenticated)/audios/page.tsx` ＋ `use-audios-page.ts`。
- `frontend/src/app/(authenticated)/audios/[id]/page.tsx` ＋ `use-audio-detail-page.ts`。
- `(authenticated)/layout.tsx` のナビに「音声」リンク（`/audios`、`pathname.startsWith('/audios')`）。
- `pnpm openapi:gen` 実行済みで `schema.d.ts` に audios 反映。
- `cd frontend && pnpm lint && pnpm build` が通る（`any` なし）。

## 8. 手動動作確認シナリオ（PR チェックリスト転記用）

- [ ] `cd frontend && pnpm openapi:gen` で `schema.d.ts` に audios 系の型が生成される。
- [ ] `cd frontend && pnpm lint`（`any` なし）・`pnpm build` が通る。
- [ ] ナビに「音声」リンクが表示され、`/audios` に遷移できる。
- [ ] 一覧が空のとき EmptyState が表示される。
- [ ] アップロードモーダルでファイル選択 / D&D で音声を登録でき、許可外 MIME・20 MiB 超はエラー表示。
- [ ] 録音 UI は存在しない（スコープ外）。
- [ ] アップロード後、一覧 1 件目に表示され、`durationSeconds`（mm:ss）・サイズ・日時が出る。
- [ ] 各行の `<audio controls>` で再生でき、別の行を再生すると前の行が停止する。
- [ ] 行の詳細リンクから詳細ページへ遷移し、メタ情報・再生・ダウンロード・削除ができる。
- [ ] 削除は確認 Dialog を経て実行され、一覧/詳細から消える。
- [ ] ページ全体への D&D でアップロードモーダルが初期ファイル付きで開く。
- [ ] 12 件超で Pagination が表示される。

## 9. 未確定事項

- なし（TSK-117 が出力する DTO 名が設計書と差異があった場合のみ Phase 5 で停止・報告）。

---

## 10. 実装計画（Phase 4）

### 事前解決済みの判断ポイント（ドライラン結果）

| # | 判断ポイント | 決定 |
| --- | --- | --- |
| DP1 | OpenAPI 型の参照方法 | `@/lib/openapi/client` の `Schemas['AudioResponseDto']` / `Schemas['CreateAudioRequestDto']`（画像と同方式）。`pnpm openapi:gen` 後に確定。 |
| DP2 | `durationSeconds` 計測 | `measureAudioDuration(file)`：`URL.createObjectURL` → `new Audio()` の `loadedmetadata` で `Math.round(duration)`。`Infinity`/`NaN`/非正値・失敗は `null`。`finally` で `revokeObjectURL`。アップロード時に `create` の `durationSeconds` へ渡す。 |
| DP3 | 同時再生制御の実装 | 一覧ページが保持する `Set<HTMLAudioElement>`（`useRef`）に各 `AudioRow` が登録/解除。各 `<audio>` の `onPlay` で `pauseOthers(self)` を呼び、自分以外を `pause()`。コンテキスト等の新規抽象は作らず props 経由で渡す。 |
| DP4 | 一覧の URL 取得 | 行マウント時に `getDownloadUrl(id)` を都度取得（`ImageThumbnail` 同パターン、`reloadKey` で再試行）。 |
| DP5 | ページング | クライアントページング、`AUDIOS_PAGE_SIZE = 12`。一覧 API は全件返す（画像同方式）。 |
| DP6 | 詳細の取得 | `useAudioDetailApi`：`findById` ＋ `getDownloadUrl` を `Promise.all`（画像 `useImageDetailApi` 同形）。`previewUrl` を `<audio src>` に使用。 |
| DP7 | サイズ整形 | `formatAudioSize` は画像 `formatImageSize` と同ロジックを音声用に複製（共通化はスコープ外・新パターン回避）。 |
| DP8 | アップロード変換 | 行わない。`validateAudioFile` 通過後そのまま PUT（画像の `processImageFile` 相当は実装しない）。 |
| DP9 | ナビ文言/パス | ラベル「音声」、`href="/audios"`、`active={pathname.startsWith('/audios')}`。「画像」リンクの直後に配置。 |
| DP10 | `durationSeconds` 表示 | `formatDuration(sec: number \| null)`：`null` は `—`、それ以外は `mm:ss`（60 分超も `mm` 継続で可）。 |

### 変更・追加ファイル（ファイル名レベル）

新規:

- `frontend/src/lib/audio-constants.ts`
- `frontend/src/lib/api/audio.ts`
- `frontend/src/lib/api-hooks/use-audios-api.ts`
- `frontend/src/lib/api-hooks/use-audio-detail-api.ts`
- `frontend/src/app/(authenticated)/audios/page.tsx`
- `frontend/src/app/(authenticated)/audios/use-audios-page.ts`
- `frontend/src/app/(authenticated)/audios/[id]/page.tsx`
- `frontend/src/app/(authenticated)/audios/[id]/use-audio-detail-page.ts`

変更:

- `frontend/src/lib/api/index.ts`（`audioApi` エクスポート追加）
- `frontend/src/app/(authenticated)/layout.tsx`（ナビに「音声」リンク）
- `frontend/src/lib/openapi/schema.d.ts`（`pnpm openapi:gen` で再生成）

### migration・環境変数・依存追加

- migration: なし（フロントのみ）。
- 環境変数: なし。
- 依存追加: なし（既存 `openapi-fetch` / design-system / Next.js のみ）。

### 作業順序（コミット単位 ＋ 各コミットの完了確認方法）

1. **chore(frontend): openapi.json から audios 型を再生成**
   - `cd frontend && pnpm openapi:gen`（**TSK-117 マージ後の `backend/openapi.json` が前提**）
   - ゲート: `schema.d.ts` に `/audios` パスと `AudioResponseDto` 等が出力される。
2. **feat(frontend): audio の定数・API ラッパ・フックを追加**
   - `audio-constants.ts` / `api/audio.ts` / `api/index.ts` / `use-audios-api.ts` / `use-audio-detail-api.ts`
   - ゲート: `pnpm build`（型エラーなし）。
3. **feat(frontend): 音声一覧ページ（リスト＋インライン再生＋D&D）を実装**
   - `audios/page.tsx` / `audios/use-audios-page.ts`
   - ゲート: `pnpm build`、一覧/アップロード/削除/同時再生停止が動作。
4. **feat(frontend): 音声詳細ページ（再生・ダウンロード・削除）を実装**
   - `audios/[id]/page.tsx` / `audios/[id]/use-audio-detail-page.ts`
   - ゲート: `pnpm build`、詳細表示/再生/DL/削除が動作。
5. **feat(frontend): 共通レイアウトのナビに「音声」リンクを追加**
   - `(authenticated)/layout.tsx`
   - ゲート: `pnpm lint && pnpm build`、ナビから `/audios` 遷移。

### テスト方針

- 画像フロントに既存ユニットテストは無く、本 TSK でも新規テストは追加しない（スコープ外）。
- 完了ゲートは `pnpm lint`（`any` なし）＋ `pnpm build` ＋ 手動動作確認シナリオ（§8）。

### 想定外時の判断ルール

標準セット（[phase-checklists §想定外時の標準ルール](../.claude/skills/skill-workflow/references/phase-checklists.md)）に加え、本 TSK 固有:

- **中断して要相談**: TSK-117 が出力した DTO 名/フィールドが本設計書（§3）と異なる、`durationSeconds` が DTO に存在しない、`/audios` パス形が異なる等、バックエンド契約との差異。
- **中断して要相談**: 既存 design-system に必要コンポーネント（Pagination/Dialog 等）が無い、または画像と異なる利用法を強いられる場合。
- **AI 単独判断 OK**: 画像パターン踏襲範囲の軽微な調整（クラス名・文言・行レイアウト微調整）、`measureAudioDuration`/`formatDuration` の実装詳細。

### 完了ゲート（Phase 5 検証）

```bash
cd frontend
pnpm install
pnpm openapi:gen      # TSK-117 マージ後の backend/openapi.json から再生成
pnpm lint && pnpm build
```

`pnpm lint`（`any` なし）・`pnpm build` 成功、`schema.d.ts` に audios 反映、§8 シナリオを満たすこと。
</content>
</invoke>
