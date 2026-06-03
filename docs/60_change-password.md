# 自分のパスワード変更 API 設計（TSK-22）

## 0. 課題シート（Notion 転記）

> Notion タスク: [自分のパスワード変更 API](https://app.notion.com/p/3589ca7d99dc81fdb91bee961b3dd9a2)（TSK-22）

### 背景

ログイン中ユーザーが任意にパスワードを変更する手段がない。

### 課題

- `POST /auth/change-password` を実装。Cognito の `ChangePassword`（access token を使用）を呼ぶ。
- 入力: `previousPassword` / `proposedPassword`。
- フロントのマイページにフォームを追加。

### 完了条件（原文）

- 自身の旧パスワード + 新パスワードで変更が成功する
- 新パスワードでログインできる
- 失敗時のエラーメッセージが日本語で適切に表示される

### Phase 2 で確定した方針

| 論点 | 確定 |
| ---- | ---- |
| 認可 | 認証済みのみ（`@Public` ではない）。access token で Cognito `ChangePassword` |
| 成功時のセッション | **既存セッションを失効させない**（GlobalSignOut しない・Cognito 既定に従う） |
| フロント配置 | **`/me/password` サブページ**（`/me/email`・`/me/mfa` と同じ構成） |
| ポリシー事前検証 | 既存 `PasswordPolicyChecklist` / `evaluatePasswordForm` を再利用 |

---

## 1. 課題サマリ

ログイン中ユーザーが現在のパスワードと新しいパスワードを入力して自分のパスワードを変更できる `POST /auth/change-password` を追加する。バックエンドは access token で Cognito `ChangePassword` を呼ぶだけで、DB は触らない。成功してもセッションは維持する（再ログイン不要）。フロントは `/me/password` サブページにフォームを置き、ポリシー事前検証は既存共通モジュールを再利用する。

## 2. スコープ

### 対象

- backend: `POST /auth/change-password`（認証済み・`previousPassword` / `proposedPassword`）
- backend: `CognitoAuthClient.changePassword` と `AuthService.changePassword`（エラーマッピング）
- frontend: `/me/password` ページ + `authApi.changePassword`、マイページ導線に追加

### 対象外

- 成功時の全セッション失効（GlobalSignOut）
- パスワードポリシーの新規定義（既存 Cognito 設定 + 既存フロント共通モジュールを利用）
- DB 変更（パスワードは Cognito 管理）

## 3. 制約

- 認可: グローバル `JwtAuthGuard` 配下（`@Public` を付けない）。access token は `Authorization` ヘッダーから取得し Cognito に渡す。
- オニオン依存方向維持（Cognito 呼び出しは Infra クライアントに閉じる）。
- DB スキーマ変更・migration なし。

## 4. 設計判断ログ

### 判断 1: エンドポイント → **`POST /auth/change-password`（認証必須・204）**（採用）

- 既存の authenticated な auth エンドポイント（logout / mfa/*）と同様、`@Public` を付けず `extractBearer` で access token を取り出して Cognito に渡す。
- レスポンスは `204 No Content`。

### 判断 2: セッション → **失効させない**（採用）

- タスク方針どおり `GlobalSignOut` は呼ばない。パスワード変更後も現在のトークンは有効なまま（Cognito 既定）。
- 全端末ログアウトは将来の別タスクで検討余地（セキュリティ強化時）。

### 判断 3: エラーマッピング（採用）

| Cognito 例外 | HTTP | メッセージ |
| --- | --- | --- |
| `NotAuthorizedException` | 401 | 現在のパスワードが正しくありません |
| `InvalidPasswordException` | 400 | 新しいパスワードがポリシーに合致していません |
| `LimitExceededException` | 429 | 回数が多すぎます。しばらくしてから再度お試しください |
| その他 | 502 | パスワード変更に失敗しました |

- access token は `JwtAuthGuard` で検証済みのため、`NotAuthorizedException` は実質「旧パスワード不一致」を意味する。

### 判断 4: フロント → **`/me/password` サブページ + `apiClient`（自動 Bearer）**（採用）

- `mfaApi` 等と同様に `apiClient.POST('/auth/change-password', ...)`（openapi-fetch の middleware が access token を自動付与・refresh 連携）を使う。
- フォームは「現在のパスワード」「新しいパスワード」「新しいパスワード（確認）」+ `PasswordPolicyChecklist`。`evaluatePasswordForm` で送信可否を判定。

## 5. データモデル

DB 変更なし（パスワードは Cognito 管理）。

## 6. API 仕様

### `POST /auth/change-password`（認証必須）

リクエスト:

```json
{ "previousPassword": "OldPass1!", "proposedPassword": "NewPass1!" }
```

- Zod `ChangePasswordSchema`: `previousPassword`(min 1) / `proposedPassword`(min 8)
- 処理: `Authorization` ヘッダーの access token + 入力を `authService.changePassword` に渡し、`cognitoAuth.changePassword(accessToken, previous, proposed)`（`ChangePasswordCommand`）を呼ぶ
- レスポンス: `204 No Content`
- エラー: 判断 3 のマッピング

## 7. 既存設計との差分

- `CognitoAuthClient` に `changePassword` と `isLimitExceeded` を追加。
- `AuthService` に `changePassword` を追加。
- `AuthController` に `POST /auth/change-password`（認証必須・204）を追加。
- frontend: `/me/password` ページ・hook 新設、`authApi.changePassword` 追加、`/me`・`/me/email`・`/me/mfa` の nav に「パスワード変更」を追加、`schema.d.ts` 再生成。
- DB・migration 変更なし。

## 8. トランザクション境界

なし（Cognito の単一操作のみ・DB 書き込みなし）。

## 9. 完了条件（具体化）

- [ ] `POST /auth/change-password` が旧 + 新パスワードで成功し `204` を返す
- [ ] 変更後、新パスワードでログインできる（手動）
- [ ] 旧パスワード誤りで `401`、ポリシー違反で `400` の日本語メッセージが返る
- [ ] フロント `/me/password` で変更でき、成功/失敗が表示される
- [ ] `/me`・`/me/email`・`/me/mfa`・`/me/password` を導線で行き来できる
- [ ] `AuthService.changePassword` の単体テストがある
- [ ] `cd backend && pnpm lint && pnpm test && pnpm build` / `cd frontend && pnpm lint && pnpm build` が通る

## 10. 手動動作確認シナリオ

1. ログインし `/me` →「パスワード変更」→ `/me/password` に遷移。
2. 現在のパスワード + ポリシーを満たす新パスワード（確認一致）を入力 → 保存で成功表示。
3. 一旦ログアウトし、新パスワードでログインできる。
4. 現在のパスワードを誤って入力 → 「現在のパスワードが正しくありません」が表示される。
5. ポリシー違反の新パスワード → チェックリストで弾かれる / `400` メッセージ。
6. 変更成功後も再ログインを求められない（セッション維持）。

## 11. 未確定事項

- なし（Phase 2 / Phase 3 で全論点確定済み）。実装計画は Phase 4 で本書末尾に追記する。
