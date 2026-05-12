# GitHub Actions CD ワークフロー設計（TSK-41）

## 1. スコープ

### 対象

- `.github/workflows/deploy.yml` の新規作成
- トリガー: `push` to `main`
- ステップ: DB マイグレーション → Lambda バンドルビルド → Lambda コード更新
- 必要な GitHub Actions Secrets の定義

### 非対象

- フロントエンド (Amplify) の明示的なデプロイトリガー（GitHub 連携による自動デプロイを利用）
- Lambda 環境変数・設定の更新（初回は `serverless deploy` で手動実施済み）
- Serverless Framework を使ったインフラプロビジョニング
- IAM ユーザーの作成（手動作業）

## 2. 関連ドキュメント

- [docs/36_lambda-api-gateway-setup.md](36_lambda-api-gateway-setup.md)（Lambda デプロイ設計）
- [docs/37_amplify-hosting-setup.md](37_amplify-hosting-setup.md)（Amplify Hosting 設計）
- [docs/40_github-actions-ci.md](40_github-actions-ci.md)（CI ワークフロー設計）

## 3. ワークフロー設計

### 3.1 トリガー

`push` to `main` のみ。PR 時は実行しない（CI が担当）。

### 3.2 ジョブ構成

`deploy` ジョブ 1 本。ステップを直列実行し、前のステップが失敗したら後続を止める。

```text
pnpm install
→ DB マイグレーション（DATABASE_URL_DIRECT 使用）
→ nest build
→ Lambda バンドル（esbuild）
→ AWS 認証設定
→ zip 作成 + aws lambda update-function-code
```

マイグレーションを Lambda デプロイより先に実行することで、新しいコードが古いスキーマで動く時間をなくす。

### 3.3 Lambda デプロイ方式

`aws lambda update-function-code`（コードのみ更新）を採用する。

- `serverless deploy function` は環境変数を含む関数設定も上書きするため CD では使わない
- `update-function-code` はコードのみ変更し、Lambda コンソールで設定した環境変数を保持する
- AWS CLI は `ubuntu-latest` ランナーにプリインストール済み

### 3.4 フロントエンドデプロイ

Amplify の GitHub 連携（`main` push → webhook 自動デプロイ）を利用する。CD ワークフローからの明示的なトリガーは行わない。

Amplify と Lambda の同時デプロイが問題になる場合（例: フロントとバックのバージョン不整合）は、`aws amplify start-job` を追加して Amplify の自動デプロイを無効化する方針に変更する（今回はスコープ外）。

## 4. GitHub Actions Secrets

| シークレット名 | 内容 |
| --- | --- |
| `AWS_ACCESS_KEY_ID` | CD 専用 IAM ユーザーのアクセスキー ID |
| `AWS_SECRET_ACCESS_KEY` | CD 専用 IAM ユーザーのシークレットアクセスキー |
| `DATABASE_URL_DIRECT` | Neon Direct 接続文字列（port 5432）マイグレーション専用 |
| `LAMBDA_FUNCTION_NAME` | Lambda 関数名（例: `petal-backend-production-backend`） |

## 5. IAM ポリシー（CD 専用ユーザー）

CD ワークフロー専用の IAM ユーザーを作成し、最小権限を付与する。

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "lambda:UpdateFunctionCode",
      "Resource": "arn:aws:lambda:ap-northeast-1:*:function:petal-backend-*"
    }
  ]
}
```

> Lambda の環境変数・設定変更は `lambda:UpdateFunctionConfiguration` が必要。CD ではコード更新のみのため付与しない。

## 6. 完了条件

- `main` ブランチへの push で DB マイグレーション → バックエンドデプロイが順番に実行される
- デプロイ後、本番 URL で実際に API が最新コードで実行されていることを確認

## 7. 手動動作確認シナリオ

1. `main` への push 後、GitHub Actions で `deploy` ジョブが起動することを確認
2. DB マイグレーションステップが成功することを確認
3. Lambda コード更新ステップが成功することを確認
4. 本番 API URL で `GET /` が 200 を返すことを確認
5. 意図的にマイグレーション失敗（存在しない DB URL）を設定 → Lambda デプロイが実行されないことを確認

## 8. 補足

- `database/data-source.ts` は `DATABASE_URL_DIRECT` 環境変数を直接参照する（`dotenv/config` 経由）。CI では `.env` ファイルではなく GitHub Secrets から環境変数として注入する。
- `pnpm --filter backend bundle:lambda` の出力ファイルは `backend/lambda.js`。zip 化は `working-directory: backend` で実行する。
- AWS リージョンは `ap-northeast-1` 固定。
