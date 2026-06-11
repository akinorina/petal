'use client';

import { useEffect, useRef, useState } from 'react';
import { Alert } from '@/design-system/components/Alert';
import { Button } from '@/design-system/components/Button';
import { Textarea } from '@/design-system/components/Input';
import type { OptimisticMessage } from './use-chat-conversation';

type ChatConversationProps = {
  messages: OptimisticMessage[];
  streamingText: string;
  isStreaming: boolean;
  error: string | null;
  onSend: (content: string) => void;
  className?: string;
};

/**
 * 会話のプレゼンテーション（メッセージリスト + コンポーザ + Alert）。
 * `<ChatPanel>` の内部部品（components/chat/ 配下の非公開実装）。
 * 高さは親コンテナに追従し（`h-full` + 内部スクロール）、`className` で枠を受け取る。
 */
export function ChatConversation({
  messages,
  streamingText,
  isStreaming,
  error,
  onSend,
  className,
}: ChatConversationProps) {
  const [input, setInput] = useState('');
  const listEndRef = useRef<HTMLDivElement>(null);

  // 新着・ストリーミングに合わせて末尾へスクロールする。
  useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingText]);

  function handleSend() {
    const content = input.trim();
    if (!content || isStreaming) return;
    onSend(content);
    setInput('');
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Enter 送信 / Shift+Enter 改行。IME 変換中（isComposing）は送信しない。
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSend();
    }
  }

  const showEmpty = messages.length === 0 && !isStreaming;

  return (
    <div className={['flex h-full flex-col', className].filter(Boolean).join(' ')}>
      <div className="flex-1 space-y-4 overflow-y-auto pb-4">
        {showEmpty ? (
          <p className="py-12 text-center text-sm text-zinc-400">
            メッセージを送信して会話を始めましょう。
          </p>
        ) : (
          messages.map((message, index) => (
            <MessageBubble key={index} message={message} />
          ))
        )}

        {isStreaming && (
          <MessageBubble
            message={{ role: 'assistant', content: streamingText }}
            pending
          />
        )}

        <div ref={listEndRef} />
      </div>

      {error && (
        <Alert variant="danger" className="mb-3">
          {error}
        </Alert>
      )}

      <div className="flex items-end gap-2 border-t border-zinc-200 bg-white pt-3">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="メッセージを入力（Enter で送信 / Shift+Enter で改行）"
          rows={2}
          disabled={isStreaming}
          className="flex-1"
        />
        <Button
          type="button"
          onClick={handleSend}
          disabled={isStreaming || input.trim().length === 0}
        >
          送信
        </Button>
      </div>
    </div>
  );
}

function MessageBubble({
  message,
  pending = false,
}: {
  message: OptimisticMessage;
  pending?: boolean;
}) {
  const isUser = message.role === 'user';
  return (
    <div className={isUser ? 'flex justify-end' : 'flex justify-start'}>
      <div
        className={[
          'max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm',
          isUser
            ? 'bg-blue-600 text-white'
            : 'bg-zinc-100 text-zinc-900',
        ].join(' ')}
      >
        {message.content}
        {pending && (
          <span className="ml-1 inline-block animate-pulse text-zinc-400">
            …
          </span>
        )}
      </div>
    </div>
  );
}
