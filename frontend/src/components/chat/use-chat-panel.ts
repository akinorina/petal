'use client';

import { useCallback, useRef } from 'react';
import {
  useChatActionsApi,
  useChatMessagesApi,
} from '@/lib/api-hooks/use-chat-api';
import { useChatConversation } from './use-chat-conversation';
import type { ChatPanelProps } from './ChatPanel';

/**
 * `<ChatPanel>` の内部配線フック（非公開）。
 * mode に応じて `useChatMessagesApi` + `useChatActionsApi` + `useChatConversation` を
 * 組み合わせ、描画に必要な props を返す。
 *
 * JP1: discriminated union の `props` 全体を依存配列に入れると毎レンダーで
 * コールバック identity が変わるため、冒頭で個別フィールドを取り出して使う。
 */
export function useChatPanel(props: ChatPanelProps) {
  const threadId = props.mode === 'thread' ? props.threadId : null;
  const onThreadCreated =
    props.mode === 'new' ? props.onThreadCreated : undefined;

  // new（threadId=null）のときは fetch せず messages=[] / error=null / isLoading=false。
  const messagesApi = useChatMessagesApi(threadId);
  const actions = useChatActionsApi();
  const createdRef = useRef<string | null>(null);

  const resolveThreadId = useCallback(async () => {
    if (threadId !== null) return threadId;
    const thread = await actions.createThread();
    createdRef.current = thread.id;
    return thread.id;
  }, [threadId, actions]);

  const onStreamSettled = useCallback(
    async (id: string) => {
      if (threadId !== null) await messagesApi.reload();
      else onThreadCreated?.(id);
    },
    [threadId, onThreadCreated, messagesApi],
  );

  const conversation = useChatConversation({
    resolveThreadId,
    onStreamSettled,
  });

  return {
    messages: conversation.buildMessages(messagesApi.messages),
    streamingText: conversation.streamingText,
    isStreaming: conversation.isStreaming,
    // 取得エラー（404 等）と送信エラーを統合表示。
    error: conversation.error ?? messagesApi.error,
    // 全画面ローディングは初回取得時のみ（送信後 reload のチラつきを防ぐ）。
    isLoading: messagesApi.isLoading && messagesApi.messages.length === 0,
    notFound: messagesApi.error !== null && messagesApi.messages.length === 0,
    send: conversation.send,
  };
}
