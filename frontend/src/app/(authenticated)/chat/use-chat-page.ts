'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ApiError } from '@/lib/api';
import { useChatThreadsApi } from '@/lib/api-hooks/use-chat-api';
import type { Schemas } from '@/lib/openapi/client';

type ChatThread = Schemas['ChatThreadResponseDto'];

export function useChatPage() {
  const router = useRouter();
  const api = useChatThreadsApi();
  const [pendingDelete, setPendingDelete] = useState<ChatThread | null>(null);

  function goToNew() {
    router.push('/chat/new');
  }

  function openThread(threadId: string) {
    router.push(`/chat/${threadId}`);
  }

  function requestDelete(thread: ChatThread) {
    setPendingDelete(thread);
  }

  function cancelDelete() {
    setPendingDelete(null);
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    try {
      await api.remove(pendingDelete.id);
      setPendingDelete(null);
    } catch (e) {
      api.setError(e instanceof ApiError ? e.message : '削除に失敗しました');
      setPendingDelete(null);
    }
  }

  return {
    threads: api.threads,
    isLoading: api.isLoading,
    error: api.error,
    pendingDelete,
    goToNew,
    openThread,
    requestDelete,
    cancelDelete,
    confirmDelete,
  };
}
