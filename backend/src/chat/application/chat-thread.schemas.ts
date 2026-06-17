import { z } from 'zod';
import { ChatRoleSchema } from '../domain/llm-message';

export const CreateThreadInputSchema = z.object({
  title: z.string().max(255).nullable().optional(),
});

export type CreateThreadInput = z.infer<typeof CreateThreadInputSchema>;

export const UpdateThreadInputSchema = z.object({
  title: z
    .string()
    .nullable()
    .transform((v) => {
      if (v === null) return null;
      const trimmed = v.trim();
      return trimmed === '' ? null : trimmed;
    })
    .pipe(z.string().max(255).nullable()),
});

export type UpdateThreadInput = z.infer<typeof UpdateThreadInputSchema>;

export const AddMessageInputSchema = z.object({
  role: ChatRoleSchema,
  content: z.string().min(1),
});

export type AddMessageInput = z.infer<typeof AddMessageInputSchema>;
