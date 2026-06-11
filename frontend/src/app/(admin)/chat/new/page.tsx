'use client';

import NextLink from 'next/link';
import { ChatPanel } from '@/components/chat';
import { Text } from '@/design-system/components/Text';
import { useChatNewPage } from './use-chat-new-page';

export default function ChatNewPage() {
  const { onThreadCreated } = useChatNewPage();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <NextLink href="/chat" className="ds-link ds-link--inline text-sm">
          ← 一覧に戻る
        </NextLink>
        <Text as="h1" variant="heading-md">
          新規チャット
        </Text>
      </div>

      <ChatPanel
        mode="new"
        onThreadCreated={onThreadCreated}
        className="h-[70vh]"
      />
    </div>
  );
}
