# Petal とは

## 概要

**Petal** は、ユーザーごとに画像コンテンツをアップロード・閲覧・管理できる Web アプリケーションです。
Instagram のような画像コンテンツ管理を念頭に置きつつ、将来的な機能拡張の土台となるシステムを目指しています。

### 目的

- 画像コンテンツのアップロード・閲覧・管理
- 認証によるユーザーごとのコンテンツ管理
- 開発者（仲田明紀）のフルスタック・クラウド技術の習得

## スコープ

- アップロードされたコンテンツは **登録したユーザー本人のみ** が閲覧できる（プライベート）。
- 管理者はユーザーの登録・編集・削除を行い、システム全体を管理する。
- 将来的にコンテンツの一般公開機能を追加する可能性がある（現状は未実装）。

## ユーザーとロール

| ロール | 説明 |
| ------ | ---- |
| 管理者（Admin） | ユーザーの登録・編集・削除を行い、システム全体を管理する。監査ログを閲覧できる。 |
| 一般ユーザー（User） | ログイン後、自分のコンテンツ（画像）を管理できる。自分のプロフィール・パスワード・メールを変更できる。 |

ロールは Cognito グループおよび DB の `users.role` で表現され、バックエンドの認可で利用される。
詳細は [20_features/05_authorization.md](../20_features/05_authorization.md) を参照。

## システム構成（概略）

```text
[フロントエンド: Next.js / Amplify Hosting]
        ↓ REST API (JWT)
[バックエンド: NestJS / Lambda + API Gateway]
   ├──→ AWS Cognito   … 認証
   ├──→ AWS S3        … 画像ファイル
   └──→ Neon Postgres … メタデータ・ユーザー・監査ログ
```

詳細は [10_architecture/01_system-architecture.md](../10_architecture/01_system-architecture.md) を参照。

## 関連ドキュメント

- 要求の詳細 → [02_requirements.md](02_requirements.md)
- 用語 → [03_glossary.md](03_glossary.md)
- 背景（原典）→ [specs/01_requirements.md](../specs/01_requirements.md), [specs/02_ implementations.md](../specs/02_%20implementations.md)
