# 36. バックエンド Lambda + API Gateway デプロイ設定（TSK-36）

## 0. ステータス

- ステータス：**実装中**
- 対応タスク：TSK-36（プロジェクト：Petal 本番環境・デプロイの充実）

## 1. 目的

NestJS バックエンドを AWS Lambda + API Gateway 上にデプロイできる構成を整備する。
インフラは **Serverless Framework** でコード管理し、`serverless deploy` 1 コマンドで
Lambda 関数・API Gateway・IAM ロールをプロビジョニングする。

## 2. スコープ

### 対象

- Lambda ハンドラーエントリーポイント（`backend/src/lambda.ts`）の作成
- Serverless Framework 設定（`backend/serverless.yml`）の作成
- `package.json` へのデプロイスクリプト追加

### 非対象

- AWS Lambda 関数・API Gateway の手動作成（`serverless deploy` が代替する）
- フロントエンド側の変更
- Cognito 本番 User Pool の作成（TSK-38）
- S3 本番バケットの作成（TSK-39）

## 3. 使用ツール

| ツール | 用途 |
| --- | --- |
| [Serverless Framework](https://www.serverless.com/) v4 | Lambda + API Gateway + IAM をコード管理 |
| `@vendia/serverless-express` | NestJS を Lambda ハンドラーに適合させる |
| `nest build`（NestJS CLI） | TypeScript を事前コンパイル（`emitDecoratorMetadata` 必須のため tsc ベース） |

> `serverless-plugin-typescript` は Serverless v4 非対応のため不使用。
> `nest build` で `dist/` を生成してから `serverless deploy` を実行する手順とする。

## 4. アーキテクチャ

```text
[API Gateway HTTP API ($default route)]
        ↓ proxy すべてのリクエスト
[Lambda 関数: petal-backend (ap-northeast-1)]
   ├──→ Neon Postgres (Pooler, port 6543, SSL必須)
   ├──→ AWS Cognito (ap-northeast-1)
   └──→ AWS S3 (ap-northeast-1)
```

- Lambda は VPC に入れない（Neon はインターネット経由接続、NAT Gateway 不要）
- API Gateway は **HTTP API**（REST API より安価・低レイテンシ）を使用
- DB 接続は `DATABASE_URL`（Pooler/6543）のみ。マイグレーション実行には `DATABASE_URL_DIRECT`（5432）を使用

## 5. 実装設計

### 5.1 ファイル構成

```text
backend/
  src/
    main.ts          ← ローカル開発用 HTTP サーバー。変更なし。
    lambda.ts        ← Lambda ハンドラーエントリーポイント（新規）
  dist/              ← nest build の出力先（.gitignore 対象）
    src/
      lambda.js      ← Serverless がこのファイルを使用
  serverless.yml     ← Serverless Framework 設定（新規）
  package.json       ← deploy / deploy:function スクリプト追加
```

### 5.2 Lambda ハンドラー（`lambda.ts`）

```typescript
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import serverlessExpress from '@vendia/serverless-express';
import express from 'express';
import { AppModule } from './app.module';
import type { Handler } from 'aws-lambda';

let cachedHandler: Handler;

async function bootstrap(): Promise<Handler> {
  const expressApp = express();
  const app = await NestFactory.create(AppModule, new ExpressAdapter(expressApp));
  app.enableCors({
    origin: process.env.CORS_ORIGINS ?? '*',
    credentials: true,
  });
  await app.init();
  return serverlessExpress({ app: expressApp });
}

export const handler: Handler = async (event, context, callback) => {
  if (!cachedHandler) {
    cachedHandler = await bootstrap();
  }
  return cachedHandler(event, context, callback);
};
```

ポイント：

- `cachedHandler` をモジュールスコープで保持 → Lambda warm 起動でアプリを再利用（コールドスタート回避）
- `main.ts` は変更しない → ローカル開発は引き続き `nest start:dev` で可

### 5.3 serverless.yml

```yaml
service: petal-backend
frameworkVersion: '4'

provider:
  name: aws
  runtime: nodejs22.x
  region: ap-northeast-1
  memorySize: 512
  timeout: 30
  environment:
    DATABASE_URL: ${env:DATABASE_URL}
    COGNITO_REGION: ${env:COGNITO_REGION}
    COGNITO_USER_POOL_ID: ${env:COGNITO_USER_POOL_ID}
    COGNITO_CLIENT_ID: ${env:COGNITO_CLIENT_ID}
    COGNITO_CLIENT_SECRET: ${env:COGNITO_CLIENT_SECRET}
    S3_BUCKET: ${env:S3_BUCKET}
    AWS_REGION_APP: ${env:AWS_REGION, 'ap-northeast-1'}
    CORS_ORIGINS: ${env:CORS_ORIGINS}
    SKIP_AUTH: ${env:SKIP_AUTH, 'false'}
  iam:
    role:
      statements:
        - Effect: Allow
          Action:
            - cognito-idp:AdminGetUser
            - cognito-idp:AdminListGroupsForUser
            - cognito-idp:InitiateAuth
            - cognito-idp:AdminInitiateAuth
            - cognito-idp:RespondToAuthChallenge
            - cognito-idp:AdminRespondToAuthChallenge
            - cognito-idp:GlobalSignOut
            - cognito-idp:AdminUserGlobalSignOut
            - cognito-idp:GetUser
            - cognito-idp:AdminCreateUser
            - cognito-idp:AdminSetUserPassword
            - cognito-idp:AdminDisableUser
            - cognito-idp:AdminEnableUser
            - cognito-idp:AdminDeleteUser
            - cognito-idp:AdminAddUserToGroup
            - cognito-idp:AdminRemoveUserFromGroup
            - cognito-idp:ListUsersInGroup
            - cognito-idp:ForgotPassword
            - cognito-idp:ConfirmForgotPassword
            - cognito-idp:AssociateSoftwareToken
            - cognito-idp:VerifySoftwareToken
            - cognito-idp:SetUserMFAPreference
          Resource: '*'
        - Effect: Allow
          Action:
            - s3:PutObject
            - s3:GetObject
            - s3:DeleteObject
            - s3:HeadObject
          Resource: arn:aws:s3:::${env:S3_BUCKET}/*

plugins:
  - serverless-plugin-typescript

functions:
  backend:
    handler: src/lambda.handler
    events:
      - httpApi:
          path: /{proxy+}
          method: ANY
      - httpApi:
          path: /
          method: ANY
```

### 5.4 環境変数（Lambda に渡す変数）

| 変数名 | 説明 |
| --- | --- |
| `DATABASE_URL` | Neon Pooler（port 6543）接続文字列 |
| `COGNITO_REGION` | `ap-northeast-1` |
| `COGNITO_USER_POOL_ID` | 本番 Cognito User Pool ID（TSK-38 で作成） |
| `COGNITO_CLIENT_ID` | 本番 Cognito App Client ID |
| `COGNITO_CLIENT_SECRET` | 本番 Cognito App Client Secret |
| `S3_BUCKET` | 本番 S3 バケット名（TSK-39 で作成） |
| `CORS_ORIGINS` | 本番フロントエンド URL（カンマ区切りで複数指定可。TSK-37 完了後に設定） |
| `SKIP_AUTH` | `false` |

> Lambda 実行ロールに IAM 権限が付与されるため `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` は Lambda 環境では不要。

## 6. デプロイ手順

### 6.1 初回デプロイ（Lambda + API Gateway + IAM をすべて作成）

```bash
# backend ディレクトリで実行
cd backend

# 本番用環境変数を設定してからデプロイ
# （backend/.envs/.env.production に本番値を記載して読み込む）
source .envs/.env.production

pnpm deploy
# 内部: serverless deploy --region ap-northeast-1
```

### 6.2 コードのみ更新（高速）

```bash
pnpm deploy:function
# 内部: serverless deploy function --function backend
```

### 6.3 DB マイグレーション（`DATABASE_URL_DIRECT` で実行）

```bash
DATABASE_URL_DIRECT=<neon-direct-url> pnpm migration:run
```

## 7. 完了条件

- `pnpm --filter backend build` が通る（既存ビルドが壊れていない）
- `serverless deploy` が成功し、Lambda + API Gateway が ap-northeast-1 に作成される
- API Gateway の URL で `GET /` が 200 を返す
- `POST /auth/login` が正常に応答する（Neon DB 接続成功）
- CloudWatch Logs にコネクション枯渇エラーが出ていない

## 8. 動作確認シナリオ（手動）

- [ ] `GET <API Gateway URL>/` → 200 応答
- [ ] `POST <API Gateway URL>/auth/login` でログイン成功（トークン取得）
- [ ] CloudWatch Logs でエラーなしを確認
