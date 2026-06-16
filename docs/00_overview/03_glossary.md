# 用語集

Petal のドキュメント・コードで使われる用語と略語。

## ドメイン用語

| 用語 | 説明 |
| ---- | ---- |
| ユーザー（User） | システムの利用者。`petal.users` テーブルと Cognito ユーザーが 1:1 で対応する。 |
| ロール（Role） | `admin` / `user` の 2 種。DB の `users.role` と Cognito グループで表現。 |
| 画像（Image） | ユーザーがアップロードした画像。ファイル本体は S3、メタデータは `petal.images`。 |
| 所有者（Owner） | 画像を登録したユーザー。画像は所有者のみ閲覧可。 |
| 監査ログ（Audit Log） | ユーザー管理操作の記録。追記専用で論理削除しない。 |
| 論理削除（ソフトデリート） | `deleted_at` に削除日時を入れ、物理削除しない方式。 |
| チャットスレッド（ChatThread） | LLM との会話の単位。所有者本人のみ閲覧可。`petal.chat_threads`。 |
| LLM プロバイダー | Chat が接続する LLM。Claude / Gemini / OpenAI / LocalLLM を設定でき、使用 provider は env で切替。 |

## 認証関連

| 用語 | 説明 |
| ---- | ---- |
| Cognito | AWS の認証基盤。User Pool でユーザーを管理。 |
| User Pool | Cognito のユーザーディレクトリ。 |
| App Client | User Pool に接続するアプリ。Petal は SECRET_HASH 付きの Confidential client。 |
| `cognito_sub` | Cognito ユーザーの一意 ID（`sub`）。DB ユーザーと突き合わせるキー。 |
| SECRET_HASH | Confidential client が API 呼び出しに付与する HMAC。バックエンドのみが計算。 |
| GlobalSignOut | ユーザーの全リフレッシュトークンを失効させる Cognito 操作。ログアウト/削除時に使用。 |
| MFA / TOTP | 多要素認証 / 時間ベースのワンタイムパスワード（認証アプリ）。 |
| アクセストークン / リフレッシュトークン | Cognito 発行の JWT。前者で API 認可、後者で前者を更新。 |
| チャレンジ | ログイン時に追加対応が必要な状態（新パスワード設定、MFA 入力など）。 |

## インフラ・技術

| 用語 | 説明 |
| ---- | ---- |
| Neon | サーバーレス PostgreSQL。Petal は DB のみ Neon を使用（[specs/04](../specs/04_db-neon-aws-hybrid.md)）。 |
| Pooler / Direct | Neon の接続方式。アプリは Pooler（PgBouncer）、マイグレーションは Direct。 |
| Localstack | ローカルで S3 をエミュレートする AWS 互換サービス。 |
| Amplify Hosting | フロントエンドのホスティング。 |
| Lambda + API Gateway | バックエンド（NestJS）のサーバーレス実行環境。 |
| Serwist | Next.js 向け Service Worker ライブラリ（PWA）。 |
| DDD / オニオンアーキテクチャ | ドメイン駆動設計 / 依存方向を外→内に限定する層構造。 |

## 略語

| 略語 | 意味 |
| ---- | ---- |
| FE / BE | フロントエンド / バックエンド |
| SW | Service Worker |
| PWA | Progressive Web App |
| D&D | ドラッグ＆ドロップ |
| LLM | 大規模言語モデル（Large Language Model） |
| SSE | Server-Sent Events。チャット応答の逐次ストリーミングに使用。 |
| TSK-N / PRJ-N | Notion 上のタスク / プロジェクト番号（旧 specs の接頭辞） |
