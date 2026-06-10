'use client';

import { useCallback } from 'react';
import { userApi } from '@/lib/api';
import type { Schemas } from '@/lib/openapi/client';
import { useApiResource } from './use-api-resource';

type User = Schemas['UserResponseDto'];
type CreateUserRequest = Schemas['CreateUserRequestDto'];
type UpdateUserRequest = Schemas['UpdateUserRequestDto'];

export type UsersQuery = {
  limit: number;
  offset: number;
  q?: string;
  role?: 'admin' | 'user';
  deleted: boolean;
};

export function useUsersApi(query: UsersQuery) {
  const { limit, offset, q, role, deleted } = query;

  const fetcher = useCallback(
    () => userApi.findPage({ limit, offset, q, role, deleted }),
    [limit, offset, q, role, deleted],
  );
  const { data, isLoading, error, setError, reload } =
    useApiResource<{ items: User[]; total: number }>(fetcher);

  const create = useCallback(
    async (data: CreateUserRequest) => {
      await userApi.create(data);
      await reload();
    },
    [reload],
  );

  const update = useCallback(
    async (id: string, data: UpdateUserRequest) => {
      await userApi.update(id, data);
      await reload();
    },
    [reload],
  );

  const remove = useCallback(
    async (id: string) => {
      await userApi.remove(id);
      await reload();
    },
    [reload],
  );

  const restore = useCallback(
    async (id: string) => {
      await userApi.restore(id);
      await reload();
    },
    [reload],
  );

  const resendInvite = useCallback(
    async (id: string) => {
      await userApi.resendInvite(id);
      await reload();
    },
    [reload],
  );

  return {
    items: data?.items ?? [],
    total: data?.total ?? 0,
    isLoading,
    error,
    setError,
    reload,
    create,
    update,
    remove,
    restore,
    resendInvite,
  };
}
