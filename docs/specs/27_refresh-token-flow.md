# Petal - リフレッシュトークンによるアクセストークン更新 設計

対応タスク: **TSK-20「リフレッシュトークンによるアクセストークン更新」**

関連ドキュメント:

- [docs/00_rules.md](00_rules.md) — 設計・実装ルール
- [docs/03_workflow.md](03_workflow.md) — 標準ワークフロー
- [docs/11_user-info_and_authentication.md](11_user-info_and_authentication.md) — 認証基盤（§4.3 トークン有効期限：access 1h / refresh 30日）
- [docs/14_cognito-user-pool-setup.md](14_cognito-user-pool-setup.md) — User Pool 設定（Confidential client、SECRET_HASH 必須）
- [docs/18_logout-api.md](18_logout-api.md) — `GlobalSignOut` 連携でリフレッシュトークン失効
- [docs/24_testing-strategy.md](24_testing-strategy.md) — テスト方針

---

## 1. 背景

現状フロントは access token 期限切れ（1h）を検知すると localStorage を消し、ユーザーは再ログインが必要になる。実運用では数十分操作しただけで再ログインを求められる UX になっており、リフレッシュトークン（30 日有効）を活用した自動更新を入れる。

---

## 2. スコープと完了条件

### 対象

1. **backend**: `POST /auth/refresh`（Public）を実装。リフレッシュトークン + email を受け取り、Cognito の `InitiateAuth(REFRESH_TOKEN_AUTH)` で新しい access token / id token を取得して返す。
2. **frontend (lib/cognito.ts)**: ログイン / パスワード変更チャレンジ完了時に refresh token も localStorage に保存する。
3. **frontend (openapi-fetch middleware)**: API レスポンスが 401 のとき、自動で refresh → 元リクエストをリトライする。リトライも 401 ならローカル状態をクリアしてログアウト扱い。
4. **frontend (logout)**: localStorage から refresh token も削除。
5. ユニットテスト追加（`AuthService.refresh` の正常系・異常系）。

### 非対象（別タスク化）

- **HttpOnly Cookie への移行**: Notion チケット原文「将来的に Cookie 化を別タスクで検討」の通り、本タスクでは localStorage を継続。XSS リスクは現状の access token 保管と同じ水準で増えない（refresh token は同じスコープに置く）。
- **リフレッシュトークン期限切れ後の再発行**: Cognito の REFRESH_TOKEN_AUTH では新しい refresh token は発行されない（既存トークンを使い回す）。30 日後に期限切れたら再ログインが必要になる挙動をそのまま採用。
- **並行リクエストでの refresh シングルトン化**: 複数の 401 が同時に発生した場合、各々が独立に refresh を呼ぶ。Cognito の refresh token は冪等に使えるため動作上は問題ない。シングルトン化は不要な複雑さを増すので入れない。
- **`GET /auth/me` 等の追加**: 既存の `GET /users/me` で代替。
- **frontend ユニットテスト**: テスト基盤がまだ整備されていない（TSK-28 は backend のみ）。フロント側は手動動作確認で担保する。

### 完了条件

- [ ] `POST /auth/refresh` が `{ refreshToken, email }` を受け取り新しい access token を返す
- [ ] Cognito の refresh token が無効/期限切れの場合 401 を返す
- [ ] フロントが access token 期限切れ時に自動で refresh → リトライする
- [ ] refresh も失敗したらフロントがローカル状態をクリアしログアウト扱いになる
- [ ] `pnpm --filter backend test` が緑（既存テスト + 新規 `AuthService.refresh`）
- [ ] `pnpm --filter backend build` / `pnpm --filter frontend build` が通る
- [ ] OpenAPI スキーマが再生成され `/auth/refresh` が含まれる
- [ ] 設計ドキュメント・`AGENTS.md` の表更新

---

## 3. Backend 詳細設計

### 3.1 `CognitoAuthClient.refreshAccessToken`

ファイル: `backend/src/auth/infra/cognito-auth.client.ts`

```ts
export type CognitoRefreshedTokens = {
  accessToken: string;
  idToken: string;
  expiresIn: number;
};

async refreshAccessToken(
  refreshToken: string,
  username: string,
): Promise<CognitoRefreshedTokens | null> {
  const command = new AdminInitiateAuthCommand({
    UserPoolId: this.userPoolId,
    ClientId: this.clientId,
    AuthFlow: AuthFlowType.REFRESH_TOKEN_AUTH,
    AuthParameters: {
      REFRESH_TOKEN: refreshToken,
      SECRET_HASH: this.computeSecretHash(username),
    },
  });

  const response = await this.client.send(command);
  const result = response.AuthenticationResult;
  if (!result?.AccessToken || !result.IdToken) return null;

  return {
    accessToken: result.AccessToken,
    idToken: result.IdToken,
    expiresIn: result.ExpiresIn ?? 3600,
  };
}
```

**SECRET_HASH の username**: Cognito の REFRESH_TOKEN_AUTH では SECRET_HASH に元 USERNAME（= 本リポジトリでは email）を使う。ログインフロー（`authenticate`）と同じ値で計算する。

**戻り値に refreshToken は含めない**: REFRESH_TOKEN_AUTH では新しい refresh token は発行されない仕様（既存 refresh token を使い回す）。

### 3.2 `AuthService.refresh`

ファイル: `backend/src/auth/application/auth.service.ts`

```ts
async refresh(
  refreshToken: string,
  email: string,
): Promise<{ accessToken: string; idToken: string; expiresIn: number; email: string }> {
  try {
    const tokens = await this.cognitoAuth.refreshAccessToken(refreshToken, email);
    if (!tokens) {
      throw new UnauthorizedException('リフレッシュトークンが無効です');
    }
    return { ...tokens, email };
  } catch (err) {
    if (err instanceof UnauthorizedException) throw err;
    if (this.cognitoAuth.isNotAuthorized(err)) {
      throw new UnauthorizedException('リフレッシュトークンが無効または失効しています');
    }
    this.logger.error(
      'Cognito refresh に失敗しました',
      err instanceof Error ? err.stack : String(err),
    );
    throw new BadGatewayException('トークン更新に失敗しました');
  }
}
```

`CognitoAuthClient` に `isNotAuthorized` 判定が必要なため新規追加する（既存の `cognito-user.client.ts` には同等メソッドが存在）。

### 3.3 Controller / DTO / Schema

`auth.controller.ts` に追加:

```ts
@Public()
@Post('refresh')
@HttpCode(200)
@ApiOkResponse({ type: RefreshResponseDto })
async refresh(@Body() body: RefreshRequestDto): Promise<RefreshResponseDto> {
  const parsed = RefreshSchema.safeParse(body);
  if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
  return this.authService.refresh(parsed.data.refreshToken, parsed.data.email);
}
```

`auth.schemas.ts`:

```ts
export const RefreshSchema = z.object({
  refreshToken: z.string().min(1),
  email: z.email(),
});
export type RefreshInput = z.infer<typeof RefreshSchema>;
```

`auth.dto.ts`:

```ts
export class RefreshRequestDto {
  refreshToken!: string;
  @ApiProperty({ format: 'email' })
  email!: string;
}

export class RefreshResponseDto {
  accessToken!: string;
  idToken!: string;
  expiresIn!: number;
  @ApiProperty({ format: 'email' })
  email!: string;
}
```

### 3.4 セキュリティ境界

- `POST /auth/refresh` は `@Public()`。認証は不要（refresh token そのものが認証要素）。
- email を body で受けるが、refresh token と紐づかない email を渡しても Cognito 側で SECRET_HASH 検証 + refresh token 検証で弾かれる。
- 失敗時の 401 メッセージは情報漏洩を避けて「無効または失効しています」と統一。

---

## 4. Frontend 詳細設計

### 4.1 トークンの保管 (`lib/cognito.ts`)

新規定数とヘルパー:

```ts
const REFRESH_TOKEN_KEY = 'petal_refresh_token';

function persistSession(
  accessToken: string,
  refreshToken: string,
  email: string,
): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  localStorage.setItem(EMAIL_KEY, email);
}

export function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

function clearSession(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(EMAIL_KEY);
}
```

`login` / `completeNewPassword` で `persistSession` に refresh token も渡す。

### 4.2 `refreshAccessToken` 関数

```ts
export async function refreshAccessToken(): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
  const email = localStorage.getItem(EMAIL_KEY);
  if (!refreshToken || !email) return null;

  try {
    const res = await fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken, email }),
    });
    if (!res.ok) {
      clearSession();
      return null;
    }
    const data: { accessToken: string; idToken: string; expiresIn: number; email: string } =
      await res.json();
    localStorage.setItem(ACCESS_TOKEN_KEY, data.accessToken);
    return data.accessToken;
  } catch {
    clearSession();
    return null;
  }
}
```

`logout` 内で `clearSession()` を呼ぶようリファクタ。

`getAccessToken` の既存挙動（期限切れ → null 返却 + ローカル消去）は **変えない**。openapi-fetch middleware が getAccessToken の null を見て refresh を試みる責務を持つ。これにより：

- 期限切れアクセストークン → middleware が refresh を呼ぶ → 新トークン取得して使う
- refresh も失敗 → API 呼び出しは認証なしで送信 → backend で 401 → AuthContext がログアウト処理

> 注: getAccessToken 内で refresh を呼ぶ案も検討したが、middleware から呼ぶ方が SSR / 非ブラウザ文脈での挙動が予測しやすい。getAccessToken は同期的に「現状のトークンを返す」役割に留める。

### 4.3 openapi-fetch middleware (`lib/openapi/client.ts`)

```ts
const RETRY_HEADER = 'X-Petal-Retry';

const authMiddleware: Middleware = {
  async onRequest({ request }) {
    let token = await getAccessToken();
    if (!token) {
      token = await refreshAccessToken();
    }
    if (token) request.headers.set('Authorization', `Bearer ${token}`);
    return request;
  },
  async onResponse({ request, response }) {
    if (response.status !== 401) return response;
    if (request.headers.get(RETRY_HEADER)) return response; // すでにリトライ済み

    const newToken = await refreshAccessToken();
    if (!newToken) return response;

    const retryRequest = new Request(request, {
      headers: new Headers(request.headers),
    });
    retryRequest.headers.set('Authorization', `Bearer ${newToken}`);
    retryRequest.headers.set(RETRY_HEADER, '1');
    return fetch(retryRequest);
  },
};
```

ロジック:

1. `onRequest`: 期限切れなら **事前** に refresh して新トークンで送る（最も多いパス）。
2. `onResponse`: それでも 401 なら（例: refresh と同時に backend 側でユーザー削除等）、最後の救済として refresh + リトライを 1 回だけ試みる。
3. RETRY_HEADER で無限ループを防ぐ。

### 4.4 ログアウト連携 (`AuthContext`)

middleware の `onResponse` で refresh 失敗時に `clearSession()` が呼ばれる。AuthContext は次のレンダリングで `getAccessToken()` が null を返すことで isAuthenticated を false にする…が、現状は常時監視していない。

**シンプルな対応**: middleware で 401 + refresh 失敗時に `window.dispatchEvent(new Event('petal:auth-cleared'))` を発火し、AuthContext で listener を貼って状態を更新する。

```ts
// lib/cognito.ts
function clearSession(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(EMAIL_KEY);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('petal:auth-cleared'));
  }
}
```

```ts
// contexts/AuthContext.tsx
useEffect(() => {
  const handler = () =>
    setState({ isAuthenticated: false, email: null, isLoading: false });
  window.addEventListener('petal:auth-cleared', handler);
  return () => window.removeEventListener('petal:auth-cleared', handler);
}, []);
```

リダイレクトは現行の AuthGuard 相当の仕組み（middleware や `useAuth` の利用箇所）に任せる。本タスクでは状態更新までを担保。

---

## 5. データモデル / マイグレーション / 環境変数

- DB スキーマ変更 **なし**
- Cognito User Pool 設定変更 **なし**（REFRESH_TOKEN_AUTH は既存設定で利用可）
- IAM 権限変更 **なし**
- 環境変数追加 **なし**

---

## 6. 影響範囲

### Backend

| ファイル | 変更概要 |
| --- | --- |
| `src/auth/infra/cognito-auth.client.ts` | `refreshAccessToken()` 追加、`isNotAuthorized` 判定追加 |
| `src/auth/application/auth.service.ts` | `refresh(refreshToken, email)` 追加 |
| `src/auth/application/auth.schemas.ts` | `RefreshSchema` 追加 |
| `src/auth/controller/auth.controller.ts` | `POST /auth/refresh` 追加 |
| `src/auth/controller/auth.dto.ts` | `RefreshRequestDto` / `RefreshResponseDto` 追加 |
| `src/auth/application/auth.service.spec.ts` | `AuthService.refresh` のテスト追加 |
| `openapi.json` | 自動再生成（`pnpm --filter backend openapi:export`） |

### Frontend

| ファイル | 変更概要 |
| --- | --- |
| `lib/cognito.ts` | refresh token 保管、`refreshAccessToken()`、`clearSession()`、イベント発火 |
| `lib/openapi/client.ts` | middleware に onRequest 期限切れ refresh + onResponse 401 リトライ |
| `lib/openapi/schema.d.ts` | OpenAPI 再生成で `/auth/refresh` が型に反映 |
| `contexts/AuthContext.tsx` | `petal:auth-cleared` イベント listener |

### Docs

| ファイル | 変更概要 |
| --- | --- |
| `docs/27_refresh-token-flow.md` | 本書（新規） |
| `AGENTS.md` | ドキュメント表に追記 |

migration / `.env.example` / Cognito User Pool 設定の変更は **なし**。

---

## 7. 手動動作確認シナリオ

PR 本文のチェックリストに転記する。

- [ ] ログインして 1 時間以上待つ → API リクエストが自動で通り続ける
- [ ] DevTools で localStorage の access_token を期限切れ状態に書き換え → 次の API 呼び出しで自動 refresh が走る（Network タブで確認）
- [ ] DevTools で refresh_token を空文字に書き換え → API 呼び出しが 401 になり AuthContext が isAuthenticated=false に切り替わる
- [ ] ログアウト → access/refresh/email すべてが localStorage から消える
- [ ] backend で当該ユーザーを `DELETE /users/:id` → 既存トークンで API 呼ぶと AuthGuard で 401 → middleware が refresh するも Cognito 側で `disabled` のため 401 → ログアウト扱いになる
- [ ] パスワードリセットを完了 → 既存の access/refresh が `GlobalSignOut` で失効済み（[docs/19](19_password-reset.md)）→ 次回 API で 401 → refresh も 401 → ログアウト
- [ ] `pnpm --filter backend build` / `pnpm --filter frontend build` が通る

---

## 8. リスク・補足

- **email を body で送る**: `POST /auth/refresh` は Public で email を受け取る形だが、SECRET_HASH 検証 + refresh token 検証で不正なペアは Cognito が弾く。
- **並行 401**: 複数の API 呼び出しが同時に 401 になった場合、各々が独立に refresh を呼ぶ。Cognito の refresh token は再利用可能なので問題は起きないが、無駄なリクエストは増える。シングルトン化は将来の最適化として残す。
- **localStorage の XSS リスク**: refresh token を localStorage に置くと XSS 時に access token と一緒に窃取される。本タスクでは現方針継続（[docs/27 §2 非対象](27_refresh-token-flow.md)）。Cookie 化は別タスクで対応する。
- **リフレッシュ後の id token 変更**: id token も refresh のたびに新しいものが返るが、本リポジトリは AccessToken のみ使うため id token は localStorage に保存しない（既存挙動を維持）。`refreshAccessToken` の戻り値も accessToken のみとする。
- **`GET /users/me` への影響**: AuthGuard が `request.user` の DB lookup を行うため、refresh で得た新 access token でも `cognito_sub` が同じなら問題なく通る。削除済みユーザーは AuthGuard で 401（[docs/25](25_authguard-db-validation-tests.md)）。
