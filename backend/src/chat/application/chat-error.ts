import { HttpStatus } from '@nestjs/common';

// LLM 生成に関するエラーコード。フロントはこの code と retryable で
// リトライ可否を判断する。
export type ChatErrorCode =
  | 'LLM_UPSTREAM_UNAVAILABLE' // 接続失敗/タイムアウト/上流5xx（retryable: true）
  | 'LLM_RATE_LIMITED' // 上流429（retryable: true）
  | 'LLM_BAD_REQUEST' // 上流4xx（モデル不在等・retryable: false）
  | 'LLM_GENERATION_FAILED'; // その他（retryable: true）

export interface ClassifiedChatError {
  code: ChatErrorCode;
  // 日本語の汎用メッセージ。上流エラー本文・接続先 URL は載せない。
  message: string;
  retryable: boolean;
  // ストリーム開始前エラー時に使う HTTP ステータス（429 or 502）。
  httpStatus: number;
}

// 上流エラーをダックタイピング（status/code/message）で読むための形。
// openai 型を application に import しない（オニオン維持）。
interface DuckTypedError {
  status?: number;
  code?: string;
  message?: string;
}

function asDuckTypedError(err: unknown): DuckTypedError {
  if (typeof err !== 'object' || err === null) {
    return {};
  }
  const record = err as Record<string, unknown>;
  const status = typeof record.status === 'number' ? record.status : undefined;
  const code = typeof record.code === 'string' ? record.code : undefined;
  const message =
    typeof record.message === 'string' ? record.message : undefined;
  return { status, code, message };
}

const CONNECTION_ERROR_CODES = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'ETIMEDOUT',
  'ENOTFOUND',
  'EAI_AGAIN',
  'EPIPE',
]);

// 上流エラーを分類する。秘密情報（接続先 URL・上流本文）を返さない。
export function classifyLlmError(err: unknown): ClassifiedChatError {
  const { status, code } = asDuckTypedError(err);

  if (status === HttpStatus.TOO_MANY_REQUESTS) {
    return {
      code: 'LLM_RATE_LIMITED',
      message: 'LLM サーバが混雑しています。しばらくして再試行してください',
      retryable: true,
      httpStatus: HttpStatus.TOO_MANY_REQUESTS,
    };
  }

  if (typeof status === 'number' && status >= 500) {
    return {
      code: 'LLM_UPSTREAM_UNAVAILABLE',
      message: 'LLM サーバでエラーが発生しました',
      retryable: true,
      httpStatus: HttpStatus.BAD_GATEWAY,
    };
  }

  if (typeof status === 'number' && status >= 400) {
    return {
      code: 'LLM_BAD_REQUEST',
      message: 'リクエストを処理できませんでした',
      retryable: false,
      httpStatus: HttpStatus.BAD_GATEWAY,
    };
  }

  if (code !== undefined && CONNECTION_ERROR_CODES.has(code)) {
    return {
      code: 'LLM_UPSTREAM_UNAVAILABLE',
      message: 'LLM サーバに接続できません',
      retryable: true,
      httpStatus: HttpStatus.BAD_GATEWAY,
    };
  }

  return {
    code: 'LLM_GENERATION_FAILED',
    message: '応答の生成に失敗しました',
    retryable: true,
    httpStatus: HttpStatus.BAD_GATEWAY,
  };
}
