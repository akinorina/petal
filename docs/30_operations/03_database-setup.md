# データベース構築（Neon / ローカル）

本番・dev の DB は **Neon（Serverless Postgres）**、ローカルは Docker の PostgreSQL。スキーマは `petal`。詳細な選定背景は [specs/04_db-neon-aws-hybrid.md](../specs/04_db-neon-aws-hybrid.md)。

## ローカル（Docker）

```bash
cd backend
docker compose up -d        # PostgreSQL 起動
pnpm migration:run          # マイグレーション適用
```

接続情報は `.envs/.env.local` の `DB_*`。

## Neon（本番 / dev）

### 1. Neon プロジェクト作成

- Free プランで可。DB `petal` を作成。
- **Pooler / Direct 両方**の接続文字列を取得して安全に保管する。

### 2. 接続方式（最重要）

Neon は同一ポート（5432）で**ホスト名により Pooler と Direct を区別**する。用途で必ず使い分ける。

| 用途 | エンドポイント | 環境変数 |
| ---- | -------------- | -------- |
| アプリ実行（Lambda → DB） | Pooler（ホスト名に `-pooler`） | `DATABASE_URL` |
| マイグレーション・DDL・pg_dump | Direct | `DATABASE_URL_DIRECT` |

```dotenv
DATABASE_URL=postgresql://...-pooler.<region>.aws.neon.tech/petal?sslmode=require&channel_binding=require
DATABASE_URL_DIRECT=postgresql://....<region>.aws.neon.tech/petal?sslmode=require&channel_binding=require
```

Lambda は同時実行ごとに接続を張るため、Pooler（PgBouncer transaction mode）を経由して接続枯渇を防ぐ。

### 3. TypeORM 設定（Pooler 対応）

`DataSource` は `DATABASE_URL`（Pooler）、マイグレーション CLI は `DATABASE_URL_DIRECT`（Direct）を読む。Pooler は transaction mode なので次が必須:

- `ssl: { rejectUnauthorized: false }`（Neon は SSL 必須）
- prepared statement 無効化（`extra: { prepareThreshold: 0 }` 相当）
- コネクションプール制限（`extra: { max: 1 }` 程度）
- `DataSource` は Lambda ハンドラ外でモジュールスコープにシングルトン化（warm 再利用）

原典: [specs/34_typeorm-neon.md](../specs/34_typeorm-neon.md)

### 4. マイグレーション適用

```bash
# Direct エンドポイントを指して適用
cd backend && pnpm migration:run
```

## マイグレーションコマンド（`backend/`）

```bash
pnpm migration:generate database/migrations/<名前>  # エンティティ差分から生成
pnpm migration:create   database/migrations/<名前>  # 空ファイル
pnpm migration:run                                  # 実行
pnpm migration:revert                               # 取り消し
pnpm migration:show                                 # 適用状況
```

スキーマ詳細は [10_architecture/05_database-schema.md](../10_architecture/05_database-schema.md)。

## Neon Free の運用上の注意

| 制約 | 対策 |
| ---- | ---- |
| compute 自動サスペンド | 週次 keep-alive（[08_operational-jobs.md](08_operational-jobs.md)） |
| 自動バックアップなし | 週次 `pg_dump` → S3（[08_operational-jobs.md](08_operational-jobs.md)） |
| direct 接続数上限 | Pooler 経由で接続 |

## 関連ドキュメント

- スキーマ → [10_architecture/05_database-schema.md](../10_architecture/05_database-schema.md)
- 運用ジョブ → [08_operational-jobs.md](08_operational-jobs.md)
- 原典 → [specs/04_db-neon-aws-hybrid.md](../specs/04_db-neon-aws-hybrid.md), [specs/34_typeorm-neon.md](../specs/34_typeorm-neon.md)
