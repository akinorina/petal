# 管理者用 Cognito ↔ DB 同期スクリプト 設計（TSK-26）

## 0. 課題シート（Notion 転記）

> Notion タスク: [管理者用 Cognito ↔ DB 同期スクリプト](https://app.notion.com/p/3589ca7d99dc81d78593c277359cd535)（TSK-26）

### 背景

移行・障害復旧などで「Cognito にいるが DB にいない」「DB にいるが Cognito にいない」ユーザーが出ることがある。手動で SQL / コンソールを叩くのは事故リスクが高い。

### 課題

- `backend/scripts/import-cognito-users.ts` を実装。
  - モード A: Cognito → DB（Cognito の特定ユーザーまたは全ユーザーを DB に取り込む）。氏名/ふりがな/role はコマンド引数で指定。
  - モード B: DB → Cognito（DB にしかないユーザーに対し `AdminCreateUser` を実行）。
- `--dry-run` オプションで事前確認可能。

#### 提案

- 「不整合検知/修復スクリプト」（TSK-18 で完成）と機能が一部重複。本タスクは「インポート/作成」、別タスクは「監査・差分検出」と役割分担。
- 大量ユーザー時のページング対応（既存 audit-cognito-sync と同様）。

### 完了条件（原文）

- スクリプトで Cognito ユーザーを DB に取り込める
- DB のみのユーザーを Cognito に作成できる
- `--dry-run` で結果プレビューできる

---

## 1. 課題サマリ

`backend/scripts/import-cognito-users.ts` を新設し、`pnpm import-cognito-users --mode <a|b> [...]` で「Cognito → DB」「DB → Cognito」のいずれかを実行する。差分検出は既存 `cognito-sync-diff.ts` の `classifyDiscrepancies` を再利用し、`db_only` / `cognito_only` のレコードのみ対象。`--dry-run` で結果プレビュー、`--email` で単発対象指定、`--all` で全件処理。Mode B では新規発行された Cognito sub で DB の `cognito_sub` を更新する。

## 2. スコープ

### 対象

- backend: `scripts/import-cognito-users.ts`（新規・ts-node 実行）
- backend: `package.json` に `import-cognito-users` の pnpm スクリプトを追加
- backend: 既存 `cognito-sync-diff.ts` の型・関数を再利用（変更なし）
- docs: `docs/64_cognito-sync-import.md`（本ドキュメント） + `AGENTS.md` 表

### 対象外

- email ミスマッチ・状態ミスマッチの修復（TSK-18 `audit-cognito-sync --fix` 側で実施）
- DB / Cognito の双方向自動同期（手動運用前提）
- 招待メール送信（モード B で新規作成するユーザーには **招待メールを送らない**＝`MessageAction='SUPPRESS'` を採用）
- 単体テスト（純粋ロジック層は既存 `cognito-sync-diff.spec.ts` が担保。本スクリプトは I/O 中心のため手動シナリオで動作確認）

## 3. 制約

- 既存 `cognito-sync-diff.ts` の関数を変更しない（テストへの影響を避ける）。
- 大量ユーザー対応: Cognito `ListUsers` を PaginationToken で全ページ走査（既存 `audit-cognito-sync.ts` と同じ実装）。
- `--dry-run` 時は **DB と Cognito を一切書き換えない**。
- オニオン依存方向: スクリプトは `infra` レイヤ相当として AWS SDK / TypeORM を直接使う（既存 audit/create-admin と同様）。アプリ層には依存しない。
- 環境変数: `COGNITO_USER_POOL_ID` / `COGNITO_REGION` / `DATABASE_URL`（既存スクリプトと同じ）。

## 4. 設計判断ログ

### 判断 1: コマンド形式 → **`--mode <cognito-to-db|db-to-cognito>` 必須**（採用）

```text
pnpm import-cognito-users --mode cognito-to-db [--email X] [--all] \
  [--name "氏名"] [--name-kana "ふりがな"] [--role admin|user] [--dry-run]

pnpm import-cognito-users --mode db-to-cognito [--email X] [--all] [--dry-run]
```

- `--email` と `--all` は排他。どちらか必須。
- `--name` / `--name-kana` / `--role` はモード A（`--email` 指定時）のみ意味を持つ。`--all` 時の取り込みは name/nameKana に email を、role に `user` を入れる **暫定値**で行う（後で admin が編集する前提）。
- **理由**: 既存 audit スクリプトと並び、bash で叩きやすい形にする。bulk と single の両対応で運用パターンに対応。

### 判断 2: 差分検出 → **既存 `classifyDiscrepancies` を再利用**（採用）

- インポート対象は `db_only` / `cognito_only` のみ。
- `state_mismatch` / `email_mismatch` は本スクリプトの対象外（audit 側）。

### 判断 3: モード A の冪等性 → **既存 `cognito_sub` があれば skip**（採用）

- 同じ sub が既に DB にある場合は INSERT せずスキップ + ログのみ。
- `--email` 指定で対象が既に存在する場合も skip + メッセージ。

### 判断 4: モード B の新 sub 反映 → **AdminCreateUser のレスポンスから新 sub を取り、DB を UPDATE**（採用）

- `AdminCreateUser` を `MessageAction='SUPPRESS'` で呼ぶ（招待メールを送らない）。
- 一時パスワードは Cognito が自動生成（呼び出し側で `TemporaryPassword` を渡さない）。**運用前提**: ユーザーは別途パスワードリセット / 招待メール再送 (TSK-25) で復旧する。
- レスポンスの `User.Attributes` から新しい `sub` を取得し、DB の対象行を `UPDATE petal.users SET cognito_sub = :newSub WHERE id = :id` で更新。
- 旧 sub と新 sub の対応は標準出力に残す（運用記録）。

### 判断 5: dry-run の出力 → **対象一覧と「何をするか」を表示し、SDK 呼び出し・DB 書き込みは行わない**（採用）

- 各対象につき `[dry-run] would INSERT to DB ...` / `[dry-run] would AdminCreateUser ...` のように 1 行 1 件。
- DB 接続は読み取り (`SELECT`) のみ実施。

### 判断 6: 監査ログ → **本スクリプトでは記録しない**（採用）

- 監査ログテーブル（`audit_logs`）はアプリのドメイン操作向けで、運用スクリプトはオペレータ責任で実行・別途記録する想定。
- スクリプトは標準出力にすべての操作を残す（ログ採取は運用に委ねる）。

### 判断 7: エラー処理 → **1 件失敗で残りを継続し、終了時に件数を集計**（採用）

- AWS SDK 例外や DB 例外は `try/catch` で 1 件ずつ吸収。失敗した sub をリストし、終了時に `成功 N 件 / 失敗 M 件` で報告。
- `process.exitCode = 1` を失敗があった場合のみセット（CI 取り込みのため）。

### 判断 8: name / nameKana のバリデーション → **長さ 1〜100 を守る**（採用）

- DB の `users.name` / `name_kana` は `length 100`（既存スキーマ）。
- `--all` の暫定値はメールアドレスの長さに依存するので、`100` を超える可能性がある email は `name` を `'(unset)'` に倒す（事故防止）。

## 5. データモデル

DB 変更なし（既存 `petal.users` を直接 INSERT / UPDATE する）。

## 6. CLI 仕様

### モード A: Cognito → DB

| 引数 | 必須 | 意味 |
| --- | --- | --- |
| `--mode cognito-to-db` | ✅ | 動作モード |
| `--email <email>` | ◯ | 特定ユーザーのみ取り込む（`--all` と排他） |
| `--all` | ◯ | DB に存在しない全 Cognito ユーザーを取り込む（`--email` と排他） |
| `--name <str>` | - | `--email` 時のみ有効。指定なしなら email を流用 |
| `--name-kana <str>` | - | `--email` 時のみ有効。指定なしなら email を流用 |
| `--role <admin\|user>` | - | `--email` 時のみ有効。デフォルト `user` |
| `--dry-run` | - | 実際の書き込みを行わない |

### モード B: DB → Cognito

| 引数 | 必須 | 意味 |
| --- | --- | --- |
| `--mode db-to-cognito` | ✅ | 動作モード |
| `--email <email>` | ◯ | 特定ユーザーのみ作成（`--all` と排他） |
| `--all` | ◯ | DB のみに存在する全ユーザーを作成（`--email` と排他） |
| `--dry-run` | - | 実際の書き込みを行わない |

### 出力フォーマット

```text
=== Cognito ↔ DB 同期スクリプト (mode=cognito-to-db, dry-run=false) ===
対象: 3 件
  - sub=xxxxx email=alice@example.com  → INSERT 成功 (id=...)
  - sub=yyyyy email=bob@example.com    → skip (DB に既存)
  - sub=zzzzz email=carol@example.com  → 失敗: ...
完了: 成功 1 件 / スキップ 1 件 / 失敗 1 件
```

## 7. 既存設計との差分

- 新規スクリプト `backend/scripts/import-cognito-users.ts` を追加。
- `backend/package.json` に `"import-cognito-users": "ts-node -r tsconfig-paths/register scripts/import-cognito-users.ts"` を追加。
- `backend/scripts/cognito-sync-diff.ts` は **変更なし**（型・分類関数を再利用するのみ）。
- `docs/64_cognito-sync-import.md` 新設、`AGENTS.md` 表に追記。

## 8. トランザクション境界

- モード A の DB INSERT は 1 件ごとに独立（複数件を 1 トランザクションにまとめない）。失敗時に他件の成功を巻き戻さないため。
- モード B は `AdminCreateUser` → DB `UPDATE cognito_sub` の順。`AdminCreateUser` 成功後に DB 更新が失敗した場合は **Cognito 側を残し**、標準出力で警告（管理者が手動で対応）。これは「DB UPDATE → 外部 API → COMMIT」の原則の例外だが、Cognito の sub を後から DB に当てるという操作の性質上ロールバックが現実的でない（Cognito ユーザー削除＝SDK 例外時の二段補償が複雑）ため割り切る。

## 9. 完了条件（具体化）

- [ ] `pnpm import-cognito-users --mode cognito-to-db --all --dry-run` で対象ユーザー一覧と「INSERT 予定」が表示される
- [ ] `pnpm import-cognito-users --mode cognito-to-db --email X --name Y --name-kana Z --role user` で 1 件 DB INSERT される
- [ ] `pnpm import-cognito-users --mode db-to-cognito --all --dry-run` で「AdminCreateUser 予定」が表示される
- [ ] `pnpm import-cognito-users --mode db-to-cognito --email X` で 1 件 Cognito 作成 + DB `cognito_sub` 更新が走る
- [ ] 既存ユーザーは skip、失敗は集計に反映され `exitCode=1`
- [ ] `cd backend && pnpm lint && pnpm build` 通過

## 10. 手動動作確認シナリオ

1. **準備**: localstack または DEV 環境で「Cognito にいるが DB にいない」ユーザー A、「DB にいるが Cognito にいない」ユーザー B を意図的に作る（例: DB から該当行を `DELETE`、Cognito で `AdminDeleteUser` を叩く）。
2. `pnpm import-cognito-users --mode cognito-to-db --all --dry-run` を実行 → A が「INSERT 予定」で表示される。DB は変わらない。
3. `pnpm import-cognito-users --mode cognito-to-db --email <A の email> --name '田中 太郎' --name-kana 'たなか たろう' --role user` を実行 → A が DB に INSERT される。
4. `pnpm import-cognito-users --mode db-to-cognito --all --dry-run` を実行 → B が「AdminCreateUser 予定」で表示される。Cognito は変わらない。
5. `pnpm import-cognito-users --mode db-to-cognito --email <B の email>` を実行 → B が Cognito に作成され、DB の `cognito_sub` が新 sub に更新される。
6. `pnpm audit-cognito-sync` で不整合が解消されたことを確認。

## 11. 未確定事項

- なし。

---

## 12. 実装計画（Phase 4）

### 12.1 変更・追加ファイル

- `backend/scripts/import-cognito-users.ts`（新規）
- `backend/package.json`（変更: `import-cognito-users` スクリプト追記）
- `docs/64_cognito-sync-import.md`（新規）
- `AGENTS.md`（変更）

migration / 環境変数 / 依存追加: なし。

### 12.2 作業順序（コミット単位）

1. **スクリプト本体 + package.json スクリプト追加** — 完了確認: `cd backend && pnpm lint && pnpm build` 通過、`pnpm import-cognito-users --help` 相当（引数なしで usage 出力）が動く

### 12.3 テスト方針

- 純粋ロジック（`classifyDiscrepancies`）は既存 spec で担保済み。
- スクリプト本体は I/O 中心のため手動動作確認のみ（§10）。

### 12.4 想定外時の判断ルール（タスク固有）

- **AI 単独判断 OK**: 出力文言、CLI ヘルプ文、対象 0 件時のメッセージ。
- **中断して相談**:
  - bulk 取り込み時のデフォルト値（`name=email, role=user`）を変えたい場合
  - `MessageAction='SUPPRESS'` を `'RESEND'` 相当にしたい（招待メールを送るかどうか）
  - 監査ログに記録したい場合

### 12.5 事前解決済みの判断ポイント（ドライラン結果）

| # | 判断ポイント | 解決 |
| - | ------------ | ---- |
| 1 | CLI 形式 | `--mode` 必須 + `--email \| --all` 排他必須 + `--dry-run` |
| 2 | 差分検出 | `classifyDiscrepancies` を再利用 |
| 3 | 冪等性 | 既存 sub なら skip |
| 4 | モード B の sub 反映 | `AdminCreateUser` レスポンスの sub で DB を `UPDATE cognito_sub` |
| 5 | 招待メール | `MessageAction='SUPPRESS'`（送らない） |
| 6 | dry-run | 読み取りのみ、書き込みは一切しない |
| 7 | エラー時 | 件ごとに継続、終了時に集計 + 失敗あれば `exitCode=1` |
| 8 | bulk のデフォルト氏名 | email を流用、長すぎる場合は `'(unset)'` |
