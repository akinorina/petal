'use client';

import { Alert } from '@/design-system/components/Alert';
import { Card } from '@/design-system/components/Card';
import { EmptyState } from '@/design-system/components/EmptyState';
import { Pagination } from '@/design-system/components/Pagination';
import { Text } from '@/design-system/components/Text';
import { useAuditLogsPage } from './use-audit-logs-page';

export default function AuditLogsPage() {
  const {
    items,
    total,
    isLoading,
    error,
    page,
    pageSize,
    hasPrev,
    hasNext,
    next,
    prev,
  } = useAuditLogsPage();

  const currentPage = page + 1; // 1-indexed for Pagination
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Text as="h1" variant="heading-md">監査ログ</Text>
        <p className="text-xs text-zinc-500">
          {total} 件中 {page * pageSize + 1}–{page * pageSize + items.length}
        </p>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}

      {isLoading ? (
        <p className="text-sm text-zinc-500">読み込み中...</p>
      ) : items.length === 0 ? (
        <Card padding="none">
          <EmptyState
            title="監査ログはまだありません"
            description="ユーザー管理操作が行われると、ここに履歴が記録されます。"
          />
        </Card>
      ) : (
        <Card padding="none" className="overflow-x-auto">
          <table className="min-w-full divide-y divide-zinc-200 text-sm">
            <thead className="bg-zinc-50 text-xs uppercase tracking-wider text-zinc-500">
              <tr>
                <th className="px-3 py-2 text-left">日時</th>
                <th className="px-3 py-2 text-left">アクション</th>
                <th className="px-3 py-2 text-left">操作者 ID</th>
                <th className="px-3 py-2 text-left">対象 ID</th>
                <th className="px-3 py-2 text-left">詳細</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 bg-white">
              {items.map((log) => (
                <tr key={log.id}>
                  <td className="whitespace-nowrap px-3 py-2 text-zinc-700">
                    {new Date(log.createdAt).toLocaleString('ja-JP')}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 font-mono text-xs">
                    {log.action}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-zinc-500">
                    {log.actorUserId}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-zinc-500">
                    {log.targetUserId ?? '-'}
                  </td>
                  <td className="px-3 py-2 text-xs text-zinc-700">
                    <pre className="max-w-md whitespace-pre-wrap break-words font-mono">
                      {log.metadata
                        ? JSON.stringify(log.metadata, null, 2)
                        : '-'}
                    </pre>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {(hasPrev || hasNext) && (
        <div className="flex justify-end">
          <Pagination
            variant="simple"
            page={currentPage}
            totalPages={totalPages}
            ariaLabel="監査ログのページ"
            onChange={(p) => {
              if (p > currentPage) next();
              else if (p < currentPage) prev();
            }}
          />
        </div>
      )}
    </div>
  );
}
