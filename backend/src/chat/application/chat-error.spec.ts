import { HttpStatus } from '@nestjs/common';
import { classifyLlmError } from './chat-error';

describe('classifyLlmError', () => {
  it('非オブジェクト入力（null）は LLM_GENERATION_FAILED にフォールバックする', () => {
    const result = classifyLlmError(null);

    expect(result.code).toBe('LLM_GENERATION_FAILED');
    expect(result.retryable).toBe(true);
    expect(result.httpStatus).toBe(HttpStatus.BAD_GATEWAY);
  });

  it('非オブジェクト入力（文字列）は LLM_GENERATION_FAILED にフォールバックする', () => {
    const result = classifyLlmError('boom');

    expect(result.code).toBe('LLM_GENERATION_FAILED');
    expect(result.retryable).toBe(true);
  });

  it('status 429 は LLM_RATE_LIMITED（retryable・httpStatus 429）に分類する', () => {
    const result = classifyLlmError({ status: 429 });

    expect(result.code).toBe('LLM_RATE_LIMITED');
    expect(result.retryable).toBe(true);
    expect(result.httpStatus).toBe(HttpStatus.TOO_MANY_REQUESTS);
  });

  it('status 5xx は LLM_UPSTREAM_UNAVAILABLE（retryable・httpStatus 502）に分類する', () => {
    const result = classifyLlmError({ status: 503 });

    expect(result.code).toBe('LLM_UPSTREAM_UNAVAILABLE');
    expect(result.retryable).toBe(true);
    expect(result.httpStatus).toBe(HttpStatus.BAD_GATEWAY);
  });

  it('status 4xx（429 以外）は LLM_BAD_REQUEST（retryable false・httpStatus 502）に分類する', () => {
    const result = classifyLlmError({ status: 400 });

    expect(result.code).toBe('LLM_BAD_REQUEST');
    expect(result.retryable).toBe(false);
    expect(result.httpStatus).toBe(HttpStatus.BAD_GATEWAY);
  });

  it('接続エラーコード（ECONNREFUSED 等・status 無し）は LLM_UPSTREAM_UNAVAILABLE に分類する', () => {
    const result = classifyLlmError({
      code: 'ECONNREFUSED',
      message: 'failed',
    });

    expect(result.code).toBe('LLM_UPSTREAM_UNAVAILABLE');
    expect(result.retryable).toBe(true);
    expect(result.httpStatus).toBe(HttpStatus.BAD_GATEWAY);
  });

  it('status も既知の接続コードも無い場合は LLM_GENERATION_FAILED にフォールバックする', () => {
    const result = classifyLlmError({ code: 'EUNKNOWN', message: 'other' });

    expect(result.code).toBe('LLM_GENERATION_FAILED');
    expect(result.retryable).toBe(true);
    expect(result.httpStatus).toBe(HttpStatus.BAD_GATEWAY);
  });

  it('秘密情報（上流本文・接続先 URL）をメッセージに含めない', () => {
    const result = classifyLlmError({
      status: 500,
      message: 'connect ECONNREFUSED 10.0.0.1:1234 secret-body',
    });

    expect(result.message).not.toContain('10.0.0.1');
    expect(result.message).not.toContain('secret-body');
  });
});
