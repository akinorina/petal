import { resolveApiBaseUrl } from './api-base-url';

const BASE_URL = resolveApiBaseUrl();

const ACCESS_TOKEN_KEY = 'petal_access_token';
const REFRESH_TOKEN_KEY = 'petal_refresh_token';
const EMAIL_KEY = 'petal_email';

export const AUTH_CLEARED_EVENT = 'petal:auth-cleared';

type RefreshResponse = {
  accessToken: string;
  idToken: string;
  expiresIn: number;
  email: string;
};

export function getAccessToken(): Promise<string | null> {
  if (typeof window === 'undefined') return Promise.resolve(null);
  const token = localStorage.getItem(ACCESS_TOKEN_KEY);
  if (!token) return Promise.resolve(null);
  if (isTokenExpired(token)) {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    return Promise.resolve(null);
  }
  return Promise.resolve(token);
}

export function getCurrentUserEmail(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(EMAIL_KEY);
}

export function setCurrentUserEmail(email: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(EMAIL_KEY, email);
}

/**
 * 保存済みリフレッシュトークンで新しいアクセストークンを取得する。
 * 成功したら localStorage を更新して新トークンを返す。失敗（refresh token
 * 期限切れ・通信エラー等）はローカル状態をクリアして null を返し、
 * AUTH_CLEARED_EVENT を発火する。
 */
export async function refreshAccessToken(): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
  const email = localStorage.getItem(EMAIL_KEY);
  if (!refreshToken || !email) {
    clearSession();
    return null;
  }

  try {
    const res = await fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken, email }),
    });
    if (!res.ok) {
      clearSession();
      return null;
    }
    const data: RefreshResponse = await res.json();
    localStorage.setItem(ACCESS_TOKEN_KEY, data.accessToken);
    return data.accessToken;
  } catch {
    clearSession();
    return null;
  }
}

export function persistSession(
  accessToken: string,
  refreshToken: string,
  email: string,
): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  localStorage.setItem(EMAIL_KEY, email);
}

export function clearSession(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(EMAIL_KEY);
  window.dispatchEvent(new Event(AUTH_CLEARED_EVENT));
}

export function getStoredAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp * 1000 < Date.now();
  } catch {
    return true;
  }
}
