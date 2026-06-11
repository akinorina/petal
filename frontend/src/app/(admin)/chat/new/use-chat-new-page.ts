'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useRef } from 'react';
import { useChatActionsApi } from '@/lib/api-hooks/use-chat-api';
import { useChatConversation } from '../use-chat-conversation';

export function useChatNewPage() {
  const router = useRouter();
  const actions = useChatActionsApi();
  // 作成済み threadId をローカル変数（ref）で保持し、ストリーム中は state に載せない（D2）。
  const createdThreadIdRef = useRef<string | null>(null);

  const resolveThreadId = useCallback(async () => {
    const thread = await actions.createThread();
    createdThreadIdRef.current = thread.id;
    return thread.id;
  }, [actions]);

  const onStreamSettled = useCallback(
    (threadId: string) => {
      // 完了後に確定スレッドへ遷移（遷移先が GET messages で確定描画）。
      router.replace(`/chat/${threadId}`);
    },
    [router],
  );

  const conversation = useChatConversation({
    resolveThreadId,
    onStreamSettled,
  });

  return {
    messages: conversation.buildMessages([]),
    streamingText: conversation.streamingText,
    isStreaming: conversation.isStreaming,
    error: conversation.error,
    send: conversation.send,
  };
}
