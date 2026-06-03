# Cognito 連携の観測性 設計（TSK-27）

## 0. 課題シート（Notion 転記）

> Notion タスク: [Cognito 連携の観測性（ログ・メトリクス・トレース）](https://app.notion.com/p/3589ca7d99dc8134a12ff8df2cee6b8c)（TSK-27）

### 背景

Cognito 連携の失敗率・レイテンシを継続観測する手段がない。本番運用で障害が起きてから初めて気づく状態。

### 課題

- 構造化ロギング（pino 等）を導入し、すべての Cognito 系操作の成否・所要時間・エラーコードをログ。
- メトリクス: `cognito_admin_api_total{op, result}` / `cognito_admin_api_latency_seconds` 相当。CloudWatch / Prometheus / OpenTelemetry のいずれかへ送出。
- トレース: HTTP リクエスト → Service → Cognito クライアント の span を関連付ける。

#### 提案

- 段階導入: まず構造化ログのみ。CloudWatch Logs Insights で十分集計可能。OTel は本番要件次第で別タスク。
- 既存 `Logger.error` 呼び出しを構造化ログに置き換える際、既存の挙動を壊さない。

### 完了条件（原文）

- Cognito 連携の成否・レイテンシが構造化ログに残る
- CloudWatch Logs Insights から集計可能
- エラーコード別の発生数が見える

---

## 1. 課題サマリ

Cognito 系 SDK 呼び出し（`CognitoUserClient` / `CognitoAuthClient` の全 `this.client.send(...)`）を 1 つのヘルパ `runWithCognitoMetrics(op, fn)` で包み、次の構造化ログを 1 行 JSON で残す。

- `msg: 'cognito_api'`
- `op`: AdminCreateUser / InitiateAuth など SDK の操作名
- `result`: `'success' | 'error'`
- `latencyMs`: 経過ミリ秒
- `errorCode`: 失敗時のエラークラス名（例: `UserNotFoundException`）

これにより CloudWatch Logs Insights で次のクエリが書けるようになる。

```text
fields @timestamp, op, result, latencyMs, errorCode
| filter msg = "cognito_api"
| stats count() as n, avg(latencyMs) as avg_ms by op, result
```

メトリクス/トレース（Prometheus・OTel）は **本タスク対象外** とし、本番要件で必要になったら別タスクで追加する。

## 2. スコープ

### 対象

- backend: `runWithCognitoMetrics(op, fn)` ヘルパを新設し、`CognitoUserClient` / `CognitoAuthClient` の全 SDK 呼び出しを包む
- backend: 構造化ログを NestJS `Logger.log` 経由で 1 行 JSON として出力（CloudWatch では 1 イベント = 1 JSON が Insights で扱いやすい）
- backend: 単体テストで「op/result/latencyMs/errorCode が正しく載るか」「成功・失敗で再 throw されるか」を担保

### 対象外

- Prometheus エクスポータ追加
- OpenTelemetry（OTel）の span 連携
- CloudWatch メトリクスフィルタ（運用作業）
- 既存の `this.logger.error(...)` / `this.logger.warn(...)` の削除（**互換性のため残す**。構造化ログは「補助レーン」として追加する）
- pino 等のロガー差し替え（既存の NestJS `Logger` をそのまま使う）

## 3. 制約

- 既存挙動の互換維持: 既存の例外伝播・ログメッセージは一切変えない。構造化ログは **追加** のみ。
- オニオン依存方向: ヘルパは `common/` 配下（フレームワーク非依存）に置く。`infra/` から呼ぶ。
- ロガー I/F: 既存の `Logger` を呼び出し側で渡す形にして、ヘルパは Nest や AWS SDK に依存させない。
- 出力フォーマット: 1 行 JSON。タイムスタンプ・level は NestJS Logger が prefix を付けるため、JSON 本体には含めない。

## 4. 設計判断ログ

### 判断 1: 計装方式 → **共通ヘルパ `runWithCognitoMetrics(op, fn, logger)`**（採用）

```ts
async function runWithCognitoMetrics<T>(
  op: string,
  fn: () => Promise<T>,
  logger: Pick<Logger, 'log' | 'warn'>,
): Promise<T> {
  const start = Date.now();
  try {
    const result = await fn();
    logger.log(
      JSON.stringify({
        msg: 'cognito_api',
        op,
        result: 'success',
        latencyMs: Date.now() - start,
      }),
    );
    return result;
  } catch (err) {
    const errorCode =
      err instanceof Error ? err.constructor.name : typeof err;
    logger.warn(
      JSON.stringify({
        msg: 'cognito_api',
        op,
        result: 'error',
        latencyMs: Date.now() - start,
        errorCode,
      }),
    );
    throw err;
  }
}
```

- **理由**: デコレータ方式は AWS SDK の Middleware や class decorator が必要で型・依存が膨らむ。1 行ラップが最も小さい侵襲で全箇所に適用できる。
- **エラーログレベル**: `warn`（既存の `this.logger.error(...)` と二重に出るため、構造化側は `warn` にして「素のエラー出力と構造化メトリクスの両立」を狙う。Insights は level に依存しない）。

### 判断 2: フォーマット → **1 行 JSON（`JSON.stringify` の結果を Logger.log の message に渡す）**（採用）

- CloudWatch Logs Insights は `parse @message '...'` でフィールドを抽出できるが、JSON ならば `fields op, result, latencyMs` で直接アクセスできる。
- pino のような jsonLogger を導入する案もあるが、本番の Lambda 環境で運用するうえで NestJS Logger + JSON 文字列で十分。

### 判断 3: op の命名 → **SDK のコマンドクラスから派生（`AdminCreateUser`, `InitiateAuth` 等）**（採用）

- SDK のクラス名 `AdminCreateUserCommand` の `Command` を取り除いた文字列をそのまま使う。
- 呼び出し側で明示的に `runWithCognitoMetrics('AdminCreateUser', () => ...)` と書く（自動抽出ではなく明示的にして、リファクタ耐性を上げる）。

### 判断 4: 適用範囲 → **`CognitoUserClient` / `CognitoAuthClient` の全 `this.client.send(...)`**（採用）

- いずれも 1 メソッド = 1 SDK コマンドの構造なので、メソッド単位で包む。
- 例外: `enableUser` のように成否が直接 throw されるメソッドは、現状の throw 挙動を維持しつつ計装する。

### 判断 5: テスト方針 → **ヘルパ単体テスト + 既存 spec への影響なし**（採用）

- 既存の `cognito-user.client` は SDK モックなしで動かないため単体テスト対象外。`runWithCognitoMetrics` 自体は純粋関数なのでテストしやすい。
- 既存の `user.service.spec.ts` / `auth.service.spec.ts` は `CognitoUserClient` / `CognitoAuthClient` をモックしているため、ラップを追加しても影響なし。

### 判断 6: 既存 `Logger.error` 呼び出し → **そのまま残す（構造化ログは追加レーン）**（採用）

- 既存の `this.logger.error('Cognito ユーザー作成に失敗しました...')` はオペレータ向けの素のテキストログとして価値がある。
- 構造化ログは集計用なので、二重出力を許容する（CloudWatch のコスト影響は無視できる範囲）。

## 5. データモデル

なし（既存スキーマ変更なし）。

## 6. API 仕様

なし（外部 API への影響なし）。

## 7. 既存設計との差分

- 新規ファイル: `backend/src/common/observability/cognito-metrics.ts` に `runWithCognitoMetrics` を実装。
- 変更: `CognitoUserClient` / `CognitoAuthClient` の各メソッドで `await this.client.send(cmd)` を `await runWithCognitoMetrics('OpName', () => this.client.send(cmd), this.logger)` に置換。
- テスト追加: `backend/src/common/observability/cognito-metrics.spec.ts`。

## 8. トランザクション境界

なし。

## 9. 完了条件（具体化）

- [ ] `runWithCognitoMetrics` が成功時に `result:'success'` + `latencyMs` を JSON で出力する
- [ ] 失敗時に `result:'error'` + `latencyMs` + `errorCode`（例外クラス名）を JSON で出力し、例外を再 throw する
- [ ] `CognitoUserClient` / `CognitoAuthClient` の全 `client.send(...)` 呼び出しが包まれている
- [ ] 既存の `user.service.spec.ts` / `auth.service.spec.ts` が無修正で通る
- [ ] `cognito-metrics.spec.ts` が成功・失敗・errorCode・latencyMs の各観点をカバーする
- [ ] `cd backend && pnpm lint && pnpm test && pnpm build` 通過

## 10. 手動動作確認シナリオ

1. ローカルで backend を起動し admin としてユーザー作成 → ログに `{"msg":"cognito_api","op":"AdminCreateUser","result":"success","latencyMs":N}` が 1 行で出る。
2. 既に登録済みのメールアドレスで再度ユーザー作成 → `{"msg":"cognito_api","op":"AdminCreateUser","result":"error","latencyMs":N,"errorCode":"UsernameExistsException"}` が出る。
3. 存在しないメールアドレスでパスワードリセット要求 → Cognito の `PreventUserExistenceErrors`（デフォルト ON、ユーザー列挙攻撃対策）により Cognito API 自体は成功扱いで、`{"msg":"cognito_api","op":"ForgotPassword","result":"success","latencyMs":N}` が出る。これは Cognito 側の意図された挙動。
4. CloudWatch Logs Insights で `filter msg = "cognito_api" | stats count() by op, result` が動く（ステージ環境で確認）。

## 11. 未確定事項

- なし。

---

## 12. 実装計画（Phase 4）

### 12.1 変更・追加ファイル

- `backend/src/common/observability/cognito-metrics.ts`（新規）: `runWithCognitoMetrics(op, fn, logger)` + 型
- `backend/src/common/observability/cognito-metrics.spec.ts`（新規）: 単体テスト
- `backend/src/user/infra/cognito-user.client.ts`（変更）: 全 `this.client.send(...)` を `runWithCognitoMetrics` 経由に置換
- `backend/src/auth/infra/cognito-auth.client.ts`（変更）: 同上

migration / 環境変数 / 依存追加: なし。

### 12.2 作業順序（コミット単位）

1. **ヘルパ実装 + 単体テスト** — 完了確認: `cd backend && pnpm test src/common/observability` 緑
2. **2 つの Cognito クライアントに適用** — 完了確認: `cd backend && pnpm lint && pnpm test && pnpm build` 通過

### 12.3 テスト方針

- `runWithCognitoMetrics` の単体テスト:
  - 成功時: `logger.log` が `result:'success'` + `latencyMs` の JSON で呼ばれる
  - 失敗時: `logger.warn` が `result:'error'` + `errorCode` + `latencyMs` の JSON で呼ばれ、元の例外が再 throw される
  - latencyMs が 0 以上の数値である
  - errorCode は例外クラス名（カスタムクラスでも動く）
- 既存 spec は変更なしで通ること。

### 12.4 想定外時の判断ルール（タスク固有）

- **AI 単独判断 OK**: 操作名（op 文字列）、JSON フィールド順序、ログレベルの細部。
- **中断して相談**: 既存ログを「置き換え」たくなる場合（本タスクでは追加のみ）、別のロガー（pino 等）への移行案。

### 12.5 事前解決済みの判断ポイント（ドライラン結果）

| # | 判断ポイント | 解決 |
| - | ------------ | ---- |
| 1 | 計装方式 | ヘルパ関数による明示ラップ（デコレータ不使用） |
| 2 | フォーマット | 1 行 JSON（`Logger.log/warn` の message） |
| 3 | op 命名 | SDK コマンドクラス名から `Command` を取り除いた値（明示） |
| 4 | エラーログレベル | 構造化側は `warn`、既存の `error` テキストログは残す |
| 5 | 既存テスト | 影響なし（モック前提のため） |
| 6 | OTel / Prometheus | 本タスク対象外 |
