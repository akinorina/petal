# GitHub Actions CI ワークフロー設計（TSK-40）

## 1. スコープ

### 対象

- `.github/workflows/ci.yml` の新規作成
- backend ジョブ: lint・ユニットテスト・ビルド
- frontend ジョブ: lint・ビルド
- トリガー: `pull_request` および `push`（main ブランチ）

### 非対象

- backend e2e テスト（`pnpm --filter backend test:e2e`）
  - `app.e2e-spec.ts` は AppModule を丸ごと起動するため TypeORM 経由で PostgreSQL が必要。また Cognito・S3 等の環境変数も AppModule 初期化時に参照される可能性がある。CI でのサービスコンテナ＋シークレット整備は別タスクとして分離する。
- デプロイ自動化（Serverless Framework / Amplify）
- カバレッジレポートのアップロード

## 2. 関連ドキュメント

- [docs/24_testing-strategy.md](24_testing-strategy.md)（テスト方針・モック戦略）
- [docs/00_rules.md](00_rules.md)（コーディング・Git ルール）

## 3. 技術構成

| 項目 | 値 | 根拠 |
| --- | --- | --- |
| Node.js | 20 | ルート `package.json` の `engines.node: ">=20.0.0"` |
| pnpm | 10.33.0 | ルート `package.json` の `packageManager: "pnpm@10.33.0"` |
| runner | ubuntu-latest | 標準的な CI 環境 |

## 4. ジョブ設計

### 4.1 backend ジョブ

外部サービス不要。ユニットテストはすべてのリポジトリ・外部クライアントを Jest モックで差し替えるため、環境変数・DB 接続なしで実行できる。

```text
checkout
→ pnpm/action-setup@v4 (version: 10.33.0)
→ actions/setup-node@v4 (node: 20, cache: pnpm)
→ pnpm install --frozen-lockfile
→ pnpm --filter backend lint
→ pnpm --filter backend test
→ pnpm --filter backend build
```

### 4.2 frontend ジョブ

`NEXT_PUBLIC_API_BASE_URL` はコード内でフォールバック値（`http://localhost:3000`）を持つため、env 未設定でもビルド成功する。`NEXT_PUBLIC_COGNITO_*` は .env.example に定義されているが現時点でソースコード内に参照箇所がないため同様。

```text
checkout
→ pnpm/action-setup@v4 (version: 10.33.0)
→ actions/setup-node@v4 (node: 20, cache: pnpm)
→ pnpm install --frozen-lockfile
→ pnpm --filter frontend lint
→ pnpm --filter frontend build
```

### 4.3 ジョブ並列実行

backend・frontend は相互依存なし。並列実行で CI 時間を短縮する。

## 5. pnpm キャッシュ戦略

`actions/setup-node@v4` の `cache: 'pnpm'` を使用する。ルートの `pnpm-lock.yaml` を自動検出しキャッシュキーを生成する。ロックファイルが変わらなければ `pnpm install` がキャッシュヒットし高速化する。

## 6. 完了条件

- PR を作成すると CI が自動実行される
- backend テスト・lint・ビルドすべてが成功する
- frontend lint・ビルドが成功する
- バッジ・ステータスが GitHub PR 上に表示される

## 7. 手動動作確認シナリオ

1. 本ブランチの PR を GitHub 上で作成する → CI が自動起動することを確認
2. GitHub Actions の Checks タブで backend / frontend の両ジョブが緑になることを確認
3. 意図的に lint エラーを含むコミットを push する → CI が失敗することを確認（後で revert）
4. 意図的に TypeScript コンパイルエラーを含む build → CI が失敗することを確認（後で revert）

## 8. 今後の拡張候補

- backend e2e テストを PostgreSQL サービスコンテナで実行（別タスク）
- テストカバレッジ閾値の設定・Codecov 等へのアップロード（[docs/24_testing-strategy.md §8.4](24_testing-strategy.md) 参照）
