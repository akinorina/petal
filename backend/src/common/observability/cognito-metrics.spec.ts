import { CognitoMetricsLogger, runWithCognitoMetrics } from './cognito-metrics';

type MetricsPayload = {
  msg: string;
  op: string;
  result: 'success' | 'error';
  latencyMs: number;
  errorCode?: string;
};

class UserNotFoundException extends Error {
  constructor() {
    super('user not found');
    this.name = 'UserNotFoundException';
  }
}

function buildLogger(): {
  log: jest.Mock<void, [string]>;
  warn: jest.Mock<void, [string]>;
} & CognitoMetricsLogger {
  return {
    log: jest.fn<void, [string]>(),
    warn: jest.fn<void, [string]>(),
  };
}

function parsePayload(message: string | undefined): MetricsPayload {
  if (message === undefined) {
    throw new Error('logger was not called');
  }
  return JSON.parse(message) as MetricsPayload;
}

describe('runWithCognitoMetrics', () => {
  it('成功時: result=success と latencyMs を 1 行 JSON で log する', async () => {
    const logger = buildLogger();
    const result = await runWithCognitoMetrics(
      'AdminCreateUser',
      () => Promise.resolve('ok'),
      logger,
    );

    expect(result).toBe('ok');
    expect(logger.log).toHaveBeenCalledTimes(1);
    expect(logger.warn).not.toHaveBeenCalled();

    const payload = parsePayload(logger.log.mock.calls[0]?.[0]);
    expect(payload.msg).toBe('cognito_api');
    expect(payload.op).toBe('AdminCreateUser');
    expect(payload.result).toBe('success');
    expect(typeof payload.latencyMs).toBe('number');
    expect(payload.latencyMs).toBeGreaterThanOrEqual(0);
    expect(payload.errorCode).toBeUndefined();
  });

  it('失敗時: result=error と errorCode（例外クラス名）を warn し、例外を再 throw する', async () => {
    const logger = buildLogger();
    const thrown = new UserNotFoundException();

    await expect(
      runWithCognitoMetrics(
        'AdminGetUser',
        () => Promise.reject(thrown),
        logger,
      ),
    ).rejects.toBe(thrown);

    expect(logger.log).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledTimes(1);

    const payload = parsePayload(logger.warn.mock.calls[0]?.[0]);
    expect(payload.msg).toBe('cognito_api');
    expect(payload.op).toBe('AdminGetUser');
    expect(payload.result).toBe('error');
    expect(payload.errorCode).toBe('UserNotFoundException');
    expect(typeof payload.latencyMs).toBe('number');
    expect(payload.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('非 Error の throw でも errorCode に typeof が入る', async () => {
    const logger = buildLogger();

    // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
    const promise = Promise.reject('string-throw');
    await expect(
      runWithCognitoMetrics('InitiateAuth', () => promise, logger),
    ).rejects.toBe('string-throw');

    const payload = parsePayload(logger.warn.mock.calls[0]?.[0]);
    expect(payload.errorCode).toBe('string');
  });

  it('latencyMs は経過時間を反映する', async () => {
    const logger = buildLogger();

    await runWithCognitoMetrics(
      'GetUser',
      async () => {
        await new Promise((resolve) => setTimeout(resolve, 30));
      },
      logger,
    );

    const payload = parsePayload(logger.log.mock.calls[0]?.[0]);
    expect(payload.latencyMs).toBeGreaterThanOrEqual(25);
  });
});
