# Petal - MFA (TOTP) 対応 設計

対応タスク: **TSK-13「MFA (TOTP) 対応」**

関連ドキュメント:

- [docs/00_rules.md](00_rules.md) — 設計・実装ルール
- [docs/03_workflow.md](03_workflow.md) — 標準ワークフロー
- [docs/11_user-info_and_authentication.md](11_user-info_and_authentication.md) — 認証基盤
- [docs/14_cognito-user-pool-setup.md](14_cognito-user-pool-setup.md) — Cognito User Pool 設定（本タスクで MFA 設定を追記）
- [docs/15_user-management-enhancement.md](15_user-management-enhancement.md) — 管理者ユーザー管理（NEW_PASSWORD_REQUIRED チャレンジの実装パターンを踏襲）
- [docs/27_refresh-token-flow.md](27_refresh-token-flow.md) — refresh フロー（MFA 通過後も同じ refresh token を発行する Cognito 仕様）
- [docs/24_testing-strategy.md](24_testing-strategy.md) — テスト方針

---

## 1. 背景と本タスクの位置付け

[docs/14_cognito-user-pool-setup.md](14_cognito-user-pool-setup.md) §3.6 で「任意（推奨：本番は SMS or TOTP）」と記載。本番リリース前に MFA を有効化する。Notion チケットの方針通り **TOTP のみ・Optional** で v1 を提供し、以下は別タスクとする:

- Required への昇格
- バックアップコード（リカバリ手段）
- SMS MFA
- 「このデバイスを記憶する」機能

---

## 2. スコープと完了条件

### 対象

1. **Cognito User Pool 設定変更**: MFA = Optional + Software token MFA を有効化（手作業手順を [docs/14](14_cognito-user-pool-setup.md) に追記）。
2. **TOTP 登録フロー**:
   - `POST /auth/mfa/setup`（認証必須）— `AssociateSoftwareToken` を呼び `secretCode` と `otpauthUri` を返す。
   - `POST /auth/mfa/verify`（認証必須）— `VerifySoftwareToken` でコード検証 → `SetUserMFAPreference` で MFA 有効化。
3. **TOTP 解除**:
   - `POST /auth/mfa/disable`（認証必須）— `SetUserMFAPreference` で SoftwareTokenMfa を無効化。
4. **ログインフローに SOFTWARE_TOKEN_MFA チャレンジ対応**:
   - `AuthService.login` がチャレンジを返した場合、`POST /auth/challenge/mfa`（Public）で `RespondToAuthChallenge` を呼び認証完了。
   - レスポンス DTO の `LoginResponseDto` discriminated union に `MfaChallengeResponseDto` を追加。
5. **マイページに MFA 設定 UI**: 「2 段階認証を有効にする / 解除する」セクションを追加。QR コード表示、コード入力、状態表示。
6. **ログイン画面に MFA コード入力画面**: 既存の `NEW_PASSWORD_REQUIRED` と同様の discriminated union 拡張。
7. **`GET /users/me`** の戻り値に MFA 有効状態を追加（フロントの設定 UI で表示するため）。
8. ユニットテスト追加。

### 非対象（別タスク化）

- **バックアップコード / リカバリ手段** — 重要だが Notion で明示的に別タスク。「TOTP デバイス紛失時は admin による reset」を運用回避策として残す。
- **MFA Required（必須化）** — v1 は Optional のみ。本番運用後に判断。
- **SMS MFA** — TOTP のみ。
- **デバイス記憶機能** — 「このデバイスを 30 日間記憶」等は対象外。
- **admin による他ユーザーの MFA リセット API** — 運用要件次第で別タスク。
- **監査ログへの MFA 操作記録** — TSK-24 のスコープ外（admin による他者操作のみ対象）。本タスクではセルフサービス操作なので audit log は記録しない。
- **Cognito 設定変更の自動化** — User Pool 設定は AWS コンソールでの手作業（既存方針通り）。

### 完了条件

- [ ] User Pool で TOTP MFA が Optional で有効化されている（手順を [docs/14](14_cognito-user-pool-setup.md) に追記）
- [ ] `POST /auth/mfa/setup` が QR コード（otpauth URI）と secretCode を返す
- [ ] `POST /auth/mfa/verify` でコード検証成功時に MFA が有効化される
- [ ] MFA 有効ユーザーがログイン時に 6 桁コード入力を求められる
- [ ] `POST /auth/mfa/disable` で MFA を解除できる
- [ ] フロント `/me` ページから MFA を有効化 / 解除できる
- [ ] フロント `/login` から MFA チャレンジを完走できる
- [ ] `GET /users/me` で MFA 有効状態が取れる
- [ ] `pnpm --filter backend test` が緑（既存 + 新規）
- [ ] `pnpm --filter backend build` / `pnpm --filter frontend build` が通る
- [ ] OpenAPI を再生成
- [ ] 設計ドキュメント・`AGENTS.md` 表更新

---

## 3. Backend 詳細設計

### 3.1 `CognitoAuthClient` 拡張

新規メソッド（`backend/src/auth/infra/cognito-auth.client.ts`）:

```ts
async associateSoftwareToken(
  accessToken: string,
): Promise<{ secretCode: string }>

async verifySoftwareToken(
  accessToken: string,
  userCode: string,
  friendlyDeviceName?: string,
): Promise<{ status: 'SUCCESS' | 'ERROR' }>

async setSoftwareTokenMfaEnabled(
  accessToken: string,
  enabled: boolean,
): Promise<void>

async respondToMfaChallenge(
  username: string,
  code: string,
  session: string,
): Promise<CognitoAuthTokens | null>
```

**SECRET_HASH の username**: ログインと同じ email で計算（既存 `authenticate` / `respondToNewPasswordChallenge` と同じ流儀）。

`authenticate` の戻り値に SOFTWARE_TOKEN_MFA チャレンジを追加:

```ts
export type CognitoAuthResult =
  | { kind: 'authenticated'; tokens: CognitoAuthTokens }
  | { kind: 'challenge'; challengeName: 'NEW_PASSWORD_REQUIRED'; session: string }
  | { kind: 'mfa_challenge'; challengeName: 'SOFTWARE_TOKEN_MFA'; session: string };
```

### 3.2 `CognitoUserClient` 拡張（または新規メソッド）

`GET /users/me` の MFA 状態取得用に、Cognito の `AdminGetUser` で `UserMFASettingList` を読む方法と、access token を使う `GetUser` で読む方法がある。AuthGuard が DB lookup する設計上、access token は controller でも参照できる（`@Headers('authorization')`）。

**方針**: ユーザー自身が `/users/me` を呼ぶ流れに沿って、`getUserEmail` と同じパターンで access token 経由で MFA 状態を取得する。新規メソッド `getUserMfaSettings(accessToken)` を `CognitoUserClient` に追加。

```ts
async getUserMfaSettings(accessToken: string): Promise<{ totpEnabled: boolean }> {
  const result = await this.client.send(new GetUserCommand({ AccessToken: accessToken }));
  const totpEnabled = (result.UserMFASettingList ?? []).includes('SOFTWARE_TOKEN_MFA');
  return { totpEnabled };
}
```

### 3.3 `AuthService` 拡張

```ts
async login(email, password): Promise<LoginResponseDto> {
  // 既存に加え、kind === 'mfa_challenge' のケースで MfaChallengeResponseDto を返す
}

async respondMfaChallenge(
  email: string,
  code: string,
  session: string,
): Promise<AuthenticatedResponseDto> {
  // respondToMfaChallenge を呼び、null / 例外なら UnauthorizedException
}

async setupMfa(accessToken: string): Promise<{ secretCode: string; otpauthUri: string }> {
  const { secretCode } = await this.cognitoAuth.associateSoftwareToken(accessToken);
  // otpauthUri を組み立てる: otpauth://totp/Petal:<email>?secret=<secret>&issuer=Petal
  // email は GetUser で取得（または引数で受け取る）
  return { secretCode, otpauthUri };
}

async verifyMfaSetup(accessToken: string, code: string): Promise<void> {
  const { status } = await this.cognitoAuth.verifySoftwareToken(accessToken, code, 'Petal');
  if (status !== 'SUCCESS') throw new BadRequestException('コードが正しくありません');
  await this.cognitoAuth.setSoftwareTokenMfaEnabled(accessToken, true);
}

async disableMfa(accessToken: string): Promise<void> {
  await this.cognitoAuth.setSoftwareTokenMfaEnabled(accessToken, false);
}
```

`otpauthUri` は backend で組み立てる（フロントで組み立てると秘密鍵がクライアントコードに露出しないが、Petal は secret を直接フロントに返してすぐ QR 描画する設計でも問題ない。コード重複を避けるため backend で組み立てる）。

### 3.4 Controller / DTO / Schema

`auth.controller.ts` に追加:

| エンドポイント | 認証 | 概要 |
| --- | --- | --- |
| `POST /auth/mfa/setup` | 認証必須 | QR 用 secret + otpauth URI を返す |
| `POST /auth/mfa/verify` | 認証必須 | コード検証 → MFA 有効化 |
| `POST /auth/mfa/disable` | 認証必須 | MFA 無効化 |
| `POST /auth/challenge/mfa` | `@Public()` | MFA チャレンジ応答 |

DTO:

```ts
export class MfaSetupResponseDto {
  secretCode!: string;
  otpauthUri!: string;
}

export class MfaVerifyRequestDto {
  code!: string;
}

export class MfaChallengeRequestDto {
  @ApiProperty({ format: 'email' })
  email!: string;
  code!: string;
  session!: string;
}

export class MfaChallengeResponseDto {
  @ApiProperty({ enum: ['MFA_REQUIRED'] })
  status!: 'MFA_REQUIRED';
  @ApiProperty({ enum: ['SOFTWARE_TOKEN_MFA'] })
  challengeName!: 'SOFTWARE_TOKEN_MFA';
  session!: string;
  email!: string;
}

export type LoginResponseDto =
  | AuthenticatedResponseDto
  | ChallengeResponseDto       // NEW_PASSWORD_REQUIRED
  | MfaChallengeResponseDto;   // SOFTWARE_TOKEN_MFA
```

### 3.5 `GET /users/me` の MFA 状態反映

`UserController.findMe` で `accessToken` を取得し、`AuthService` （または新設の `MfaService`）経由で `cognitoUser.getUserMfaSettings(accessToken)` を呼ぶ。

レスポンス拡張: `UserResponseDto` に `mfaEnabled?: boolean` を追加。**自分自身のレスポンス専用** とし、`GET /users/:id`（admin 用）には含めない（他ユーザーの MFA 状態を admin が見る要件は別タスク）。

実装上は別 DTO を作って分けるのがクリーンだが、本リポジトリの既存パターンに合わせて `UserResponseDto` の optional フィールドにする。

### 3.6 SECRET_HASH と MFA チャレンジ

`RespondToAuthChallenge` で SOFTWARE_TOKEN_MFA を扱うとき、`ChallengeResponses` に `USERNAME` / `SOFTWARE_TOKEN_MFA_CODE` / `SECRET_HASH` を含める必要がある。`SECRET_HASH` は email で計算（`authenticate` と同流儀）。

### 3.7 v1.1 で再ログインなし: refresh token は発行されないか

Cognito の SOFTWARE_TOKEN_MFA チャレンジ通過後は通常の `AuthenticationResult` が返り、その中に refresh token も含まれる。フロントは既存パターンと同様にトークンを保存。

---

## 4. Frontend 詳細設計

### 4.1 ログイン画面の MFA チャレンジ対応

既存の `/login` は `NEW_PASSWORD_REQUIRED` を扱う。`SOFTWARE_TOKEN_MFA` を返された場合は MFA コード入力画面に遷移する。

実装方針:

- `lib/cognito.ts` の `LoginResult` に `kind: 'mfa_challenge'` を追加。
- `respondMfaChallenge(email, code, session)` を追加し、`POST /auth/challenge/mfa` を叩いてトークンを保存。
- `/login` ページのフックで MFA チャレンジ時は state を切り替え、コード入力フォームを表示。

### 4.2 マイページの MFA 設定 UI

`/me` 配下に `/me/mfa` セクションを追加（または `/me/email` と同居の設定一覧画面）。

実装方針:

- `useMfaApi`（API フック）— `setupMfa` / `verifyMfaSetup` / `disableMfa`。
- `useMfaSettingsPage`（ページフック）— ステップ管理（state: idle / setup / verify / enabled）。
- 表示:
  - 無効時: 「MFA を有効にする」ボタン → setup → QR コード表示 + コード入力 → verify → 完了
  - 有効時: 「MFA は有効です」状態 + 「無効化する」ボタン

QR コード描画: 軽量な `qrcode` ライブラリ（or `qrcode.react`）を frontend に追加。

### 4.3 OpenAPI 再生成

新エンドポイントが反映される。

---

## 5. データモデル / マイグレーション / 環境変数

- DB スキーマ変更 **なし**（MFA 状態は Cognito が保持）
- 環境変数追加 **なし**
- IAM 権限追加 **なし**（既存の Cognito 操作権限で `AssociateSoftwareToken` / `VerifySoftwareToken` / `SetUserMFAPreference` / `RespondToAuthChallenge` は可能）

---

## 6. Cognito User Pool 設定（手作業）

[docs/14_cognito-user-pool-setup.md](14_cognito-user-pool-setup.md) §3.6 を本タスクで更新する。AWS コンソール手順:

1. Cognito > User pool > Authentication > MFA
2. **MFA enforcement**: Optional
3. **MFA methods**: Authenticator apps（Software token MFA）にチェック
4. SMS にはチェックしない（本タスクスコープ外）

設定を保存したら既存ユーザーには影響なし（Optional のため）。明示的に有効化したユーザーのみ MFA を求められる。

---

## 7. 影響範囲

### Backend

| ファイル | 変更概要 |
| --- | --- |
| `src/auth/infra/cognito-auth.client.ts` | 4 メソッド追加、`authenticate` の戻り値に MFA challenge を追加 |
| `src/user/infra/cognito-user.client.ts` | `getUserMfaSettings(accessToken)` 追加 |
| `src/auth/application/auth.service.ts` | `respondMfaChallenge` / `setupMfa` / `verifyMfaSetup` / `disableMfa` 追加、`login` の戻り値拡張 |
| `src/auth/application/auth.schemas.ts` | `MfaChallengeSchema` / `MfaVerifySchema` 追加 |
| `src/auth/controller/auth.controller.ts` | 4 エンドポイント追加 |
| `src/auth/controller/auth.dto.ts` | DTO 追加（`MfaChallengeResponseDto` 等） |
| `src/auth/application/auth.service.spec.ts` | 新規メソッドのユニットテスト |
| `src/user/controller/user.controller.ts` | `findMe` で MFA 状態を取得して返す |
| `src/user/controller/user.dto.ts` | `UserResponseDto.mfaEnabled?: boolean` 追加 |
| `openapi.json` | 自動再生成 |

### Frontend

| ファイル | 変更概要 |
| --- | --- |
| `lib/cognito.ts` | `LoginResult` 拡張、`respondMfaChallenge` 追加 |
| `lib/api.ts` | `mfaApi.setup / verifyMfaSetup / disable` 追加 |
| `lib/openapi/schema.d.ts` | OpenAPI 再生成 |
| `app/login/...` | MFA コード入力画面の表示分岐 |
| `app/(authenticated)/me/mfa/page.tsx` + フック | 新規 MFA 設定ページ |
| `app/(authenticated)/me/...` ナビ | MFA 設定リンク |
| `package.json` | `qrcode.react`（または同等）依存追加 |

### Docs

| ファイル | 変更概要 |
| --- | --- |
| `docs/29_mfa-totp.md` | 本書（新規） |
| `docs/14_cognito-user-pool-setup.md` | §3.6 を「Optional + TOTP」に更新する手順を明記 |
| `AGENTS.md` | 表に追記 |

---

## 8. 手動動作確認シナリオ

PR 本文のチェックリストに転記する。

- [ ] User Pool で MFA = Optional + Software token MFA を有効化（手作業）
- [ ] 認証済みユーザーで `POST /auth/mfa/setup` → secretCode と otpauthUri が返る
- [ ] Authenticator アプリで QR を読み取り、`POST /auth/mfa/verify` で 6 桁コード送信 → 200
- [ ] 同ユーザーがログアウト → 再ログインで MFA コード入力画面に遷移
- [ ] 6 桁コード入力 → 認証成功でトークン取得
- [ ] `POST /auth/mfa/disable` で解除 → 次回ログインから MFA 不要
- [ ] フロント `/me/mfa` で同フローが UI から完結する
- [ ] `GET /users/me` レスポンスに `mfaEnabled` が含まれる
- [ ] `pnpm --filter backend build` / `pnpm --filter frontend build` 通過

---

## 9. リスク・補足

- **既存ユーザーが MFA 設定しない場合**: User Pool の MFA = Optional のため、設定しない限りログイン体験は変わらない。
- **TOTP デバイス紛失時の救済**: 本タスクではバックアップコード未提供のため、admin による Cognito コンソールでの強制リセット運用が必要。`docs/29` に明記する。
- **`disable` でコード検証を求めるか**: 防御深化として MFA コードを要求する選択肢もあるが、認証済みユーザーの access token 自体が認証要素なので v1 では要求しない。将来のセキュリティ強化として残す。
- **otpauthUri のラベル**: `otpauth://totp/Petal:<email>?secret=...&issuer=Petal&algorithm=SHA1&digits=6&period=30` で固定。ラベルは `Petal:<email>` 形式（Authenticator アプリ標準）。
- **Cognito の `getUserEmail` メソッド**: 既に `UpdateUserAttributes` 系で使用しているため、`/me` の MFA 状態取得で `accessToken` を controller で取得する流れも確立済み。
- **テスト**: `AuthService` に追加するメソッドのユニットテスト、`UserController.findMe` の MFA 状態返却は backend ユニットテストの範囲。フロントは引き続き手動確認。
