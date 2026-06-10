# API 設計

REST API。バックエンド（NestJS）が OpenAPI 仕様を生成し、フロントエンドが型付きクライアントを生成する。

## 設計方針

- DTO クラス（`backend/src/<feature>/controller/*.dto.ts`）が **API 契約の真実のソース**。
- 認証必須エンドポイントは `@ApiBearerAuth('bearer')` を付け、`JwtAuthGuard` で保護する。Public なものは `@Public()` を付ける。
- admin 限定は `@Roles(UserRole.Admin)` + `RolesGuard` で保護する。
- 外部入力（リクエストボディ・クエリ）は Zod でバリデーションする。
- レスポンスの `Date` は controller の整形関数で `toISOString()` し、DTO は `string`（`format: date-time`）として宣言する。

## エンドポイント一覧

`Auth` 列: 🌐=Public / 🔑=要認証 / 👑=admin 限定。

### auth（[backend/src/auth/controller/auth.controller.ts](../../backend/src/auth/controller/auth.controller.ts)）

| メソッド | パス | Auth | 概要 |
| -------- | ---- | ---- | ---- |
| POST | /auth/login | 🌐 | ログイン（チャレンジ応答あり） |
| POST | /auth/logout | 🔑 | ログアウト（GlobalSignOut） |
| GET | /auth/signup-config | 🌐 | セルフサインアップ可否の公開設定 |
| POST | /auth/signup | 🌐 | セルフサインアップ |
| POST | /auth/confirm-signup | 🌐 | サインアップ確認 |
| POST | /auth/change-password | 🔑 | パスワード変更 |
| POST | /auth/forgot-password | 🌐 | パスワードリセット要求 |
| POST | /auth/confirm-forgot-password | 🌐 | パスワードリセット確定 |
| POST | /auth/refresh | 🌐 | アクセストークン更新 |
| POST | /auth/challenge/new-password | 🌐 | 初回ログインの新パスワード設定 |
| POST | /auth/challenge/mfa | 🌐 | MFA チャレンジ応答 |
| POST | /auth/mfa/setup | 🔑 | MFA(TOTP) セットアップ開始 |
| POST | /auth/mfa/verify | 🔑 | MFA セットアップ検証 |
| POST | /auth/mfa/disable | 🔑 | MFA 無効化 |

### users（[backend/src/user/controller/user.controller.ts](../../backend/src/user/controller/user.controller.ts)）

| メソッド | パス | Auth | 概要 |
| -------- | ---- | ---- | ---- |
| GET | /users/me | 🔑 | 自分の情報（role 含む） |
| PATCH | /users/me | 🔑 | 自分の name/nameKana 変更 |
| PATCH | /users/me/email | 🔑 | メール変更開始（検証コード送信） |
| POST | /users/me/email/verify | 🔑 | メール変更確定 |
| GET | /users | 👑 | ユーザー一覧（ページング/検索/フィルタ） |
| GET | /users/:id | 👑 | ユーザー詳細 |
| POST | /users | 👑 | ユーザー作成（Cognito 招待 + DB） |
| PATCH | /users/:id | 👑 | ユーザー更新 |
| DELETE | /users/:id | 👑 | ユーザー削除（論理 + GlobalSignOut） |
| POST | /users/:id/restore | 👑 | 削除済みユーザー復活 |
| POST | /users/:id/resend-invite | 👑 | 招待メール再送 |

### images（[backend/src/image/controller/image.controller.ts](../../backend/src/image/controller/image.controller.ts)）

| メソッド | パス | Auth | 概要 |
| -------- | ---- | ---- | ---- |
| POST | /images | 🔑 | 画像アップロード |
| GET | /images | 🔑 | 自分の画像一覧 |
| GET | /images/:id | 🔑 | 画像詳細 |
| GET | /images/:id/download-url | 🔑 | 署名付きダウンロード URL |
| DELETE | /images/:id | 🔑 | 画像削除（論理） |

### audit-logs（[backend/src/audit/controller/audit-log.controller.ts](../../backend/src/audit/controller/audit-log.controller.ts)）

| メソッド | パス | Auth | 概要 |
| -------- | ---- | ---- | ---- |
| GET | /audit-logs | 👑 | 監査ログ一覧 |

## OpenAPI / 型生成

```text
backend/openapi.json              ← Backend が生成（Git 管理）
frontend/src/lib/openapi/         ← openapi-typescript が生成する型 + 型付きクライアント
frontend/src/lib/api.ts           ← UI から呼ぶドメイン別 API ラッパ
```

- `@nestjs/swagger` + Swagger CLI Plugin（`backend/nest-cli.json`）で DTO から自動推論。enum / `Date` 等は `@ApiProperty` を付与。
- Swagger UI: `http://localhost:3000/api-docs`、JSON: `/api-docs-json`（`pnpm start:dev` 中）。

再生成フロー（DTO 変更時は **必ず** この順で実行し生成物をコミット）:

```bash
cd backend  && pnpm openapi:export   # backend/openapi.json を更新
cd frontend && pnpm openapi:gen      # src/lib/openapi の型を更新
```

利用例:

```ts
import { imageApi } from '@/lib/api';
import type { Schemas } from '@/lib/openapi/client';
type ImageItem = Schemas['ImageResponseDto'];
const items: ImageItem[] = await imageApi.findAll();
```

## エラー・共通処理

- フロントは `lib/api.ts` の `unwrap()` を経由して共通エラー処理を行う。`apiClient` を直接呼ばない。
- 認証トークン付与・リフレッシュは `lib/openapi/client.ts` の middleware で自動化。
- ログインロックアウト時は 429、セルフサインアップ無効時は 403 など、機能側で意味のあるステータスを返す（各機能ドキュメント参照）。

## 関連ドキュメント

- フロントの API 利用 → [03_frontend-architecture.md](03_frontend-architecture.md)
- 認可 → [20_features/05_authorization.md](../20_features/05_authorization.md)
- 原典 → [specs/13_openapi.md](../specs/13_openapi.md)
