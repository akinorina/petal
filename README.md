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
| パッケージマネージャ | pnpm（モノリポ） |

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

| ファイル | 内容 |
| -------- | ---- |
| [docs/00_rules.md](docs/00_rules.md) | 設計・実装ルール |
| [docs/01_requirements.md](docs/01_requirements.md) | 要求仕様 |
| [docs/02_ implementations.md](docs/02_%20implementations.md) | 実装仕様（技術スタック・構成） |
| [docs/11_user-info_and_authentication.md](docs/11_user-info_and_authentication.md) | ユーザー情報・認証機能の設計 |
| [docs/13_openapi.md](docs/13_openapi.md) | OpenAPI / Swagger と Frontend 型生成の連携 |

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

詳細は [docs/30_direnv-envrc.md](docs/30_direnv-envrc.md) を参照。

### 2. バックエンドのセットアップ

- [backend/README.md](backend/README.md)

### 3. フロントエンドのセットアップ

- [frontend/README.md](frontend/README.md)

## 開発

```bash
# バックエンド（http://localhost:3000）
pnpm --filter backend start:dev

# フロントエンド（http://localhost:3001）
pnpm --filter frontend start:dev
```
