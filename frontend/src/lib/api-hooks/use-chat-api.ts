'use client';

import { useCallback, useMemo } from 'react';
import {
  chatApi,
  streamChatMessage,
  type ChatStreamHandlers,
} from '@/lib/api';
import type { Schemas } from '@/lib/openapi/client';
import { useApiResource } from './use-api-resource';

type ChatThread = Schemas['ChatThreadResponseDto'];
type ChatMessage = Schemas['ChatMessageResponseDto'];

/**
 * スレッド一覧の取得・削除フック。一覧ページ（`/chat`）で使う。
 */
export function useChatThreadsApi() {
  const fetcher = useCallback(() => chatApi.listThreads(), []);
  const { data, isLoading, error, setError, reload } =
    useApiResource<ChatThread[]>(fetcher);

  const remove = useCallback(
    async (threadId: string) => {
      await chatApi.removeThread(threadId);
      await reload();
    },
    [reload],
  );

  return {
    threads: data ?? [],
    isLoading,
    error,
    setError,
    reload,
    remove,
  };
}

/**
 * 指定スレッドのメッセージ一覧フック。`threadId` が `null`（新規ページ）のときは
 * fetch せず空配列を返す（無駄な取得をしない）。
 */
export function useChatMessagesApi(threadId: string | null) {
  const fetcher = useCallback(
    () =>
      threadId
        ? chatApi.listMessages(threadId)
        : Promise.resolve<ChatMessage[]>([]),
    [threadId],
  );
  const { data, isLoading, error, setError, reload } =
    useApiResource<ChatMessage[]>(fetcher);

  return {
    messages: data ?? [],
    isLoading,
    error,
    setError,
    reload,
  };
}

/**
 * 命令的なチャット操作（スレッド作成・送信ストリーム）フック。
 * UI レイヤが `lib/api` を直接呼ばずに済むよう、`streamMessage` もここで公開する。
 */
export function useChatActionsApi() {
  return useMemo(
    () => ({
      createThread: () => chatApi.createThread({}),
      streamMessage: (
        threadId: string,
        content: string,
        handlers: ChatStreamHandlers,
        signal?: AbortSignal,
      ) => streamChatMessage(threadId, content, handlers, signal),
    }),
    [],
  );
}
