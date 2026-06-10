# 観測性（Observability）

ログ・メトリクス・品質監査。

## Cognito 連携メトリクス

- Cognito SDK 呼び出しは `runWithCognitoMetrics(op, fn)` で包み、`{msg, op, result, latencyMs, errorCode}` を **1 行 JSON** で出力する。
- CloudWatch Logs Insights で集計可能。既存ログと併存。
- 実装: [backend/src/common/observability/cognito-metrics.ts](../../backend/src/common/observability/cognito-metrics.ts)、原典 [specs/63_cognito-observability.md](../specs/63_cognito-observability.md)

## アプリケーションログ

- Lambda の標準出力は CloudWatch Logs に集約される。
- トランザクション境界で不整合が残りうる極小ケース（外部 API 成功 → COMMIT 失敗）では、`user_id` 等の特定情報をログに残す（[10_architecture/02_backend-architecture.md](../10_architecture/02_backend-architecture.md)）。

## Lighthouse PWA 監査（CI）

- `@lhci/cli` + GitHub Actions で PWA を監査し、`installable-manifest` をゲートにする。
- 設定: [frontend/lighthouserc.json](../../frontend/lighthouserc.json)、原典 [specs/54_lighthouse-pwa-ci.md](../specs/54_lighthouse-pwa-ci.md)

## 起動モード計測（PWA）

- `display-mode: standalone` 判定フックで `trackEvent('app_launch')` を発火する（[20_features/07_pwa.md](../20_features/07_pwa.md)、原典 [specs/53](../specs/53_standalone-detection.md)）。

## 関連ドキュメント

- CI/CD → [06_cicd.md](06_cicd.md)
- PWA → [20_features/07_pwa.md](../20_features/07_pwa.md)
- Cognito 同期 → [20_features/08_cognito-sync.md](../20_features/08_cognito-sync.md)
- 原典 → [specs/63_cognito-observability.md](../specs/63_cognito-observability.md), [specs/54_lighthouse-pwa-ci.md](../specs/54_lighthouse-pwa-ci.md)
