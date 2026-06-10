# テスト方針

原典: [specs/24_testing-strategy.md](../specs/24_testing-strategy.md)。

## フレームワークと配置

- **Jest 30 + ts-jest**。HTTP 統合は `supertest`。
- ユニットテストは対象ファイルと **同居** させ `<file>.spec.ts` 命名（例: `user.service.ts` ↔ `user.service.spec.ts`）。
- e2e テストは `backend/test/*.e2e-spec.ts`（Jest 設定が分かれている）。
- `describe` はクラス名 + メソッド名、`it` は日本語で振る舞いを記述する。

## レイヤー別の責務

| レイヤー | テスト | 備考 |
| -------- | ------ | ---- |
| Domain | 必要に応じてユニット | Zod 不変条件は Service テストで間接的にカバーされる範囲を許容 |
| Application（`*.service.ts`） | **ユニット必須** | Repository / SDK クライアントを DI モックで差し替え |
| Infra（TypeORM・AWS SDK ラッパー） | スコープ外 | 統合テストは別途方針を定める |
| Controller | 原則スコープ外 | 薄く Service に委譲するため Service テストで担保 |
| Cross-cutting（Guard 等） | 原則スコープ外 | e2e で担保 |

## モック戦略

- **Repository**: インターフェース（`IUserRepository` 等）と DI シンボル（`USER_REPOSITORY` 等）を `useValue` でモック。`jest.Mocked<...>` で型安全を保つ。
- **Cognito クライアント**: 具象クラス（`CognitoAuthClient` / `CognitoUserClient`）を `useValue` でモック。インターフェース化はしない（DI で差替可能なため過剰抽象化を避ける）。例外判定メソッド（`isUserNotFound` 等）も spec 側で `jest.fn()` 実装。
- **`runInTransaction`**: モックでは `(fn) => fn(txRepo)` の形で即時実行。実 DB トランザクションの挙動はユニットでは検証しない。

## カバレッジと CI

- カバレッジ閾値は現時点で未設定（実態が見えてから別途決める）。
- CI では `backend` の lint/test/build、`frontend` の lint/build をゲートにする（[30_operations/06_cicd.md](../30_operations/06_cicd.md)）。
- ローカルでは `cd backend && pnpm test` が緑になることが基本要件。

## 認証ガードのスキップ

`SKIP_AUTH=true` のときガードをスキップする仕組みを使う。ユニットテストは Service 層に閉じるためガードは関与しない。

## 関連ドキュメント

- 規約 → [10_architecture/07_coding-rules.md](../10_architecture/07_coding-rules.md)
- CI → [30_operations/06_cicd.md](../30_operations/06_cicd.md)
- 原典 → [specs/24_testing-strategy.md](../specs/24_testing-strategy.md), [specs/25_authguard-db-validation-tests.md](../specs/25_authguard-db-validation-tests.md)
