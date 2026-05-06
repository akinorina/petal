# AGENTS.md

このリポジトリで作業する AI エージェント（Claude Code, Cursor, Copilot など）への指示ファイル。

## 0. 最初に読むべきもの

`docs/` 以下にプロジェクトのルール・要求・設計が集約されている。**作業開始前に必ず関連ドキュメントを参照すること**。本ファイルの指示と `docs/` の内容が矛盾した場合は **`docs/` を正とする**。

| ドキュメント | 内容 |
| ------------ | ---- |
| [docs/00_rules.md](docs/00_rules.md) | アーキテクチャ・コーディング・ディレクトリ構成・DB・Git の全ルール |
| [docs/01_requirements.md](docs/01_requirements.md) | プロジェクトの要求仕様（機能要件） |
| [docs/02_ implementations.md](docs/02_%20implementations.md) | 技術スタック・システム構成 |
| [docs/03_workflow.md](docs/03_workflow.md) | タスク遂行の標準ワークフロー（設計→計画→ブランチ作成→実装→自主レビュー） |
| [docs/11_user-info_and_authentication.md](docs/11_user-info_and_authentication.md) | ユーザー情報・認証機能の設計 |
| [docs/12_image-management.md](docs/12_image-management.md) | 画像管理機能の設計（TSK-3） |
| [docs/13_openapi.md](docs/13_openapi.md) | OpenAPI / Swagger と Frontend 型生成の連携 |
| [docs/14_cognito-user-pool-setup.md](docs/14_cognito-user-pool-setup.md) | Cognito User Pool の構築手順（AWS コンソール作業） |
| [docs/15_user-management-enhancement.md](docs/15_user-management-enhancement.md) | ユーザー管理機能の拡張設計（TSK-4：Cognito 登録／無効化／初回ログイン） |

新しい設計ドキュメントを追加した場合は、このテーブルにも追記すること。

## 1. プロジェクト概要

**Petal** は画像コンテンツ管理 Web アプリケーション（モノリポ）。

- `backend/` … NestJS + TypeORM + PostgreSQL（REST API）
- `frontend/` … Next.js + React + Tailwind CSS
- 認証 … AWS Cognito（バックエンド経由で SECRET_HASH 付きの Confidential client）
- パッケージマネージャ … **pnpm のみ**（npm / yarn 禁止）

## 2. 守るべき主要ルール（要約）

詳細は [docs/00_rules.md](docs/00_rules.md) を参照。下記は逸脱しやすいポイントの要約。

### アーキテクチャ

- **DDD + オニオンアーキテクチャ**。依存方向は外側 → 内側。Domain は Infrastructure を参照しない。
- **フィーチャ優先のディレクトリ構成**。`src/<feature>/{domain,application,infra,controller}/` 配下に置く。レイヤーを `src/` 直下に置かない。
- 外部 SDK（Cognito, S3 等）の呼び出しは必ず `infra/` に隔離する。`application/` から SDK を直接触らない。

### コーディング

- TypeScript: `any` 禁止、`strict` 有効。
- Zod: 外部入力（API リクエスト・環境変数）は必ず Zod でバリデーション。型は `z.infer` で生成し、手書き型と二重定義しない。
- **ドメインエンティティは Zod スキーマで不変条件を定義し、コンストラクタで `parse()` する**。位置引数ではなくプロパティオブジェクトを 1 つ受け取る形にする。

### DB

- TypeORM。`synchronize: false`（自動同期しない）。
- スキーマ変更は migration ファイルで管理。`backend/database/migrations/` に置く。
- 削除はすべて論理削除（`@DeleteDateColumn` で `deleted_at` を入れる）。物理削除しない。

### 環境変数

- `.env` はコミットしない。`.env.example` を更新する。
- クライアントシークレットなど秘密情報を `NEXT_PUBLIC_*` に置かない（ブラウザに露出する）。

### Git

- **コミットメッセージは日本語**。
- `git push --force` や `git reset --hard` などの破壊的操作はユーザーの明示的許可なく実行しない。

## 3. 作業の進め方

1. ユーザーの要求を理解したら、関連する `docs/` を読む。
2. 既存のコード規約・命名・構成に揃える。新しいパターンを持ち込まない。
3. 不明な設計判断はコードを書く前にユーザーに確認する。
4. 実装後はビルド（`pnpm --filter backend build` / `pnpm --filter frontend build`）を通すこと。
5. ルールを更新・追加した場合は `docs/00_rules.md` を編集する。本ファイルではなく `docs/` を正とする運用。

## 4. やってはいけないこと

- `docs/` のルールに反する実装。
- npm / yarn の使用。
- 物理削除の実装。
- Domain 層から Infrastructure（TypeORM, AWS SDK 等）を直接 import する。
- フロントエンドにクライアントシークレット等の秘密情報を含める。
- ユーザー許可なしの破壊的 Git 操作（force push, reset --hard, branch -D 等）。
