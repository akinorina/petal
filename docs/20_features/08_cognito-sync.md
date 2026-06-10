# Cognito ⇔ DB 同期

Cognito と DB（`petal.users`）の整合性を保つための運用スクリプト群。`cognito_sub` をキーに突き合わせる。
実装: [backend/scripts/](../../backend/scripts/)

## 不整合検知 / 修復（audit）

- `audit-cognito-sync`: `sub` をキーに DB と Cognito を突き合わせ、**4 分類**でレポート。
- `--fix` は「**削除済 × Cognito 有効 → 無効化**」のみ実行（安全側）。
- 分類ロジックは純粋関数（`classifyDiscrepancies`）として単体テスト。
- 原典: [specs/58_cognito-sync-audit.md](../specs/58_cognito-sync-audit.md)

## 同期インポート（管理者用）

- `backend/scripts/import-cognito-users.ts`。
- `--mode cognito-to-db | db-to-cognito` + `--email | --all` + `--dry-run`。
- 差分検出は既存の `classifyDiscrepancies` を再利用。
- Mode B（db-to-cognito）は `MessageAction=SUPPRESS` で作成し、新 `sub` を DB に反映。
- 原典: [specs/64_cognito-sync-import.md](../specs/64_cognito-sync-import.md)

## create-admin（再実行耐性）

- 初期管理者作成スクリプト。`AdminGetUser` で事前確認 → 必要分だけ作成。
- DB は `ON CONFLICT (cognito_sub) DO NOTHING`。
- `--force-reset-password` 指定時のみパスワード上書き。状態別メッセージで結果を可視化（べき等）。
- 原典: [specs/65_create-admin-idempotent.md](../specs/65_create-admin-idempotent.md)

## 観測性

Cognito SDK 呼び出しは `runWithCognitoMetrics(op, fn)` で包み、`{msg, op, result, latencyMs, errorCode}` を 1 行 JSON で出力する。詳細は [30_operations/07_observability.md](../30_operations/07_observability.md)。

## 関連ドキュメント

- ユーザー管理 → [02_user-management.md](02_user-management.md)
- 認可（DB を真実とする理由）→ [05_authorization.md](05_authorization.md)
- Cognito 構築 → [30_operations/02_cognito-setup.md](../30_operations/02_cognito-setup.md)
- 観測性 → [30_operations/07_observability.md](../30_operations/07_observability.md)
