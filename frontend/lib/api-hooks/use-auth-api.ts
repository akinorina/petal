'use client';

import { useMemo } from 'react';
import {
  completeNewPassword,
  confirmPasswordReset,
  login,
  logout,
  requestPasswordReset,
  type LoginResult,
} from '@/lib/cognito';

export type { LoginResult };

export function useAuthApi() {
  return useMemo(
    () => ({
      login,
      completeNewPassword,
      logout,
      requestPasswordReset,
      confirmPasswordReset,
    }),
    [],
  );
}
