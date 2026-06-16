# TSK-111: テスト・ビルド・環境変数・ドキュメントを整備する

- Notion: [テスト・ビルド・環境変数・ドキュメントを整備する](https://app.notion.com/p/37b9ca7d99dc81c3b59bf0352036b7f4)
- プロジェクト: PRJ-16（Petal LLMチャット実装）
- 規模: M / 重要度: MIDDLE / 完了予定: 2026-06-13

---

## 0. 課題シート（Notion 転記）

### 一行サマリ

LLM チャット機能の仕上げとして、Application 層テスト補完・`backend`/`frontend` の
build 確認・`.env.example` 更新・フィーチャドキュメントを整備する。

### 背景・動機

PRJ-16 の完了条件（build 通過・テスト・ドキュメント）を満たすための仕上げタスク。
実装機能を docs に現状仕様として残し、要求一覧に反映する。

### 完了条件（課題シート原文 → 本設計での確定）

- [ ] Application 層のユニットテストが補完され、green
      → **chat application 層の未カバー分岐を埋める**（§4 で具体化）
- [ ] `cd backend && pnpm build` / `cd frontend && pnpm build` が通る
      → 両方とも**現状すでに通過済み**。最終コミットで再確認する
- [ ] `.env.example`（backend）に LLM 接続用環境変数が追記されている
      → 本プロジェクトに `.env.example` は存在せず、env 実態は
      `backend/.envs/.env.local.example` / `.env.dev.example`。
      **LLM_BASE_URL / LLM_API_KEY / LLM_MODEL は既に両ファイルに追記済み**のため
      追加作業なし（§3 設計判断ログ参照）
- [ ] `docs/20_features/` に LLM チャットの現状仕様を追加し、
      `docs/00_overview/02_requirements.md` の機能一覧/将来構想を更新している
      → **`docs/20_features/09_chat.md` を新規作成**し requirements を更新（主作業）

### スコープ外

- 新規機能の追加実装（TSK-107〜110 で完了済み前提）
- Controller / Infra 層のテスト（[テスト方針](40_processes/02_testing-strategy.md)で原則スコープ外）
- カバレッジ閾値の CI 設定（テスト方針で「実態が見えてから別途」とされ未設定のまま）

### 制約

- `.env` はコミットしない（`.envs/*.example` のみ）。秘密情報を `NEXT_PUBLIC_*` に置かない
- ドキュメントは `docs/` を正とする運用に準拠
- `docs/**/*.md` 変更時は `npx markdownlint-cli 'docs/**/*.md'` が通ること

---

## 1. スコープ

### 対象

1. **テスト補完**: `backend/src/chat/application/` の未カバー分岐を埋める
   - `chat-error.ts`（`classifyLlmError`）: 専用 spec が未作成（branch 66%）
   - `chat-completion.service.ts`: `finishReason ?? null` 右辺（finishReason 欠落時）が未カバー（branch 87.5%）
2. **build 確認**: backend / frontend の `pnpm build` 再確認
3. **ドキュメント**: `docs/20_features/09_chat.md` 新規作成 + `requirements.md` 更新

### 対象外

- env example の編集（既に追記済み・§3 参照）
- chat 機能そのものの実装変更（テスト追加・docs のみ。**プロダクションコードは変更しない**）

---

## 2. 現状把握（調査結果）

### テストカバレッジ（chat application 層、`pnpm jest src/chat --coverage`）

| ファイル | Stmts | Branch | 未カバー | 対応 |
| -------- | ----- | ------ | -------- | ---- |
| chat.service.ts | 100 | 100 | なし | — |
| chat-thread.service.ts | 100 | 100 | なし | — |
| chat-completion.service.ts | 100 | 87.5 | L60-63（finishReason 欠落分岐） | **テスト追加** |
| chat-error.ts | 80 | 66.6 | L30,54,63,72（分類分岐） | **新規 spec** |
| chat-stream.ts | — | — | 型のみ（ランタイムコードなし） | 対象外 |

- chat application 層以外（controller / infra / domain）は[テスト方針](40_processes/02_testing-strategy.md)上スコープ外。
- 既存テストは全 180 件 green。

### env（既に追記済み）

`backend/.envs/.env.local.example` L86-94 / `.env.dev.example` L72-80 に下記が存在:

```env
# LLM チャット（chat フィーチャ / OpenAI 互換エンドポイント）
LLM_BASE_URL=...   # 接続先 OpenAI 互換エンドポイント（必須・URL）
LLM_API_KEY=       # 任意。未設定時 SDK 用に 'not-needed' 既定
LLM_MODEL=         # 任意。既定モデル
```

Zod スキーマ定義は [llm.config.ts](../../backend/src/chat/infra/llm.config.ts) の `LlmEnvSchema`。

### ドキュメント（未整備）

- `docs/20_features/` に chat の feature doc が存在しない（01〜08 のみ）。
- `requirements.md` の機能一覧に chat が無く、将来構想 L64 に「LLM API を活用した AI 機能」が残る。

---

## 3. 設計判断ログ

### 判断 1: 完了条件③「`.env.example` 更新」の扱い → **追記済みとして完了扱い**

- **採用**: 既存の `.envs/.env.local.example` / `.env.dev.example` に LLM 変数が
  既に入っているため追加作業なし。本設計書に「`.env.example` の実態は `.envs/*.example`」と注記。
- **却下**: 新たに `backend/.env.example` を作成 → プロジェクトの env 管理方式
  （`use-env.sh` による `.envs/` 切替 + symlink）と二重管理になり整合しない。
- **理由**: AGENTS.md / 既存運用が `.envs/*.example` を正とする。タスク記載の
  `.env.example` は通称であり、実体ファイルは既に条件を満たしている。

### 判断 2: テスト補完の範囲 → **chat application 層の未カバー分岐のみ**

- **採用**: カバレッジ計測で判明した `chat-error.ts` と `chat-completion.service.ts`
  の未カバー分岐を埋める。`chat-error.ts` は純粋関数のため**専用 spec を新規作成**。
- **却下案 A**: controller / infra もテスト → テスト方針でスコープ外。過剰。
- **却下案 B**: green 確認のみで追加なし → 「補完」の語義を満たさず、分岐の取りこぼしが残る。
- **理由**: テスト方針は「Application 層ユニット必須」。純粋関数の直接 spec は
  方針の「対象ファイルと同居 `<file>.spec.ts`」に合致。

### 判断 3: feature doc の配置 → **`docs/20_features/09_chat.md` 新規**

- **採用**: 既存 feature doc（01〜08）と同形式・同粒度で `09_chat.md` を作成。
  `requirements.md` 機能一覧に「LLM チャット」節を追加し実装ドキュメントへリンク。
  将来構想の「LLM API を活用した AI 機能」はローカル LLM チャットとして一部実現した旨に更新。
- **理由**: AGENTS.md カテゴリ表は `20_features/` ディレクトリ単位で参照するため、
  個別ファイル追加で表自体の編集は不要。番号は連番で 09 が空き。

---

## 4. 実装計画

### 変更・追加ファイル

| 種別 | ファイル | 内容 |
| ---- | -------- | ---- |
| 追加 | `backend/src/chat/application/chat-error.spec.ts` | `classifyLlmError` の全分岐テスト |
| 変更 | `backend/src/chat/application/chat-completion.service.spec.ts` | `done` だが `finishReason` 欠落 → `finishReason: null` のケース追加 |
| 追加 | `docs/20_features/09_chat.md` | LLM チャット現状仕様 |
| 変更 | `docs/00_overview/02_requirements.md` | 機能一覧に LLM チャット追加 / 将来構想更新 |

- **プロダクションコード（`.ts` の非 spec）・migration・env・依存追加は一切なし。**

### 作業順序（コミット単位）

1. **テスト補完**（1 コミット）
   - `chat-error.spec.ts` 新規: `describe('classifyLlmError')` で以下を網羅
     - 非オブジェクト入力（`null` / 文字列）→ `LLM_GENERATION_FAILED`（fallback）
     - `status === 429` → `LLM_RATE_LIMITED` / retryable true / httpStatus 429
     - `status >= 500` → `LLM_UPSTREAM_UNAVAILABLE` / retryable true / httpStatus 502
     - `status` 4xx（429 以外, 例 400）→ `LLM_BAD_REQUEST` / retryable false / httpStatus 502
     - 接続エラーコード（`ECONNREFUSED` 等, status 無し）→ `LLM_UPSTREAM_UNAVAILABLE`
     - status も既知 code も無し → `LLM_GENERATION_FAILED`（fallback）
   - `chat-completion.service.spec.ts` 追加: `{ delta: 'x', done:false }` の後
     `{ delta: '', done: true }`（finishReason 無し）→ done イベントの `finishReason` が `null`
   - 完了確認: `cd backend && pnpm jest src/chat --coverage --collectCoverageFrom='chat/**/*.ts'`
     で chat application 層の Branch が `chat-error.ts` / `chat-completion.service.ts` とも 100%
2. **ドキュメント**（1 コミット）
   - `docs/20_features/09_chat.md` 作成（既存 feature doc 形式: 概要 / データモデル /
     API / ストリーミング / エラー分類 / 環境変数 / 関連ドキュメント）
   - `requirements.md`: 機能要件に「LLM チャット」節追加（機能 21〜）、将来構想を更新
   - 完了確認: `npx markdownlint-cli 'docs/**/*.md'` が通る
3. **最終確認**（コミット不要・必要時のみ）
   - `cd backend && pnpm build` / `cd frontend && pnpm build` / `cd backend && pnpm test` 全通過

### テスト方針

- 追加テストは[テスト方針](40_processes/02_testing-strategy.md)準拠（`<file>.spec.ts` 同居、
  `describe` = クラス/関数名、`it` = 日本語の振る舞い記述）。
- `classifyLlmError` は純粋関数のため DI 不要、入出力の直接アサート。

### 想定外時の判断ルール

- **AI 単独判断 OK**: テスト記述の細部、doc の文言・章立て調整、markdownlint 自動修正。
- **中断して要相談**:
  - プロダクションコード（`chat-error.ts` 等の非 spec）の挙動修正が必要になった場合
    （= テストで既存実装のバグが判明）。本タスクはテスト追加のみのため実装変更は範囲外。
  - カバレッジが追加テストでも 100% にならず、原因が到達不能コード等で実装変更を要する場合。
  - requirements.md の既存記述（非機能要件など）に手を入れる必要が出た場合。

### 事前解決済みの判断ポイント

| 論点 | 解決 |
| ---- | ---- |
| env example を編集するか | しない（既に追記済み・判断 1） |
| テストはどこまで | chat application 層の未カバー分岐のみ・controller/infra は対象外（判断 2） |
| chat-error の spec を新規作るか間接カバーか | 新規 `chat-error.spec.ts` を作成（判断 2） |
| feature doc のファイル名 | `docs/20_features/09_chat.md`（判断 3） |
| requirements の将来構想をどうするか | 「LLM API を活用した AI 機能」をローカル LLM チャットで一部実現した旨に更新（判断 3） |
| migration / 依存追加 | なし |

---

## 5. 完了条件（具体化版）

- [ ] `chat-error.spec.ts` 追加で `classifyLlmError` の全分岐がカバーされる
- [ ] `chat-completion.service.spec.ts` に finishReason 欠落ケースが追加される
- [ ] `pnpm jest src/chat --coverage` で chat application 層の対象 2 ファイルの Branch が 100%
- [ ] `cd backend && pnpm test` が全 green
- [ ] `cd backend && pnpm build` / `cd frontend && pnpm build` が通る
- [ ] `docs/20_features/09_chat.md` が既存 feature doc と同形式で作成される
- [ ] `requirements.md` 機能一覧に LLM チャットが追加され将来構想が更新される
- [ ] `npx markdownlint-cli 'docs/**/*.md'` が通る

## 6. 手動動作確認シナリオ

このタスクはテスト・ドキュメントのみで挙動を変えないため、手動 UI 確認は不要。
代わりに下記コマンド確認を完了確認とする:

1. `cd backend && pnpm jest src/chat --coverage --collectCoverageFrom='chat/**/*.ts'`
   → 対象 2 ファイルの Branch 100%、全テスト green
2. `cd backend && pnpm test` → 全 green
3. `cd backend && pnpm build` / `cd frontend && pnpm build` → 成功
4. `npx markdownlint-cli 'docs/**/*.md'` → エラーなし

## 7. 未確定事項

なし（Phase 4 ドライランで全判断ポイント解決済み）。
</content>
</invoke>
