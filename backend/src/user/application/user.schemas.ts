import { z } from 'zod';
import { UserRole } from '../domain/user-role.enum';

export const CreateUserSchema = z.object({
  email: z.email(),
  name: z.string().min(1).max(100),
  nameKana: z.string().min(1).max(100),
  role: z.enum(UserRole).default(UserRole.User),
});

export const UpdateUserSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  nameKana: z.string().min(1).max(100).optional(),
  role: z.enum(UserRole).optional(),
});

export const UpdateMyProfileSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  nameKana: z.string().min(1).max(100).optional(),
});

export const ListUsersQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  q: z
    .string()
    .max(100)
    .optional()
    .transform((v) => {
      if (v === undefined) return undefined;
      const trimmed = v.trim();
      return trimmed === '' ? undefined : trimmed;
    }),
  role: z.enum(UserRole).optional(),
  deleted: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
});

export const RequestEmailChangeSchema = z.object({
  email: z.email(),
});

export const ConfirmEmailChangeSchema = z.object({
  code: z.string().min(1),
});

export type CreateUserInput = z.infer<typeof CreateUserSchema>;
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;
export type UpdateMyProfileInput = z.infer<typeof UpdateMyProfileSchema>;
export type ListUsersQuery = z.infer<typeof ListUsersQuerySchema>;
export type RequestEmailChangeInput = z.infer<typeof RequestEmailChangeSchema>;
export type ConfirmEmailChangeInput = z.infer<typeof ConfirmEmailChangeSchema>;
