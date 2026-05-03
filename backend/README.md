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
# 環境変数を設定
cp .env.example .env
# .env を編集して DB / Cognito の設定値を埋める

# DB 起動（Docker）
pnpm db:up

# マイグレーション
pnpm migration:run

# 初期 Admin ユーザーの作成
pnpm create-admin
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
# PostgreSQL 起動 / 停止 / ログ
pnpm db:up
pnpm db:down
pnpm db:logs

# マイグレーション
pnpm migration:generate database/migrations/<名前>   # エンティティ差分から自動生成
pnpm migration:create database/migrations/<名前>     # 空ファイル作成
pnpm migration:run                                    # 実行
pnpm migration:revert                                 # 直前を取り消し
pnpm migration:show                                   # 適用状況の確認
```

## 環境変数

`.env.example` を参照。主な変数：

| 変数 | 用途 |
| ---- | ---- |
| `DB_*` | PostgreSQL 接続情報 |
| `COGNITO_REGION` / `COGNITO_USER_POOL_ID` / `COGNITO_CLIENT_ID` / `COGNITO_CLIENT_SECRET` | AWS Cognito |
| `SKIP_AUTH` | テスト時のみ `true` で認証ガードをスキップ |
| `CORS_ORIGIN` | フロントエンドのオリジン |
| `ADMIN_*` | `pnpm create-admin` で使用する初期 Admin ユーザー情報 |

## アーキテクチャ

DDD + オニオンアーキテクチャ。依存方向は外側 → 内側で、Domain は外部に依存しない。詳細は [../docs/00_rules.md](../docs/00_rules.md) を参照。
