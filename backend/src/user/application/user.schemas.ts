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

export type CreateUserInput = z.infer<typeof CreateUserSchema>;
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;
