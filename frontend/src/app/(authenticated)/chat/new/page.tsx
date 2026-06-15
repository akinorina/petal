'use client';

import NextLink from 'next/link';
import { ChatPanel } from '@/components/chat';
import { Text } from '@/design-system/components/Text';
import { useChatNewPage } from './use-chat-new-page';

export default function ChatNewPage() {
  const { onThreadCreated } = useChatNewPage();

  return (
    <div className="flex h-full flex-col gap-4">
      <Text as="h1" variant="heading-md" className="flex-none">
        新規チャット
      </Text>
      <NextLink
        href="/chat"
        className="ds-link ds-link--inline flex-none text-sm"
      >
        ← 一覧に戻る
      </NextLink>

      <ChatPanel
        mode="new"
        onThreadCreated={onThreadCreated}
        className="flex-1 min-h-0"
      />
    </div>
  );
}
