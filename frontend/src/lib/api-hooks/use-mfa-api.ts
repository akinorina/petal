'use client';

import { useCallback } from 'react';
import { mfaApi, userApi } from '@/lib/api';
import { useApiResource } from './use-api-resource';

/** MFA の有効状態（GET /users/me 由来）と設定/有効化/解除操作を提供する。 */
export function useMfaApi() {
  const fetcher = useCallback(async () => {
    const me = await userApi.findMe();
    return me.mfaEnabled ?? false;
  }, []);
  const { data, isLoading, error, setError, reload } = useApiResource<boolean>(
    fetcher,
    'MFA 状態の取得に失敗しました',
  );

  const setup = useCallback(() => mfaApi.setup(), []);
  const verify = useCallback((code: string) => mfaApi.verify(code), []);
  const disable = useCallback(() => mfaApi.disable(), []);

  return {
    enabled: data,
    isLoading,
    error,
    setError,
    reload,
    setup,
    verify,
    disable,
  };
}
