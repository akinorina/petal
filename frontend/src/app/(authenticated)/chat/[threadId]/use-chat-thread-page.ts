'use client';

import { useParams } from 'next/navigation';
import { useChatThreadsApi } from '@/lib/api-hooks/use-chat-api';

/**
 * 既存スレッドページのロジック。会話の配線は `<ChatPanel>` が担う。
 * ここでは URL から `threadId` を取り出し、スレッド一覧（`useChatThreadsApi`）から
 * 一致するスレッドのタイトル（正本・`string | null`）を引いて返す。
 * タイトル編集（楽観更新・保存）は `<EditableThreadTitle>` が `reload` 経由で正本へ収束させる。
 */
export function useChatThreadPage() {
  const params = useParams<{ threadId: string }>();
  const { threads, isLoading, reload } = useChatThreadsApi();
  const thread = threads.find((t) => t.id === params.threadId);
  const title: string | null = thread?.title ?? null;
  return { threadId: params.threadId, title, isLoading, reload };
}
