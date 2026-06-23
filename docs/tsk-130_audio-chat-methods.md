# TSK-130 AudioService にチャット連携メソッドを追加（設計書）

- Notion: <https://app.notion.com/p/3889ca7d99dc8157a93fe9f45a6c075b>
- プロジェクト: PRJ-18（Petal LLM音声対応）<https://app.notion.com/p/3819ca7d99dc80bebbd8ed9118b7703f>
- 規模: S / 重要度: HIGH
- 関連: [docs/20_features/10_audio-management.md](20_features/10_audio-management.md) / [docs/20_features/09_chat.md](20_features/09_chat.md) / 参考実装 `backend/src/image/application/image.service.ts`

## 1. 課題シート（Notion 転記・フリーズ）

### 一行サマリ

音声ライブラリ（backend `src/audio/`）は TSK-117〜120 で既に実装済み。本タスクはチャット連携に必要な 2 メソッド（`getOwnedAudioBase64` / `getOwnedAudioView`）を `AudioService` に追加するだけに縮小する。

### 背景・動機

PRJ-18 計画時の調査漏れで「音声ライブラリ新設」を前提にしていたが、実際には backend `src/audio/`（アップロード・一覧・詳細・署名URL・論理削除・MIME/サイズ検証・`durationSeconds` カラム・migration `1746144007000-CreateAudiosTable.ts`）、フロント一覧/録音/詳細、docs `20_features/10_audio-management.md` まで既存。よって新設は不要。残るのは後続のチャット送信（TSK-131）が `ImageService.getOwnedImageBase64` / `getOwnedImageView` と同型で呼べる音声版メソッドの追加のみ。

### 完了条件

- [ ] `AudioService.getOwnedAudioBase64(user, id): { mediaType: AudioMimeType; data: string }` を追加（S3 バイト取得→base64、所有者認可は既存 `findOneForOwner` 経由）。
- [ ] `AudioService.getOwnedAudioView(user, id): { audioId, mimeType, originalFilename, downloadUrl, expiresInSeconds }` を追加（署名付き再生 URL ＋メタ）。
- [ ] `audio.service.spec.ts` で新メソッドの正常系・非所有 404 を検証。
- [ ] `cd backend && pnpm build` と `pnpm test` が通る。

### スコープ外

- 音声ライブラリ本体の新規実装（既存のため不要）。
- チャットへの音声添付・送信（TSK-131）／フロント UI（TSK-132）／実機検証（TSK-133）。
- サイズ上限 20MiB→25MB 変更（既存 20MiB を踏襲）。

### 制約

- `image-management` の `getOwnedImageBase64` / `getOwnedImageView` と同型のシグネチャ・実装にする。
- 既存 `AudioService` の構造・命名・DI を踏襲。新パターンを持ち込まない。

### 不明点・迷い

解決済み（音声ライブラリは既存、本タスクはチャット連携メソッド 2 件の追加に縮小。`view` も TSK-131 が必要とするため本タスクに含める）。

## 2. スコープ

### 対象

- `backend/src/audio/application/audio.service.ts` に 2 メソッド追加。
- `backend/src/audio/application/audio.service.spec.ts` を新規作成（既存 spec なし）。

### 対象外

- 上記「スコープ外」のとおり。`audio.module.ts` / controller / domain / infra は変更不要（既存メソッド・DI で完結）。

## 3. 設計判断ログ

### 判断 1: `view` メソッドを本タスクに含める（採用）

- **採用**: `getOwnedAudioBase64`（LLM 送信用）に加え `getOwnedAudioView`（履歴表示用署名 URL ＋メタ）も本タスクで追加する。
- **理由**: 画像のチャット連携（`ChatAttachmentService`）は `getOwnedImageBase64`（送信）と `getOwnedImageView`（履歴 view）の両方を呼ぶ。音声も TSK-131 が同型で両方必要になるため、ライブラリ側のチャット連携 API としてまとめて揃える方が TSK-131 が自己完結できる。
- 却下: base64 のみ追加（TSK-131 着手時に view 不足が判明し出戻る）。

### 判断 2: 戻り値の `audioId` 命名（採用）

- **採用**: `getOwnedAudioView` の戻り値キーは画像版 `imageId` に対応して `audioId` とする。
- **理由**: 画像版と素直に対応し、TSK-131 の `ChatMessageAttachmentView` 音声版が画像版と平仄を取れる。

## 4. データモデル

変更なし。既存 `Audio` エンティティ・`petal.audios` テーブル・`AudioMimeType` をそのまま利用する。

## 5. API 仕様

REST エンドポイント追加なし。`AudioService`（application 層）に内部メソッドを追加するのみ。

```ts
// LLM 送信用：S3 本体を base64 化して返す
async getOwnedAudioBase64(
  currentUser: User,
  id: string,
): Promise<{ mediaType: AudioMimeType; data: string }>;

// 履歴表示用：署名付き再生 URL ＋メタを返す
async getOwnedAudioView(
  currentUser: User,
  id: string,
): Promise<{
  audioId: string;
  mimeType: AudioMimeType;
  originalFilename: string;
  downloadUrl: string;
  expiresInSeconds: number;
}>;
```

両メソッドとも先頭で既存 `findOneForOwner(currentUser, id)` を呼び、非所有/不在は `NotFoundException`（404）が伝播する。`getOwnedAudioBase64` は `this.s3.getObjectBytes(audio.s3Key)` → `Buffer.from(bytes).toString('base64')`。`getOwnedAudioView` は `this.s3.createDownloadUrl(audio.s3Key)` と `this.s3.presignTtlSeconds` を使う。いずれも `S3StorageClient` は既に DI 済み。

## 6. トランザクション境界

なし（読み取り専用。DB 書き込み・外部副作用の同時変更なし）。

## 7. 既存設計との差分

- `AudioService` にメソッド 2 個追加のみ。既存メソッド・DI・モジュール定義・DB スキーマは不変。
- 画像版 `ImageService` の同名メソッドと実装パターンを一致させる（差分は型名 `ImageMimeType`→`AudioMimeType`、キー名 `imageId`→`audioId` のみ）。

## 8. 完了条件（具体化版）

- [ ] `audio.service.ts` に `getOwnedAudioBase64` を追加。`image.service.ts:91-101` と同型。
- [ ] `audio.service.ts` に `getOwnedAudioView` を追加。`image.service.ts:104-123` と同型（`imageId`→`audioId`）。
- [ ] `audio.service.spec.ts` 新規。Repository（`IAudioRepository`）と `S3StorageClient` を `useValue` モックし、(a) `getOwnedAudioBase64` が所有音声を base64 で返す、(b) `getOwnedAudioView` が署名 URL ＋メタを返す、(c) 非所有/不在で 404 を投げる、を検証。
- [ ] `cd backend && pnpm build` が通る。
- [ ] `cd backend && pnpm test` が緑。

## 9. 手動動作確認シナリオ

本タスクは内部メソッド追加のため、検証は自動テスト（`audio.service.spec.ts`）で行う。

1. `cd backend && pnpm test audio.service` → 新規 spec が緑。
2. `cd backend && pnpm build` → 型エラーなし。
3. 実エンドポイント経由の動作は TSK-131（チャット送信）で end-to-end 確認する。

## 10. 未確定事項

なし。

## 11. 実装計画

### 変更・追加ファイル

- 変更: `backend/src/audio/application/audio.service.ts`（`getOwnedAudioBase64` / `getOwnedAudioView` を追記。`AudioMimeType` を `../domain/audio` から import）
- 追加: `backend/src/audio/application/audio.service.spec.ts`（新規）

### migration・環境変数・依存追加

- いずれも不要（DB スキーマ・env・依存パッケージ変更なし）。

### 作業順序（コミット単位 + 完了確認）

1. `feat(tsk-130): AudioService にチャット連携メソッドを追加` — 2 メソッド追記。確認: `cd backend && pnpm build` が通る。
2. `test(tsk-130): AudioService チャット連携メソッドのユニットテスト` — spec 新規。確認: `cd backend && pnpm test audio.service` が緑。

### テスト方針

- `audio.service.spec.ts` で `AUDIO_REPOSITORY`（`useValue` でモックの `IAudioRepository`）と `S3StorageClient`（`useValue` で `getObjectBytes` / `createDownloadUrl` を `jest.fn()`、`presignTtlSeconds` をプロパティ値）を DI。
- 検証: (a) `getOwnedAudioBase64` が所有音声を `{ mediaType, data(base64) }` で返す、(b) `getOwnedAudioView` が `{ audioId, mimeType, originalFilename, downloadUrl, expiresInSeconds }` を返す、(c) `findById` が null（非所有/不在）で両メソッドが `NotFoundException` を投げる。
- モックの `Audio` は実 `Audio` インスタンスを生成して使う（`isOwnedBy` を本物で通すため）。

### 想定外時の判断ルール

- AI 単独判断 OK: 軽微なリファクタ、設計書スコープ内の追記。
- 中断して要相談: 既存 `AudioService` 既存メソッド・DB スキーマ・`audio.module.ts` の変更が必要になった場合、画像版と実装パターンが乖離する場合。

### 事前解決済みの判断ポイント

- view を本タスクに含める（判断 1）／戻り値キーは `audioId`（判断 2）。
- サイズ上限は既存 20MiB を踏襲（25MB 変更はしない）。
- 規模が小さく文脈完全把握済みのため、Phase 5 はバックグラウンドサブエージェントではなくフォアグラウンドで実装する。
