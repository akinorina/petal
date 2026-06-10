# Petal

画像コンテンツのアップロード・管理を行う Web アプリケーション。

## 技術スタック

| 領域 | 技術 |
| ---- | ---- |
| バックエンド | TypeScript / NestJS / TypeORM |
| フロントエンド | TypeScript / Next.js / React / Tailwind CSS |
| データベース | PostgreSQL |
| 認証 | AWS Cognito |
| ストレージ | AWS S3（v2 以降） |
| パッケージマネージャ | pnpm（モノリポ・workspace なし／backend・frontend は独立プロジェクト） |

## ディレクトリ構成

```text
petal/
  backend/    # NestJS REST API
  frontend/   # Next.js
  docs/       # 設計・要求・ルールドキュメント
  AGENTS.md   # AI エージェント向け指示
  CLAUDE.md   # Claude Code 用ポインタ
```

## ドキュメント

ドキュメントは機能・レイヤー軸で体系化しています。起点は [docs/README.md](docs/README.md)。

| カテゴリ | 内容 |
| -------- | ---- |
| [docs/00_overview/](docs/00_overview/) | プロジェクト概要・要求仕様・用語 |
| [docs/10_architecture/](docs/10_architecture/) | システム構成・設計思想・コーディング規約・DB/API 設計 |
| [docs/20_features/](docs/20_features/) | 機能別の現状仕様 |
| [docs/30_operations/](docs/30_operations/) | ローカル構築・デプロイ・CI/CD・運用 |
| [docs/40_processes/](docs/40_processes/) | 開発ワークフロー・テスト方針・Git 運用 |
| [docs/specs/](docs/specs/) | 旧タスク別ドキュメント（アーカイブ） |

## セットアップ

### 1. direnv のインストール（環境変数の自動ロード）

[direnv](https://direnv.net/) を使うとディレクトリ移動時に `.env` が自動ロードされます。

```bash
# インストール
brew install direnv

# シェルに hook を追加（~/.zshrc に追記してリロード）
echo 'eval "$(direnv hook zsh)"' >> ~/.zshrc
source ~/.zshrc
```

詳細は [docs/30_operations/01_local-setup.md](docs/30_operations/01_local-setup.md) を参照。

### 2. バックエンドのセットアップ

- [backend/README.md](backend/README.md)

### 3. フロントエンドのセットアップ

- [frontend/README.md](frontend/README.md)

## 開発

backend / frontend は pnpm workspace を組まない独立プロジェクトです。依存は各ディレクトリで個別に install します（`cd backend && pnpm install` / `cd frontend && pnpm install`）。

```bash
# バックエンド（http://localhost:3000）
cd backend && pnpm start:dev

# フロントエンド（http://localhost:3001）
cd frontend && pnpm start:dev
```
