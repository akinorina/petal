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
| ER 図 | [er-diagram.drawio.svg](er-diagram.drawio.svg) | petal スキーマの users / images / audit_logs と関連（owner FK・RESTRICT、actor/target の論理関連）、論理削除・append-only の区別 | [11](../11_user-info_and_authentication.md), [12](../12_image-management.md), [28](../28_audit-logs.md) |
| CI/CD・リリースフロー図 | [cicd-release-flow.drawio.svg](cicd-release-flow.drawio.svg) | main（CI のみ）→ Promote（手動）→ release → CD(Lambda)/Amplify、定期ジョブ・禁止事項 | [55](../55_release-branch-cicd.md), [40](../40_github-actions-ci.md), [41](../41_github-actions-cd.md) |
| 画像アップロード シーケンス図 | [image-upload-sequence.drawio.svg](image-upload-sequence.drawio.svg) | フロント前処理（EXIF/リサイズ/圧縮）→ POST /images でメタ作成 + 署名付き URL → ブラウザが S3 へ直接 PUT（バイト中継なし）→ ダウンロード | [12](../12_image-management.md), [44](../44_image-upload-drag-drop.md), [49](../49_camera-upload.md) |
| MFA (TOTP) シーケンス図 | [mfa-sequence.drawio.svg](mfa-sequence.drawio.svg) | TOTP 登録・有効化（Associate/Verify/SetPreference）とログイン時 SOFTWARE_TOKEN_MFA チャレンジ | [29](../29_mfa-totp.md) |
| メールアドレス変更 シーケンス図 | [email-change-sequence.drawio.svg](email-change-sequence.drawio.svg) | 変更要求 → 検証コード確認。DB を保留 UPDATE → Cognito Verify 成否で COMMIT/ROLLBACK | [20](../20_email-change-flow.md) |
| パスワードリセット シーケンス図 | [password-reset-sequence.drawio.svg](password-reset-sequence.drawio.svg) | ForgotPassword → ConfirmForgotPassword + GlobalSignOut。enumeration 対策で常に 204 | [19](../19_password-reset.md) |

## 追加予定

- ユースケース図（一般ユーザー / admin） — [01_requirements.md](../01_requirements.md)
- ロール/認可フロー図（AuthGuard → DB lookup → RolesGuard） — [21](../21_role-cognito-group-sync.md)
- PWA 構成図（Service Worker キャッシュ戦略・更新通知） — [50](../50_pwa-foundation.md)〜[53](../53_standalone-detection.md)
