/**
 * Cognito SDK 呼び出しの観測性ヘルパ（TSK-27）。
 *
 * すべての `cognitoClient.send(...)` を `runWithCognitoMetrics(op, fn, logger)` で
 * 包むことで、操作ごとの成否・所要時間・エラーコードを 1 行 JSON で出力する。
 *
 * 例:
 * - 成功: `{"msg":"cognito_api","op":"AdminCreateUser","result":"success","latencyMs":123}`
 * - 失敗: `{"msg":"cognito_api","op":"AdminCreateUser","result":"error","latencyMs":456,"errorCode":"UsernameExistsException"}`
 *
 * CloudWatch Logs Insights では `filter msg = "cognito_api" | stats count() by op, result`
 * のように集計できる。
 *
 * 既存挙動を一切変えないため、例外はそのまま再 throw する。
 */

/**
 * NestJS の Logger と pino 互換ロガーの両方を受け入れられる最小インターフェース。
 * 依存方向を internal にしないため、外部の Logger 実装には依存しない。
 */
export interface CognitoMetricsLogger {
  log(message: string): void;
  warn(message: string): void;
}

export async function runWithCognitoMetrics<T>(
  op: string,
  fn: () => Promise<T>,
  logger: CognitoMetricsLogger,
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
    const errorCode = err instanceof Error ? err.constructor.name : typeof err;
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
