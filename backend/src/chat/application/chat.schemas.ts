import { z } from 'zod';

// 送信メッセージ本文の最大長（文字数）。
export const MAX_MESSAGE_CONTENT_LENGTH = 32768;

// 1 メッセージあたりの添付画像枚数上限（判断 2）。
export const MAX_ATTACHMENTS = 5;

// 1 メッセージあたりの添付音声件数上限（TSK-131）。
export const MAX_AUDIO_ATTACHMENTS = 3;

// 送信エンドポイントの外部入力スキーマ。本文＋任意の添付画像／音声 id 群を受ける。
export const SendMessageSchema = z.object({
  content: z.string().min(1).max(MAX_MESSAGE_CONTENT_LENGTH),
  attachmentImageIds: z.array(z.uuid()).max(MAX_ATTACHMENTS).optional(),
  attachmentAudioIds: z.array(z.uuid()).max(MAX_AUDIO_ATTACHMENTS).optional(),
});

export type SendMessageInput = z.infer<typeof SendMessageSchema>;
