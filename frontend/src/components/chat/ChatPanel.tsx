'use client';

import { Alert } from '@/design-system/components/Alert';
import { ChatConversation } from './ChatConversation';
import { useChatPanel } from './use-chat-panel';

export type ChatPanelProps = {
  /** 高さ・枠線・余白等は埋め込み側がここで指定する（例: 'h-[70vh]'）。 */
  className?: string;
} & (
  | { mode: 'thread'; threadId: string }
  | { mode: 'new'; onThreadCreated?: (threadId: string) => void }
);

/**
 * 自己完結したチャット会話パネル。`threadId`（または `mode="new"`）を渡すだけで
 * 内部で API 配線・送信・描画まで完結する。高さは埋め込み側が `className` で与える。
 */
export function ChatPanel(props: ChatPanelProps) {
  const { messages, streamingText, isStreaming, error, isLoading, notFound, send } =
    useChatPanel(props);

  if (isLoading) {
    return (
      <div
        className={[props.className, 'flex items-center justify-center']
          .filter(Boolean)
          .join(' ')}
      >
        <p className="text-sm text-text-tertiary">読み込み中...</p>
      </div>
    );
  }

  if (notFound) {
    return (
      <div
        className={[props.className, 'flex items-center justify-center']
          .filter(Boolean)
          .join(' ')}
      >
        <Alert variant="danger">会話が見つかりません</Alert>
      </div>
    );
  }

  return (
    <ChatConversation
      messages={messages}
      streamingText={streamingText}
      isStreaming={isStreaming}
      error={error}
      onSend={send}
      className={props.className}
    />
  );
}
