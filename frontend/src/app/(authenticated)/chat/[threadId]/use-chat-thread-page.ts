'use client';

import { useParams } from 'next/navigation';
import { useChatThreadsApi } from '@/lib/api-hooks/use-chat-api';

/**
 * 既存スレッドページのロジック。会話の配線は `<ChatPanel>` が担う。
 * ここでは URL から `threadId` を取り出し、スレッド一覧（`useChatThreadsApi`）から
 * 一致するスレッドのタイトルを引いて返す（読み取り表示のみ・JP6）。
 * ロード中はタイトルを空文字にして「無題の会話」のちらつきを避ける。
 */
export function useChatThreadPage() {
  const params = useParams<{ threadId: string }>();
  const { threads, isLoading } = useChatThreadsApi();
  const thread = threads.find((t) => t.id === params.threadId);
  const title = isLoading ? '' : (thread?.title ?? '無題の会話');
  return { threadId: params.threadId, title };
}
