'use client';

import { useCallback, useEffect, useState } from 'react';
import { ApiError, userApi } from '@/lib/api';
import type { Schemas } from '@/lib/openapi/client';

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
  const [items, setItems] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { limit, offset, q, role, deleted } = query;

  const reload = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await userApi.findPage({
        limit,
        offset,
        q,
        role,
        deleted,
      });
      setItems(data.items);
      setTotal(data.total);
    } catch (e) {
      setError(
        e instanceof ApiError ? e.message : 'データの取得に失敗しました',
      );
    } finally {
      setIsLoading(false);
    }
  }, [limit, offset, q, role, deleted]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload();
  }, [reload]);

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
    items,
    total,
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
