# frontend — DEV 環境（AWS Amplify Hosting）

ローカル開発手順は [README.md](README.md) を参照。本ドキュメントでは、Next.js アプリを **AWS Amplify Hosting** にデプロイしてリモートで動作させる **DEV 環境** の構築・設定・デプロイ手順をまとめる。

## 構成

| レイヤ | 採用サービス | 備考 |
| ------ | ------------ | ---- |
| ホスティング | AWS Amplify Hosting | GitHub 連携で Git push 起動の自動デプロイ |
| 接続先 API | バックエンド DEV（API Gateway + Lambda） | [../backend/README.dev.md](../backend/README.dev.md) で構築したもの |
| 認証 | バックエンド経由で AWS Cognito（DEV 用 `petal-dev`） | クライアントシークレットはフロントに置かない |
| リージョン | `ap-northeast-1` | |
| ブランチ | `main`（DEV 環境にデプロイされる Git ブランチ） | |

## 前提

- バックエンドが DEV 環境にデプロイ済みで、API Gateway の URL が取得できていること（[../backend/README.dev.md](../backend/README.dev.md) §4 参照）
- バックエンド DEV の Cognito User Pool（`petal-dev`）が利用可能なこと
- GitHub リポジトリへのアクセス権、および AWS Amplify Console を操作できる権限

## 1. Amplify アプリの作成（初回のみ）

### 1.1 アプリ作成

1. AWS Amplify Console（`ap-northeast-1`）で **「新しいアプリ」→「ウェブアプリをホスト」** を選択
2. ソースとして **GitHub** を選択し、Petal リポジトリ・`main` ブランチを接続
3. **モノレポ構成**：「アプリのルートディレクトリ」に **`frontend`** を指定
4. ビルド設定の確認画面で、後述 §1.3 の `amplify.yml` 相当の設定になっていることを確認

### 1.2 Next.js / SSR の設定

- Amplify Hosting は Next.js 16（App Router）に対応している
- ホスティングタイプは **SSR (Compute)** が自動選択されることを確認（静的書き出し設定ではないため）

### 1.3 ビルド設定（`amplify.yml`）

Amplify Console のビルド設定で、以下の内容を保存する（リポジトリにファイルを置かず Console 側で管理）。

```yaml
version: 1
applications:
  - appRoot: frontend
    frontend:
      phases:
        preBuild:
          commands:
            - corepack enable
            - pnpm install --frozen-lockfile
        build:
          commands:
            - pnpm build
      artifacts:
        baseDirectory: .next
        files:
          - '**/*'
      cache:
        paths:
          - node_modules/**/*
          - .next/cache/**/*
```

> Amplify Hosting の Next.js SSR ビルドでは、`artifacts.baseDirectory` は `.next` を指定する。

### 1.4 環境変数

Amplify Console → アプリ → **「環境変数」** で以下を設定する（ブランチ別の上書きが不要なら全環境に適用）。

| 変数 | 値 |
| ---- | -- |
| `NEXT_PUBLIC_API_BASE_URL` | バックエンド DEV の API Gateway URL（例: `https://xxxxxxxxxx.execute-api.ap-northeast-1.amazonaws.com`） |

> `NEXT_PUBLIC_*` はビルド時にバンドルへ埋め込まれるため、変更後は再ビルドが必要。
> **クライアントシークレット等の機密値を `NEXT_PUBLIC_*` に入れないこと**（ブラウザに露出する）。Cognito 認証は全てバックエンド経由。

## 2. ローカル設定（任意）

ローカルから DEV のバックエンドに接続して動作確認したい場合：

```bash
cp .envs/.env.dev.example .envs/.env.dev
# .envs/.env.dev の NEXT_PUBLIC_API_BASE_URL を DEV API Gateway URL に書き換え

pnpm use-env dev          # frontend/.env → frontend/.envs/.env.dev
direnv reload
pnpm start:dev            # http://localhost:3001 が DEV API を呼ぶ
```

> `.envs/.env.dev` はコミットしない（個人の動作確認用）。Amplify の DEV ホスト自体の設定は §1.4 が真実の値。

## 3. デプロイ

### 3.1 通常のデプロイ（Git push 連携）

```bash
git push origin main
```

Amplify が `main` ブランチへの push を検知して自動ビルド・デプロイする。

進捗・ログは Amplify Console → アプリ → 該当ブランチ → **「ビルド」** で確認できる。

### 3.2 手動再デプロイ

ソース変更なしで再ビルドしたい場合（環境変数変更時など）：

- Amplify Console → ブランチ → **「このバージョンを再デプロイ」**

### 3.3 デプロイ後の URL

Amplify が払い出すホスト名（例: `https://main.xxxxxxxxxx.amplifyapp.com`）が DEV 環境の URL。
バックエンドの `CORS_ORIGIN` にこの URL を設定する（[../backend/README.dev.md](../backend/README.dev.md) §2.1）。

## 4. 動作確認

1. Amplify が払い出した URL を開き、ログイン画面が表示されることを確認
2. `pnpm create-admin`（バックエンド側）で作成した Admin ユーザーでログイン
3. 認証後の画面（ユーザー管理など）が表示され、ネットワークタブで `NEXT_PUBLIC_API_BASE_URL` に対するリクエストが 200 で返ることを確認

## 5. バックエンド OpenAPI 反映

バックエンドの API が変わった際は、ローカルで型定義を再生成してからコミット → push でデプロイされる。

```bash
# backend/ で OpenAPI スキーマを書き出し
cd ../backend && pnpm openapi:export

# frontend/ で型を再生成
cd ../frontend && pnpm openapi:gen

git add src/lib/openapi/schema.d.ts ../backend/openapi.json
git commit -m "chore: regenerate openapi types"
git push origin main
```

## 6. 撤去

DEV 環境を削除する場合：

- Amplify Console → アプリ → **「アクション」→「アプリを削除」**
- 関連する GitHub の OAuth App 接続も不要であれば外す

> Amplify アプリを削除すると、Amplify が管理する CloudFront / S3 / Lambda@Edge 等の付随リソースもまとめて削除される。

## 7. トラブルシューティング

| 症状 | 想定原因 / 対処 |
| ---- | -------------- |
| ビルドが `pnpm: command not found` で失敗 | `amplify.yml` の preBuild に `corepack enable` を入れる（§1.3 参照） |
| `pnpm install` が遅い / 失敗する | `pnpm install --frozen-lockfile` を使う。Node バージョンが想定と違う場合は Amplify Console → 「ビルド設定」→ Live package updates で Node を指定 |
| デプロイ後に API 呼び出しが CORS で失敗 | バックエンドの `CORS_ORIGIN` が Amplify の URL と一致していない。バックエンドを `pnpm deploy:dev` で再デプロイ |
| 環境変数を変えたのに反映されない | `NEXT_PUBLIC_*` はビルド時埋め込み。Amplify Console から再デプロイが必要 |
| ログインできない / 401 が返る | バックエンド側 Cognito 設定（`COGNITO_*`）の不整合。バックエンドの CloudWatch Logs で詳細を確認 |
| SSR が動かず静的ページとして配信される | Amplify Console の「ホスティングタイプ」が SSR (Compute) になっているか確認 |
