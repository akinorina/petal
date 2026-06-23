'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useChatActionsApi } from '@/lib/api-hooks/use-chat-api';
import type { Schemas } from '@/lib/openapi/client';
import type { DisplayAttachment } from './MessageAttachments';
import type { DisplayAudioAttachment } from './MessageAudioAttachments';

type ChatMessage = Schemas['ChatMessageResponseDto'];

/** vision 非対応 provider のエラーコード（バック TSK-123/124）。 */
const VISION_UNSUPPORTED_CODE = 'LLM_VISION_UNSUPPORTED';
/** 上記コードを受けたときに表示する専用文言（添付は保持して付け直し可能）。 */
const VISION_UNSUPPORTED_MESSAGE =
  '現在のモデルは画像に対応していません。画像を外すか、対応モデルに切り替えて再送してください。';

/** 音声非対応 provider のエラーコード（バック TSK-131）。 */
const AUDIO_UNSUPPORTED_CODE = 'LLM_AUDIO_UNSUPPORTED';
/** 上記コードを受けたときに表示する専用文言（添付は保持して付け直し可能）。 */
const AUDIO_UNSUPPORTED_MESSAGE =
  '現在のモデルは音声に対応していません。音声を外すか、対応モデルに切り替えて再送してください。';

/** 楽観表示用のメッセージ（サーバ確定前のローカルバブル）。 */
export type OptimisticMessage = {
  role: 'user' | 'assistant';
  content: string;
  /** 添付画像（ユーザーバブルのサムネ表示用。楽観・履歴の両方で使う）。 */
  attachments?: DisplayAttachment[];
  /** 添付音声（ユーザーバブルの再生表示用。楽観・履歴の両方で使う）。 */
  audioAttachments?: DisplayAudioAttachment[];
};

type UseChatConversationOptions = {
  /**
   * 送信時に対象スレッドを解決する。既存ページは固定 id を返し、
   * 新規ページは初回送信時に `createThread()` して id を返す（遅延作成）。
   */
  resolveThreadId: () => Promise<string>;
  /**
   * ストリーム終了後（done/error いずれでも）に呼ばれる同期処理。
   * 既存ページは `GET /messages` の reload、新規ページは確定スレッドへの遷移。
   */
  onStreamSettled: (threadId: string) => void | Promise<void>;
};

/**
 * 会話の送信ストリーミングを担う共有フック（D5）。
 * メッセージ描画は呼び出し側が `serverMessages` を渡し、ここでは楽観バブルと
 * ストリーミングテキストを上乗せする。送信オーケストレーションはここに集約する。
 */
export function useChatConversation({
  resolveThreadId,
  onStreamSettled,
}: UseChatConversationOptions) {
  const actions = useChatActionsApi();
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [optimisticUser, setOptimisticUser] = useState<OptimisticMessage | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  // unmount 時に進行中ストリームを中断する（backend は切断で部分保存）。
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const send = useCallback(
    async (
      rawContent: string,
      attachmentImageIds?: string[],
      optimisticAttachments?: DisplayAttachment[],
      attachmentAudioIds?: string[],
      optimisticAudioAttachments?: DisplayAudioAttachment[],
    ): Promise<boolean> => {
      const content = rawContent.trim();
      if (!content || isStreaming) return false;

      setError(null);
      setOptimisticUser({
        role: 'user',
        content,
        attachments:
          optimisticAttachments && optimisticAttachments.length > 0
            ? optimisticAttachments
            : undefined,
        audioAttachments:
          optimisticAudioAttachments && optimisticAudioAttachments.length > 0
            ? optimisticAudioAttachments
            : undefined,
      });
      setStreamingText('');
      setIsStreaming(true);

      const controller = new AbortController();
      abortRef.current = controller;

      // ストリーム/開始前のいずれかでエラーが出たら false を返し、添付選択を保持させる。
      let succeeded = true;
      let threadId: string | null = null;
      try {
        threadId = await resolveThreadId();

        await actions.streamMessage(
          threadId,
          content,
          {
            onDelta: (delta) => setStreamingText((prev) => prev + delta),
            onDone: () => {},
            // vision/audio 非対応コードは専用文言へ差し替える（コードは err.code でのみ判定可能）。
            onError: (err) => {
              succeeded = false;
              setError(
                err.code === VISION_UNSUPPORTED_CODE
                  ? VISION_UNSUPPORTED_MESSAGE
                  : err.code === AUDIO_UNSUPPORTED_CODE
                    ? AUDIO_UNSUPPORTED_MESSAGE
                    : err.message || 'エラーが発生しました',
              );
            },
          },
          controller.signal,
          attachmentImageIds,
          attachmentAudioIds,
        );
      } catch {
        succeeded = false;
        setError('送信に失敗しました');
      } finally {
        // unmount による中断時は state 更新も同期もしない。
        if (!controller.signal.aborted) {
          setIsStreaming(false);
          if (threadId) {
            await onStreamSettled(threadId);
          }
          setStreamingText('');
          setOptimisticUser(null);
        }
        if (abortRef.current === controller) abortRef.current = null;
      }
      // 中断（unmount）時は呼び出し側で後処理させない。
      return !controller.signal.aborted && succeeded;
    },
    [actions, isStreaming, resolveThreadId, onStreamSettled],
  );

  /** サーバ確定メッセージ + 楽観バブルを結合した描画用リスト（system は除外）。 */
  const buildMessages = useCallback(
    (serverMessages: ChatMessage[]): OptimisticMessage[] => {
      const base: OptimisticMessage[] = serverMessages
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
          // サーバ確定の添付は署名付き downloadUrl をそのまま描画に使う。
          attachments:
            m.attachments.length > 0
              ? m.attachments.map((a) => ({
                  imageId: a.imageId,
                  downloadUrl: a.downloadUrl,
                  label: a.originalFilename,
                }))
              : undefined,
          audioAttachments:
            m.audioAttachments.length > 0
              ? m.audioAttachments.map((a) => ({
                  audioId: a.audioId,
                  downloadUrl: a.downloadUrl,
                  label: a.originalFilename,
                }))
              : undefined,
        }));
      if (optimisticUser !== null) {
        base.push(optimisticUser);
      }
      return base;
    },
    [optimisticUser],
  );

  return {
    isStreaming,
    streamingText,
    error,
    setError,
    send,
    buildMessages,
  };
}
