# 図表 (diagrams)

Petal のソフトウェア開発で用いる各種図を集約するディレクトリ。

## 運用ルール

- 図は **`*.drawio.svg`（XML 埋め込み SVG）1 種類のみ** を管理する。同名の `.drawio` ソースは置かない。
- この SVG は **draw.io エディタ（デスクトップ / VSCode 拡張）で開いてそのまま編集・保存できる**（XML が埋め込まれているため）うえ、GitHub・IDE では画像としてプレビューできる。1 ファイルで「編集」と「閲覧」を兼ねる。
- 編集時は `.drawio.svg` を draw.io で開いて保存するだけでよい（保存時に XML 埋め込みは維持される）。
- 生の `.drawio` ソースが一時的に必要な場合は、draw.io で開いて「名前を付けて保存 → .drawio」で書き出すか、埋め込み XML を抽出する（commit はしない）。

## 図の一覧

| 図 | ファイル | 内容 | 主な参照ドキュメント |
| -- | ------- | ---- | ------------------- |
| システム構成図（本番） | [system-architecture.drawio.svg](system-architecture.drawio.svg) | 本番のインフラ構成（Amplify / Lambda+API Gateway / Cognito / S3 は東京、**Neon** DB はシンガポール、Pooler 経由接続・keep-alive・pg_dump バックアップ） | [04](../04_db-neon-aws-hybrid.md), [36](../36_lambda-api-gateway-setup.md), [37](../37_amplify-hosting-setup.md), [42](../42_operational-jobs.md) |
| システム構成図（Local） | [system-architecture-local.drawio.svg](system-architecture-local.drawio.svg) | ローカル開発環境（Next.js dev / NestJS dev / Docker の PostgreSQL・LocalStack / 認証のみ実 Cognito） | [02](../02_%20implementations.md) §5, [34](../34_typeorm-neon.md) |
| 認証シーケンス図 | [auth-sequence.drawio.svg](auth-sequence.drawio.svg) | ログイン（バックエンド仲介 + SECRET_HASH）／認証付き API（JwtAuthGuard の JWKS 検証 → DB lookup）／401 時の自動リフレッシュ（openapi-fetch middleware） | [11](../11_user-info_and_authentication.md), [27](../27_refresh-token-flow.md), [21](../21_role-cognito-group-sync.md) |
| アーキテクチャ図（DDD + オニオン） | [onion-architecture.drawio.svg](onion-architecture.drawio.svg) | レイヤーと依存方向（外→内）／依存性逆転（Repository IF は domain・実装は infra）／フィーチャ優先のディレクトリ構成 | [00_rules.md](../00_rules.md) §1・§3 |

## 追加予定

- 認証シーケンス図の拡張（MFA(TOTP) / メールアドレス変更 / パスワードリセット） — [29](../29_mfa-totp.md), [20](../20_email-change-flow.md), [19](../19_password-reset.md)
- ER 図（users / images / audit_logs、論理削除） — [28](../28_audit-logs.md)
- CI/CD・リリースフロー図（main → promote → release → デプロイ） — [55](../55_release-branch-cicd.md), [40](../40_github-actions-ci.md), [41](../41_github-actions-cd.md)
- 画像アップロードのシーケンス/フロー図（D&D・カメラ・前処理・S3） — [12](../12_image-management.md), [44](../44_image-upload-drag-drop.md), [49](../49_camera-upload.md)
- ユースケース図（一般ユーザー / admin） — [01_requirements.md](../01_requirements.md)
- ロール/認可フロー図（AuthGuard → DB lookup → RolesGuard） — [21](../21_role-cognito-group-sync.md)
- PWA 構成図（Service Worker キャッシュ戦略・更新通知） — [50](../50_pwa-foundation.md)〜[53](../53_standalone-detection.md)
