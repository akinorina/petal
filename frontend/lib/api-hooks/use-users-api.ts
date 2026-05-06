'use client';

import { useCallback, useEffect, useState } from 'react';
import { ApiError, userApi } from '@/lib/api';
import type { Schemas } from '@/lib/openapi/client';

type User = Schemas['UserResponseDto'];
type CreateUserRequest = Schemas['CreateUserRequestDto'];
type UpdateUserRequest = Schemas['UpdateUserRequestDto'];

export function useUsersApi(deleted: boolean) {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await userApi.findAll({ deleted });
      setUsers(data);
    } catch (e) {
      setError(
        e instanceof ApiError ? e.message : 'データの取得に失敗しました',
      );
    } finally {
      setIsLoading(false);
    }
  }, [deleted]);

  useEffect(() => {
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

  return {
    users,
    isLoading,
    error,
    setError,
    reload,
    create,
    update,
    remove,
    restore,
  };
}
