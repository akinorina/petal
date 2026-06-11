'use client';

import { useParams } from 'next/navigation';
import { useCallback } from 'react';
import { useChatMessagesApi } from '@/lib/api-hooks/use-chat-api';
import { useChatConversation } from '../use-chat-conversation';

export function useChatThreadPage() {
  const params = useParams<{ threadId: string }>();
  const threadId = params.threadId;

  const messagesApi = useChatMessagesApi(threadId);

  const resolveThreadId = useCallback(
    () => Promise.resolve(threadId),
    [threadId],
  );

  const onStreamSettled = useCallback(async () => {
    // 既存ページ: ストリーム終了後に GET messages を再取得して確定状態に同期（D3）。
    await messagesApi.reload();
  }, [messagesApi]);

  const conversation = useChatConversation({
    resolveThreadId,
    onStreamSettled,
  });

  return {
    messages: conversation.buildMessages(messagesApi.messages),
    streamingText: conversation.streamingText,
    isStreaming: conversation.isStreaming,
    // 全画面ローディングは初回取得時のみ。送信後の reload で会話が
    // 「読み込み中」に差し替わってチラつくのを防ぐ。
    isLoading: messagesApi.isLoading && messagesApi.messages.length === 0,
    // 取得エラー（404 等）と送信エラーを統合表示。
    error: conversation.error ?? messagesApi.error,
    notFound: messagesApi.error !== null && messagesApi.messages.length === 0,
    send: conversation.send,
  };
}
