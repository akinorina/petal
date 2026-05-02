# Petal - 実装仕様書

## 1. 技術スタック

| 領域 | 技術 |
| ---- | ---- |
| バックエンド | TypeScript / Node.js / NestJS |
| フロントエンド | TypeScript / React / Next.js |
| データベース | PostgreSQL |
| ORM | TypeORM |
| 型バリデーション | Zod |
| 認証 | AWS Cognito（メール＋パスワード、将来はOAuth対応） |
| ファイルストレージ | AWS S3 |
| インフラ | AWS |
| ローカル環境 | Localstack（AWS互換） |

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

## 4. 実行環境

| 環境 | 説明 |
| ---- | ---- |
| Local | Localstack によるAWS互換のローカル開発環境 |
| Development | AWSを使った開発・検証環境（オプション） |
| Production | 本番環境 |
