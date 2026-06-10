import { z } from 'zod';

export const ChatThreadSchema = z.object({
  id: z.uuid(),
  ownerUserId: z.uuid(),
  title: z.string().max(255).nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  deletedAt: z.date().nullable(),
});

export type ChatThreadProps = z.infer<typeof ChatThreadSchema>;

export class ChatThread {
  readonly id: string;
  readonly ownerUserId: string;
  title: string | null;
  readonly createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;

  constructor(props: ChatThreadProps) {
    const validated = ChatThreadSchema.parse(props);
    this.id = validated.id;
    this.ownerUserId = validated.ownerUserId;
    this.title = validated.title;
    this.createdAt = validated.createdAt;
    this.updatedAt = validated.updatedAt;
    this.deletedAt = validated.deletedAt;
  }

  isOwnedBy(userId: string): boolean {
    return this.ownerUserId === userId;
  }
}
