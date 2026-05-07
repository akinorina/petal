'use client';

import { useMemo } from 'react';
import {
  completeNewPassword,
  confirmPasswordReset,
  login,
  logout,
  requestPasswordReset,
  respondMfaChallenge,
  type LoginResult,
} from '@/lib/cognito';

export type { LoginResult };

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
