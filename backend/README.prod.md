# backend — PROD 環境（AWS Lambda / Neon / S3）

ローカル開発手順は [README.md](README.md) を参照。
本ドキュメントでは、AWS Lambda にデプロイしてリモートで動作させる **PROD 環境** の構築・設定・デプロイ・撤去手順をまとめる。

## 構成

| レイヤ | 採用サービス | 備考 |
| ------ | ------------ | ---- |
| API ランタイム | AWS Lambda (Node.js 22.x) + Amazon API Gateway (HTTP API) | Serverless Framework v4 でデプロイ |
| DB | Neon (PostgreSQL) | Pooler 接続（アプリ）/ Direct 接続（マイグレーション） |
| 認証 | AWS Cognito User Pool（PROD 用 `petal-prod`） | |
| 画像ストレージ | AWS S3（`petal-prod`） | |
| デプロイ用 IAM | IAM ユーザー `petal-deploy` | `AWS_PROFILE=petal-deploy` で利用 |
| リージョン | `ap-northeast-1` | |

## 前提

- AWS アカウントへのアクセス権、および Serverless Framework Dashboard の `akinorina/petal` への参加権限
- ローカルに以下がインストールされていること
  - Node.js 22.x / pnpm / direnv
  - AWS CLI v2
- Neon アカウント / プロジェクト
- AWS Cognito の PROD 用 User Pool（`petal-prod`）が作成済み
- フロントエンド（Amplify）の PROD ホスト名が決まっている（CORS 設定で利用）

## 1. AWS 側リソースの準備

### 1.1 IAM ユーザー `petal-deploy`

`serverless deploy` / `serverless remove` を実行するための IAM ユーザーを作成、アクセスキーを発行し、AWS CLI のプロファイルとして登録する。

```bash
aws configure --profile petal-deploy
# AWS Access Key ID / Secret Access Key / region=ap-northeast-1 / output=json
```

最低限必要なポリシー：

- CloudFormation: スタックの作成・更新・削除
- Lambda: 関数の作成・更新・削除
- API Gateway (HTTP API): 作成・更新・削除
- IAM: Lambda 実行ロールの作成・削除（`iam:PassRole` 含む）
- CloudWatch Logs: ロググループの作成・削除
- Cognito: `serverless.yml` の `iam.role.statements` に列挙された各アクション
- S3（アプリ用バケット `petal-prod`）: `PutObject` / `GetObject` / `DeleteObject` / `HeadObject`
- S3（Serverless Framework デプロイバケット `serverless-framework-deployments-ap-northeast-1-*`）: `ListBucket` / `ListBucketVersions` / `GetObject` / `GetObjectVersion` / `PutObject` / `DeleteObject` / `DeleteObjectVersion`

> **メモ**: `ListBucketVersions` / `DeleteObjectVersion` は `serverless remove` 時に必要。これが無いとスタック撤去がエラーになる。

次のJSONは、IAMユーザー `petal-deploy` のポリシー `PetalServerlessDeploy` データです：

```JSON
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "CloudFormation",
            "Effect": "Allow",
            "Action": [
                "cloudformation:CreateStack",
                "cloudformation:UpdateStack",
                "cloudformation:DeleteStack",
                "cloudformation:DescribeStacks",
                "cloudformation:DescribeStackEvents",
                "cloudformation:DescribeStackResource",
                "cloudformation:DescribeStackResources",
                "cloudformation:GetTemplate",
                "cloudformation:ListStackResources",
                "cloudformation:ValidateTemplate"
            ],
            "Resource": "*"
        },
        {
            "Sid": "S3DeploymentBucket",
            "Effect": "Allow",
            "Action": [
                "s3:CreateBucket",
                "s3:DeleteBucket",
                "s3:GetBucketLocation",
                "s3:GetBucketPolicy",
                "s3:PutBucketPolicy",
                "s3:PutBucketTagging",
                "s3:ListBucket",
                "s3:ListBucketVersions",
                "s3:DeleteObjectVersion",
                "s3:PutObject",
                "s3:GetObject",
                "s3:DeleteObject",
                "s3:PutBucketCORS"
            ],
            "Resource": "*"
        },
        {
            "Sid": "Lambda",
            "Effect": "Allow",
            "Action": [
                "lambda:CreateFunction",
                "lambda:DeleteFunction",
                "lambda:GetFunction",
                "lambda:GetFunctionConfiguration",
                "lambda:ListVersionsByFunction",
                "lambda:PublishVersion",
                "lambda:UpdateFunctionCode",
                "lambda:UpdateFunctionConfiguration",
                "lambda:AddPermission",
                "lambda:RemovePermission",
                "lambda:GetPolicy",
                "lambda:TagResource",
                "lambda:UntagResource",
                "lambda:ListTags"
            ],
            "Resource": "*"
        },
        {
            "Sid": "ApiGatewayV2",
            "Effect": "Allow",
            "Action": [
                "apigateway:GET",
                "apigateway:POST",
                "apigateway:PUT",
                "apigateway:PATCH",
                "apigateway:DELETE"
            ],
            "Resource": "*"
        },
        {
            "Sid": "IAMRoleManagement",
            "Effect": "Allow",
            "Action": [
                "iam:CreateRole",
                "iam:DeleteRole",
                "iam:GetRole",
                "iam:PutRolePolicy",
                "iam:DeleteRolePolicy",
                "iam:AttachRolePolicy",
                "iam:DetachRolePolicy",
                "iam:GetRolePolicy",
                "iam:ListRolePolicies",
                "iam:ListAttachedRolePolicies",
                "iam:TagRole"
            ],
            "Resource": "*"
        },
        {
            "Sid": "IAMPassRoleToLambdaOnly",
            "Effect": "Allow",
            "Action": "iam:PassRole",
            "Resource": "*",
            "Condition": {
                "StringEquals": {
                    "iam:PassedToService": "lambda.amazonaws.com"
                }
            }
        },
        {
            "Sid": "CloudWatchLogs",
            "Effect": "Allow",
            "Action": [
                "logs:CreateLogGroup",
                "logs:DeleteLogGroup",
                "logs:DescribeLogGroups",
                "logs:PutRetentionPolicy",
                "logs:TagResource"
            ],
            "Resource": "*"
        },
        {
            "Sid": "SSMForServerless",
            "Effect": "Allow",
            "Action": [
                "ssm:GetParameter",
                "ssm:PutParameter",
                "ssm:DeleteParameter"
            ],
            "Resource": "arn:aws:ssm:ap-northeast-1:*:parameter/serverless-framework/*"
        }
    ]
}
```

### 1.2 S3 バケット `petal-prod`

アプリ共用バケットを `ap-northeast-1` に作成する。画像 `images/` / 音声 `audios/` / DB バックアップ `db_backups/` をプレフィックスで分離して 1 バケットに集約する（[tsk-127_s3-bucket-consolidation.md](../docs/tsk-127_s3-bucket-consolidation.md)）。

```bash
aws s3api create-bucket \
  --bucket petal-prod \
  --region ap-northeast-1 \
  --create-bucket-configuration LocationConstraint=ap-northeast-1 \
  --profile petal-deploy
```

- パブリックアクセスはブロックしたまま、アプリからは presigned URL でアクセスする想定。
- 必要に応じて CORS / ライフサイクル / 暗号化を設定。

### 1.3 Cognito User Pool （　PROD 用 `petal-prod`　）

AWS Console から User Pool と App Client を作成する。App Client では **クライアントシークレットを有効**にする（アプリ側で `COGNITO_CLIENT_SECRET` を利用するため）。

取得する値：

- `COGNITO_USER_POOL_ID`（例: `ap-northeast-1_xxxxxxxxx`）
- `COGNITO_CLIENT_ID`
- `COGNITO_CLIENT_SECRET`

### 1.4 Neon プロジェクト

Neon Console で `petal` プロジェクト / データベースを作成し、以下 2 系統の接続文字列を取得する。

- `DATABASE_URL`: Pooler 経由（`-pooler` を含むホスト名）。アプリ実行時に使用。
- `DATABASE_URL_DIRECT`: Direct 接続。`migration:run` 等の TypeORM CLI で使用。

両方とも `sslmode=require&channel_binding=require` を付与する。

## 2. ローカル設定

### 2.1 `.envs/.env.prod` の作成

```bash
cp .envs/.env.prod.example .envs/.env.prod
```

`.envs/.env.prod` を編集し、上記 1.2〜1.4 で取得した値を埋める。`.env.prod.example` のキー一覧：

| 変数 | 用途 |
| ---- | ---- |
| `DATABASE_URL` | Neon の Pooler 接続文字列（アプリ用） |
| `DATABASE_URL_DIRECT` | Neon の Direct 接続文字列（マイグレーション用） |
| `COGNITO_REGION` / `COGNITO_USER_POOL_ID` / `COGNITO_CLIENT_ID` / `COGNITO_CLIENT_SECRET` | Cognito（DEV） |
| `SKIP_AUTH` / `SKIP_AUTH_USER_ID` | DEV では `SKIP_AUTH=false` |
| `CORS_ORIGINS` | Amplify の DEV URL（カンマ区切りで複数指定可。例: `https://main.xxxxxxxxxx.amplifyapp.com`） |
| `S3_BUCKET` | `petal-prod` |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` / `ADMIN_NAME` / `ADMIN_NAME_KANA` | 初期 Admin 作成スクリプト用 |

> `.envs/.env.prod` は機密情報を含むためコミット禁止。

### 2.2 環境切り替え

ローカルから DEV 用コマンド（マイグレーション・admin 作成）を実行する場合は、`.env` シンボリックリンクを切り替える。

```bash
pnpm use-env prod          # backend/.env → backend/.envs/.env.dev
direnv reload             # direnv を使っているなら反映
```

> `pnpm deploy:prod` / `pnpm deploy:remove:prod` はスクリプト内で `.envs/.env.prod` を読み込むため、`use-env` の切り替えは不要。

## 3. 初回セットアップ （ PROD ）

### 3.1 マイグレーション適用

Neon の Direct 接続を使ってマイグレーションを実行する。

```bash
pnpm use-env prod
pnpm migration:run
```

> `database/data-source.ts` が `DATABASE_URL_DIRECT`（無ければ `DATABASE_URL`）を参照する想定。Pooler 経由だとプリペアドステートメントの扱いでマイグレーションが失敗することがあるため Direct を使う。

### 3.2 初期 Admin の作成

```bash
pnpm use-env prod
pnpm create-admin
```

`ADMIN_EMAIL` / `ADMIN_PASSWORD` / `ADMIN_NAME` / `ADMIN_NAME_KANA` の値で Cognito（DEV）に Admin ユーザーが作成される。

## 4. デプロイ

### 4.1 フルデプロイ（CloudFormation スタック含む）

```bash
pnpm deploy:prod
```

このコマンドは内部で以下を順に実行する。

1. `.envs/.env.prod` を `set -a` で環境変数にロード
2. `nest build` で TypeScript をコンパイル
3. `pnpm bundle:lambda`（esbuild）で `lambda.js` にバンドル
4. `AWS_PROFILE=petal-deploy serverless deploy --region ap-northeast-1`

デプロイ後、コンソール出力に API Gateway の URL（例: `https://xxxxxxxxxx.execute-api.ap-northeast-1.amazonaws.com`）が表示される。

### 4.2 関数のみ更新（高速）

`serverless.yml` の構成変更が無く、コード差分だけを反映したい場合：

```bash
pnpm deploy:function:prod
```

CloudFormation を経由せず Lambda 関数本体のコードのみ差し替えるため高速。`provider.environment` や IAM ポリシーを変えた時は使えない（その場合は `deploy:prod`）。

### 4.3 マイグレーションの追加

スキーマ変更を加えた際は、ローカルでマイグレーションを生成 → DEV の Neon に適用 → デプロイ、の順で行う。

```bash
pnpm use-env prod
pnpm migration:generate database/migrations/<名前>   # ローカルのエンティティ差分から生成
# 動作確認後コミット

pnpm use-env prod
pnpm migration:run                                    # Neon (DEV) に適用

pnpm deploy:prod                                       # アプリをデプロイ
```

## 5. 動作確認

```bash
# ヘルスチェック相当（ルート GET など）
curl -i https://xxxxxxxxxx.execute-api.ap-northeast-1.amazonaws.com/

# Lambda ログ確認
AWS_PROFILE=petal-deploy aws logs tail \
  /aws/lambda/petal-backend-dev-backend \
  --follow --region ap-northeast-1
```

OpenAPI スキーマ確認：

```bash
pnpm openapi:export
# backend/openapi.json が更新される
```

## 6. 撤去

DEV 環境のスタック（Lambda / API Gateway / IAM ロール / CloudWatch Logs ロググループ）を削除する。

```bash
pnpm deploy:remove:prod
```

> S3 バケット（`petal-prod`）と Cognito User Pool、Neon のデータは `serverless remove` の対象外。必要に応じて手動で削除する。

## 7. トラブルシューティング

| 症状 | 想定原因 / 対処 |
| ---- | -------------- |
| `serverless deploy` / `remove` で `is not authorized to perform: s3:...` | `petal-deploy` の IAM ポリシー不足。1.1 のポリシー一覧を確認（特に `ListBucketVersions` / `DeleteObjectVersion`）。 |
| `migration:run` が Pooler 経由でハング・失敗 | `DATABASE_URL_DIRECT` が未設定 / 反映されていない。`pnpm use-env prod` を再実行し direnv を reload。 |
| Lambda から 5xx・タイムアウト | CloudWatch Logs を確認。`DATABASE_URL`（Pooler）や Cognito 認証情報の値ずれが多い。 |
| CORS エラー | `CORS_ORIGINS` が Amplify の現行 URL と一致しているか確認。変更後は `pnpm deploy:prod` でスタック反映。 |
| `deploy:function:prod` 後に環境変数が反映されない | `provider.environment` の変更は `deploy:function` では反映されない。`pnpm deploy:prod` を使う。 |
