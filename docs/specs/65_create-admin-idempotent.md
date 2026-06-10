# create-admin スクリプトの再実行耐性 設計（TSK-29）

## 0. 課題シート（Notion 転記）

> Notion タスク: [create-admin スクリプトの再実行耐性](https://app.notion.com/p/3589ca7d99dc811d80a1dfd82e902f7d)（TSK-29）

### 背景

`pnpm create-admin` は `AdminCreateUser` を呼ぶため、既に Cognito にユーザーがいると `UsernameExistsException` で失敗する。Local 環境のリセット運用で煩雑。

### 課題

- 既に Cognito にユーザーがいる場合は `AdminGetUser` で sub を取得し、DB のみ INSERT に分岐。
- 既に DB にもユーザーがいる場合は「既存である」旨のメッセージを出して終了（成功扱い）。
- パスワード再設定の挙動は維持（`AdminSetUserPassword` で永続化）。

#### 提案

- 引数または環境変数で `--force-reset-password` のような明示的フラグを設け、それなしでは既存ユーザーのパスワードを上書きしないようにする（誤操作防止）。

### 完了条件（原文）

- Cognito 既存・DB 不在の状態で再実行できる
- DB 既存・Cognito 既存の状態でも安全に終了する
- 何が起きたか（新規作成 / 既存スキップ）が標準出力に出る

---

## 1. 課題サマリ

`backend/scripts/create-admin.ts` を「Cognito / DB の状態を事前確認し、不足だけを補う」冪等スクリプトに書き換える。`AdminGetUser` で Cognito 上の有無を確認し、無ければ `AdminCreateUser` で作成、あれば sub のみ取得して DB INSERT 側に進む。DB は `cognito_sub` 一意制約に依存して `ON CONFLICT (cognito_sub) DO NOTHING` で冪等化。パスワードの永続化は **`--force-reset-password` フラグ指定時のみ** `AdminSetUserPassword` を呼び、それ以外は新規作成時の初期パスワード設定のみ。

## 2. スコープ

### 対象

- backend: `scripts/create-admin.ts` の再実装（冪等化 + `--force-reset-password` フラグ + 状態別メッセージ）
- docs: `docs/65_create-admin-idempotent.md`（本ドキュメント）と `AGENTS.md` 表

### 対象外

- セキュリティモデル（admin の自動作成可否などの方針変更）
- マイグレーション・スキーマ変更
- Cognito 設定の変更
- DB トランザクション境界の見直し（既存どおり 1 INSERT で完結）

## 3. 制約

- 既存の環境変数インタフェース（`ADMIN_EMAIL` / `ADMIN_PASSWORD` / `ADMIN_NAME` / `ADMIN_NAME_KANA` / `COGNITO_USER_POOL_ID` / `COGNITO_REGION`）は維持。
- 新規ユーザー作成時は引き続き `MessageAction='SUPPRESS'`（招待メールを送らない）+ `AdminSetUserPassword(Permanent=true)`。
- 既存ユーザーの role が `user` のままだった場合、本スクリプトでは **role を `admin` に書き換えない**（誤昇格防止）。スクリプト本来の目的は「初期 admin の作成」であり、既存ユーザーの権限変更は管理画面・別スクリプトでやるべき。
- 失敗時はノンゼロ exit code を返す（CI 互換）。

## 4. 設計判断ログ

### 判断 1: 冪等性の取り方 → **`AdminGetUser` で事前確認し、分岐**（採用）

- 既存 `import-cognito-users.ts` と同じ方針。
- 例外で握る案（`AdminCreateUser` を呼んで `UsernameExistsException` を catch）よりも、状態を確認してから動かす方がログが分かりやすい。
- `AdminGetUser` がスローした例外（`UserNotFoundException` 以外）はそのまま伝播。

### 判断 2: パスワード上書きの制御 → **`--force-reset-password` フラグ追加**（採用）

- 既存ユーザーに対して常に `AdminSetUserPassword(Permanent=true, Password=...)` を実行するのは事故リスク（運用 admin のパスワードを誤って書き換える）。
- フラグなし時: 既存 Cognito ユーザーには触らない（パスワードは現状維持）。
- フラグあり時: `AdminSetUserPassword` を実行して環境変数のパスワードに上書き。
- 新規作成時はフラグ不要（`AdminCreateUser` で `TemporaryPassword` を渡したあと `AdminSetUserPassword` で常に永続化＝従来挙動を維持）。

### 判断 3: DB の冪等性 → **`ON CONFLICT (cognito_sub) DO NOTHING`**（採用）

- `cognito_sub` は UNIQUE 制約付き（既存 `UserEntity`）。
- 重複時は `INSERT 0`（影響行 0）で返る。`SELECT ... WHERE` で事後確認して結果メッセージを出す。

### 判断 4: 状態別メッセージ → **5 つのケースを明示**（採用）

| Cognito | DB | 動作 | メッセージ |
| --- | --- | --- | --- |
| なし | なし | Cognito 作成 → パスワード永続化 → DB INSERT | `Cognito + DB に admin を新規作成しました` |
| あり | なし | Cognito 取得（パスワードは触らない、--force 時のみ更新） → DB INSERT | `Cognito 既存・DB なし: DB に INSERT しました（force=false ならパスワード未変更）` |
| なし | あり | (理論上 cognito_sub が DB と Cognito で 1:1 のため発生しない。発生した場合は警告して終了) | `DB のみ存在: cognito_sub が Cognito にありません。手動確認が必要です` + 非ゼロ exit |
| あり | あり (同 sub) | 何もしない（--force 時のみパスワード更新） | `Cognito + DB ともに既存。スキップ（force=false）/ パスワードのみ更新（force=true）` |
| あり | あり (別 sub) | DB に別 sub の同 email がいる異常。終了 | `DB に別 sub の admin が既に居ます。手動対応が必要です` + 非ゼロ exit |

### 判断 5: role の扱い → **既存 DB ユーザーが user でも昇格しない**（採用）

- 既存ユーザーの role を本スクリプトで変えない（誤操作防止）。
- 既存 DB ユーザーが `user` のままだった場合は警告ログのみで終了（exit code 0）。`role` を変えたい場合は別スクリプト・管理画面で対応。

## 5. データモデル

なし（既存スキーマ変更なし）。

## 6. CLI / 環境変数仕様

### 環境変数（既存維持）

- `ADMIN_EMAIL` / `ADMIN_PASSWORD` / `ADMIN_NAME` / `ADMIN_NAME_KANA` / `COGNITO_USER_POOL_ID` / `COGNITO_REGION`

### CLI フラグ

- `--force-reset-password`（任意）: 指定したときのみ既存 Cognito ユーザーのパスワードを `AdminSetUserPassword(Permanent=true)` で上書きする。

### 終了コード

- 0: 正常（作成 / スキップ / 既存）
- 1: 異常（DB のみ存在 / 別 sub の admin が存在 / SDK エラー / 環境変数不足）

## 7. 既存設計との差分

- `scripts/create-admin.ts` を冪等版に置き換え（既存挙動は「`AdminCreateUser` → `AdminSetUserPassword` → DB INSERT」の 3 ステップ無条件実行）。
- `docs/65_create-admin-idempotent.md` 新設、`AGENTS.md` 表に追記。

## 8. トランザクション境界

- Cognito → DB の補償は **行わない**（初期 admin 作成スクリプトのため、運用フェーズではない）。Cognito 作成成功・DB INSERT 失敗時は手動で `audit-cognito-sync` か `import-cognito-users` で復旧する想定。

## 9. 完了条件（具体化）

- [ ] Cognito 既存・DB 不在の状態で再実行できる（DB INSERT のみ走る）
- [ ] Cognito 既存・DB 既存（同 sub）の状態で再実行しても何もせず exit 0（メッセージは出る）
- [ ] `--force-reset-password` 指定時のみ既存 Cognito ユーザーのパスワードが更新される
- [ ] DB 既存・Cognito 不在の異常状態を検知して exit 1
- [ ] DB に別 sub の同 email admin がいる異常を検知して exit 1
- [ ] 何が起きたか（新規作成 / 既存スキップ / DB のみ INSERT / パスワード更新）が標準出力に出る
- [ ] `cd backend && pnpm lint && pnpm build` 通過

## 10. 手動動作確認シナリオ

1. **クリーン状態**: Cognito も DB も空 → `pnpm create-admin` → 「Cognito + DB に admin を新規作成しました」
2. **再実行（同 sub）**: 直後にもう一度 `pnpm create-admin` → 「Cognito + DB ともに既存。スキップ」、exit 0、DB は変わらず
3. **DB だけ削除して再実行**: `DELETE FROM petal.users WHERE email = ...` → `pnpm create-admin` → 「Cognito 既存・DB なし: DB に INSERT しました」、パスワードは未変更
4. **パスワード更新**: `pnpm create-admin -- --force-reset-password` → 「パスワードを更新しました」、新パスワードでログイン確認
5. **異常検知**: DB の cognito_sub を別の sub に書き換えて再実行 → 「DB に別 sub の admin が既に居ます」、exit 1

## 11. 未確定事項

- なし。

---

## 12. 実装計画（Phase 4）

### 12.1 変更・追加ファイル

- `backend/scripts/create-admin.ts`（書き換え）
- `docs/65_create-admin-idempotent.md`（新規）
- `AGENTS.md`（変更）

migration / 環境変数 / 依存追加: なし。

### 12.2 作業順序（コミット単位）

1. **スクリプト書き換え + コメント更新** — 完了確認: `cd backend && pnpm lint && pnpm build` 通過、`pnpm create-admin -- --help` 相当（無効引数で usage 表示）が動く

### 12.3 テスト方針

- 純粋ロジックは少なく、I/O 中心のため手動シナリオで担保（§10）。

### 12.4 想定外時の判断ルール（タスク固有）

- **AI 単独判断 OK**: 出力文言、フラグ名の細部、メッセージのトーン。
- **中断して相談**:
  - 既存 DB ユーザーが `user` ロールだった場合に「admin に昇格させる」案へ切替
  - パスワードを env 経由ではなく対話入力にする案

### 12.5 事前解決済みの判断ポイント（ドライラン結果）

| # | 判断ポイント | 解決 |
| - | ------------ | ---- |
| 1 | 冪等の取り方 | `AdminGetUser` で事前確認 |
| 2 | パスワード上書き | `--force-reset-password` フラグでのみ実行 |
| 3 | DB 冪等 | `ON CONFLICT (cognito_sub) DO NOTHING` + 事後 SELECT |
| 4 | role 既存ユーザー | 昇格しない（警告ログのみ、exit 0） |
| 5 | 異常検知 | DB のみ存在 / 別 sub の同 email → exit 1 |
| 6 | 互換性 | 既存環境変数は維持、フラグ追加のみ |
