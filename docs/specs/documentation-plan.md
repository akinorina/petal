# ドキュメント体系 再構築計画

> 本ファイルは「Petal のドキュメントを体系的に再作成する」ための **計画書（メタドキュメント）** です。
> ここに書かれた構成・手順に従って、後続のタスクで実ドキュメントを作成します。
> 実ドキュメントが揃い次第、本ファイルは役割を終え `docs/specs/` 等へアーカイブします。

## 1. 背景と目的

### 現状の課題

- 現在の `docs/specs/` 配下は **タスク単位（TSK-N / PRJ-N）で時系列に積み上がった設計メモ** が 60 ファイル超ある。
- 1 機能の最新仕様を知るには、初期設計 → 複数の拡張・変更ドキュメントを横断して追う必要があり、**「今どうなっているか」を 1 箇所で把握できない**。
- 番号（00〜68）は着手順であり、機能・レイヤーの体系を表していない。
- 新規参入者が「ゼロから構築する」ための導線（要求 → 設計 → 環境構築 → デプロイ）が分断されている。

### 目的

既存ドキュメント群と **実際のソースコードを正** として、次の 3 種類を満たす体系的なドキュメント一式を再作成する。

1. **現状要約**: 現在の実装内容を機能・レイヤーごとに正確に要約したもの。
2. **ゼロから構築可能**: このドキュメントだけで、要求理解 → 設計把握 → 環境構築 → デプロイまで辿れるもの。
3. **要求仕様と設計の分離**: 「何を作るか（要求）」と「どう作るか（設計）」を体系立てて整理したもの。

### 方針

- **コードを一次情報源とする**。`docs/specs/` の旧ドキュメントは設計意図・背景の二次情報として参照するが、現状と矛盾する場合はコードを正とする。
- 旧 `docs/specs/`（番号付きタスクドキュメント）は **削除せずアーカイブとして残す**。再作成ドキュメントから必要に応じてリンクする。
- ドキュメントは **機能・レイヤー軸** で再編する。タスク番号への依存をなくす。

## 2. 目標とするドキュメント構成

`docs/` 直下を以下のカテゴリ別ディレクトリに再編する（番号はカテゴリの並び順）。

```text
docs/
  README.md                     # ドキュメント全体の目次・読む順序のガイド
  00_overview/                  # プロジェクト全体像
    01_introduction.md          #   Petal とは・スコープ・用語集
    02_requirements.md          #   要求仕様（機能要件・非機能要件）
    03_glossary.md              #   ドメイン用語・略語集
  10_architecture/              # 設計（どう作るか）
    01_system-architecture.md   #   システム構成（FE/BE/Cognito/S3/DB）図つき
    02_backend-architecture.md  #   DDD + オニオン、フィーチャ構成、レイヤー責務
    03_frontend-architecture.md #   Next.js App Router、page/hook 分離、design-system
    04_domain-model.md          #   ドメインモデル・エンティティ・不変条件
    05_database-schema.md       #   テーブル定義・ERD・マイグレーション方針・論理削除
    06_api-design.md            #   REST 設計方針・OpenAPI/型生成・エラー規約
    07_coding-rules.md          #   コーディング規約（旧 00_rules.md の現行版）
  20_features/                  # 機能別 設計（現状要約）
    01_authentication.md        #   ログイン/トークン/リフレッシュ/ロックアウト/MFA
    02_user-management.md       #   ユーザー CRUD/招待/復活/ロール/最後のadmin保護
    03_self-service-account.md  #   サインアップ/プロフィール/パスワード変更/メール変更
    04_image-management.md      #   アップロード(D&D/ファイル/カメラ)/一覧/詳細/S3
    05_authorization.md         #   AuthGuard/RolesGuard/ナビ・ルートガード
    06_audit-logs.md            #   監査ログ
    07_pwa.md                   #   PWA 基盤/SW更新/インストール導線/standalone
    08_cognito-sync.md          #   Cognito⇔DB 同期・監査・インポートスクリプト
  30_operations/                # 構築・運用（ゼロから構築・運用）
    01_local-setup.md           #   ローカル開発環境構築（direnv/.env/起動）
    02_cognito-setup.md         #   Cognito User Pool 構築（prod/dev）
    03_database-setup.md        #   Neon/TypeORM/マイグレーション/接続切替
    04_storage-setup.md         #   S3 バケット/IAM/CORS
    05_deployment.md            #   Lambda+API Gateway / Amplify Hosting
    06_cicd.md                  #   GitHub Actions CI/CD・release ブランチ運用
    07_observability.md         #   Cognito メトリクス・ログ・Lighthouse CI
    08_operational-jobs.md      #   バックアップ・keep-alive 等の運用ジョブ
  40_processes/                 # 開発プロセス
    01_workflow.md              #   タスク遂行 7 フェーズ（旧 03_workflow.md）
    02_testing-strategy.md      #   テスト方針・レイヤー別責務・モック戦略
    03_git-and-release.md       #   Git 運用・コミット規約・.trash 退避
  specs/                        # 旧タスク別ドキュメント（アーカイブ・参照用）
```

> ディレクトリ名・分割粒度は作成着手時に微調整可。粒度が細かすぎる場合は機能カテゴリ内で 1 ファイルに統合する。

## 3. 新ドキュメント ←→ 情報源マッピング

各新ドキュメントの主な情報源（コード・旧ドキュメント）。**コードを正、旧ドキュメントを背景** とする。

| 新ドキュメント | 主なコード情報源 | 参照する旧ドキュメント |
| -------------- | ---------------- | ---------------------- |
| overview/requirements | — | 01_requirements |
| architecture/system | `amplify.yml`, `backend/src/lambda.ts`, インフラ設定 | 02_implementations, 04_db-neon-aws-hybrid |
| architecture/backend | `backend/src/<feature>/{domain,application,infra,controller}` | 00_rules |
| architecture/frontend | `frontend/src/app`, `frontend/src/design-system`, `*/use-*-page.ts` | 00_rules, 43_frontend-auth-refactor |
| architecture/domain-model | `backend/src/**/domain/*.ts`（Zod スキーマ） | 11, 12 |
| architecture/database-schema | `backend/src/**/infra/*.entity.ts`, `backend/database/migrations/` | 04, 28, 57 |
| architecture/api-design | `backend/src/**/controller/*.ts`, `openapi.config.ts`, `frontend/src/lib/openapi` | 13_openapi |
| features/authentication | `backend/src/auth/**`, `frontend/src/app/login` | 11,18,19,27,29,57 |
| features/user-management | `backend/src/user/**`, `frontend .../users` | 15,16,17,21,23,26,61,62 |
| features/self-service-account | `auth`(signup/change-pw), `user`(me), `frontend .../me`,`/signup` | 12(self-signup),20,56,59,60,66 |
| features/image-management | `backend/src/image/**`, `frontend .../images` | 12,44,45,46,47,48,49 |
| features/authorization | `backend/src/common/guards`, `decorators`, `frontend (admin-only)` | 21,22,25,67 |
| features/audit-logs | `backend/src/audit/**`, `frontend .../audit-logs` | 28 |
| features/pwa | `frontend/serwist.config.ts`, `public/`, SW 関連 | 50,51,52,53,54 |
| features/cognito-sync | `backend/scripts/*cognito*`, `create-admin` | 18(audit),58,64,65 |
| operations/local-setup | `.envrc.example`, `*/README.md`, `91/92`(local) | 30,31,34 |
| operations/cognito-setup | — | 14,38 |
| operations/database-setup | `backend/database`, TypeORM 設定 | 04,34 |
| operations/storage-setup | S3/IAM 設定 | 39 |
| operations/deployment | `serverless.yml`, `amplify.yml`, `lambda.ts` | 36,37 |
| operations/cicd | `.github/workflows/` | 40,41,55 |
| operations/observability | `backend/src/common/observability`, `lighthouserc.json` | 54,63 |
| operations/operational-jobs | 運用スクリプト | 42 |
| processes/workflow | — | 03_workflow |
| processes/testing | `**/*.spec.ts`, jest 設定 | 24,25 |
| processes/git-and-release | — | 00_rules(§Git), 55 |

> 上表の旧ドキュメント番号は `docs/specs/` 内のファイル接頭辞。

## 4. 各ドキュメントの記載テンプレート

機能・設計ドキュメント（`20_features/`, `10_architecture/`）は次の節構成を基本とする。

1. **概要** — この機能/レイヤーが何を担うか（1〜2 段落）
2. **要求** — 関連する機能/非機能要件（`02_requirements.md` への参照）
3. **設計** — 構成・データフロー・主要クラス/フック・API
4. **実装ポイント** — コード上の主要ファイルへのリンク（`file:line` 形式）
5. **設計上の決定と背景** — なぜこうしたか（旧ドキュメントから抽出）
6. **関連ドキュメント** — 相互リンク

運用ドキュメント（`30_operations/`）は **手順書（前提 → 手順 → 確認 → トラブルシュート）** 形式とする。

## 5. 作成手順（フェーズ分け）

ドキュメント量が多いため、依存関係の少ない土台から積み上げる。各フェーズ完了時にレビューを挟む。

### フェーズ 0: 準備（本計画の確定）

- [ ] 本計画書のディレクトリ構成・粒度をレビュー・確定する。
- [ ] `docs/` 直下に空のカテゴリディレクトリと `README.md`（目次の骨子）を作成する。

### フェーズ 1: 土台（全体像と規約）

- [ ] `00_overview/`（introduction, requirements, glossary）
- [ ] `10_architecture/`（system, backend, frontend, domain-model, database-schema, api-design, coding-rules）
- [ ] `40_processes/`（workflow, testing, git-and-release）

> ここまでで「設計思想と規約」が固まり、以降の機能ドキュメントの記述粒度が揃う。

### フェーズ 2: 機能別 現状要約

- [ ] `20_features/` を 1 ファイルずつ作成。コードを読みながら現状を要約し、旧ドキュメントから背景を補完する。
- [ ] 各ファイルでコード参照を `file:line` リンクで明記する。

### フェーズ 3: 構築・運用手順

- [ ] `30_operations/` を作成。**実際に手順をなぞって再現性を確認**しながら書く（特に local-setup / deployment / cicd）。

### フェーズ 4: 仕上げ

- [ ] `docs/README.md` を完成（読む順序・カテゴリ案内・旧 specs との関係）。
- [ ] ルートの `README.md`・`AGENTS.md` のドキュメントリンク表を新構成に差し替え。
- [ ] 旧 `docs/specs/` を「アーカイブ」と明記（`docs/specs/README.md` を追加）。
- [ ] 相互リンク・パス切れの一括チェック（markdownlint + リンクチェック）。

## 6. 既存ドキュメント・リンクの扱い

- `docs/specs/` の番号付きドキュメントは **削除しない**。歴史的経緯・詳細設計の一次記録として残す。
- 新ドキュメントからは「背景は [specs/NN_xxx.md] を参照」の形でリンクする。
- `AGENTS.md` のドキュメント表・ルート `README.md` のリンクは、新構成の完成後にまとめて更新する（中途半端な二重メンテを避ける）。
- 「新しい設計ドキュメントを追加したら AGENTS.md の表に追記する」という現行ルールは、再構築期間中は **本計画を正** として一時停止し、フェーズ 4 で一括反映する。

## 7. 完了条件（Definition of Done）

- [ ] §2 の構成のドキュメントが（粒度調整後の最終形で）すべて存在する。
- [ ] 各機能の「現在の実装」がコードと一致している（記載とコードに齟齬がない）。
- [ ] ゼロからの構築フロー（要求 → 設計 → ローカル構築 → デプロイ）がドキュメントのみで辿れる。
- [ ] `docs/README.md` が目次として機能し、読む順序が示されている。
- [ ] ルート `README.md` / `AGENTS.md` のリンクが新構成を指している。
- [ ] markdownlint・リンクチェックがパスする。

## 8. 想定リスク・留意点

- **コードと旧ドキュメントの乖離**: 旧ドキュメントは設計時点の記述であり現状と異なる場合がある。必ずコードで裏取りする。
- **粒度の過剰分割**: ファイルが細かすぎると横断把握が再び困難になる。1 機能 1 ファイルを基本とし、迷ったら統合側に倒す。
- **作業量**: 機能 8 + アーキ 7 + 運用 8 + その他で 30 ファイル規模。フェーズ単位で区切り、一度に完成を狙わない。
- **二重メンテ**: 再構築完了までは新旧が並存する。完了まで AGENTS.md 表の更新を凍結し混乱を避ける。
