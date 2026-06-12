'use client';

import { Alert } from '@/design-system/components/Alert';
import { Button } from '@/design-system/components/Button';
import { Dialog } from '@/design-system/components/Dialog';
import { EmptyState } from '@/design-system/components/EmptyState';
import { Text } from '@/design-system/components/Text';
import type { Schemas } from '@/lib/openapi/client';
import { useChatPage } from './use-chat-page';

type ChatThread = Schemas['ChatThreadResponseDto'];

export default function ChatPage() {
  const {
    threads,
    isLoading,
    error,
    pendingDelete,
    goToNew,
    openThread,
    requestDelete,
    cancelDelete,
    confirmDelete,
  } = useChatPage();

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <Text as="h1" variant="heading-md">
          チャット
        </Text>
        <Button onClick={goToNew}>新規チャット</Button>
      </div>

      {error && (
        <Alert variant="danger" className="mb-4">
          {error}
        </Alert>
      )}

      {isLoading ? (
        <p className="text-sm text-zinc-500">読み込み中...</p>
      ) : threads.length === 0 ? (
        <EmptyState
          title="会話はまだありません"
          description="「新規チャット」から会話を始められます。"
          primaryAction={<Button onClick={goToNew}>新規チャット</Button>}
        />
      ) : (
        <ul className="divide-y divide-zinc-100 rounded-md border border-zinc-200 bg-white">
          {threads.map((thread) => (
            <ThreadRow
              key={thread.id}
              thread={thread}
              onOpen={() => openThread(thread.id)}
              onDelete={() => requestDelete(thread)}
            />
          ))}
        </ul>
      )}

      {pendingDelete && (
        <Dialog open onOpenChange={(o) => !o && cancelDelete()} size="sm">
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>会話を削除</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              <p className="text-sm">
                「{pendingDelete.title ?? '無題の会話'}」を削除しますか？
              </p>
            </Dialog.Body>
            <Dialog.Footer>
              <Button variant="secondary" onClick={cancelDelete}>
                キャンセル
              </Button>
              <Button variant="danger" onClick={confirmDelete}>
                削除する
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog>
      )}
    </div>
  );
}

function ThreadRow({
  thread,
  onOpen,
  onDelete,
}: {
  thread: ChatThread;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const title = thread.title ?? '無題の会話';
  return (
    <li className="group flex items-center justify-between gap-2 px-4 py-3">
      <button
        type="button"
        onClick={onOpen}
        className="flex-1 text-left"
        aria-label={`${title} を開く`}
      >
        <p className="text-sm font-medium">{title}</p>
        <p className="mt-0.5 text-xs text-zinc-400">
          {formatDateTime(thread.createdAt)}
        </p>
      </button>
      <button
        type="button"
        onClick={onDelete}
        aria-label={`${title} を削除`}
        className="rounded-md px-2 py-1 text-xs text-red-600 opacity-0 transition-opacity hover:bg-red-50 group-hover:opacity-100 focus:opacity-100"
      >
        削除
      </button>
    </li>
  );
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString('ja-JP', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}
