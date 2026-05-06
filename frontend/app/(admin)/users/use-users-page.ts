'use client';

import { useState } from 'react';
import { ApiError } from '@/lib/api';
import { useUsersApi } from '@/lib/api-hooks/use-users-api';
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
  const [modal, setModal] = useState<Modal>(null);
  const api = useUsersApi(tab === 'deleted');

  async function handleDelete(user: User) {
    try {
      await api.remove(user.id);
      setModal(null);
    } catch (e) {
      api.setError(e instanceof ApiError ? e.message : '削除に失敗しました');
    }
  }

  async function handleRestore(user: User) {
    try {
      await api.restore(user.id);
      setModal(null);
    } catch (e) {
      api.setError(e instanceof ApiError ? e.message : '復活に失敗しました');
    }
  }

  async function handleCreate(data: CreateUserRequest) {
    await api.create(data);
    setModal(null);
  }

  async function handleUpdate(id: string, data: UpdateUserRequest) {
    await api.update(id, data);
    setModal(null);
  }

  return {
    tab,
    setTab,
    users: api.users,
    isLoading: api.isLoading,
    error: api.error,
    modal,
    setModal,
    handleDelete,
    handleRestore,
    handleCreate,
    handleUpdate,
  };
}
