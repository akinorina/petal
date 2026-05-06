'use client';

import { useCallback, useEffect, useState } from 'react';
import { ApiError, userApi } from '@/lib/api';
import type { Schemas } from '@/lib/openapi/client';

type User = Schemas['UserResponseDto'];
type CreateUserRequest = Schemas['CreateUserRequestDto'];
type UpdateUserRequest = Schemas['UpdateUserRequestDto'];

export type Modal =
  | { type: 'create' }
  | { type: 'edit'; user: User }
  | { type: 'delete'; user: User }
  | { type: 'restore'; user: User }
  | null;

export type Tab = 'active' | 'deleted';

export function useUsersPage() {
  const [tab, setTab] = useState<Tab>('active');
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<Modal>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      setError(null);
      const data = await userApi.findAll({ deleted: tab === 'deleted' });
      setUsers(data);
    } catch (e) {
      setError(
        e instanceof ApiError ? e.message : 'データの取得に失敗しました',
      );
    } finally {
      setIsLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleDelete(user: User) {
    try {
      await userApi.remove(user.id);
      setModal(null);
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '削除に失敗しました');
    }
  }

  async function handleRestore(user: User) {
    try {
      await userApi.restore(user.id);
      setModal(null);
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '復活に失敗しました');
    }
  }

  async function handleCreate(data: CreateUserRequest) {
    await userApi.create(data);
    setModal(null);
    await load();
  }

  async function handleUpdate(id: string, data: UpdateUserRequest) {
    await userApi.update(id, data);
    setModal(null);
    await load();
  }

  return {
    tab,
    setTab,
    users,
    isLoading,
    error,
    modal,
    setModal,
    handleDelete,
    handleRestore,
    handleCreate,
    handleUpdate,
  };
}
