import { z } from 'zod';

// 送信メッセージ本文の最大長（文字数）。
export const MAX_MESSAGE_CONTENT_LENGTH = 32768;

// 送信エンドポイントの外部入力スキーマ。本文のみを受ける（D6）。
export const SendMessageSchema = z.object({
  content: z.string().min(1).max(MAX_MESSAGE_CONTENT_LENGTH),
});

export type SendMessageInput = z.infer<typeof SendMessageSchema>;
