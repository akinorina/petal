'use client';

import { useMemo } from 'react';
import { resolveApiBaseUrl } from '@/lib/api-base-url';
import {
  clearSession,
  getStoredAccessToken,
  persistSession,
} from '@/lib/auth-session';

const BASE_URL = resolveApiBaseUrl();

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

async function login(email: string, password: string): Promise<LoginResult> {
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

async function respondMfaChallenge(
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

async function completeNewPassword(
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

async function logout(): Promise<void> {
  const token = getStoredAccessToken();
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

async function requestPasswordReset(email: string): Promise<void> {
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

async function confirmPasswordReset(
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

export function useAuthApi() {
  return useMemo(
    () => ({
      login,
      completeNewPassword,
      respondMfaChallenge,
      logout,
      requestPasswordReset,
      confirmPasswordReset,
    }),
    [],
  );
}
