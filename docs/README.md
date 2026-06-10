# Petal ドキュメント

Petal は、ユーザーごとに画像コンテンツをアップロード・管理する Web アプリケーション（モノリポ）です。
このディレクトリは、要求・設計・構築・運用・開発プロセスを **機能・レイヤー軸** で体系化したドキュメント一式です。

> 再構築の方針・進め方は [documentation-plan.md](documentation-plan.md) を参照。
> 旧来のタスク単位（TSK-N / PRJ-N）の設計メモは [specs/](specs/) にアーカイブされており、各ドキュメントから背景情報として参照しています。

## 読む順序

初めての方は次の順で読むと全体像を掴めます。

1. [00_overview/](00_overview/) — Petal とは・要求仕様・用語
2. [10_architecture/](10_architecture/) — システム構成と設計思想・規約
3. [30_operations/01_local-setup.md](30_operations/01_local-setup.md) — まず動かす
4. [20_features/](20_features/) — 各機能の現状仕様
5. [40_processes/](40_processes/) — 開発の進め方

## カテゴリ

### 00_overview — プロジェクト全体像

| ドキュメント | 内容 |
| ------------ | ---- |
| [01_introduction.md](00_overview/01_introduction.md) | Petal の目的・スコープ・ロール |
| [02_requirements.md](00_overview/02_requirements.md) | 機能要件・非機能要件 |
| [03_glossary.md](00_overview/03_glossary.md) | ドメイン用語・略語集 |

### 10_architecture — 設計（どう作るか）

| ドキュメント | 内容 |
| ------------ | ---- |
| [01_system-architecture.md](10_architecture/01_system-architecture.md) | システム構成（FE/BE/Cognito/S3/DB） |
| [02_backend-architecture.md](10_architecture/02_backend-architecture.md) | DDD + オニオン・フィーチャ構成・レイヤー責務 |
| [03_frontend-architecture.md](10_architecture/03_frontend-architecture.md) | Next.js App Router・page/hook 分離・design-system |
| [04_domain-model.md](10_architecture/04_domain-model.md) | ドメインモデル・エンティティ・不変条件 |
| [05_database-schema.md](10_architecture/05_database-schema.md) | テーブル定義・ERD・マイグレーション・論理削除 |
| [06_api-design.md](10_architecture/06_api-design.md) | REST 設計・OpenAPI/型生成・エラー規約・API 一覧 |
| [07_coding-rules.md](10_architecture/07_coding-rules.md) | コーディング規約 |

### 20_features — 機能別 現状仕様

| ドキュメント | 内容 |
| ------------ | ---- |
| [01_authentication.md](20_features/01_authentication.md) | ログイン・トークン・リフレッシュ・ロックアウト・MFA |
| [02_user-management.md](20_features/02_user-management.md) | ユーザー CRUD・招待・復活・ロール・最後の admin 保護 |
| [03_self-service-account.md](20_features/03_self-service-account.md) | サインアップ・プロフィール・パスワード/メール変更 |
| [04_image-management.md](20_features/04_image-management.md) | アップロード・一覧・詳細・S3 連携 |
| [05_authorization.md](20_features/05_authorization.md) | AuthGuard・RolesGuard・ナビ/ルートガード |
| [06_audit-logs.md](20_features/06_audit-logs.md) | 監査ログ |
| [07_pwa.md](20_features/07_pwa.md) | PWA 基盤・SW 更新・インストール導線 |
| [08_cognito-sync.md](20_features/08_cognito-sync.md) | Cognito ⇔ DB 同期・監査・インポート |

### 30_operations — 構築・運用

| ドキュメント | 内容 |
| ------------ | ---- |
| [01_local-setup.md](30_operations/01_local-setup.md) | ローカル開発環境構築 |
| [02_cognito-setup.md](30_operations/02_cognito-setup.md) | Cognito User Pool 構築 |
| [03_database-setup.md](30_operations/03_database-setup.md) | Neon / TypeORM / マイグレーション |
| [04_storage-setup.md](30_operations/04_storage-setup.md) | S3 バケット / IAM / CORS |
| [05_deployment.md](30_operations/05_deployment.md) | Lambda + API Gateway / Amplify Hosting |
| [06_cicd.md](30_operations/06_cicd.md) | GitHub Actions CI/CD・release 運用 |
| [07_observability.md](30_operations/07_observability.md) | メトリクス・ログ・Lighthouse CI |
| [08_operational-jobs.md](30_operations/08_operational-jobs.md) | バックアップ・keep-alive |

### 40_processes — 開発プロセス

| ドキュメント | 内容 |
| ------------ | ---- |
| [01_workflow.md](40_processes/01_workflow.md) | タスク遂行 7 フェーズ |
| [02_testing-strategy.md](40_processes/02_testing-strategy.md) | テスト方針 |
| [03_git-and-release.md](40_processes/03_git-and-release.md) | Git 運用・コミット規約・.trash 退避 |
