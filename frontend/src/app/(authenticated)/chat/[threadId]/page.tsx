'use client';

import NextLink from 'next/link';
import { ChatPanel } from '@/components/chat';
import { Text } from '@/design-system/components/Text';
import { useChatThreadPage } from './use-chat-thread-page';

export default function ChatThreadPage() {
  const { threadId, title } = useChatThreadPage();

  return (
    <div className="flex h-full flex-col gap-4">
      <Text as="h1" variant="heading-md" className="flex-none">
        {title || ' '}
      </Text>
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
