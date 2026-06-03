# DB と Cognito の不整合検知/修復スクリプト 設計（TSK-18）

## 0. 課題シート（Notion 転記）

> Notion タスク: [DB と Cognito の不整合検知/修復スクリプト](https://app.notion.com/p/3589ca7d99dc818dbacef66ffb67d3e9)（TSK-18）

### 背景

何らかの理由（API 失敗、手動削除、復元不能なエラー）で DB と Cognito の状態がずれた場合、現状検知できない。

### 課題

- `backend/scripts/audit-cognito-sync.ts` を実装。
  - Cognito の全ユーザー（ListUsers）と DB の全ユーザー（softDelete 含む）を突き合わせる。
  - 不整合を分類してレポート: a) DB のみ b) Cognito のみ c) Disable / softDelete 状態のミスマッチ d) email ミスマッチ。
- `--fix` オプションで安全に修復できるものだけ自動修復。

### 完了条件（原文）

- スクリプトで不整合をレポート出力できる
- `--fix` で安全な修復が走る
- 大量ユーザー時もページング対応

### Phase 2 で確定した方針

| 論点 | 確定 |
| ---- | ---- |
| `--fix` の自動修復対象 | **「DB=softDelete 済 かつ Cognito=有効」→ Cognito 無効化のみ**（最も低リスク） |
| 修復履歴の監査ログ | **stdout レポートのみ**（audit_logs は actor 必須で書けない・別タスク扱い） |
| 出力形式 | **整形テキスト** |
| 構成 | `create-admin.ts` と同じ**スタンドアロン**（Nest DI 不使用・`AppDataSource` + Cognito SDK 直） |

---

## 1. 課題サマリ

DB（`petal.users`、softDelete 含む）と Cognito User Pool（ListUsers）を `cognito_sub` をキーに突き合わせ、不整合を 4 カテゴリに分類して整形テキストで出力する運用スクリプト。`--fix` 指定時のみ、最も安全な「DB 削除済なのに Cognito 有効」を Cognito 無効化して修復する。それ以外（片側のみ存在・email ずれ・DB 有効なのに Cognito 無効）はレポートのみで人間判断に委ねる。

## 2. スコープ

### 対象

- `backend/scripts/audit-cognito-sync.ts`（スタンドアロン実行スクリプト・I/O）
- `backend/src/scripts/cognito-sync-diff.ts`（純粋な分類ロジック + 型）
- `backend/src/scripts/cognito-sync-diff.spec.ts`（分類ロジックの単体テスト）
- `package.json` に `audit-cognito-sync` スクリプトを追加

### 対象外

- 片側のみ存在（DB のみ / Cognito のみ）の自動生成（パスワードや氏名が無く安全に作れない）
- email / sub ずれの自動修復（人間判断）
- 「DB 有効 かつ Cognito 無効」の自動有効化（意図的な無効化を覆すリスク）
- audit_logs への記録（actor が無いため）
- 古い行のパージ・定期実行（運用ジョブ＝[42_operational-jobs.md](42_operational-jobs.md) 側の別タスク）

## 3. 制約

- スタンドアロン構成（`ts-node -r tsconfig-paths/register`）。Nest の DI コンテナは起動しない（`create-admin.ts` 踏襲）。
- DB 読み取りは softDelete 行も含める（`AppDataSource.query` の raw SQL で `deleted_at` も取得）。
- Cognito ListUsers はページング必須（PaginationToken）。
- 破壊的操作は `--fix` 指定時のみ、かつ無効化（AdminDisableUser）に限定。

## 4. 設計判断ログ

### 判断 1: 突き合わせキー → **`cognito_sub`**（採用）

- DB `users.cognito_sub` と Cognito の `sub` 属性で突き合わせる。`email` は表示と email ミスマッチ判定に使う。
- **理由**: email は変更され得るが sub は不変。安定キーで「同一人物」を判定する。

### 判断 2: `--fix` の対象 → **「DB 削除済 × Cognito 有効」→ Disable のみ**（採用）

- 唯一自動修復するのは、論理削除済ユーザーが Cognito で有効なまま（＝ログイン可能なまま残っている）危険な状態の是正。
- **却下**: 「DB 有効 × Cognito 無効 → Enable」。運用者が意図的に Cognito 側を無効化したケースを自動で覆す恐れがあるためレポートのみ。

### 判断 3: 監査ログ → **記録しない（stdout のみ）**（採用）

- `audit_logs.actor_user_id` は users への FK・NOT NULL で、スクリプトには actor が無い。便宜上の actor を作るのは過剰。修復結果は標準出力に明示する。

### 判断 4: 構成 → **スタンドアロン**（採用）

- `create-admin.ts` と同様に `AppDataSource` と Cognito SDK を直接使う。Nest 起動の複雑さを避ける。

### 判断 5: 分類ロジックの分離 → **純粋関数を `src/scripts/` に切り出す**（採用）

- jest の `rootDir` は `src` のため、`backend/scripts/` 配下はテストされない。`classifyDiscrepancies(dbUsers, cognitoUsers)` を `src/scripts/cognito-sync-diff.ts` に純粋関数として置き、単体テストする。スクリプト本体は I/O（ListUsers ページング・DB クエリ・AdminDisableUser・出力）に専念する。

### 判断 6: 終了コード → **実行時エラー以外は 0**（採用）

- 不整合を検出してもスクリプトはレポートツールとして `exit 0`。実行時例外のみ `exit 1`。

## 5. データモデル / 型

DB スキーマ変更なし（読み取りのみ）。純粋ロジックの型:

```ts
type DbUser = { cognitoSub: string; email: string; deleted: boolean };
type CognitoUser = { sub: string; email: string; enabled: boolean };

type Discrepancy =
  | { kind: 'db_only'; sub: string; email: string }
  | { kind: 'cognito_only'; sub: string; email: string }
  | { kind: 'state_mismatch'; sub: string; email: string;
      dbDeleted: boolean; cognitoEnabled: boolean; fixable: boolean }
  | { kind: 'email_mismatch'; sub: string; dbEmail: string; cognitoEmail: string };
```

`classifyDiscrepancies(dbUsers, cognitoUsers): Discrepancy[]`:

- `db_only`: sub が DB にあり Cognito に無い
- `cognito_only`: sub が Cognito にあり DB に無い
- `state_mismatch`: 両方に存在し、`dbDeleted && cognitoEnabled`（→ `fixable: true`）または `!dbDeleted && !cognitoEnabled`（→ `fixable: false`）
- `email_mismatch`: 両方に存在し `dbEmail !== cognitoEmail`
- 状態と email の両方ずれている場合は両カテゴリに計上する。

## 6. スクリプトの挙動

- 実行: `pnpm audit-cognito-sync [--fix]`
- 引数: `--fix`（指定時のみ修復）。未指定は report-only。
- 手順:
  1. Cognito クライアント・`AppDataSource` を初期化
  2. DB から全ユーザー取得（raw SQL、softDelete 含む）: `SELECT cognito_sub, email, deleted_at FROM "petal"."users"`
  3. Cognito から全ユーザー取得（ListUsers をページング、`sub` / `email` / `Enabled` を抽出）
  4. `classifyDiscrepancies` で分類
  5. 整形テキストでレポート出力（カテゴリ別件数 + 明細）
  6. `--fix` のとき、`fixable` な `state_mismatch` に対し `AdminDisableUser` を実行し結果を出力
  7. 後始末（`AppDataSource.destroy()`）して `exit 0`

出力例:

```text
=== Cognito ↔ DB 整合性監査 ===
DB: 12 件（削除済 3 件） / Cognito: 11 件

[a] DB のみ存在 (Cognito 無し): 1 件
  - taro@example.com (sub: ...)
[b] Cognito のみ存在 (DB 無し): 0 件
[c] 状態ミスマッチ: 2 件
  - [修復可] hanako@example.com  DB=削除済 / Cognito=有効
  - [要確認] jiro@example.com    DB=有効 / Cognito=無効
[d] email ミスマッチ: 1 件
  - sub ...: DB=a@example.com / Cognito=b@example.com

修復: [修復可] 1 件
  （--fix 未指定のため修復していません / もしくは「1 件を無効化しました」）
```

## 7. 既存設計との差分

- 新規スクリプト + 純粋ロジックモジュール + テストの追加のみ。アプリ実行時（Lambda）の挙動に影響なし。
- `package.json` に script を 1 行追加。

## 8. トランザクション境界

なし（読み取り中心 + `--fix` 時の個別 AdminDisableUser のみ。DB 書き込みは行わない）。

## 9. 完了条件（具体化）

- [ ] `pnpm audit-cognito-sync` で 4 カテゴリの不整合が整形テキストで出力される
- [ ] `--fix` で「DB 削除済 × Cognito 有効」のみ Cognito 無効化される（他カテゴリは変更しない）
- [ ] Cognito ListUsers がページングされ、60 件超でも全件突き合わせできる
- [ ] DB 読み取りに softDelete 済ユーザーが含まれる
- [ ] `classifyDiscrepancies` の単体テストがある（4 カテゴリ + fixable 判定）
- [ ] `cd backend && pnpm lint && pnpm test && pnpm build` が通る
- [ ] 設計書の markdownlint が通る

## 10. 手動動作確認シナリオ

（実 Cognito + DB 接続が前提）

1. 整合した状態で実行 → 不整合 0 件のレポートが出る。
2. 任意ユーザーを DB で論理削除（`deleted_at` 設定）し Cognito は有効のまま → `[c] 修復可` に出る。
3. `--fix` 付きで再実行 → 当該ユーザーが Cognito 無効化され、レポートに「無効化しました」と出る。
4. DB の email を Cognito と変えてみる → `[d] email ミスマッチ` に出る（`--fix` でも変更されない）。
5. DB にのみ / Cognito にのみ存在するユーザーがそれぞれ `[a]` `[b]` に出る。

## 11. 未確定事項

- なし（Phase 2 / Phase 3 で全論点確定済み）。実装計画は Phase 4 で本書末尾に追記する。
