import { resolveApiBaseUrl } from './api-base-url';

// 認証前エンドポイント（ログイン/サインアップ/パスワードリセット等）や、
// openapi-fetch のミドルウェア（トークン付与・401 リトライ）を通したくない
// リクエスト用の薄い fetch ヘルパ。`@/lib/api` の `apiClient` はトークン更新を
// 行うため、refresh 自体やトークン取得前の呼び出しはこちらを使う。
export const BASE_URL = resolveApiBaseUrl();

type RequestJsonInit = {
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  /** JSON ボディ。指定時のみ Content-Type を付与する。 */
  body?: unknown;
  /** Authorization: Bearer に付与するアクセストークン。 */
  token?: string;
  /** ステータス NG かつボディに message が無いときのフォールバック文言。 */
  fallbackMessage?: string;
};

/**
 * JSON API を呼び出し、成功時はパース済みボディを返す。失敗時はサーバの
 * `message`（無ければ `fallbackMessage`）で Error を throw する。
 * レスポンスボディが空（204 等）の場合は undefined を返す。
 */
export async function requestJson<T = unknown>(
  path: string,
  init: RequestJsonInit,
): Promise<T> {
  const headers: Record<string, string> = {};
  if (init.body !== undefined) headers['Content-Type'] = 'application/json';
  if (init.token) headers.Authorization = `Bearer ${init.token}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    method: init.method,
    headers,
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const message =
      (data as { message?: unknown })?.message ??
      init.fallbackMessage ??
      'リクエストに失敗しました';
    throw new Error(typeof message === 'string' ? message : String(message));
  }

  return (await res.json().catch(() => undefined)) as T;
}
