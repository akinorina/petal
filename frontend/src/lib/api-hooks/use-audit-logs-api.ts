'use client';

import { useCallback, useEffect, useState } from 'react';
import { ApiError, auditLogApi } from '@/lib/api';
import type { Schemas } from '@/lib/openapi/client';

type AuditLog = Schemas['AuditLogResponseDto'];

export function useAuditLogsApi(limit: number, offset: number) {
  const [items, setItems] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await auditLogApi.findAll({ limit, offset });
      setItems(data.items);
      setTotal(data.total);
    } catch (e) {
      setError(
        e instanceof ApiError ? e.message : 'データの取得に失敗しました',
      );
    } finally {
      setIsLoading(false);
    }
  }, [limit, offset]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { items, total, isLoading, error, reload };
}
