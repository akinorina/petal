'use client';

import { useParams } from 'next/navigation';

/**
 * 既存スレッドページのロジック。会話の配線は `<ChatPanel>` が担うため、
 * ここは URL から `threadId` を取り出すだけに縮退している（JP7）。
 */
export function useChatThreadPage() {
  const params = useParams<{ threadId: string }>();
  return { threadId: params.threadId };
}
