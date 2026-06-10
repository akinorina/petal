import { apiClient, type Schemas } from '../openapi/client';

export { apiClient };
export type { Schemas };

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function unwrap<T>(
  promise: Promise<{ data?: T; error?: unknown; response: Response }>,
): Promise<T> {
  const { data, error, response } = await promise;
  if (!response.ok) {
    // openapi-fetch はレスポンスボディを既に消費しているため、
    // response.clone() は使わず、パース済みの error からメッセージを取り出す。
    const message =
      messageFromError(error) || response.statusText || 'リクエストに失敗しました';
    throw new ApiError(response.status, message);
  }
  return data as T;
}

function messageFromError(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string') return message;
  }
  return '';
}
