'use client';

import { useState } from 'react';
import { useAuditLogsApi } from '@/lib/api-hooks/use-audit-logs-api';

const PAGE_SIZE = 20;

export function useAuditLogsPage() {
  const [page, setPage] = useState(0);
  const offset = page * PAGE_SIZE;
  const { items, total, isLoading, error } = useAuditLogsApi(
    PAGE_SIZE,
    offset,
  );

  const hasPrev = page > 0;
  const hasNext = offset + items.length < total;

  return {
    items,
    total,
    isLoading,
    error,
    page,
    pageSize: PAGE_SIZE,
    hasPrev,
    hasNext,
    next: () => setPage((p) => p + 1),
    prev: () => setPage((p) => Math.max(0, p - 1)),
  };
}
