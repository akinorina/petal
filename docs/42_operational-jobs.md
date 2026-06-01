# 42. 運用ジョブ：pg_dump バックアップ・keep-alive（TSK-42）

## 0. このドキュメントの位置付け

- ステータス：**実装中**
- 目的：Neon Free プランの制約（7 日間アクセスなしで自動 pause / 自動バックアップなし）に対応する定期ジョブを GitHub Actions で構築する。
- 関連：
  - [docs/04_db-neon-aws-hybrid.md](04_db-neon-aws-hybrid.md) §4（DB 方針。Neon Free の制約・対策の整理として参照）
  - [docs/36_lambda-api-gateway-setup.md](36_lambda-api-gateway-setup.md)（実 DB は Neon Postgres、`DATABASE_URL_DIRECT` の整備済み）

## 1. スコープ

### 対象

- `.github/workflows/backup.yml`：週次 pg_dump → S3 バックアップ
- `.github/workflows/keepalive.yml`：週次 `SELECT 1` による keep-alive

### 非対象

- バックアップ用 S3 バケットの作成 / S3 Lifecycle ルール設定（AWS コンソール手動作業）
- バックアップからのリストア手順書
- バックアップ専用 IAM の切り出し（既存 deploy 用 IAM を流用）

## 2. 背景・前提

Neon Free プランには以下の制約がある（[docs/04_db-neon-aws-hybrid.md](04_db-neon-aws-hybrid.md) §4 を参照）。

- **自動 pause**：7 日間アクセスがないとプロジェクトが pause される
- **自動バックアップなし**：PITR・スナップショットがない

このため、運用側で以下を担保する。

- **keep-alive**：週 1 回 Neon に対し `SELECT 1` を打ってアクセスを発生させる
- **バックアップ**：週 1 回 `pg_dump` を実行し、S3 にダンプを退避する

### 接続先

pg_dump / psql はいずれもセッションを跨ぐ処理のため **Direct 接続（5432 ポート）= `DATABASE_URL_DIRECT`** を使用する。Pooler（6543）は transaction mode で動作するため利用できない。

## 3. ワークフロー設計

### 3.1 backup.yml

- **トリガー**
  - `schedule: cron: '0 1 * * 0'`（UTC 日曜 01:00 = JST 日曜 10:00）
  - `workflow_dispatch`（手動実行用）
- **手順**
  1. `actions/checkout@v6`
  2. `apt-get install -y postgresql-client`（`pg_dump` を導入）
  3. `pg_dump "$DATABASE_URL_DIRECT" | gzip > backup-$(date -u +%Y-%m-%d).sql.gz`
  4. `aws s3 cp` で `s3://$BACKUP_S3_BUCKET/backups/` へアップロード
  5. 古いバックアップの削除は **S3 Lifecycle**（28 日後 expire）に任せる
- **失敗時**：GitHub Actions の標準通知（Actions タブ・メール）で検知。再実行は `workflow_dispatch` で対応。

### 3.2 keepalive.yml

- **トリガー**
  - `schedule: cron: '0 0 * * 3'`（UTC 水曜 00:00 = JST 水曜 09:00）
  - `workflow_dispatch`
- **手順**
  1. `actions/checkout@v6`
  2. `apt-get install -y postgresql-client`
  3. `psql "$DATABASE_URL_DIRECT" -c "SELECT 1"`

### 3.3 共通事項

- ランナー：`ubuntu-latest`
- `postgresql-client` のバージョンは Ubuntu apt の既定版（Neon 側は PostgreSQL 16 系互換だが、pg_dump はマイナーバージョン差異に寛容）
- 機密情報はすべて GitHub Secrets 経由で渡し、ログ出力しない

## 4. 必要な GitHub Secrets

| Secret 名 | 内容 | 既存 / 新規 |
| --- | --- | --- |
| `AWS_ACCESS_KEY_ID` | AWS IAM アクセスキー | 既存（deploy.yml で利用中） |
| `AWS_SECRET_ACCESS_KEY` | AWS IAM シークレットキー | 既存 |
| `DATABASE_URL_DIRECT` | Neon Direct 接続文字列（5432 / SSL 必須） | **新規** |
| `BACKUP_S3_BUCKET` | バックアップ先 S3 バケット名（例：`petal-db-backup`） | **新規** |

## 5. AWS 側の事前作業（ユーザー手動）

1. S3 バケット作成（`ap-northeast-1` / 推奨名 `petal-db-backup`）
2. バケットの Lifecycle ルール：`backups/` プレフィックスに対し 28 日後 expire
3. 既存 deploy 用 IAM ユーザーに以下のポリシーを付与
   - `s3:PutObject` on `arn:aws:s3:::petal-db-backup/backups/*`
4. GitHub Secrets に `DATABASE_URL_DIRECT` と `BACKUP_S3_BUCKET` を登録

## 6. 完了条件

- [ ] `backup.yml` を `workflow_dispatch` で手動実行し、S3 に `backups/backup-YYYY-MM-DD.sql.gz` が保存される
- [ ] `keepalive.yml` を `workflow_dispatch` で手動実行し、`SELECT 1` が成功する
- [ ] 両ワークフローの Scheduled 履歴が Actions タブに表示される（初回スケジュール到達後に確認）

## 7. 手動動作確認シナリオ

1. main マージ後、Actions タブから `backup.yml` を `Run workflow` で実行 → 成功（緑）を確認
2. AWS S3 コンソールで `s3://petal-db-backup/backups/backup-YYYY-MM-DD.sql.gz` の存在とサイズ（数百 KB〜数 MB を想定）を確認
3. ローカルで `aws s3 cp s3://petal-db-backup/backups/backup-YYYY-MM-DD.sql.gz -` → `gunzip` でダンプ内容が読めることを確認
4. Actions タブから `keepalive.yml` を `Run workflow` で実行 → 成功を確認
5. 翌週の Scheduled 実行履歴が両ワークフローに記録されることを確認

## 8. 留意事項

- Neon の compute hours は Free プランに上限がある。週 1 回・数 MB 程度のダンプなら無料枠内に収まる想定だが、DB サイズが拡大した場合は実行頻度の見直しを検討する。
- バックアップファイルには DB 全体の論理ダンプが含まれる。S3 バケットはパブリック非公開（ACL: private、Block Public Access: ON）を必ず維持する。
- リストア手順は本ドキュメントの範囲外。必要になった時点で別ドキュメント化する。
