# TSK-30: direnv 導入と .envrc 設定

## 目的

LOCAL / 本番など複数環境の環境変数を安全・簡単に切り替えられる基盤を整備する。  
`direnv` を使い、ディレクトリ移動時に対応する `.env` ファイルが自動ロードされるようにする。

## スコープ

### 対象

- `direnv` の利用方法の文書化
- `.envrc.example` の提供（ルート・backend・frontend）
- `.gitignore` への `.envrc` 追加
- README / docs へのセットアップ手順記載

### 非対象

- CI/CD 環境への適用（GitHub Actions は直接 Secret を参照するため不要）
- 本番環境への適用（本番は AWS Systems Manager Parameter Store 等を使用）

## ファイル構成

```text
petal/
  .envrc.example          # ルート .envrc のテンプレート（コミット）
  .envrc                  # 実体（gitignore・各自作成）
  backend/
    .envrc.example        # backend .envrc のテンプレート（コミット）
    .envrc                # 実体（gitignore・各自作成）
    .env                  # 実際の環境変数（gitignore）
    .env.example          # テンプレート（コミット）
  frontend/
    .envrc.example        # frontend .envrc のテンプレート（コミット）
    .envrc                # 実体（gitignore・各自作成）
    .env.local            # 実際の環境変数（gitignore）
    .env.local.example    # テンプレート（コミット）
```

## `.envrc` の内容

### ルート（`petal/.envrc`）

```bash
# petal/.envrc
# モノリポルートで実行するコマンド（pnpm install 等）向けの共通設定。
# backend / frontend 配下では各ディレクトリの .envrc が自動ロードされる。
```

### backend（`petal/backend/.envrc`）

```bash
# petal/backend/.envrc
dotenv .env
```

### frontend（`petal/frontend/.envrc`）

```bash
# petal/frontend/.envrc
dotenv .env.local
```

## `.gitignore` の方針

`.envrc` は機密情報を間接的に参照するため、`.gitignore` に含め誤コミットを防ぐ。  
チームへの共有は `.envrc.example` と本ドキュメントで行う。

| ファイル | gitignore | 共有方法 |
|---|---|---|
| `.envrc` | ✓ | `.envrc.example` + docs |
| `.env` | ✓ | `.env.example` |
| `.env.local` | ✓ | `.env.local.example` |
| `.envrc.example` | ✗（コミット） | — |
| `.env.example` | ✗（コミット） | — |
| `.env.local.example` | ✗（コミット） | — |

## セットアップ手順（開発者向け）

```bash
# 1. direnv のインストール
brew install direnv

# 2. シェルへの hook 追加（~/.zshrc または ~/.bashrc に追記）
eval "$(direnv hook zsh)"   # zsh の場合
eval "$(direnv hook bash)"  # bash の場合

# 3. シェルを再起動またはリロード
source ~/.zshrc

# 4. .envrc の作成（各ディレクトリ）
cp .envrc.example .envrc
cp backend/.envrc.example backend/.envrc
cp frontend/.envrc.example frontend/.envrc

# 5. direnv に .envrc を許可
direnv allow                   # ルート
(cd backend && direnv allow)   # backend
(cd frontend && direnv allow)  # frontend

# 6. 動作確認（backend ディレクトリに移動して確認）
cd backend
printenv DB_HOST      # .env の値が表示されれば OK
```

## 完了条件

- `direnv allow` 後に環境変数が自動ロードされることをターミナルで確認
- `.envrc` と `.env.local` が `.gitignore` に含まれており、誤コミットされない状態
- README または docs に direnv のセットアップ手順が記載されている
