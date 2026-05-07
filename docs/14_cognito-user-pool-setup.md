# Petal - Cognito User Pool セットアップ手順

本ドキュメントは、Petal の認証基盤として使用する **AWS Cognito User Pool** を AWS マネジメントコンソール上で構築する手順をまとめたものである。
本リポジトリのコードは「User Pool は既に構築済み」という前提で動作する。新環境（開発・ステージング・本番、または個人検証環境）を立ち上げる際は本手順に従って User Pool を準備すること。

関連ドキュメント:

- [docs/00_rules.md](00_rules.md) §7 — Cognito は Local 環境でも実 AWS を使用（Localstack 不可）
- [docs/11_user-info_and_authentication.md](11_user-info_and_authentication.md) — 認証フロー設計

## 1. 全体構成

- **User Pool** 1 つ（環境ごとに分離）
- **App Client** 1 つ（**Confidential client**：クライアントシークレットあり、`SECRET_HASH` を付与する）
- 認証フロー: バックエンド経由のみ（フロントは Cognito を直接叩かない）
- 初回ログイン時のパスワード変更フロー（`NEW_PASSWORD_REQUIRED`）を有効化する

## 2. 事前準備

- AWS アカウント / IAM ユーザー（User Pool 作成権限を持つこと）
- リージョンの決定（例: `ap-northeast-1`）
- 環境名の決定（例: `dev`, `stg`, `prod`）

## 3. User Pool 作成手順（AWS マネジメントコンソール）

### 3.1 User Pool を新規作成

1. AWS コンソールで **Cognito** を開く。
2. リージョンを確認し、「**ユーザープールを作成**」をクリック。

### 3.2 アプリケーション種別

- **アプリケーションタイプ**: 「**従来型ウェブアプリケーション (Traditional web application)**」を選択。
  - 理由: バックエンドからクライアントシークレット付きで呼び出すため。

### 3.3 サインインオプション

- **Cognito user pool sign-in options**: 「**Email**」のみ選択。
  - ユーザー名は使わず、メールアドレスでサインインする。

### 3.4 必須属性 (Required attributes)

- 必須属性: **email** のみ（標準で必須）。
- 氏名・氏名ふりがなは Cognito 側では持たず、**Petal 側 DB（`users` テーブル）で管理**する。
  - 理由: アプリ固有のメタデータは DB を正とし、Cognito は認証情報のみを保持する。

### 3.5 パスワードポリシー

| 項目 | 値 |
| ---- | -- |
| 最小長 | 8 文字 |
| 数字を含む | 必須 |
| 特殊文字を含む | 必須 |
| 大文字を含む | 必須 |
| 小文字を含む | 必須 |
| 一時パスワード有効期限 | 7 日（運用に応じて調整） |

### 3.6 MFA / リカバリ

- **MFA enforcement**: **Optional**（任意）
- **MFA methods**: **Authenticator apps（Software token MFA / TOTP）にチェック**
  - SMS にはチェックしない（[docs/29_mfa-totp.md](29_mfa-totp.md) のスコープ外）
- **アカウントリカバリ**: Email のみを選択。

> 既存の User Pool で MFA をまだ有効化していない場合: コンソール上で MFA enforcement を Optional に切り替え、Software token MFA を有効化する。Optional のため既存ユーザーには影響せず、明示的に有効化したユーザーのみ MFA を求められる。詳細は [docs/29_mfa-totp.md](29_mfa-totp.md) を参照。

### 3.7 サインアップ設定

- **セルフサービスのサインアップ**: **無効**。
  - ユーザー登録は Petal バックエンド（管理者）経由のみ。
- **属性の検証**: Email を検証する設定にする（招待メール経由のため）。

### 3.8 メッセージ配信

- 開発環境では **Cognito の Email** をそのまま使用してよい（送信上限あり）。
- 本番環境では **SES 連携** を推奨。From アドレス・SES の検証済みドメインを設定する。

### 3.9 招待メッセージのカスタマイズ

- ユーザーを管理者作成（`AdminCreateUser`）したときの招待メールに **メールアドレスと一時パスワードを必ず含める**。
- 件名・本文は運用ポリシーに合わせて編集する（プレースホルダ `{username}`, `{####}` を必ず残すこと）。

### 3.10 アプリケーションクライアントの作成

- **App Client name**: `petal-backend-<env>`（例: `petal-backend-dev`）
- **Client secret**: **生成する（Generate a client secret）**。
  - バックエンドから `SECRET_HASH` を計算して送信するため必須。
- **Authentication flows** で以下を有効化：
  - `ALLOW_ADMIN_USER_PASSWORD_AUTH`（バックエンド経由のサインイン）
  - `ALLOW_REFRESH_TOKEN_AUTH`
  - `ALLOW_USER_PASSWORD_AUTH`（必要に応じて）
- **トークン有効期限** はデフォルトで可（運用に合わせて短縮検討）。

### 3.11 確認・作成

- 設定内容を確認し、**ユーザープールを作成** をクリック。

## 4. 作成後に取得・控える情報

下記をバックエンドの `.env` に設定する。

| 環境変数 | 取得元 | 例 |
| -------- | ------ | -- |
| `AWS_REGION` | 作成したリージョン | `ap-northeast-1` |
| `COGNITO_USER_POOL_ID` | User Pool 詳細画面 | `ap-northeast-1_XXXXXXXXX` |
| `COGNITO_CLIENT_ID` | App Client 詳細画面 | `xxxxxxxxxxxxxxxxxxxxxxxxxx` |
| `COGNITO_CLIENT_SECRET` | App Client 詳細画面 → クライアントシークレットを表示 | `xxxxxxxxxx...` |

> ⚠️ クライアントシークレットは `NEXT_PUBLIC_*` を含むフロントエンド側に絶対に置かない（[AGENTS.md](../AGENTS.md) §2 / §4）。

## 5. IAM 権限（バックエンド実行ユーザー）

バックエンドが User Pool を操作するために、実行 IAM ユーザー / ロールへ以下のアクションを許可する。Resource は対象 User Pool の ARN に絞る。

```json
{
  "Effect": "Allow",
  "Action": [
    "cognito-idp:AdminCreateUser",
    "cognito-idp:AdminDeleteUser",
    "cognito-idp:AdminDisableUser",
    "cognito-idp:AdminEnableUser",
    "cognito-idp:AdminGetUser",
    "cognito-idp:AdminUpdateUserAttributes",
    "cognito-idp:AdminInitiateAuth",
    "cognito-idp:AdminRespondToAuthChallenge",
    "cognito-idp:AdminSetUserPassword",
    "cognito-idp:ListUsers"
  ],
  "Resource": "arn:aws:cognito-idp:<region>:<account-id>:userpool/<user-pool-id>"
}
```

実際に必要なアクション集合は実装に従って絞り込んでよい。最小権限を原則とする。

## 6. 動作確認（コンソールでの簡易テスト）

1. Cognito コンソール → User Pool → 「**ユーザー**」タブ → 「ユーザーを作成」。
2. メールアドレスを入力、「招待を送信」「一時パスワードを生成」を選択して作成。
3. 受信メールに一時パスワードが届くこと、ステータスが `FORCE_CHANGE_PASSWORD` になっていることを確認。
4. バックエンド側のサインイン API で初回ログイン → パスワード変更フローが完走することを確認。

## 7. 環境ごとの分離

- 環境ごとに **別の User Pool** を用意する（dev / stg / prod）。
- User Pool は環境分離のための主要境界。**環境を跨いだユーザー共有は行わない**。
- 各環境の `.env` で `COGNITO_USER_POOL_ID` / `COGNITO_CLIENT_ID` / `COGNITO_CLIENT_SECRET` を切り替える。
