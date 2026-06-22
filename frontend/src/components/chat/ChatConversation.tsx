'use client';

import { useEffect, useRef, useState } from 'react';
import { Alert } from '@/design-system/components/Alert';
import { Button } from '@/design-system/components/Button';
import { Textarea } from '@/design-system/components/Input';
import { AttachmentPreviewList } from './AttachmentPreviewList';
import { ImageAttachmentPicker } from './ImageAttachmentPicker';
import { MarkdownContent } from './MarkdownContent';
import { MessageAttachments } from './MessageAttachments';
import { useImageAttachment } from './use-image-attachment';
import type { OptimisticMessage } from './use-chat-conversation';

/** vision 非対応 provider のエラーコード（バック TSK-123/124）。 */
const VISION_UNSUPPORTED_CODE = 'LLM_VISION_UNSUPPORTED';
/** 上記コードを受けたときに表示する専用文言。 */
const VISION_UNSUPPORTED_MESSAGE =
  '現在のモデルは画像に対応していません。画像を外すか、対応モデルに切り替えて再送してください。';

type ChatConversationProps = {
  messages: OptimisticMessage[];
  streamingText: string;
  isStreaming: boolean;
  error: string | null;
  /** content と選択画像 id（選択順）、楽観表示用の添付メタを渡す。 */
  onSend: (
    content: string,
    attachmentImageIds: string[],
    optimisticAttachments: { imageId: string; label?: string }[],
  ) => void;
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
  const attachment = useImageAttachment();

  // 新着・ストリーミングに合わせて末尾へスクロールする。
  useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingText]);

  function handleSend() {
    const content = input.trim();
    if (!content || isStreaming) return;
    // 楽観バブルには選択中画像のローカルメタ（id + ラベル）を渡す。
    const optimistic = attachment.selectedImages.map((img) => ({
      imageId: img.id,
      label: img.title || img.originalFilename,
    }));
    onSend(content, attachment.selectedIds, optimistic);
    setInput('');
    // 送信後は選択をクリアする（付け直しはエラー時のみ別途行う）。
    attachment.clear();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Enter 送信 / Shift+Enter 改行。IME 変換中（isComposing）は送信しない。
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSend();
    }
  }

  const showEmpty = messages.length === 0 && !isStreaming;

  // vision 非対応のエラーは専用文言に差し替える（添付は保持して付け直し可能）。
  const displayError =
    error === VISION_UNSUPPORTED_CODE ? VISION_UNSUPPORTED_MESSAGE : error;

  return (
    <div className={['flex h-full flex-col', className].filter(Boolean).join(' ')}>
      <div className="flex-1 min-h-0 space-y-4 overflow-y-auto pb-4">
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

      {displayError && (
        <Alert variant="danger" className="mb-3">
          {displayError}
        </Alert>
      )}

      <div className="border-t border-zinc-200 bg-white pt-3">
        <AttachmentPreviewList
          images={attachment.selectedImages}
          onRemove={attachment.remove}
          disabled={isStreaming}
        />
        <div className="flex items-end gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={attachment.openPicker}
            disabled={isStreaming}
          >
            画像
          </Button>
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

      <ImageAttachmentPicker
        open={attachment.isPickerOpen}
        onOpenChange={(o) => (o ? attachment.openPicker() : attachment.closePicker())}
        images={attachment.images}
        isLoading={attachment.isLoading}
        error={attachment.error}
        selectedIds={attachment.selectedIds}
        canAddMore={attachment.canAddMore}
        onToggle={attachment.toggle}
      />
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
          'max-w-[80%] rounded-2xl px-4 py-2 text-sm',
          isUser
            ? 'whitespace-pre-wrap bg-blue-600 text-white'
            : 'bg-zinc-100 text-zinc-900',
        ].join(' ')}
      >
        {isUser ? (
          message.content
        ) : (
          <MarkdownContent content={message.content} />
        )}
        {isUser && message.attachments && message.attachments.length > 0 && (
          <MessageAttachments attachments={message.attachments} />
        )}
        {pending && (
          <span className="ml-1 inline-block animate-pulse text-zinc-400">
            …
          </span>
        )}
      </div>
    </div>
  );
}
