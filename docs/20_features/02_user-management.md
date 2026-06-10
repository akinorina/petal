# ユーザー管理

管理者（admin）によるユーザーの作成・編集・削除・復活・招待再送と、一覧（ページング/検索/フィルタ）。
実装: [backend/src/user/](../../backend/src/user/) / フロント [frontend/src/app/(admin)/(admin-only)/users/](../../frontend/src/app/(admin)/(admin-only)/users/), [frontend/src/lib/api-hooks/use-users-api.ts](../../frontend/src/lib/api-hooks/use-users-api.ts)

すべて admin 限定（`@Roles(UserRole.Admin)`）。認可は [05_authorization.md](05_authorization.md) を参照。

## エンドポイント

| メソッド | パス | 概要 |
| -------- | ---- | ---- |
| GET | /users | 一覧（ページング/検索/フィルタ） |
| GET | /users/:id | 詳細 |
| POST | /users | 作成（Cognito 招待 + DB 登録） |
| PATCH | /users/:id | 更新 |
| DELETE | /users/:id | 削除（論理 + GlobalSignOut） |
| POST | /users/:id/restore | 削除済みを復活 |
| POST | /users/:id/resend-invite | 招待メール再送 |

## ユーザー作成

- Cognito に `AdminCreateUser` で招待（初回ログイン時に新パスワード設定）し、DB に `users` レコードを INSERT。
- DB と Cognito を同時に変えるため、トランザクション境界 + 外部副作用の順序を守る（[10_architecture/02_backend-architecture.md](../10_architecture/02_backend-architecture.md)）。
- 原典: [specs/15_user-management-enhancement.md](../specs/15_user-management-enhancement.md)

## 削除と復活（論理削除）

- 削除は `deleted_at` を立てる**論理削除**。同時に Cognito を無効化し、**GlobalSignOut** で既存トークンを失効させる（削除済みユーザーが既存トークンで API を叩けないようにする）。
- 復活（`/restore`）は `deleted_at` をクリアし Cognito を再有効化。
- 削除済みユーザーの閲覧・復活 UI は admin 画面で提供。
- 原典: [specs/16_user-restore.md](../specs/16_user-restore.md), [specs/17_deleted-users-ui.md](../specs/17_deleted-users-ui.md), [specs/23_user-token-revocation-on-delete.md](../specs/23_user-token-revocation-on-delete.md)

## 最後の admin の保護

- DELETE / PATCH `/users/:id` で **最後の admin** の削除・降格を拒否する（admin 数チェック）。自分自身の削除も拒否。
- 違反時は `LastAdminConflictException`（[backend/src/common/exceptions/last-admin-conflict.exception.ts](../../backend/src/common/exceptions/last-admin-conflict.exception.ts)）。
- 原典: [specs/26_last-admin-protection.md](../specs/26_last-admin-protection.md)

## 招待メール再送

- `POST /users/:id/resend-invite`: `AdminGetUser` で状態確認 → `AdminCreateUser(MessageAction=RESEND)`。
- `UserResponseDto` に `invitationPending` を付加し、UI で未確認ユーザーにのみ再送ボタンを表示。
- 原典: [specs/62_resend-invite.md](../specs/62_resend-invite.md)

## 一覧（ページング/検索/フィルタ）

- `GET /users` は `{ items, total, limit, offset }` を返す。
- `q` で email / name / nameKana の OR `ILIKE` 部分一致、`role` / `deleted` フィルタ。
- フロントは URL クエリ同期 + デバウンス 300ms。
- 原典: [specs/61_user-list-pagination.md](../specs/61_user-list-pagination.md)

## ロール

`admin` / `user`。DB の `users.role` を単一の真実とし、認可で利用する。ロールと Cognito グループの同期は [05_authorization.md](05_authorization.md) / [08_cognito-sync.md](08_cognito-sync.md) を参照。

## 関連ドキュメント

- 認可 → [05_authorization.md](05_authorization.md)
- 監査ログ（操作記録）→ [06_audit-logs.md](06_audit-logs.md)
- Cognito ⇔ DB 同期 → [08_cognito-sync.md](08_cognito-sync.md)
- 自分の情報変更 → [03_self-service-account.md](03_self-service-account.md)
