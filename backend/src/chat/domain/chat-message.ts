import { z } from 'zod';
import { ChatRole, ChatRoleSchema } from './llm-message';

export const ChatMessageSchema = z.object({
  id: z.uuid(),
  threadId: z.uuid(),
  seq: z.number().int().nonnegative(),
  role: ChatRoleSchema,
  content: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
  deletedAt: z.date().nullable(),
});

export type ChatMessageProps = z.infer<typeof ChatMessageSchema>;

export class ChatMessage {
  readonly id: string;
  readonly threadId: string;
  readonly seq: number;
  readonly role: ChatRole;
  readonly content: string;
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
    this.createdAt = validated.createdAt;
    this.updatedAt = validated.updatedAt;
    this.deletedAt = validated.deletedAt;
  }
}
