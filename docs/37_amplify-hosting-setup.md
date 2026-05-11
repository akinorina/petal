# 37. フロントエンド AWS Amplify Hosting 設定（TSK-37）

## 0. ステータス

- ステータス：**実装中**
- 対応タスク：TSK-37（プロジェクト：Petal 本番環境・デプロイの充実）

## 1. 目的

Next.js フロントエンドを AWS Amplify Hosting で公開できるようにする。
`amplify.yml` をリポジトリに追加し、Amplify がモノリポ構成でビルドできるようにする。

## 2. スコープ

### 対象

- `amplify.yml`（リポジトリルート）の作成
- `frontend/next.config.ts` の更新（`output: 'standalone'` 追加）
- `frontend/.envs/.env.production.example` の作成（本番用環境変数テンプレート）
- AWS Amplify Console での手動作業手順の文書化

### 非対象

- Amplify Console での GitHub 連携・アプリ作成（手動作業）
- カスタムドメインの設定（必要になったときに別途対応）
- バックエンド API の変更

## 3. アーキテクチャ

```text
GitHub (main ブランチ) push
        ↓ webhook
[AWS Amplify Hosting]
  - amplify.yml に従い pnpm install + next build を実行
  - Next.js SSR（standalone モード）でホスト
        ↓ HTTPS
[Lambda + API Gateway (TSK-36)]
```

## 4. 実装設計

### 4.1 `amplify.yml`（リポジトリルート）

Amplify がモノリポ構成を正しくビルドするための設定ファイル。

```yaml
version: 1
frontend:
  phases:
    preBuild:
      commands:
        - corepack enable
        - corepack prepare pnpm@latest --activate
        - pnpm install --frozen-lockfile
    build:
      commands:
        - pnpm --filter frontend build
  artifacts:
    baseDirectory: frontend/.next
    files:
      - '**/*'
  cache:
    paths:
      - node_modules/**/*
      - frontend/node_modules/**/*
      - frontend/.next/cache/**/*
```

ポイント：

- `corepack` で pnpm を有効化（Amplify の Node.js 環境に pnpm がない場合の対処）
- `pnpm install --frozen-lockfile` でルートの `pnpm-workspace.yaml` を使い全依存を解決
- `baseDirectory: frontend/.next` で Next.js の出力ディレクトリを指定
- キャッシュを設定してビルド時間を短縮

### 4.2 `frontend/next.config.ts`

Amplify SSR（standalone モード）対応のため `output: 'standalone'` を追加。

```typescript
const nextConfig: NextConfig = {
  output: 'standalone',
};
```

### 4.3 本番用環境変数（Amplify Console に設定）

| 変数名 | 説明 |
| --- | --- |
| `NEXT_PUBLIC_API_BASE_URL` | API Gateway の URL（TSK-36 で作成した URL） |
| `NEXT_PUBLIC_COGNITO_REGION` | `ap-northeast-1` |
| `NEXT_PUBLIC_COGNITO_USER_POOL_ID` | 本番 Cognito User Pool ID（TSK-38 で作成） |
| `NEXT_PUBLIC_COGNITO_CLIENT_ID` | 本番 Cognito App Client ID（TSK-38 で作成） |

> `NEXT_PUBLIC_*` 変数はブラウザに露出する。クライアントシークレットは含めない。

### 4.4 `frontend/.envs/.env.production.example`

本番環境の環境変数テンプレートを追加する（実際の値は Amplify Console で設定するため、このファイルには値を入れない）。

## 5. AWS Amplify Console 手動作業手順（ユーザー実施）

### 5.1 Amplify アプリの作成

1. AWS Amplify Console（ap-northeast-1）を開く
2. 「新しいアプリを作成」→「既存のコードをデプロイ」
3. GitHub を選択し、`petal` リポジトリ・`main` ブランチを選択
4. 「モノリポ」設定で、アプリルートディレクトリに `frontend` を指定
5. ビルド設定は `amplify.yml` を自動検出させる（または手動で内容を貼り付け）

### 5.2 環境変数の設定

Amplify Console の「アプリの設定」→「環境変数」で §4.3 の変数を設定する。

### 5.3 CORS 設定（バックエンド側）

Amplify の URL（`https://xxxx.amplifyapp.com`）を `backend/.envs/.env.production` の `CORS_ORIGIN` に設定し、`pnpm --filter backend deploy` で Lambda を再デプロイする。

### 5.4 動作確認

1. Amplify が提供する URL（`https://main.xxxx.amplifyapp.com`）でアクセス
2. ログイン・画像表示などの主要機能を確認

## 6. 完了条件

- `amplify.yml` がリポジトリルートに存在する
- `main` ブランチへの push で Amplify ビルドが自動実行される
- 本番 URL でフロントエンドにアクセスできる
- ログイン API（API Gateway URL）との通信が成功する

## 7. 動作確認シナリオ（手動）

- [ ] Amplify の本番 URL でトップページが表示される
- [ ] ログイン操作が成功し、ダッシュボードへ遷移する
- [ ] 画像一覧が取得・表示される
