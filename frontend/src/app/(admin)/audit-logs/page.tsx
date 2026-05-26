'use client';

import { Button } from '@/design-system/components/Button';
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Text as="h1" variant="heading-md">監査ログ</Text>
        <p className="text-xs text-zinc-500">
          {total} 件中 {page * pageSize + 1}–{page * pageSize + items.length}
        </p>
      </div>

      {error && (
        <p className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {isLoading ? (
        <p className="text-sm text-zinc-500">読み込み中...</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-zinc-500">監査ログはまだありません。</p>
      ) : (
        <div className="overflow-x-auto rounded border border-zinc-200">
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
        </div>
      )}

      <div className="flex items-center justify-end gap-2">
        <Button
          variant="secondary"
          size="sm"
          disabled={!hasPrev}
          onClick={prev}
        >
          前へ
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={!hasNext}
          onClick={next}
        >
          次へ
        </Button>
      </div>
    </div>
  );
}
