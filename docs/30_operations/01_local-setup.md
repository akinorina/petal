# ローカル開発環境構築

ローカルは DB（PostgreSQL）と S3 互換（LocalStack）を Docker で起動し、**認証のみ実 AWS Cognito** を使う。

## 前提

- Node.js 20+ / pnpm 9+（リポジトリは pnpm 11 系を使用）
- Docker（Compose v2）
- direnv（環境変数の自動ロード）
- AWS Cognito の User Pool（ローカルでも実 Cognito を使う。構築は [02_cognito-setup.md](02_cognito-setup.md)）

```bash
# direnv インストール（macOS）
brew install direnv
echo 'eval "$(direnv hook zsh)"' >> ~/.zshrc && source ~/.zshrc
```

backend / frontend は **pnpm workspace を組まない独立プロジェクト**。依存は各ディレクトリで個別に install する。

## バックエンド

```bash
cd backend
pnpm install

# direnv
cp .envrc.example .envrc && direnv allow

# 環境変数（.envs/ からコピーして値を埋め、symlink を作成）
cp .envs/.env.local.example .envs/.env.local
#  COGNITO_USER_POOL_ID / COGNITO_CLIENT_ID / COGNITO_CLIENT_SECRET を設定
#  ADMIN_EMAIL / ADMIN_PASSWORD を設定（初期 Admin アカウント）
#  DB_* を設定
bash scripts/use-env.sh local        # local 用 .env を有効化

# DB（PostgreSQL）+ LocalStack(S3) 起動
docker compose up -d

pnpm migration:run                   # マイグレーション
pnpm create-admin                    # 初期 Admin 作成（べき等）
pnpm s3:setup                        # LocalStack の S3 バケット作成

pnpm start:dev                       # 開発サーバ（HTTPS, http://localhost:3000）
```

主な環境変数:

| 変数 | 用途 |
| ---- | ---- |
| `DB_*` | PostgreSQL 接続情報 |
| `COGNITO_REGION` / `COGNITO_USER_POOL_ID` / `COGNITO_CLIENT_ID` / `COGNITO_CLIENT_SECRET` | Cognito |
| `SKIP_AUTH` | テスト時のみ `true` で認証ガードをスキップ |
| `CORS_ORIGINS` | フロントのオリジン（カンマ区切り） |
| `ADMIN_*` | `pnpm create-admin` 用の初期 Admin |
| `SELF_SIGNUP_ENABLED` | セルフサインアップ可否（`true` のみ有効・既定 OFF） |

## フロントエンド

```bash
cd frontend
pnpm install

cp .envrc.example .envrc && direnv allow
cp .envs/.env.local.example .envs/.env.local
#  NEXT_PUBLIC_API_BASE_URL を backend の URL に設定
bash scripts/use-env.sh local

pnpm start:dev                       # http://localhost:3001
```

| 変数 | 用途 |
| ---- | ---- |
| `NEXT_PUBLIC_API_BASE_URL` | バックエンド API のベース URL |

> クライアントシークレット等の秘密情報を `NEXT_PUBLIC_*` に置かない。Cognito 認証はすべてバックエンド経由。

## 確認

- `http://localhost:3000/api-docs` で Swagger UI が開く。
- `http://localhost:3001` でログイン画面が開き、初期 Admin でログインできる。

## トラブルシュート

- **DB に繋がらない**: `docker compose ps` で postgres / localstack の起動を確認。`pnpm db:logs` / `pnpm s3:logs` でログ確認。
- **認証が通らない**: Cognito の User Pool / App Client / SECRET 設定と `.envs/.env.local` の値を確認（[02_cognito-setup.md](02_cognito-setup.md)）。
- **S3 操作が失敗**: `pnpm s3:setup` でバケット作成済みか確認。

## 関連ドキュメント

- DB 詳細 → [03_database-setup.md](03_database-setup.md)
- Cognito 構築 → [02_cognito-setup.md](02_cognito-setup.md)
- S3 構築 → [04_storage-setup.md](04_storage-setup.md)
- 環境変数管理(direnv) 原典 → [specs/30_direnv-envrc.md](../specs/30_direnv-envrc.md), [specs/31_env-example.md](../specs/31_env-example.md)
