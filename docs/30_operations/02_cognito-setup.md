# Cognito User Pool 構築

認証基盤の AWS Cognito User Pool / App Client を構築する。Petal は **SECRET_HASH 付きの Confidential client** を使い、Cognito へのアクセスはバックエンド経由のみ。ローカル開発でも実 Cognito を使う。

## 構築する要素

- **User Pool**: ユーザーディレクトリ。サインイン属性は email。
- **App Client（Confidential）**: クライアントシークレットを発行（バックエンドが SECRET_HASH を計算）。
- **グループ**: `admin` / `user`（ロール表現の一部。認可の真実は DB 側 `users.role`、[20_features/05_authorization.md](../20_features/05_authorization.md)）。
- **MFA**: Software Token MFA を Optional に設定（[20_features/01_authentication.md](../20_features/01_authentication.md)）。
- **パスワードポリシー**: フロント事前検証と整合させる（[20_features/03_self-service-account.md](../20_features/03_self-service-account.md)）。

## 環境別プール

| 環境 | プール |
| ---- | ------ |
| Local / Production | 本番用 User Pool（原典 [specs/14](../specs/14_cognito-user-pool-setup.md)） |
| Development | `dev` ステージ専用 User Pool・App Client（原典 [specs/38](../specs/38_cognito-dev-setup.md)） |

## バックエンドに設定する値

構築後、以下を `.envs/.env.<stage>` に設定する。

| 変数 | 取得元 |
| ---- | ------ |
| `COGNITO_REGION` | リージョン（ap-northeast-1） |
| `COGNITO_USER_POOL_ID` | User Pool ID |
| `COGNITO_CLIENT_ID` | App Client ID |
| `COGNITO_CLIENT_SECRET` | App Client のシークレット |

## 初期 Admin 作成

```bash
cd backend && pnpm create-admin   # ADMIN_EMAIL / ADMIN_PASSWORD を使う。べき等
```

詳細は [20_features/08_cognito-sync.md](../20_features/08_cognito-sync.md)（create-admin の再実行耐性）。

## 関連ドキュメント

- 認証機能 → [20_features/01_authentication.md](../20_features/01_authentication.md)
- Cognito ⇔ DB 同期 → [20_features/08_cognito-sync.md](../20_features/08_cognito-sync.md)
- 観測性 → [07_observability.md](07_observability.md)
- 原典 → [specs/14_cognito-user-pool-setup.md](../specs/14_cognito-user-pool-setup.md), [specs/38_cognito-dev-setup.md](../specs/38_cognito-dev-setup.md)
