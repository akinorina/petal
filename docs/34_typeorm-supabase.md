# TSK-34: TypeORM 設定更新（SSL・Pooler 対応）

## 目的

バックエンドの TypeORM 設定を Supabase（SSL 必須・PgBouncer Pooler）に対応させる。
ローカル開発環境（個別変数）との切り替えも維持する。

## スコープ

### 対象

- `backend/database/data-source.ts`（マイグレーション CLI 用）
- `backend/src/app.module.ts`（アプリ実行時用）

### 非対象

- マイグレーションファイルの内容変更
- Supabase 側の設定変更

## 接続モードの切り替えロジック

環境変数の有無で接続方式を自動切り替えする。

| 環境変数 | 接続先 | 用途 |
| --- | --- | --- |
| `DATABASE_URL` あり | Supabase Pooler（port 6543） | アプリ実行時 |
| `DATABASE_URL` なし | ローカル PostgreSQL（`DB_HOST` 等） | ローカル開発 |
| `DATABASE_URL_DIRECT` あり | Supabase Direct（port 5432） | マイグレーション CLI |
| `DATABASE_URL_DIRECT` なし | ローカル PostgreSQL（`DB_HOST` 等） | ローカル開発 |

## Supabase 接続時の設定値

### SSL

```typescript
ssl: { rejectUnauthorized: false }
```

Supabase は SSL 必須。`rejectUnauthorized: false` は Supabase の自己署名証明書への対応。

### Pooler 追加設定（アプリ実行時のみ）

```typescript
extra: {
  max: 1,             // Lambda 1インスタンスあたりの接続数を1に制限
  prepareThreshold: 0 // PgBouncer transaction mode では prepared statement 不可
}
```

マイグレーション CLI（Direct 接続）では `extra` 不要。

## 完了条件

- `pnpm --filter backend build` が通る
- `DATABASE_URL_DIRECT` を設定した状態で `pnpm --filter backend migration:run` が実行できる
- `DATABASE_URL` なし（ローカル）でもアプリが従来通り起動できる
