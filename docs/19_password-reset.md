# Petal - パスワードリセット 設計

対応タスク: **TSK-8「パスワードリセット」**

関連ドキュメント:

- [docs/03_workflow.md](03_workflow.md)
- [docs/11_user-info_and_authentication.md](11_user-info_and_authentication.md)
- [docs/15_user-management-enhancement.md](15_user-management-enhancement.md)
- [docs/18_logout-api.md](18_logout-api.md)

---

## 1. スコープと完了条件

### 対象

- **Backend**:
  - `POST /auth/forgot-password` — Cognito の `ForgotPassword` を呼んで検証コードをメール送信。
  - `POST /auth/confirm-forgot-password` — `ConfirmForgotPassword` でコード + 新パスワードを受け取り確定し、続けて `AdminUserGlobalSignOut` で既存トークンを失効させる。
- **Frontend**:
  - `/forgot-password` ページを新設（2 ステップ: メール入力 → コード入力 + 新パスワード入力）。
  - `/login` 画面に「パスワードを忘れた方」リンクを追加。

### 非対象

- アプリ層のレート制限（Cognito の組み込み制限に任せる。詳細なアプリ層ガードは別タスク「不正ログイン試行のロックアウト」）。
- パスワードポリシーのフロント事前検証（[docs/22_password-policy-frontend-validation.md](22_password-policy-frontend-validation.md) / TSK-11 で対応）。

### 完了条件（Notion チケット転記）

- [ ] パスワード忘れフローで再設定が完走する
- [ ] 新パスワードでログインできる
- [ ] 既存のアクセス/リフレッシュトークンが無効化される（GlobalSignOut 連携）

---

## 2. API 仕様

### 2.1 検証コード送信

```text
POST /auth/forgot-password
Body: { "email": "user@example.com" }

Response 204 No Content

Errors:
  400 — email バリデーション失敗
  502 — Cognito 連携失敗
```

意図的に **存在しない email でも 204 を返す**。理由: ユーザー列挙（enumeration）を防ぐ。

### 2.2 コード確認 + 新パスワード設定

```text
POST /auth/confirm-forgot-password
Body: {
  "email": "user@example.com",
  "code": "123456",
  "newPassword": "NewPassword123!"
}

Response 204 No Content

Errors:
  400 — 入力バリデーションエラー / 無効なコード / 期限切れ / パスワードポリシー違反
  502 — Cognito 連携失敗（ConfirmForgotPassword は成功したが GlobalSignOut が失敗 など）
```

両エンドポイントとも `@Public()` を付与（ログイン前のフロー）。

### 2.3 Zod スキーマ

```ts
export const ForgotPasswordSchema = z.object({
  email: z.email(),
});

export const ConfirmForgotPasswordSchema = z.object({
  email: z.email(),
  code: z.string().min(1),
  newPassword: z.string().min(8),
});
```

---

## 3. シーケンス

```text
Frontend                      Backend                    Cognito
   │ /forgot-password へ遷移     │                           │
   │                            │                           │
   │ Step1: email 入力 → 送信    │                           │
   │  POST /auth/forgot-password │                           │
   │───────────────────────────>│                           │
   │                            │ ForgotPasswordCommand     │
   │                            │ (Username + SECRET_HASH)  │
   │                            │──────────────────────────>│
   │                            │<── ok ────────────────────│
   │<── 204 ────────────────────│                           │
   │                                                        │
   │                            メール: 検証コード             │
   │ Step2 へ遷移                                            │
   │                                                        │
   │ コード + 新パスワード入力 → 送信                            │
   │  POST /auth/confirm-       │                           │
   │    forgot-password         │                           │
   │───────────────────────────>│                           │
   │                            │ ConfirmForgotPassword     │
   │                            │ (Username, Code,          │
   │                            │  Password, SECRET_HASH)   │
   │                            │──────────────────────────>│
   │                            │<── ok / Code/Password エラー
   │                            │ AdminUserGlobalSignOut    │
   │                            │ (UserPoolId, Username)    │
   │                            │──────────────────────────>│
   │                            │<── ok ────────────────────│
   │<── 204 ────────────────────│                           │
   │                                                        │
   │ /login へ遷移                                           │
```

### 3.1 失敗時の挙動

| 段階 | 失敗 | サーバ応答 | 補足 |
| ---- | ---- | ---------- | ---- |
| ForgotPassword | UserNotFoundException | 204（隠蔽） | enumeration 対策 |
| ForgotPassword | LimitExceededException | 502 | Cognito 側のレート制限。フロントは「しばらく待つ」表示 |
| ForgotPassword | その他 SDK 例外 | 502 | |
| ConfirmForgotPassword | CodeMismatch | 400 | 「コードが正しくありません」 |
| ConfirmForgotPassword | ExpiredCode | 400 | 「コードの有効期限が切れています」 |
| ConfirmForgotPassword | InvalidPassword | 400 | パスワードポリシー違反 |
| AdminUserGlobalSignOut | ユーザー無効化中等 | **ログのみ。本フローは 204** | パスワードリセット自体は完了させる。失効はベストエフォート |

> AdminUserGlobalSignOut で 502 を返してしまうと、ユーザー視点では「パスワード変更されたかどうか分からない」状態になる。実害は小さいので **失敗してもパスワードリセットは成功扱い**にし、ログだけ残す。

### 3.2 Cognito の組み込み挙動

- `ConfirmForgotPassword` 成功時、Cognito は **既存リフレッシュトークンを自動的に無効化**する（仕様）。
- アクセストークンは有効期限満了まで有効（最大 1 時間）。`AdminUserGlobalSignOut` を併用してもアクセストークン自体の失効はできず、Cognito 側の管理状態が更新されるのみ。
- 本タスクでは「リフレッシュトークン失効まで」を完了条件とし、アクセストークン即時失効は別タスク（AuthGuard + DB セッション）に委譲。

---

## 4. バックエンド実装

### 4.1 ファイル構成

| 操作 | パス | 内容 |
| ---- | ---- | ---- |
| 修正 | `backend/src/auth/infra/cognito-auth.client.ts` | `forgotPassword(email)` / `confirmForgotPassword(email, code, password)` を追加 |
| 修正 | `backend/src/user/infra/cognito-user.client.ts` | `globalSignOut(email)` を追加（`AdminUserGlobalSignOutCommand`） |
| 修正 | `backend/src/auth/application/auth.schemas.ts` | `ForgotPasswordSchema` / `ConfirmForgotPasswordSchema` を追加 |
| 修正 | `backend/src/auth/application/auth.service.ts` | `forgotPassword(email)` / `confirmForgotPassword(...)` を追加 |
| 修正 | `backend/src/auth/controller/auth.controller.ts` | エンドポイント 2 つを追加 |
| 修正 | `backend/src/auth/controller/auth.dto.ts` | 入力 DTO を追加 |
| 修正 | `backend/src/auth/auth.module.ts` | UserModule を import して CognitoUserClient を利用可にする |

### 4.2 モジュール依存

`AuthService` から `CognitoUserClient` を呼ぶ必要があるため、`AuthModule` で `UserModule` を import する。`UserModule` の `exports` に `CognitoUserClient` を追加する。

> 代替案: 認証専用の admin クライアントを `auth/infra/` に作る。ただし重複なので `UserModule` から exports する形を採用。

### 4.3 Service 実装方針

```ts
async forgotPassword(email: string): Promise<void> {
  try {
    await this.cognitoAuth.forgotPassword(email);
  } catch (err) {
    // UserNotFound は隠蔽（204 を返すため例外を握り潰す）
    if (this.cognitoAuth.isUserNotFound(err)) {
      this.logger.warn(`存在しない email へのパスワードリセット要求: ${email}`);
      return;
    }
    this.logger.error('ForgotPassword 失敗', ...);
    throw new BadGatewayException('パスワードリセット要求に失敗しました');
  }
}

async confirmForgotPassword(email, code, newPassword): Promise<void> {
  try {
    await this.cognitoAuth.confirmForgotPassword(email, code, newPassword);
  } catch (err) {
    if (this.cognitoAuth.isCodeMismatch(err)) throw new BadRequestException('コードが正しくありません');
    if (this.cognitoAuth.isExpiredCode(err)) throw new BadRequestException('コードの有効期限が切れています');
    if (this.cognitoAuth.isInvalidPassword(err)) throw new BadRequestException('パスワードがポリシーに合致していません');
    throw new BadRequestException('パスワード変更に失敗しました');
  }

  // ベストエフォート：失敗してもログだけ
  try {
    await this.cognitoUser.globalSignOut(email);
  } catch (err) {
    this.logger.error('AdminUserGlobalSignOut 失敗（パスワードリセットは成功）', ...);
  }
}
```

### 4.4 SECRET_HASH

`ForgotPassword` / `ConfirmForgotPassword` も SECRET_HASH が必要（Confidential client のため）。既存の `computeSecretHash` を流用する。

---

## 5. フロントエンド実装

### 5.1 新規ページ `frontend/app/forgot-password/page.tsx`

ステート:

```ts
type Step =
  | { kind: 'request'; email: string }
  | { kind: 'confirm'; email: string };
```

UI:
- Step `request`: email 入力 + 「コードを送信」ボタン → 成功で `confirm` に遷移
- Step `confirm`: 受信したコード + 新パスワード（確認入力含む）+ 「設定する」ボタン → 成功でログイン画面へ `router.push('/login')`

### 5.2 `frontend/app/login/page.tsx`

ログインフォームの下に「パスワードを忘れた方」リンクを追加 (`<Link href="/forgot-password">`)。

### 5.3 API クライアント `frontend/lib/cognito.ts`

```ts
export async function requestPasswordReset(email: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) throw new Error(...);
}

export async function confirmPasswordReset(
  email: string,
  code: string,
  newPassword: string,
): Promise<void> { /* 同様 */ }
```

ログインしていない状態の API なので `getAccessToken()` middleware の影響は受けない（`/auth/login` などと同じ扱い）。`apiClient` ではなく直接 `fetch` を使う既存パターンを踏襲。

---

## 6. テスト

- 自動テストは追加せず、手動動作確認を完了条件とする（既存方針）。

### 手動動作確認シナリオ

1. ログイン画面で「パスワードを忘れた方」をクリック
2. メールアドレスを入力 → コード送信 → メールを受信
3. コード + 新パスワードを入力 → 成功 → ログイン画面へ
4. 新パスワードでログイン成功
5. 古いリフレッシュトークン（あれば）は使えない
6. 異常系: 存在しない email でも 204 を返す（メールは届かない）
7. 異常系: 不正なコードで 400
8. 異常系: 期限切れコード（1 時間後）で 400

---

## 7. 既存ドキュメント更新

### 7.1 `AGENTS.md`

ドキュメント表に `19_password-reset.md` を追記。

### 7.2 環境変数 / マイグレーション / IAM

- 環境変数: 変更なし。
- マイグレーション: 変更なし（DB 変更なし）。
- IAM: `cognito-idp:AdminUserGlobalSignOut` を `~/.aws/credentials` の petal-local IAM ユーザーポリシーに追加する必要あり（運用作業）。`docs/14_*` §5 にも明記する。

---

## 8. 完了条件チェックリスト

§1 と同じ。

---

## 9. 未確定事項 / 将来検討

- アプリ層のレート制限（不正ログイン試行のロックアウトタスクで併せて対応）。
- パスワードリセット成功時の通知メール（不要と判断、Cognito の標準メールに任せる）。
- 検証コードの有効期限カスタマイズ（現状 Cognito デフォルトの 1 時間）。
