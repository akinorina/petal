'use client';

import NextLink from 'next/link';
import { ChatPanel, EditableThreadTitle } from '@/components/chat';
import { useChatThreadPage } from './use-chat-thread-page';

export default function ChatThreadPage() {
  const { threadId, title, isLoading, reload } = useChatThreadPage();

  return (
    <div className="flex h-full flex-col gap-4">
      <EditableThreadTitle
        threadId={threadId}
        title={title}
        isLoading={isLoading}
        onSaved={reload}
      />
      <NextLink
        href="/chat"
        className="ds-link ds-link--inline flex-none text-sm"
      >
        ← 一覧に戻る
      </NextLink>

      <ChatPanel mode="thread" threadId={threadId} className="flex-1 min-h-0" />
    </div>
  );
}
