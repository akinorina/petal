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
| 成功時のセッション | **全セッションを失効させる**（成功後に GlobalSignOut → `/login` へ誘導し再ログイン） |
| フロント配置 | **`/me/password` サブページ**（`/me/email`・`/me/mfa` と同じ構成） |
| ポリシー事前検証 | 既存 `PasswordPolicyChecklist` / `evaluatePasswordForm` を再利用 |

---

## 1. 課題サマリ

ログイン中ユーザーが現在のパスワードと新しいパスワードを入力して自分のパスワードを変更できる `POST /auth/change-password` を追加する。バックエンドは access token で Cognito `ChangePassword` を呼び、成功後に `GlobalSignOut` で全セッションを失効させる（DB は触らない）。現在のトークンも無効化されるため、フロントは成功後にセッションをクリアして `/login` へ誘導し再ログインを促す。フォームは `/me/password` サブページに置き、ポリシー事前検証は既存共通モジュールを再利用する。

## 2. スコープ

### 対象

- backend: `POST /auth/change-password`（認証済み・`previousPassword` / `proposedPassword`）
- backend: `CognitoAuthClient.changePassword` と `AuthService.changePassword`（エラーマッピング + 成功後 `globalSignOut`）
- frontend: `/me/password` ページ + `authApi.changePassword`、成功後のセッションクリア + `/login` 誘導、マイページ導線に追加

### 対象外

- パスワードポリシーの新規定義（既存 Cognito 設定 + 既存フロント共通モジュールを利用）
- DB 変更（パスワードは Cognito 管理）
- 「現在の端末だけセッションを残す」挙動（Cognito の `GlobalSignOut` は全トークンを失効させるため不可）

## 3. 制約

- 認可: グローバル `JwtAuthGuard` 配下（`@Public` を付けない）。access token は `Authorization` ヘッダーから取得し Cognito に渡す。
- オニオン依存方向維持（Cognito 呼び出しは Infra クライアントに閉じる）。
- DB スキーマ変更・migration なし。

## 4. 設計判断ログ

### 判断 1: エンドポイント → **`POST /auth/change-password`（認証必須・204）**（採用）

- 既存の authenticated な auth エンドポイント（logout / mfa/*）と同様、`@Public` を付けず `extractBearer` で access token を取り出して Cognito に渡す。
- レスポンスは `204 No Content`。

### 判断 2: セッション → **成功後に全セッション失効（GlobalSignOut）**（採用）

- パスワード変更成功後に `cognitoAuth.globalSignOut(accessToken)` を呼び、全端末のトークンを失効させる。
- **理由**: 旧パスワードで発行済みのトークン（盗難・共有端末に残存する可能性）を確実に無効化し、セキュリティを高める。
- `globalSignOut` の失敗は **warn ログのみ**でパスワード変更自体は成功扱い（`confirmForgotPassword` と同じ補償方針）。
- **トレードオフ**: Cognito の `GlobalSignOut` は現在の端末のトークンも失効させるため、変更したユーザーは再ログインが必要になる。フロントは成功後にセッションをクリアして `/login` へ誘導する（§判断 4）。

### 判断 3: エラーマッピング（採用）

| Cognito 例外 | HTTP | メッセージ |
| --- | --- | --- |
| `NotAuthorizedException` | 401 | 現在のパスワードが正しくありません |
| `InvalidPasswordException` | 400 | 新しいパスワードがポリシーに合致していません |
| `LimitExceededException` | 429 | 回数が多すぎます。しばらくしてから再度お試しください |
| その他 | 502 | パスワード変更に失敗しました |

- access token は `JwtAuthGuard` で検証済みのため、`NotAuthorizedException` は実質「旧パスワード不一致」を意味する。

### 判断 4: フロント → **`/me/password` サブページ + `apiClient`（自動 Bearer）+ 成功後に再ログイン誘導**（採用）

- `mfaApi` 等と同様に `apiClient.POST('/auth/change-password', ...)`（openapi-fetch の middleware が access token を自動付与・refresh 連携）を使う。
- フォームは「現在のパスワード」「新しいパスワード」「新しいパスワード（確認）」+ `PasswordPolicyChecklist`。`evaluatePasswordForm` で送信可否を判定。
- 成功後はバックエンドの `GlobalSignOut` で現在のトークンも無効になるため、**セッションをクリアして `/login` へ遷移**し、「パスワードを変更しました。再度ログインしてください」を表示する（メッセージ伝達は `sessionStorage` 経由、または成功画面に CTA を出す）。

## 5. データモデル

DB 変更なし（パスワードは Cognito 管理）。

## 6. API 仕様

### `POST /auth/change-password`（認証必須）

リクエスト:

```json
{ "previousPassword": "OldPass1!", "proposedPassword": "NewPass1!" }
```

- Zod `ChangePasswordSchema`: `previousPassword`(min 1) / `proposedPassword`(min 8)
- 処理: `Authorization` ヘッダーの access token + 入力を `authService.changePassword` に渡し、`cognitoAuth.changePassword(accessToken, previous, proposed)`（`ChangePasswordCommand`）を呼ぶ。成功後に `cognitoAuth.globalSignOut(accessToken)`（失敗は warn ログのみ）
- レスポンス: `204 No Content`
- エラー: 判断 3 のマッピング

## 7. 既存設計との差分

- `CognitoAuthClient` に `changePassword` と `isLimitExceeded` を追加。
- `AuthService` に `changePassword` を追加。
- `AuthController` に `POST /auth/change-password`（認証必須・204）を追加。
- frontend: `/me/password` ページ・hook 新設、`authApi.changePassword` 追加、`/me`・`/me/email`・`/me/mfa` の nav に「パスワード変更」を追加、`schema.d.ts` 再生成。
- DB・migration 変更なし。

## 8. トランザクション境界

なし（Cognito の `ChangePassword` → `GlobalSignOut` の順。後者は冪等・補償不要で、失敗しても変更は成立。DB 書き込みなし）。

## 9. 完了条件（具体化）

- [ ] `POST /auth/change-password` が旧 + 新パスワードで成功し `204` を返す
- [ ] 成功後に `GlobalSignOut` が呼ばれ、旧トークンが失効する
- [ ] 変更後、新パスワードでログインできる（手動）
- [ ] 旧パスワード誤りで `401`、ポリシー違反で `400` の日本語メッセージが返る
- [ ] フロント `/me/password` で変更でき、成功時はセッションがクリアされ `/login` へ誘導・再ログインを促すメッセージが出る
- [ ] `/me`・`/me/email`・`/me/mfa`・`/me/password` を導線で行き来できる
- [ ] `AuthService.changePassword` の単体テスト（成功時 globalSignOut 呼出を含む）がある
- [ ] `cd backend && pnpm lint && pnpm test && pnpm build` / `cd frontend && pnpm lint && pnpm build` が通る

## 10. 手動動作確認シナリオ

1. ログインし `/me` →「パスワード変更」→ `/me/password` に遷移。
2. 現在のパスワード + ポリシーを満たす新パスワード（確認一致）を入力 → 保存で成功 → `/login` に遷移し「パスワードを変更しました。再度ログインしてください」が表示される。
3. 新パスワードでログインできる（旧パスワードではログインできない）。
4. 現在のパスワードを誤って入力 → 「現在のパスワードが正しくありません」が表示される。
5. ポリシー違反の新パスワード → チェックリストで弾かれる / `400` メッセージ。
6. 変更前に別端末でログインしていたセッションが、変更後は無効化されている（API が 401 になる）。

## 11. 未確定事項

- なし（Phase 2 / Phase 3 で全論点確定済み）。

---

## 12. 実装計画（Phase 4）

### 12.1 変更・追加ファイル

#### backend

- `src/auth/infra/cognito-auth.client.ts`（変更）: `changePassword(accessToken, prev, proposed)` + `isLimitExceeded`（`ChangePasswordCommand` / `LimitExceededException` を import）
- `src/auth/application/auth.service.ts`（変更）: `changePassword` + エラーマッピング（`HttpException`/`HttpStatus` で 429）+ 成功後 `globalSignOut`（warn ログのみで握り潰し）
- `src/auth/application/auth.schemas.ts`（変更）: `ChangePasswordSchema`
- `src/auth/controller/auth.dto.ts`（変更）: `ChangePasswordRequestDto`
- `src/auth/controller/auth.controller.ts`（変更）: `POST /auth/change-password`（`@Public` なし・204・`extractBearer`）
- `src/auth/application/auth.service.spec.ts`（変更）: `changePassword` テスト + cognito モックに `changePassword`/`isLimitExceeded` 追加
- `openapi.json`（再生成）

#### frontend

- `src/lib/api.ts`（変更）: `authApi.changePassword(body)`（`apiClient.POST('/auth/change-password')`）
- `src/app/(admin)/me/password/page.tsx`（新規）: 現在/新/確認 + `PasswordPolicyChecklist`
- `src/app/(admin)/me/password/use-me-password-page.ts`（新規）: 成功後にセッションクリア + `/login` 遷移、再ログイン用メッセージ伝達
- `src/app/login/...`（変更・必要時）: 再ログイン誘導メッセージの表示（`sessionStorage` 経由）
- `src/app/(admin)/me/page.tsx` / `me/email/page.tsx` / `me/mfa/page.tsx`（変更）: nav に「パスワード変更」追加
- `src/lib/openapi/schema.d.ts`（再生成）

migration / 環境変数 / 依存追加: なし。

### 12.2 作業順序（コミット単位）

1. **backend: change-password エンドポイント + テスト + openapi 再生成** — 完了確認 `cd backend && pnpm lint && pnpm test && pnpm build`、`/auth/change-password` が openapi.json に出る
2. **frontend: /me/password ページ + api + 導線 + schema 再生成** — 完了確認 `cd frontend && pnpm lint && pnpm build`

### 12.3 テスト方針

- `auth.service.spec.ts`: 正常（changePassword + globalSignOut 呼出）/ globalSignOut 失敗でも成功扱い / NotAuthorized→401 / InvalidPassword→400 / LimitExceeded→429 / その他→502 をカバー。
- frontend はユニットテスト無し（lint/build で担保）。手動シナリオ（§10）で確認。

### 12.4 想定外時の判断ルール（タスク固有）

- **AI 単独判断 OK**: 画面文言・フォーム配置、nav リンク文言。
- **中断して相談**: API 仕様/スキーマ変更、GlobalSignOut（セッション失効）方針の変更、Cognito エラー分類が想定と異なる場合。

### 12.5 事前解決済みの判断ポイント（ドライラン結果）

| # | 判断ポイント | 解決 |
| - | ------------ | ---- |
| 1 | レスポンス | `204 No Content` |
| 2 | エラーマッピング | NotAuthorized→401 / InvalidPassword→400 / LimitExceeded→429 / その他→502 |
| 3 | access token | `extractBearer` で取得し Cognito `ChangePassword` に渡す（DB 不使用） |
| 4 | フロント呼び出し | `apiClient`（authApi）で自動 Bearer 付与（mfaApi と同方式） |
| 5 | 送信可否 | `current != '' && evaluatePasswordForm(...).canSubmit` |
| 6 | 成功後 | backend で `globalSignOut`、frontend は `clearSession()` → `/login` 遷移。再ログイン誘導メッセージは `sessionStorage` 経由で login 画面に表示 |
| 7 | 導線 | `/me`・`/me/email`・`/me/mfa`・`/me/password` の nav 相互リンク |
| 8 | spec モック | `buildMockCognitoAuth` に `changePassword`/`isLimitExceeded` を追加（`globalSignOut` は既存） |
| 9 | globalSignOut 失敗時 | warn ログのみでパスワード変更は成功扱い（補償しない） |
