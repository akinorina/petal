import type { ChatErrorCode } from './chat-error';

// 送信フローのストリームイベント（非永続の判別共用体）。
export type ChatStreamEvent =
  | { type: 'delta'; delta: string }
  | {
      type: 'done';
      messageId: string | null;
      seq: number | null;
      finishReason: string | null;
    }
  | {
      type: 'error';
      code: ChatErrorCode;
      message: string;
      retryable: boolean;
    };
