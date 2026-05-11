# 38. 認証: Cognito 開発環境用 User Pool 作成（TSK-38）

## 0. ステータス

- ステータス：**実装中**
- 対応タスク：TSK-38（プロジェクト：Petal 本番環境・デプロイの充実）

## 1. 目的

LOCAL 環境（LocalStack 不可、実 AWS Cognito を使用）とは別に、**開発環境（`dev` ステージ）専用の Cognito User Pool** を作成し、Lambda（TSK-36）・Amplify（TSK-37）から利用できる状態にする。

関連ドキュメント:

- [docs/14_cognito-user-pool-setup.md](14_cognito-user-pool-setup.md) — Cognito User Pool の構築手順（汎用）
- [docs/36_lambda-api-gateway-setup.md](36_lambda-api-gateway-setup.md) — Lambda 環境変数の設定箇所
- [docs/37_amplify-hosting-setup.md](37_amplify-hosting-setup.md) — Amplify 環境変数の設定箇所

## 2. スコープ

### 対象

- AWS Cognito User Pool（`dev` 環境用）の作成（AWS Console 手動作業）
- `backend/.envs/.env.development` への `COGNITO_*` 環境変数の設定
- `frontend/.envs/.env.production.example` の Cognito 変数を不要として削除

### 非対象

- Staging / Production 用 User Pool の作成
- SES 連携によるメール送信（開発環境は Cognito デフォルトのメール送信を使用）
- フロントエンドの Cognito 直接呼び出し（バックエンド経由のみ）

## 3. 開発環境固有の設定

汎用手順は [docs/14_cognito-user-pool-setup.md](14_cognito-user-pool-setup.md) を参照すること。以下は `dev` 環境で採用する具体的な値。

### 3.1 User Pool 名

```text
petal-dev
```

### 3.2 App Client 名

```text
petal-backend-dev
```

- **Client secret**: 生成する（`SECRET_HASH` 付きで呼び出すため必須）
- **Authentication flows**: `ALLOW_ADMIN_USER_PASSWORD_AUTH`, `ALLOW_REFRESH_TOKEN_AUTH`

### 3.3 MFA 設定

- MFA enforcement: **Optional**（[docs/29_mfa-totp.md](29_mfa-totp.md) の実装に合わせる）
- MFA methods: **Authenticator apps（TOTP）のみ**（SMS 不要）

### 3.4 メール配信

- 開発環境では **Cognito デフォルトのメール送信**を使用（SES 不要）
- 送信元: Cognito のデフォルトドメイン

### 3.5 セルフサービスサインアップ

- **無効**（管理者作成のみ）

## 4. 環境変数

### 4.1 バックエンド（Lambda 環境変数）

Serverless Framework のデプロイ時に `backend/.envs/.env.development` から読み込む。

| 変数名 | 説明 |
| --- | --- |
| `COGNITO_REGION` | `ap-northeast-1` |
| `COGNITO_USER_POOL_ID` | 作成した User Pool の ID（例: `ap-northeast-1_XXXXXXXXX`） |
| `COGNITO_CLIENT_ID` | App Client の ID |
| `COGNITO_CLIENT_SECRET` | App Client のクライアントシークレット |

> `COGNITO_CLIENT_SECRET` はバックエンドのみで使用する。フロントエンドには置かない。

### 4.2 フロントエンド（Amplify 環境変数）

フロントエンドは Cognito を直接呼び出さないため、`NEXT_PUBLIC_COGNITO_*` 変数は不要。
`frontend/.envs/.env.production.example` から該当変数を削除する。

## 5. 作業手順（AWS Console）

### Step 1: User Pool 作成

[docs/14_cognito-user-pool-setup.md §3](14_cognito-user-pool-setup.md) の手順に従って User Pool を作成する。
§3.1〜§3.11 をすべて実施すること。

### Step 2: 作成後の情報取得

以下の値を AWS Console から取得し、`backend/.envs/.env.development` に設定する。

```bash
COGNITO_REGION=ap-northeast-1
COGNITO_USER_POOL_ID=ap-northeast-1_XXXXXXXXX
COGNITO_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx
COGNITO_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxx...
```

### Step 3: Lambda 環境変数の更新

`backend/.envs/.env.development` を更新後、Lambda に再デプロイする。

```bash
cd backend
pnpm run deploy
```

### Step 4: Amplify 環境変数の確認

Amplify Console の環境変数に `NEXT_PUBLIC_COGNITO_*` が残っている場合は削除する（不要）。

### Step 5: 初期管理者ユーザーの作成

[docs/14_cognito-user-pool-setup.md §6](14_cognito-user-pool-setup.md) の動作確認手順に従い、管理者ユーザーを Cognito 上で作成してログインを確認する。

## 6. 完了条件

- 開発環境用 Cognito User Pool が ap-northeast-1 で稼働している
- 開発環境用の `COGNITO_USER_POOL_ID` / `COGNITO_CLIENT_ID` を取得済み
- `backend/.envs/.env.development` に `COGNITO_*` 変数が設定されている
- Lambda に再デプロイ済みで、ログイン API（`POST /auth/login`）が正常動作する
- ログイン・MFA 設定・リフレッシュトークンが正常に機能する

## 7. 動作確認シナリオ（手動）

- [ ] Cognito User Pool が ap-northeast-1 に作成されている
- [ ] `POST /auth/login` が `200 OK` + アクセストークンを返す
- [ ] Amplify dev URL でトップページが表示される（TSK-37 完了後）
- [ ] Amplify dev URL でログインが成功し、ダッシュボードへ遷移する
