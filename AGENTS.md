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
| [docs/04_db-supabase-aws-hybrid.md](docs/04_db-supabase-aws-hybrid.md) | インフラ構成方針：DB のみ Supabase / その他 AWS（個人運用コスト最適化） |
| [docs/11_user-info_and_authentication.md](docs/11_user-info_and_authentication.md) | ユーザー情報・認証機能の設計 |
| [docs/12_image-management.md](docs/12_image-management.md) | 画像管理機能の設計（TSK-3） |
| [docs/13_openapi.md](docs/13_openapi.md) | OpenAPI / Swagger と Frontend 型生成の連携 |
| [docs/14_cognito-user-pool-setup.md](docs/14_cognito-user-pool-setup.md) | Cognito User Pool の構築手順（AWS コンソール作業） |
| [docs/15_user-management-enhancement.md](docs/15_user-management-enhancement.md) | ユーザー管理機能の拡張設計（TSK-4：Cognito 登録／無効化／初回ログイン） |
| [docs/16_user-restore.md](docs/16_user-restore.md) | 削除済みユーザーの再有効化 API 設計（TSK-6） |
| [docs/17_deleted-users-ui.md](docs/17_deleted-users-ui.md) | 削除済みユーザーの閲覧・復活 UI 設計（TSK-7） |
| [docs/18_logout-api.md](docs/18_logout-api.md) | ログアウト API 設計（TSK-19：GlobalSignOut 連携） |
| [docs/19_password-reset.md](docs/19_password-reset.md) | パスワードリセット 設計（TSK-8：ForgotPassword + ConfirmForgotPassword + GlobalSignOut） |
| [docs/20_email-change-flow.md](docs/20_email-change-flow.md) | メールアドレス変更フロー 設計（TSK-9：UpdateUserAttributes + VerifyUserAttribute） |
| [docs/21_role-cognito-group-sync.md](docs/21_role-cognito-group-sync.md) | ロール認可基盤 設計（TSK-10：AuthGuard で DB lookup → request.user.role / RolesGuard / GET /users/me） |
| [docs/22_password-policy-frontend-validation.md](docs/22_password-policy-frontend-validation.md) | パスワードポリシー フロント事前検証 設計（TSK-11：共通モジュール + チェックリスト UI） |
| [docs/23_user-token-revocation-on-delete.md](docs/23_user-token-revocation-on-delete.md) | 削除ユーザーの既存トークン無効化 設計（TSK-14：DELETE /users/:id に GlobalSignOut を追加） |
| [docs/24_testing-strategy.md](docs/24_testing-strategy.md) | テスト方針 設計（TSK-28：Jest によるユニットテスト整備、レイヤー別責務、モック戦略） |
| [docs/25_authguard-db-validation-tests.md](docs/25_authguard-db-validation-tests.md) | AuthGuard の DB ユーザー存在・有効性チェック テスト整備（TSK-15：実装は TSK-10 完了済みで、回帰防止のためテストで明文化） |
| [docs/26_last-admin-protection.md](docs/26_last-admin-protection.md) | 最後の admin の削除/降格を防ぐ 設計（TSK-16：DELETE/PATCH /users/:id に admin 数チェックと自身削除拒否を追加） |
| [docs/27_refresh-token-flow.md](docs/27_refresh-token-flow.md) | リフレッシュトークンによるアクセストークン更新 設計（TSK-20：POST /auth/refresh + openapi-fetch middleware による自動 refresh） |
| [docs/28_audit-logs.md](docs/28_audit-logs.md) | 監査ログ（ユーザー管理操作）設計（TSK-24：audit_logs テーブル + UserService 連動 + admin 閲覧 UI） |
| [docs/29_mfa-totp.md](docs/29_mfa-totp.md) | MFA (TOTP) 対応 設計（TSK-13：Cognito Software Token MFA Optional + ログインチャレンジ拡張 + マイページ設定 UI） |
| [docs/30_direnv-envrc.md](docs/30_direnv-envrc.md) | direnv 導入と .envrc 設定（TSK-30：.envs/ ディレクトリと symlink 切り替えによる環境変数管理） |
| [docs/31_env-example.md](docs/31_env-example.md) | .env.example の整備（TSK-31：Supabase DB 変数・AWS 認証情報・frontend 変数の追加） |
| [docs/34_typeorm-supabase.md](docs/34_typeorm-supabase.md) | TypeORM 設定更新（TSK-34：SSL 必須・PgBouncer Pooler 対応、DATABASE_URL / DATABASE_URL_DIRECT による接続切り替え） |
| [docs/36_lambda-api-gateway-setup.md](docs/36_lambda-api-gateway-setup.md) | Lambda + API Gateway デプロイ設定（TSK-36：Serverless Framework + @vendia/serverless-express、nest build で事前コンパイル） |
| [docs/37_amplify-hosting-setup.md](docs/37_amplify-hosting-setup.md) | Amplify Hosting 設定（TSK-37：amplify.yml によるモノリポビルド・standalone モード） |
| [docs/38_cognito-dev-setup.md](docs/38_cognito-dev-setup.md) | Cognito 開発環境用 User Pool 作成手順（TSK-38：`dev` ステージ専用 User Pool・App Client 設定） |
| [docs/39_s3-dev-setup.md](docs/39_s3-dev-setup.md) | S3 開発環境用バケット作成・IAM 設定（TSK-39：`petal-images-dev` バケット・CORS 設定） |
| [docs/40_github-actions-ci.md](docs/40_github-actions-ci.md) | GitHub Actions CI ワークフロー設計（TSK-40：backend lint/test/build・frontend lint/build） |
| [docs/41_github-actions-cd.md](docs/41_github-actions-cd.md) | GitHub Actions CD ワークフロー設計（TSK-41：DB マイグレーション→Lambda コード更新） |

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

### Frontend

- **ページコンポーネント（`app/**/page.tsx`）は View（JSX）に専念**させ、ステート・副作用・イベントハンドラは **同居するカスタムフック `use-<page>-page.ts`** に切り出す。
- フックはページと同じディレクトリに置く。1 ページ 1 フックを基本とする。詳細は [docs/00_rules.md](docs/00_rules.md) §3 を参照。

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
