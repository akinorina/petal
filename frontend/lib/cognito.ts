const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

const ACCESS_TOKEN_KEY = 'petal_access_token';
const EMAIL_KEY = 'petal_email';

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

export type LoginResult =
  | { kind: 'authenticated'; email: string }
  | {
      kind: 'challenge';
      challengeName: 'NEW_PASSWORD_REQUIRED';
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

  const data: AuthenticatedResponse | ChallengeResponse = await res.json();

  if (data.status === 'CHALLENGE') {
    return {
      kind: 'challenge',
      challengeName: data.challengeName,
      session: data.session,
      email: data.email,
    };
  }

  persistSession(data.accessToken, data.email);
  return { kind: 'authenticated', email: data.email };
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
  persistSession(data.accessToken, data.email);
}

export function logout(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(EMAIL_KEY);
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

function persistSession(accessToken: string, email: string): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(EMAIL_KEY, email);
}

function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp * 1000 < Date.now();
  } catch {
    return true;
  }
}
