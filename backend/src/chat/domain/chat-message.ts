import { z } from 'zod';
import { ChatRole, ChatRoleSchema } from './llm-message';

// メッセージに添付された画像参照（順序付き）。position はメッセージ内の表示・送信順。
export const ChatMessageImageRefSchema = z.object({
  imageId: z.uuid(),
  position: z.number().int().nonnegative(),
});

export type ChatMessageImageRef = z.infer<typeof ChatMessageImageRefSchema>;

// メッセージに添付された音声参照（順序付き・画像参照と対称・TSK-131）。
export const ChatMessageAudioRefSchema = z.object({
  audioId: z.uuid(),
  position: z.number().int().nonnegative(),
});

export type ChatMessageAudioRef = z.infer<typeof ChatMessageAudioRefSchema>;

export const ChatMessageSchema = z.object({
  id: z.uuid(),
  threadId: z.uuid(),
  seq: z.number().int().nonnegative(),
  role: ChatRoleSchema,
  content: z.string(),
  // 画像添付（既存）。命名の非対称は判断 4 のとおり許容する。
  attachments: z.array(ChatMessageImageRefSchema).default([]),
  // 音声添付（TSK-131）。画像とは別フィールドで持つ（判断 4）。
  audioAttachments: z.array(ChatMessageAudioRefSchema).default([]),
  createdAt: z.date(),
  updatedAt: z.date(),
  deletedAt: z.date().nullable(),
});

// 入力型を用いることで attachments を省略可能（既定 []）にする。
export type ChatMessageProps = z.input<typeof ChatMessageSchema>;

export class ChatMessage {
  readonly id: string;
  readonly threadId: string;
  readonly seq: number;
  readonly role: ChatRole;
  readonly content: string;
  readonly attachments: ChatMessageImageRef[];
  readonly audioAttachments: ChatMessageAudioRef[];
  readonly createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;

  constructor(props: ChatMessageProps) {
    const validated = ChatMessageSchema.parse(props);
    this.id = validated.id;
    this.threadId = validated.threadId;
    this.seq = validated.seq;
    this.role = validated.role;
    this.content = validated.content;
    this.attachments = validated.attachments;
    this.audioAttachments = validated.audioAttachments;
    this.createdAt = validated.createdAt;
    this.updatedAt = validated.updatedAt;
    this.deletedAt = validated.deletedAt;
  }
}
