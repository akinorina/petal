# デプロイ

バックエンドは **Lambda + API Gateway**（Serverless Framework）、フロントエンドは **Amplify Hosting**。いずれも ap-northeast-1（東京）。

## バックエンド（Lambda + API Gateway）

- NestJS を `@vendia/serverless-express` 系で Lambda 化（エントリ [backend/src/lambda.ts](../../backend/src/lambda.ts)）。
- `nest build` で事前コンパイル → `esbuild` でバンドル → Serverless Framework でデプロイ。

主なコマンド（`backend/`、`AWS_PROFILE=petal-deploy`）:

```bash
pnpm build              # nest build
pnpm bundle:lambda      # esbuild で lambda.js を生成
pnpm deploy             # build + bundle + serverless deploy（本番）
pnpm deploy:dev         # .envs/.env.dev を読んで dev へデプロイ
pnpm deploy:function    # 関数コードのみ更新（高速）
```

- `serverless.yml` でリージョン・関数・API Gateway を定義。
- 環境変数（Cognito / Neon の Pooler URL / S3 等）は Lambda に設定する。
- Lambda は VPC に入れない（Neon へはインターネット経由）。
- 原典: [specs/36_lambda-api-gateway-setup.md](../specs/36_lambda-api-gateway-setup.md)

## フロントエンド（Amplify Hosting）

- モノリポの `frontend/` を `appRoot` に指定（[amplify.yml](../../amplify.yml)）。
- frontend は独立 pnpm プロジェクト。`corepack enable` → `pnpm install --frozen-lockfile` → `pnpm build`。
- 成果物は `.next`、`.next/cache` と `node_modules` をキャッシュ。
- 原典: [specs/37_amplify-hosting-setup.md](../specs/37_amplify-hosting-setup.md)

## デプロイの起動方法

通常は GitHub Actions（`release` ブランチ）経由で自動デプロイする。手動の `pnpm deploy` は緊急時・初回構築向け。CI/CD の流れは [06_cicd.md](06_cicd.md)。

## 関連ドキュメント

- CI/CD・リリース運用 → [06_cicd.md](06_cicd.md)
- システム構成 → [10_architecture/01_system-architecture.md](../10_architecture/01_system-architecture.md)
- DB 接続（Pooler）→ [03_database-setup.md](03_database-setup.md)
- 原典 → [specs/36_lambda-api-gateway-setup.md](../specs/36_lambda-api-gateway-setup.md), [specs/37_amplify-hosting-setup.md](../specs/37_amplify-hosting-setup.md)
