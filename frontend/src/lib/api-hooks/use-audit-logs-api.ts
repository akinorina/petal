'use client';

import { useCallback } from 'react';
import { auditLogApi } from '@/lib/api';
import type { Schemas } from '@/lib/openapi/client';
import { useApiResource } from './use-api-resource';

type AuditLog = Schemas['AuditLogResponseDto'];

export function useAuditLogsApi(limit: number, offset: number) {
  const fetcher = useCallback(
    () => auditLogApi.findAll({ limit, offset }),
    [limit, offset],
  );
  const { data, isLoading, error, reload } =
    useApiResource<{ items: AuditLog[]; total: number }>(fetcher);

  return {
    items: data?.items ?? [],
    total: data?.total ?? 0,
    isLoading,
    error,
    reload,
  };
}
