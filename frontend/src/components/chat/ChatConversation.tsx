'use client';

import { useEffect, useRef, useState } from 'react';
import { Alert } from '@/design-system/components/Alert';
import { Button } from '@/design-system/components/Button';
import { ChatBubble } from '@/design-system/components/ChatBubble';
import { ChatComposer } from '@/design-system/components/ChatComposer';
import { AttachmentPreviewList } from './AttachmentPreviewList';
import { AudioAttachmentPicker } from './AudioAttachmentPicker';
import { AudioAttachmentPreviewList } from './AudioAttachmentPreviewList';
import { ImageAttachmentPicker } from './ImageAttachmentPicker';
import { MarkdownContent } from './MarkdownContent';
import { MessageAttachments } from './MessageAttachments';
import { MessageAudioAttachments } from './MessageAudioAttachments';
import { useAudioAttachment } from './use-audio-attachment';
import { useImageAttachment } from './use-image-attachment';
import type { OptimisticMessage } from './use-chat-conversation';

type ChatConversationProps = {
  messages: OptimisticMessage[];
  streamingText: string;
  isStreaming: boolean;
  error: string | null;
  /**
   * content と選択画像/音声 id（選択順）、楽観表示用の添付メタを渡す。
   * 送信が成功したか（エラーなく完了したか）を解決する。
   */
  onSend: (
    content: string,
    attachmentImageIds: string[],
    optimisticAttachments: { imageId: string; label?: string }[],
    attachmentAudioIds: string[],
    optimisticAudioAttachments: {
      audioId: string;
      label?: string;
      durationSeconds?: number;
    }[],
  ) => Promise<boolean>;
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
  const audioAttachment = useAudioAttachment();

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
    // 楽観バブルには選択中音声のローカルメタ（id + ラベル + 再生時間）を渡す。
    const optimisticAudio = audioAttachment.selectedAudios.map((a) => ({
      audioId: a.id,
      label: a.title || a.originalFilename,
      durationSeconds: a.durationSeconds ?? undefined,
    }));
    setInput('');
    // 送信成功時のみ選択をクリアする。失敗（非対応等）時は保持して付け直せるようにする。
    void onSend(
      content,
      attachment.selectedIds,
      optimistic,
      audioAttachment.selectedIds,
      optimisticAudio,
    ).then((ok) => {
      if (ok) {
        attachment.clear();
        audioAttachment.clear();
      }
    });
  }

  const showEmpty = messages.length === 0 && !isStreaming;

  return (
    <div className={['flex h-full flex-col', className].filter(Boolean).join(' ')}>
      <div className="flex-1 min-h-0 space-y-4 overflow-y-auto pb-4">
        {showEmpty ? (
          <p className="py-12 text-center text-sm text-text-tertiary">
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

      <ChatComposer
        value={input}
        onChange={setInput}
        onSubmit={handleSend}
        disabled={isStreaming}
        placeholder="メッセージを入力（Enter で送信 / Shift+Enter で改行）"
        actions={
          <>
            <Button
              type="button"
              variant="secondary"
              onClick={attachment.openPicker}
              disabled={isStreaming}
            >
              画像
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={audioAttachment.openPicker}
              disabled={isStreaming}
            >
              音声
            </Button>
          </>
        }
        previews={
          <>
            <AttachmentPreviewList
              images={attachment.selectedImages}
              onRemove={attachment.remove}
              disabled={isStreaming}
            />
            <AudioAttachmentPreviewList
              audios={audioAttachment.selectedAudios}
              onRemove={audioAttachment.remove}
              disabled={isStreaming}
            />
          </>
        }
      />

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

      <AudioAttachmentPicker
        open={audioAttachment.isPickerOpen}
        onOpenChange={(o) =>
          o ? audioAttachment.openPicker() : audioAttachment.closePicker()
        }
        audios={audioAttachment.audios}
        isLoading={audioAttachment.isLoading}
        error={audioAttachment.error}
        selectedIds={audioAttachment.selectedIds}
        canAddMore={audioAttachment.canAddMore}
        onToggle={audioAttachment.toggle}
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
    <ChatBubble variant={isUser ? 'sent' : 'received'}>
      {isUser ? message.content : <MarkdownContent content={message.content} />}
      {isUser && message.attachments && message.attachments.length > 0 && (
        <MessageAttachments attachments={message.attachments} />
      )}
      {isUser &&
        message.audioAttachments &&
        message.audioAttachments.length > 0 && (
          <MessageAudioAttachments attachments={message.audioAttachments} />
        )}
      {pending && (
        <span className="ml-1 inline-block animate-pulse text-text-tertiary">
          …
        </span>
      )}
    </ChatBubble>
  );
}
