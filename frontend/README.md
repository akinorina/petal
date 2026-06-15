# frontend

Petal のフロントエンド。Next.js + React + Tailwind CSS。

## ディレクトリ構成

```text
frontend/
  src/
    app/              # Next.js App Router
      login/          # ログイン画面
      (authenticated)/  # 認証必須のルートグループ
        users/          # ユーザー管理画面
    components/       # 共有コンポーネント
    contexts/         # React Context（認証状態など）
    lib/              # API クライアント・認証ヘルパー
  public/             # 静的ファイル
  scripts/            # 運用スクリプト
```

## セットアップ

```bash
# install
pnpm install

# direnv 設定
cp .envrc.example .envrc
direnv allow

# 環境変数を設定（.envs/ からコピーして値を埋め、symlink を作成）
cp .envs/.env.local.example .envs/.env.local
# .env.local を編集して NEXT_PUBLIC_API_URL を設定

# .envs/.env.local を編集して DB / Cognito の設定値を埋める
bash scripts/use-env.sh local

```

## 開発

```bash
# 開発サーバ起動（http://localhost:3001）
pnpm start:dev

# プロダクションビルド
pnpm build

# プロダクション起動
pnpm start:prod

# Lint
pnpm lint
```

## 環境変数

| 変数 | 用途 |
| ---- | ---- |
| `NEXT_PUBLIC_API_BASE_URL` | バックエンド API のベース URL |

**注意:** クライアントシークレットなど秘密情報を `NEXT_PUBLIC_*` に含めないこと（ブラウザに露出する）。Cognito の認証はすべてバックエンド経由で行う。

## 認証フロー

1. ログイン画面で email / password を入力
2. バックエンド `POST /auth/login` を呼ぶ（バックエンドが Cognito に SECRET_HASH 付きで認証）
3. アクセストークンを `localStorage` に保存
4. 以降の API 呼び出しに `Authorization: Bearer <token>` を付与

詳細は [../docs/11_user-info_and_authentication.md](../docs/11_user-info_and_authentication.md) を参照。
