# 監査ログ

ユーザー管理操作（作成・更新・削除・復活など）を記録し、管理者が閲覧する。**追記専用**で論理削除しない。
実装: [backend/src/audit/](../../backend/src/audit/) / フロント [frontend/src/app/(admin)/(admin-only)/audit-logs/](../../frontend/src/app/(admin)/(admin-only)/audit-logs/), [frontend/src/lib/api-hooks/use-audit-logs-api.ts](../../frontend/src/lib/api-hooks/use-audit-logs-api.ts)

## データモデル

`petal.audit_logs`（[audit-log.entity.ts](../../backend/src/audit/infra/audit-log.entity.ts)）:

| カラム | 説明 |
| ------ | ---- |
| actor_user_id | 操作者 |
| action | 操作種別（`AuditAction` enum） |
| target_user_id | 操作対象ユーザー（nullable） |
| metadata | 付随情報（jsonb） |
| created_at | 記録日時 |

- `deleted_at` を持たない**追記専用テーブル**。UPDATE / DELETE 系 API を提供しないことで履歴として永続させる。
- actor / target / created_at にインデックス。

## 記録

- `UserService` のユーザー管理操作に連動して監査ログを INSERT する。
- 自分のプロフィール変更（`PATCH /users/me`）は監査対象外（[03_self-service-account.md](03_self-service-account.md)）。

## 閲覧

- `GET /audit-logs`（admin 限定 `@Roles(UserRole.Admin)`）。
- admin 画面で一覧表示。

## 関連ドキュメント

- ユーザー管理 → [02_user-management.md](02_user-management.md)
- 認可 → [05_authorization.md](05_authorization.md)
- DB スキーマ → [10_architecture/05_database-schema.md](../10_architecture/05_database-schema.md)
- 原典 → [specs/28_audit-logs.md](../specs/28_audit-logs.md)
