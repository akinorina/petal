# 運用ジョブ

Neon Free の制約に対応する定期ジョブ。GitHub Actions の cron で実行する。原典: [specs/42_operational-jobs.md](../specs/42_operational-jobs.md)。

## バックアップ（pg_dump → S3）

- ワークフロー: [.github/workflows/backup.yml](../../.github/workflows/backup.yml)
- スケジュール: **週次**（cron `0 1 * * 0` = 毎週日曜 01:00 UTC）+ 手動実行可。
- 内容: `postgresql-client` を入れ、Neon を `pg_dump`（Direct エンドポイント）→ 圧縮 → S3 へアップロード。
- 目的: Neon Free は自動バックアップ・PITR がないため、週次ダンプで保全する。

## Keep-alive（SELECT 1）

- ワークフロー: [.github/workflows/keepalive.yml](../../.github/workflows/keepalive.yml)
- スケジュール: **週次**（cron `0 0 * * 3` = 毎週水曜 00:00 UTC）+ 手動実行可。
- 内容: Neon に `SELECT 1` を発行。
- 目的: compute の自動サスペンドによるコールドスタートを抑制する。

## 必要なシークレット

両ジョブとも GitHub Actions Secrets に DB 接続情報（Direct エンドポイント）と、backup は S3 アップロード用の AWS 認証情報が必要。

## 関連ドキュメント

- DB（Neon の制約）→ [03_database-setup.md](03_database-setup.md)
- CI/CD → [06_cicd.md](06_cicd.md)
- 原典 → [specs/42_operational-jobs.md](../specs/42_operational-jobs.md), [specs/04_db-neon-aws-hybrid.md](../specs/04_db-neon-aws-hybrid.md)
