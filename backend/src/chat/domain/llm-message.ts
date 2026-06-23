import { z } from 'zod';

// チャットメッセージのロール。
export const ChatRoleSchema = z.enum(['system', 'user', 'assistant']);
export type ChatRole = z.infer<typeof ChatRoleSchema>;

// マルチモーダル content の各 part。
// text part は本文テキスト、image part は base64 データを保持する（判断 3）。
export const ChatTextPartSchema = z.object({
  type: z.literal('text'),
  text: z.string(),
});
export type ChatTextPart = z.infer<typeof ChatTextPartSchema>;

export const ChatImagePartSchema = z.object({
  type: z.literal('image'),
  mediaType: z.string().min(1),
  data: z.string().min(1),
});
export type ChatImagePart = z.infer<typeof ChatImagePartSchema>;

// audio part は base64 音声データを保持する（image part と対称・TSK-131）。
export const ChatAudioPartSchema = z.object({
  type: z.literal('audio'),
  mediaType: z.string().min(1),
  data: z.string().min(1),
});
export type ChatAudioPart = z.infer<typeof ChatAudioPartSchema>;

export const ChatContentPartSchema = z.discriminatedUnion('type', [
  ChatTextPartSchema,
  ChatImagePartSchema,
  ChatAudioPartSchema,
]);
export type ChatContentPart = z.infer<typeof ChatContentPartSchema>;

// 1 件のチャットメッセージ（ワイヤ表現）。
// content は後方互換のため string も許容し、配列はマルチモーダル parts。
export const ChatMessageSchema = z.object({
  role: ChatRoleSchema,
  content: z.union([z.string(), z.array(ChatContentPartSchema).min(1)]),
});
export type ChatMessage = z.infer<typeof ChatMessageSchema>;

// content からテキストのみを取り出す。string はそのまま、配列は text part を
// 結合して image part は無視する。画像の実マッピングは TSK-② が担当（判断 5）。
export function contentToText(content: string | ChatContentPart[]): string {
  if (typeof content === 'string') return content;
  return content
    .filter((p): p is ChatTextPart => p.type === 'text')
    .map((p) => p.text)
    .join('');
}

// メッセージ群のいずれかが image part を含むか判定する（純粋・テスト可）。
// vision 非対応 provider への画像付き送信 block 判定に使う（判断 2）。
export function hasImageContent(
  messages: { content: string | ChatContentPart[] }[],
): boolean {
  return messages.some(
    (m) =>
      Array.isArray(m.content) && m.content.some((p) => p.type === 'image'),
  );
}

// メッセージ群のいずれかが audio part を含むか判定する（hasImageContent と同型）。
// 音声非対応 provider への音声付き送信 block 判定に使う（判断 2）。
export function hasAudioContent(
  messages: { content: string | ChatContentPart[] }[],
): boolean {
  return messages.some(
    (m) =>
      Array.isArray(m.content) && m.content.some((p) => p.type === 'audio'),
  );
}
