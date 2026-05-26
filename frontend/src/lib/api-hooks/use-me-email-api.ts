'use client';

import { useMemo } from 'react';
import { userApi } from '@/lib/api';

export function useMeEmailApi() {
  return useMemo(
    () => ({
      requestEmailChange: (email: string) => userApi.requestEmailChange(email),
      confirmEmailChange: (code: string) => userApi.confirmEmailChange(code),
    }),
    [],
  );
}
