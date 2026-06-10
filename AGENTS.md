# AGENTS.md

このリポジトリで作業する AI エージェント（Claude Code, Cursor, Copilot など）への指示ファイル。

## 0. 最初に読むべきもの

`docs/` 以下にプロジェクトのルール・要求・設計が集約されている。**作業開始前に必ず関連ドキュメントを参照すること**。本ファイルの指示と `docs/` の内容が矛盾した場合は **`docs/` を正とする**。

| カテゴリ | 内容 | 起点 |
| -------- | ---- | ---- |
| 概要・要求 | プロジェクト概要・要求仕様・用語 | [docs/00_overview/](docs/00_overview/) |
| 設計 | システム構成・DDD/オニオン・DB/API 設計・コーディング規約 | [docs/10_architecture/](docs/10_architecture/) |
| 機能仕様 | 認証・ユーザー管理・画像・認可・監査ログ・PWA 等の現状仕様 | [docs/20_features/](docs/20_features/) |
| 構築・運用 | ローカル構築・Cognito/DB/S3・デプロイ・CI/CD・運用ジョブ | [docs/30_operations/](docs/30_operations/) |
| 開発プロセス | タスク遂行 7 フェーズ・テスト方針・Git/リリース運用 | [docs/40_processes/](docs/40_processes/) |
| アーカイブ | 旧タスク別設計メモ（TSK-N/PRJ-N）。各ドキュメントの「原典」 | [docs/specs/](docs/specs/) |

ドキュメント全体の目次は [docs/README.md](docs/README.md)。再編の方針は [docs/documentation-plan.md](docs/documentation-plan.md)。

特に逸脱しやすいルールは [docs/10_architecture/07_coding-rules.md](docs/10_architecture/07_coding-rules.md)、ワークフローは [docs/40_processes/01_workflow.md](docs/40_processes/01_workflow.md) を必ず参照すること。

## 1. プロジェクト概要

**Petal** は画像コンテンツ管理 Web アプリケーション（モノリポ）。

- `backend/` … NestJS + TypeORM + PostgreSQL（REST API）
- `frontend/` … Next.js + React + Tailwind CSS
- 認証 … AWS Cognito（バックエンド経由で SECRET_HASH 付きの Confidential client）
- パッケージマネージャ … **pnpm のみ**（npm / yarn 禁止）。**pnpm workspace は組まない**：`backend/` と `frontend/` はそれぞれ独立した pnpm プロジェクトで、各自の `pnpm-lock.yaml` と設定用 `pnpm-workspace.yaml`（`packages:` を持たず `allowBuilds` 等の設定専用）を持つ。依存は各ディレクトリで個別に install する（`cd backend && pnpm install` / `cd frontend && pnpm install`）。ルート直下で `pnpm install` や `pnpm --filter` は使わない。

## 2. 守るべき主要ルール（要約）

詳細は [docs/10_architecture/07_coding-rules.md](docs/10_architecture/07_coding-rules.md) を参照。下記は逸脱しやすいポイントの要約。

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
- フックはページと同じディレクトリに置く。1 ページ 1 フックを基本とする。詳細は [docs/10_architecture/03_frontend-architecture.md](docs/10_architecture/03_frontend-architecture.md) を参照。

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

### ファイル削除（`.trash` 退避）

- ファイル・ディレクトリを削除したいときは `rm` で物理削除せず、リポジトリ直下の **`.trash/`（`.gitignore` 済み）へ `mv` で退避**する。中間生成物・一時ファイルの片付けも同様。詳細は [docs/40_processes/03_git-and-release.md](docs/40_processes/03_git-and-release.md)。

### リリース運用（PRJ-11）

詳細は [docs/30_operations/06_cicd.md](docs/30_operations/06_cicd.md) を参照。

- 開発は `main` で行う。全 PR は `main` に向ける。
- `main` への push では **CI のみ** が走る（Lambda / Amplify はデプロイされない）。
- デプロイは **`release` ブランチへの push** が起点。`release` への更新は GitHub Actions の `Promote main to release` ワークフロー（`workflow_dispatch`）経由で `main` をマージして行う。
- **`release` への直接 push は禁止**（GitHub Free プランの制約で Branch protection を使えないため運用ルールで担保）。

## 3. 作業の進め方

1. ユーザーの要求を理解したら、関連する `docs/` を読む。
2. 既存のコード規約・命名・構成に揃える。新しいパターンを持ち込まない。
3. 不明な設計判断はコードを書く前にユーザーに確認する。
4. 実装後はビルド（`cd backend && pnpm build` / `cd frontend && pnpm build`）を通すこと。
5. ルールを更新・追加した場合は [docs/10_architecture/07_coding-rules.md](docs/10_architecture/07_coding-rules.md) を編集する。本ファイルではなく `docs/` を正とする運用。

## 4. やってはいけないこと

- `docs/` のルールに反する実装。
- npm / yarn の使用。
- 物理削除の実装。
- Domain 層から Infrastructure（TypeORM, AWS SDK 等）を直接 import する。
- フロントエンドにクライアントシークレット等の秘密情報を含める。
- ユーザー許可なしの破壊的 Git 操作（force push, reset --hard, branch -D 等）。
