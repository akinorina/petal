# Petal - 実装仕様書

## 1. 技術スタック

| 領域 | 技術 |
| ---- | ---- |
| バックエンド | TypeScript / Node.js / NestJS |
| フロントエンド | TypeScript / React / Next.js |
| CSSフレームワーク | Tailwind CSS |
| データベース | PostgreSQL |
| ORM | TypeORM |
| 型バリデーション | Zod |
| 認証 | AWS Cognito（メール＋パスワード、将来はOAuth対応） |
| ファイルストレージ | AWS S3 |
| インフラ | AWS |
| ローカル環境 | Localstack（AWS互換） |
| パッケージマネージャー | pnpm（npm / yarn 使用禁止） |

---

## 2. システム構成

```
[フロントエンド: Next.js]
        ↓ REST API
[バックエンド: NestJS]
        ↓
 ┌──────┬──────────┬──────────┐
 │      │          │          │
[PostgreSQL] [AWS S3] [AWS Cognito]
```

- フロントエンドとバックエンドは REST API で通信する。
- 認証は AWS Cognito が発行するトークン（JWT）でバックエンドが検証する。
- 画像ファイルは AWS S3 に保存し、メタデータ（ファイル名・サイズ等）は PostgreSQL に保存する。

---

## 3. アーキテクチャ

- **設計手法**: ドメイン駆動設計（DDD）
- **アーキテクチャパターン**: オニオンアーキテクチャ
- **API**: REST API

詳細は [00_rules.md](00_rules.md) を参照。

---

## 4. プロジェクト構成（モノリポ）

バックエンドとフロントエンドを同一リポジトリで管理するフラット構成とする。
規模が大きくなった場合は分割する。

```text
petal/
  backend/    # NestJS（REST API）
  frontend/   # Next.js
  infra/      # インフラ設定（docker-compose など）
  docs/       # 設計・仕様ドキュメント
  package.json           # pnpm workspace ルート
  pnpm-workspace.yaml
```

---

## 5. Local 開発環境のセットアップ

Local 環境の DB は Docker で起動する。設定は `infra/docker-compose.yml` で管理する。

```bash
# infra/.env.example をコピーして設定
cp infra/.env.example infra/.env

# PostgreSQL 起動
pnpm db:up

# PostgreSQL 停止
pnpm db:down

# ログ確認
pnpm db:logs
```

`infra/.env` の値と `backend/.env` の DB 接続情報（`DB_*`）は一致させること。

---

## 6. 実行環境

| 環境 | 説明 |
| ---- | ---- |
| Local | Docker（PostgreSQL）+ 実 AWS Cognito |
| Development | AWSを使った開発・検証環境（オプション） |
| Production | 本番環境 |
