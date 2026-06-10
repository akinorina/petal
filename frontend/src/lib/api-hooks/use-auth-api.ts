'use client';

import { useMemo } from 'react';
import { requestJson } from '@/lib/http';
import {
  clearSession,
  getStoredAccessToken,
  persistSession,
} from '@/lib/auth-session';

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
  const data = await requestJson<
    AuthenticatedResponse | ChallengeResponse | MfaChallengeResponse
  >('/auth/login', {
    method: 'POST',
    body: { email, password },
    fallbackMessage: 'ログインに失敗しました',
  });

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
  const data = await requestJson<AuthenticatedResponse>(
    '/auth/challenge/mfa',
    {
      method: 'POST',
      body: { email, code, session },
      fallbackMessage: 'MFA 認証に失敗しました',
    },
  );
  persistSession(data.accessToken, data.refreshToken, data.email);
}

async function completeNewPassword(
  email: string,
  newPassword: string,
  session: string,
): Promise<void> {
  const data = await requestJson<AuthenticatedResponse>(
    '/auth/challenge/new-password',
    {
      method: 'POST',
      body: { email, newPassword, session },
      fallbackMessage: 'パスワード設定に失敗しました',
    },
  );
  persistSession(data.accessToken, data.refreshToken, data.email);
}

async function logout(): Promise<void> {
  const token = getStoredAccessToken();
  try {
    if (token) {
      await requestJson('/auth/logout', { method: 'POST', token });
    }
  } catch {
    // ネットワーク失敗等はローカル状態クリアを優先するため握り潰す
  } finally {
    clearSession();
  }
}

async function signup(
  email: string,
  password: string,
  name: string,
  nameKana: string,
): Promise<void> {
  await requestJson('/auth/signup', {
    method: 'POST',
    body: { email, password, name, nameKana },
    fallbackMessage: 'サインアップに失敗しました',
  });
}

async function confirmSignup(
  email: string,
  code: string,
  name: string,
  nameKana: string,
): Promise<void> {
  await requestJson('/auth/confirm-signup', {
    method: 'POST',
    body: { email, code, name, nameKana },
    fallbackMessage: 'サインアップの確定に失敗しました',
  });
}

async function requestPasswordReset(email: string): Promise<void> {
  await requestJson('/auth/forgot-password', {
    method: 'POST',
    body: { email },
    fallbackMessage: 'パスワードリセット要求に失敗しました',
  });
}

async function confirmPasswordReset(
  email: string,
  code: string,
  newPassword: string,
): Promise<void> {
  await requestJson('/auth/confirm-forgot-password', {
    method: 'POST',
    body: { email, code, newPassword },
    fallbackMessage: 'パスワード設定に失敗しました',
  });
}

async function getSignupConfig(): Promise<{ enabled: boolean }> {
  return requestJson<{ enabled: boolean }>('/auth/signup-config', {
    method: 'GET',
    fallbackMessage: 'サインアップ設定の取得に失敗しました',
  });
}

export function useAuthApi() {
  return useMemo(
    () => ({
      login,
      completeNewPassword,
      respondMfaChallenge,
      logout,
      signup,
      confirmSignup,
      getSignupConfig,
      requestPasswordReset,
      confirmPasswordReset,
    }),
    [],
  );
}
