'use client';

import { useRouter } from 'next/navigation';
import { useCallback } from 'react';

/**
 * 新規チャットページのロジック。会話の配線は `<ChatPanel>` が担うため、
 * ここはスレッド作成後の遷移コールバックを供給するだけに縮退している（JP7）。
 */
export function useChatNewPage() {
  const router = useRouter();

  const onThreadCreated = useCallback(
    (id: string) => router.replace(`/chat/${id}`),
    [router],
  );

  return { onThreadCreated };
}
