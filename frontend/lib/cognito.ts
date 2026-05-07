const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

const ACCESS_TOKEN_KEY = 'petal_access_token';
const REFRESH_TOKEN_KEY = 'petal_refresh_token';
const EMAIL_KEY = 'petal_email';

export const AUTH_CLEARED_EVENT = 'petal:auth-cleared';

type AuthenticatedResponse = {
  status: 'AUTHENTICATED';
  accessToken: string;
  idToken: string;
  refreshToken: string;
  expiresIn: number;
  email: string;
};

type ChallengeResponse = {
  status: 'CHALLENGE';
  challengeName: 'NEW_PASSWORD_REQUIRED';
  session: string;
  email: string;
};

type MfaChallengeResponse = {
  status: 'MFA_REQUIRED';
  challengeName: 'SOFTWARE_TOKEN_MFA';
  session: string;
  email: string;
};

type RefreshResponse = {
  accessToken: string;
  idToken: string;
  expiresIn: number;
  email: string;
};

export type LoginResult =
  | { kind: 'authenticated'; email: string }
  | {
      kind: 'challenge';
      challengeName: 'NEW_PASSWORD_REQUIRED';
      session: string;
      email: string;
    }
  | {
      kind: 'mfa_challenge';
      challengeName: 'SOFTWARE_TOKEN_MFA';
      session: string;
      email: string;
    };

export async function login(
  email: string,
  password: string,
): Promise<LoginResult> {
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.message ?? 'ログインに失敗しました');
  }

  const data: AuthenticatedResponse | ChallengeResponse | MfaChallengeResponse =
    await res.json();

  if (data.status === 'CHALLENGE') {
    return {
      kind: 'challenge',
      challengeName: data.challengeName,
      session: data.session,
      email: data.email,
    };
  }

  if (data.status === 'MFA_REQUIRED') {
    return {
      kind: 'mfa_challenge',
      challengeName: data.challengeName,
      session: data.session,
      email: data.email,
    };
  }

  persistSession(data.accessToken, data.refreshToken, data.email);
  return { kind: 'authenticated', email: data.email };
}

export async function respondMfaChallenge(
  email: string,
  code: string,
  session: string,
): Promise<void> {
  const res = await fetch(`${BASE_URL}/auth/challenge/mfa`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, code, session }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.message ?? 'MFA 認証に失敗しました');
  }
  const data: AuthenticatedResponse = await res.json();
  persistSession(data.accessToken, data.refreshToken, data.email);
}

export async function completeNewPassword(
  email: string,
  newPassword: string,
  session: string,
): Promise<void> {
  const res = await fetch(`${BASE_URL}/auth/challenge/new-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, newPassword, session }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.message ?? 'パスワード設定に失敗しました');
  }

  const data: AuthenticatedResponse = await res.json();
  persistSession(data.accessToken, data.refreshToken, data.email);
}

export async function logout(): Promise<void> {
  const token = localStorage.getItem(ACCESS_TOKEN_KEY);
  try {
    if (token) {
      await fetch(`${BASE_URL}/auth/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
    }
  } catch {
    // ネットワーク失敗等はローカル状態クリアを優先するため握り潰す
  } finally {
    clearSession();
  }
}

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

function persistSession(
  accessToken: string,
  refreshToken: string,
  email: string,
): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  localStorage.setItem(EMAIL_KEY, email);
}

function clearSession(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(EMAIL_KEY);
  window.dispatchEvent(new Event(AUTH_CLEARED_EVENT));
}

export async function requestPasswordReset(email: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.message ?? 'パスワードリセット要求に失敗しました');
  }
}

export async function confirmPasswordReset(
  email: string,
  code: string,
  newPassword: string,
): Promise<void> {
  const res = await fetch(`${BASE_URL}/auth/confirm-forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, code, newPassword }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.message ?? 'パスワード設定に失敗しました');
  }
}

function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp * 1000 < Date.now();
  } catch {
    return true;
  }
}
