# TSK-30: direnv 導入と .envrc 設定

## 目的

LOCAL / 本番など複数環境の環境変数を安全・簡単に切り替えられる基盤を整備する。  
`direnv` を使い、ディレクトリ移動時に `.env` が自動ロードされるようにする。

環境の切り替えは `scripts/use-env.sh <環境名>` で行い、シンボリックリンクを付け替える方式を採用する。

## スコープ

### 対象

- `direnv` の設定（各ディレクトリの `.envrc.example`）
- 環境ごとの `.env` ファイルを格納する `.envs/` ディレクトリの整備
- 環境切り替えスクリプト `scripts/use-env.sh`
- `.gitignore` への `.envrc` / `.envs/.env.*` の追加
- README / docs へのセットアップ手順記載

### 非対象

- CI/CD 環境（GitHub Actions は直接 Secret を参照するため不要）
- 本番環境（AWS Systems Manager Parameter Store 等を使用）

## ファイル構成

```text
petal/
  .envrc.example                    # ルート .envrc のテンプレート（コミット）
  .envrc                            # 実体（gitignore・各自作成）
  scripts/
    use-env.sh                      # 環境切り替えスクリプト（コミット）
  backend/
    .envs/
      .env.local.example            # local 用テンプレート（コミット）
      .env.local                    # local 用実体（gitignore・各自作成）
      .env.staging.example          # staging 用テンプレート（コミット）
      .env.staging                  # staging 用実体（gitignore・各自作成）
    .envrc.example                  # テンプレート（コミット）
    .envrc                          # 実体（gitignore・各自作成）
    .env                            # → .envs/.env.<環境名> へのシンボリックリンク（gitignore）
    .env.example                    # 既存テンプレート（コミット）
  frontend/
    .envs/
      .env.local.example            # local 用テンプレート（コミット）
      .env.local                    # local 用実体（gitignore・各自作成）
      .env.staging.example          # staging 用テンプレート（コミット）
      .env.staging                  # staging 用実体（gitignore・各自作成）
    .envrc.example                  # テンプレート（コミット）
    .envrc                          # 実体（gitignore・各自作成）
    .env.local                      # → .envs/.env.<環境名> へのシンボリックリンク（gitignore）
    .env.local.example              # 既存テンプレート（コミット）
```

## `.envrc` の内容

### ルート（`petal/.envrc`）

```bash
# petal/.envrc
# モノリポルートで実行するコマンド向け。
# backend / frontend 配下では各ディレクトリの .envrc が自動ロードされる。
```

### backend（`petal/backend/.envrc`）

```bash
dotenv .env
```

### frontend（`petal/frontend/.envrc`）

```bash
dotenv .env.local
```

## 環境切り替えの仕組み

`scripts/use-env.sh <環境名>` を実行すると、各サービスの `.env`（または `.env.local`）が  
`.envs/.env.<環境名>` へのシンボリックリンクに付け替わる。

```text
backend/.env  →  backend/.envs/.env.local    （local 時）
              →  backend/.envs/.env.staging  （staging 時）

frontend/.env.local  →  frontend/.envs/.env.local    （local 時）
                     →  frontend/.envs/.env.staging  （staging 時）
```

direnv は `.envrc` 内の `dotenv .env` / `dotenv .env.local` でリンク先を読み込むため、  
スクリプト実行後にディレクトリへ入り直すだけで環境変数が切り替わる。

## `.gitignore` の方針

| ファイル | gitignore | 理由 |
| --- | --- | --- |
| `.envrc` | ✓ | 誤コミット防止 |
| `backend/.env` | ✓（ルートの `.env` パターンで対応済み） | symlink を追跡しない |
| `frontend/.env.local` | ✓（ルートの `.env.local` パターンで対応済み） | symlink を追跡しない |
| `backend/.envs/.env.*` | ✓ | 実際の秘密情報を含む |
| `frontend/.envs/.env.*` | ✓ | 実際の秘密情報を含む |
| `*.example` | ✗（コミット） | チームへの共有テンプレート |

## セットアップ手順（開発者向け）

```bash
# 1. direnv のインストール
brew install direnv

# 2. シェルへの hook 追加（~/.zshrc に追記してリロード）
echo 'eval "$(direnv hook zsh)"' >> ~/.zshrc
source ~/.zshrc

# 3. .envrc を各ディレクトリに作成して許可
cp .envrc.example .envrc
cp backend/.envrc.example backend/.envrc
cp frontend/.envrc.example frontend/.envrc
direnv allow
(cd backend && direnv allow)
(cd frontend && direnv allow)

# 4. 環境ごとの .env ファイルを作成
cp backend/.envs/.env.local.example backend/.envs/.env.local
cp frontend/.envs/.env.local.example frontend/.envs/.env.local
# → 各ファイルに実際の値を記入

# 5. 環境を切り替え（symlink 作成）
bash scripts/use-env.sh local

# 6. 動作確認
cd backend
printenv DB_HOST   # .envs/.env.local の値が表示されれば OK
```

## 完了条件

- `bash scripts/use-env.sh local` 実行後、`cd backend && printenv DB_HOST` で値が表示される
- `.envrc` と `.envs/.env.*` が `.gitignore` に含まれており、誤コミットされない状態
- README に direnv のセットアップ手順が記載されている
