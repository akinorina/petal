'use client';

import NextLink from 'next/link';
import { ChatPanel } from '@/components/chat';
import { useChatThreadPage } from './use-chat-thread-page';

export default function ChatThreadPage() {
  const { threadId } = useChatThreadPage();

  return (
    <div className="space-y-4">
      <NextLink href="/chat" className="ds-link ds-link--inline text-sm">
        ← 一覧に戻る
      </NextLink>

      <ChatPanel mode="thread" threadId={threadId} className="h-[70vh]" />
    </div>
  );
}
