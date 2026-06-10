# TSK-31: .env.example の整備（backend / frontend）

## 目的

本番環境・Neon 移行・AWS デプロイに必要な環境変数を `.env.example` として整備し、
開発者が必要な変数を把握できるようにする。

## スコープ

### 対象

- `backend/.env.example` の更新（Neon 対応 DB 変数追加・コメント整備）
- `backend/.envs/.env.local.example` の同期更新
- `frontend/.env.example` の新規作成
- `frontend/.envs/.env.local.example` の更新（`NEXT_PUBLIC_COGNITO_*` 追加）
- `frontend/.gitignore` への `!.env.example` 追加

### 非対象

- 実際のシークレット値の設定
- Neon / AWS の構築作業
- TypeORM の接続設定変更（別タスク）

## 変数仕様

### backend

| 変数名 | 用途 |
| --- | --- |
| `DATABASE_URL` | Neon PgBouncer Pooler 接続（`-pooler` エンドポイント / port 5432）。通常の API 実行時に使用 |
| `DATABASE_URL_DIRECT` | Neon Direct 接続（非 `-pooler` エンドポイント / port 5432）。マイグレーション実行専用 |
| `DB_HOST` / `DB_PORT` / ... | ローカル PostgreSQL 用（既存）。本番では `DATABASE_URL` に置き換え予定 |
| `COGNITO_REGION` 他 | AWS Cognito 設定（既存） |
| `AWS_REGION` / `S3_BUCKET` 他 | AWS S3 設定（既存） |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | AWS 認証情報（デプロイ環境用） |

### frontend

| 変数名 | 用途 |
| --- | --- |
| `NEXT_PUBLIC_API_BASE_URL` | バックエンド API のベース URL（本番用） |
| `NEXT_PUBLIC_COGNITO_REGION` | Cognito リージョン |
| `NEXT_PUBLIC_COGNITO_USER_POOL_ID` | Cognito User Pool ID |
| `NEXT_PUBLIC_COGNITO_CLIENT_ID` | Cognito クライアント ID（公開情報） |

> **注意**: `NEXT_PUBLIC_*` はブラウザに露出する。シークレット（`COGNITO_CLIENT_SECRET` 等）は絶対に含めない。

## 完了条件

- `backend/.env.example` に `DATABASE_URL` / `DATABASE_URL_DIRECT` が含まれている
- `frontend/.env.example` に本番 API エンドポイント変数が含まれている
- 実際のシークレット値が含まれていないことを確認
