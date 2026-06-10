import { z } from 'zod';
import { ChatRoleSchema } from '../domain/llm-message';

export const CreateThreadInputSchema = z.object({
  title: z.string().max(255).nullable().optional(),
});

export type CreateThreadInput = z.infer<typeof CreateThreadInputSchema>;

export const AddMessageInputSchema = z.object({
  role: ChatRoleSchema,
  content: z.string().min(1),
});

export type AddMessageInput = z.infer<typeof AddMessageInputSchema>;
