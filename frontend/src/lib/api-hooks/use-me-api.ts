'use client';

import { useCallback, useMemo } from 'react';
import { authApi, userApi } from '@/lib/api';
import type { Schemas } from '@/lib/openapi/client';
import { useApiResource } from './use-api-resource';

type Me = Schemas['UserResponseDto'];
type UpdateMyProfileRequest = Schemas['UpdateMyProfileRequestDto'];
type ChangePasswordRequest = Schemas['ChangePasswordRequestDto'];

/** マイプロフィール（GET /users/me）の取得状態と更新操作を提供する。 */
export function useMeApi() {
  const fetcher = useCallback(() => userApi.findMe(), []);
  const { data, isLoading, error, setError, reload } = useApiResource<Me>(
    fetcher,
    'プロフィールの取得に失敗しました',
  );

  const updateProfile = useCallback(
    (body: UpdateMyProfileRequest) => userApi.updateMyProfile(body),
    [],
  );

  return { me: data, isLoading, error, setError, reload, updateProfile };
}

/**
 * 現在のユーザー（GET /users/me）を命令的に取得する操作フック。
 * AuthContext のようにマウント時の自動取得ではなく、任意のタイミングで
 * role などを取り直したい用途に使う。
 */
export function useCurrentUserApi() {
  return useMemo(() => ({ findMe: () => userApi.findMe() }), []);
}

/** パスワード変更（POST /auth/change-password）のみを提供する操作フック。 */
export function useMePasswordApi() {
  return useMemo(
    () => ({
      changePassword: (body: ChangePasswordRequest) =>
        authApi.changePassword(body),
    }),
    [],
  );
}
