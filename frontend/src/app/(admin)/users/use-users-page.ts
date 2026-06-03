'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
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
export type RoleFilter = 'all' | 'admin' | 'user';

export const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 300;

function parseTab(value: string | null): Tab {
  return value === 'true' ? 'deleted' : 'active';
}

function parseRole(value: string | null): RoleFilter {
  return value === 'admin' || value === 'user' ? value : 'all';
}

function parsePage(value: string | null): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}

export function useUsersPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const tab = parseTab(searchParams.get('deleted'));
  const roleFilter = parseRole(searchParams.get('role'));
  const page = parsePage(searchParams.get('page'));
  const urlQ = searchParams.get('q') ?? '';

  const [searchInput, setSearchInput] = useState(urlQ);
  const [modal, setModal] = useState<Modal>(null);

  const query = useMemo(
    () => ({
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
      q: urlQ.trim() || undefined,
      role: roleFilter === 'all' ? undefined : roleFilter,
      deleted: tab === 'deleted',
    }),
    [page, urlQ, roleFilter, tab],
  );

  const api = useUsersApi(query);

  const updateQuery = useCallback(
    (patch: { tab?: Tab; role?: RoleFilter; q?: string; page?: number }) => {
      const next = new URLSearchParams(searchParams.toString());

      if (patch.tab !== undefined) {
        if (patch.tab === 'deleted') next.set('deleted', 'true');
        else next.delete('deleted');
      }

      if (patch.role !== undefined) {
        if (patch.role === 'all') next.delete('role');
        else next.set('role', patch.role);
      }

      if (patch.q !== undefined) {
        const trimmed = patch.q.trim();
        if (trimmed === '') next.delete('q');
        else next.set('q', trimmed);
      }

      const nextPage =
        patch.page ??
        (patch.tab !== undefined ||
        patch.role !== undefined ||
        patch.q !== undefined
          ? 1
          : page);
      if (nextPage <= 1) next.delete('page');
      else next.set('page', String(nextPage));

      router.replace(`?${next.toString()}`);
    },
    [router, searchParams, page],
  );

  useEffect(() => {
    setSearchInput(urlQ);
  }, [urlQ]);

  useEffect(() => {
    if (searchInput === urlQ) return;
    const t = setTimeout(() => {
      updateQuery({ q: searchInput, page: 1 });
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [searchInput, urlQ, updateQuery]);

  const setTab = useCallback(
    (next: Tab) => updateQuery({ tab: next, page: 1 }),
    [updateQuery],
  );

  const setRoleFilter = useCallback(
    (next: RoleFilter) => updateQuery({ role: next, page: 1 }),
    [updateQuery],
  );

  const setPage = useCallback(
    (next: number) => updateQuery({ page: next }),
    [updateQuery],
  );

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

  const totalPages = Math.max(1, Math.ceil(api.total / PAGE_SIZE));

  return {
    tab,
    setTab,
    roleFilter,
    setRoleFilter,
    searchInput,
    setSearchInput,
    page,
    setPage,
    totalPages,
    pageSize: PAGE_SIZE,
    items: api.items,
    total: api.total,
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
