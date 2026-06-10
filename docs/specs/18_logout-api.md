# Petal - ログアウト API 設計

対応タスク: **TSK-19「ログアウト API（GlobalSignOut 連携）」**

関連ドキュメント:

- [docs/03_workflow.md](03_workflow.md)
- [docs/11_user-info_and_authentication.md](11_user-info_and_authentication.md)
- [docs/15_user-management-enhancement.md](15_user-management-enhancement.md)

---

## 1. スコープと完了条件

### 対象

- **Backend**: `POST /auth/logout` を実装。`GlobalSignOut`（access token 経由・IAM 不要）を呼び、Cognito 上のリフレッシュトークンを失効させる。
- **Frontend**: `logout()` で API を叩いてから `localStorage` を消す。API 失敗時もローカル状態はクリアする。

### 非対象

- アクセストークンの即時失効（Cognito 仕様上、有効期限満了まで残る。後述 §6）。
- 監査ログ連動（別タスク「監査ログ（ユーザー管理操作）」で対応）。
- 管理者による強制ログアウト（削除フローでの `AdminUserGlobalSignOut` 連携は別タスク「削除/無効化したユーザーの既存トークン無効化」で対応）。

### 完了条件

- [ ] `POST /auth/logout` でリフレッシュトークンが Cognito 上で失効する
- [ ] フロントが API を叩いた後にローカル状態（`localStorage`）をクリアする
- [ ] API 失敗時もフロントはログアウト状態に遷移する
- [ ] 認証されていないリクエストは 401 を返す（`@Public()` を付けない）

---

## 2. API 仕様

```text
POST /auth/logout
Authorization: Bearer <access token>

Response: 204 No Content

Errors:
  401 — Authorization ヘッダーが無い / 無効
  502 — Cognito 連携に失敗
```

- レスポンスボディなし。
- 成功時はサーバ側の追加処理なし（DB 変更なし）。

---

## 3. シーケンス

```text
Frontend             Backend                  Cognito
  │ logout() 開始       │                        │
  │  POST /auth/logout  │                        │
  │  (Authorization:    │                        │
  │   Bearer <token>)   │                        │
  │────────────────────>│                        │
  │                     │ AuthGuard で JWT 検証   │
  │                     │ Authorization から     │
  │                     │ access token を抽出    │
  │                     │ GlobalSignOutCommand   │
  │                     │ (AccessToken)          │
  │                     │───────────────────────>│
  │                     │<── ok / NotAuthorized ─│
  │<── 204 / 502 ───────│                        │
  │                                              │
  │ localStorage を消す（成否に関わらず）         │
  │ ログイン画面へ遷移                            │
```

### 3.1 失敗時の挙動

- Cognito 側で失敗 → サーバは 502 を返す。フロントは catch して localStorage を消し、ログイン画面へ遷移。
- ネットワーク不達 → フロントは fetch エラーを catch して同様にローカル状態をクリア。

---

## 4. 認証 / 認可

- `@Public()` を付けない → デフォルトの `JwtAuthGuard` が適用され、Authorization ヘッダーが必須。
- 期限切れ access token では 401 を返す（AuthGuard で弾かれる）。
  - この場合フロントは「ログイン状態が既に無効」とみなしてローカルクリア + ログイン画面遷移。
- ログアウト時に access token 自体は不要に思えるが、`GlobalSignOut` SDK 呼び出しに **同じ access token** が必要なので、ヘッダーから取り出して使う。

---

## 5. バックエンド実装

### 5.1 ファイル構成

| 操作 | パス | 内容 |
| ---- | ---- | ---- |
| 修正 | `backend/src/auth/infra/cognito-auth.client.ts` | `globalSignOut(accessToken)` を追加 |
| 修正 | `backend/src/auth/application/auth.service.ts` | `logout(accessToken)` を追加 |
| 修正 | `backend/src/auth/controller/auth.controller.ts` | `POST /auth/logout` ハンドラ追加 |

### 5.2 Controller

```ts
@Post('logout')
@HttpCode(204)
async logout(@Headers('authorization') authorization: string): Promise<void> {
  const token = extractBearer(authorization);
  await this.authService.logout(token);
}
```

`extractBearer` は `'Bearer xxx'` から `'xxx'` を取り出す。AuthGuard が既に検証している前提で、ここで失敗するケースはほぼないが、念のため不正形式は 401 にする（`UnauthorizedException`）。

### 5.3 Cognito クライアント

`auth/infra/cognito-auth.client.ts` に以下を追加:

```ts
async globalSignOut(accessToken: string): Promise<void> {
  await this.client.send(
    new GlobalSignOutCommand({ AccessToken: accessToken }),
  );
}
```

`GlobalSignOutCommand` は IAM 認証ではなく、access token を引数に取るユーザー認証 API。SDK のクライアント設定に IAM クレデンシャルがあっても問題ない（無視される）。

### 5.4 Service

```ts
async logout(accessToken: string): Promise<void> {
  try {
    await this.cognitoAuth.globalSignOut(accessToken);
  } catch (err) {
    this.logger.error(
      'Cognito ログアウトに失敗しました',
      err instanceof Error ? err.stack : String(err),
    );
    throw new BadGatewayException('ログアウトに失敗しました');
  }
}
```

---

## 6. アクセストークンの扱い（補足）

`GlobalSignOut` の仕様:

- リフレッシュトークン: **即時失効**。
- アクセストークン: **既存トークンは有効期限満了（最大 1 時間）まで使える**。Cognito 自身が JWT 検証で失効を判別しないため。
- 結果として「ログアウト後 1 時間以内は古い access token で API を叩ける」状態が残る。

これを許容する理由:

- 本タスクのスコープ（Notion 完了条件）はリフレッシュトークン失効まで。
- アクセストークンの即時失効は別タスク「AuthGuard で DB ユーザーの存在・有効性チェック」または「削除/無効化したユーザーの既存トークン無効化」で扱う（DB 側にセッション ID を持たせるなどのアーキテクチャ判断が必要）。

---

## 7. フロントエンド実装

### 7.1 `frontend/lib/cognito.ts`

`logout()` を **async** に変更し、API を叩く:

```ts
export async function logout(): Promise<void> {
  const token = localStorage.getItem(ACCESS_TOKEN_KEY);
  try {
    if (token) {
      await fetch(`${BASE_URL}/auth/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
    }
  } catch {
    // ネットワーク失敗等は握り潰す（ローカル状態は必ずクリアする）
  } finally {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(EMAIL_KEY);
  }
}
```

サーバが 502 を返した場合も `fetch` 自体は成功扱いなので、`response.ok` を見ない（catch で握り潰す代わりに try/finally で必ず localStorage をクリア）。

### 7.2 `frontend/contexts/AuthContext.tsx`

`logout` を async に。コンポーネント側の呼び出しはすでに `() => logout()` の形なので変更最小:

```ts
const logout = useCallback(async () => {
  await cognitoLogout();
  setState({ isAuthenticated: false, email: null, isLoading: false });
}, []);
```

### 7.3 ヘッダー / ナビゲーションの呼び出し側

既存のログアウトボタンが `onClick={logout}` の形であれば、async 化で問題なく動作する（戻り値の Promise は無視される）。

---

## 8. テスト

- 自動テストは追加せず、手動確認とビルド通過を完了条件とする（既存方針）。

---

## 9. 既存ドキュメントの更新

### 9.1 `AGENTS.md`

ドキュメント表に `18_logout-api.md` を追記。

### 9.2 `.env.example` / migration / IAM

- 変更なし（`GlobalSignOut` は IAM 不要）。

---

## 10. 完了条件チェックリスト

§1 と同じ。

---

## 11. 未確定事項 / 将来検討

- アクセストークン即時失効（DB セッション ID + AuthGuard 連携）。
- 監査ログ連動（自発ログアウト / 管理者強制ログアウトの区別）。
- リフレッシュトークン更新エンドポイント（別タスク）。
