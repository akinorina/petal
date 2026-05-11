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

### direnv（環境変数の自動ロード）

[direnv](https://direnv.net/) を使うとディレクトリ移動時に `.env` が自動ロードされます。

```bash
# 1. インストール
brew install direnv

# 2. シェルに hook を追加（~/.zshrc または ~/.bashrc）
echo 'eval "$(direnv hook zsh)"' >> ~/.zshrc  # zsh の場合
source ~/.zshrc

# 3. .envrc を作成して許可
cp .envrc.example .envrc
cp backend/.envrc.example backend/.envrc
cp frontend/.envrc.example frontend/.envrc
direnv allow                            # ルート
(cd backend && direnv allow)            # backend
(cd frontend && direnv allow)           # frontend
```

詳細は [docs/30_direnv-envrc.md](docs/30_direnv-envrc.md) を参照。

### 依存関係と初期設定

```bash
# 依存関係のインストール
pnpm install

# バックエンド
cd backend && cp .env.example .env  # 設定値を埋める
pnpm db:up                          # PostgreSQL 起動
pnpm migration:run                  # マイグレーション
pnpm create-admin                   # 初期 Admin ユーザー作成

# フロントエンド
cd ../frontend && cp .env.local.example .env.local  # 設定値を埋める
```

詳細は各ディレクトリの README を参照：

- [backend/README.md](backend/README.md)
- [frontend/README.md](frontend/README.md)

## 開発

```bash
# バックエンド（http://localhost:3000）
pnpm --filter backend start:dev

# フロントエンド（http://localhost:3001）
pnpm --filter frontend start:dev
```
