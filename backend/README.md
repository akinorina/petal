# backend

Petal のバックエンド。NestJS による REST API サーバ。

## ディレクトリ構成

```text
backend/
  src/                      # ランタイムコード
    <feature>/              # 例: user, auth
      domain/               # エンティティ・リポジトリIF
      application/          # ユースケース（サービス）
      infra/                # DB エンティティ・外部サービス連携
      controller/           # コントローラー・DTO
      <feature>.module.ts
    common/                 # 横断的関心事（ガード等）
    app.module.ts
    main.ts
  database/                 # CLI 専用：DataSource・マイグレーション
  scripts/                  # CLI 専用：管理用スクリプト
```

ディレクトリ構成・アーキテクチャの詳細は [../docs/00_rules.md](../docs/00_rules.md) を参照。

## セットアップ

```bash
# 依存関係のインストール
pnpm install

# direnv 設定
cp .envrc.example .envrc
direnv allow

# 環境変数を設定（.envs/ からコピーして値を埋め、symlink を作成）
cp .envs/.env.local.example .envs/.env.local
# Cognito ユーザープールの値 `COGNITO_USER_POOL_ID` `COGNITO_CLIENT_ID` `COGNITO_CLIENT_SECRET` を .envs/.env.local に設定
# `ADMIN_EMAIL` `ADMIN_PASSWORD` を設定、これがADMINアカウントのID、PASSWORDになります。

# .envs/.env.local を編集して DB / Cognito の設定値を埋める
bash scripts/use-env.sh local

# LocalStack 用の HTTPS 証明書を生成
# （mkcert で certs/localhost+2.pem を用意済みであること。LocalStack が起動時にマウントするため docker compose の前に実行）
bash scripts/localstack/generate-localstack-cert.sh

# DB 起動（Docker）
docker compose up -d

# マイグレーション
pnpm migration:run

# 初期 Admin ユーザーの作成
pnpm create-admin

# localstack S3バケット設定
pnpm s3:setup
```

## 開発

```bash
# 開発サーバ起動（ホットリロード）
pnpm start:dev

# プロダクションビルド
pnpm build

# テスト
pnpm test
```

## DB 操作

```bash
# Docker Compose 起動 / 停止
docker compose up -d
docker compose down

# PostgreSQL ログ
pnpm db:logs

# マイグレーション
pnpm migration:generate database/migrations/<名前>   # エンティティ差分から自動生成
pnpm migration:create database/migrations/<名前>     # 空ファイル作成
pnpm migration:run                                    # 実行
pnpm migration:revert                                 # 直前を取り消し
pnpm migration:show                                   # 適用状況の確認
```

## 環境変数

`.envs/.env.local.example` を参照。主な変数：

| 変数 | 用途 |
| ---- | ---- |
| `DB_*` | PostgreSQL 接続情報 |
| `COGNITO_REGION` / `COGNITO_USER_POOL_ID` / `COGNITO_CLIENT_ID` / `COGNITO_CLIENT_SECRET` | AWS Cognito |
| `SKIP_AUTH` | テスト時のみ `true` で認証ガードをスキップ |
| `CORS_ORIGINS` | フロントエンドのオリジン（カンマ区切りで複数指定可） |
| `ADMIN_*` | `pnpm create-admin` で使用する初期 Admin ユーザー情報 |

## アーキテクチャ

DDD + オニオンアーキテクチャ。依存方向は外側 → 内側で、Domain は外部に依存しない。詳細は [../docs/00_rules.md](../docs/00_rules.md) を参照。
