'use client';

import NextLink from 'next/link';
import { Alert } from '@/design-system/components/Alert';
import { ChatConversation } from '../ChatConversation';
import { useChatThreadPage } from './use-chat-thread-page';

export default function ChatThreadPage() {
  const {
    messages,
    streamingText,
    isStreaming,
    isLoading,
    error,
    notFound,
    send,
  } = useChatThreadPage();

  if (isLoading) {
    return <p className="text-sm text-zinc-500">読み込み中...</p>;
  }

  if (notFound) {
    return (
      <div>
        <NextLink href="/chat" className="ds-link ds-link--inline text-sm">
          ← 一覧に戻る
        </NextLink>
        <Alert variant="danger" className="mt-4">
          会話が見つかりません
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <NextLink href="/chat" className="ds-link ds-link--inline text-sm">
        ← 一覧に戻る
      </NextLink>

      <ChatConversation
        messages={messages}
        streamingText={streamingText}
        isStreaming={isStreaming}
        error={error}
        onSend={send}
      />
    </div>
  );
}
