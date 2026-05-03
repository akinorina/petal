import { z } from 'zod';
import { UserRole } from '../domain/user-role.enum';

export const CreateUserSchema = z.object({
  cognitoSub: z.string().min(1),
  name: z.string().min(1).max(100),
  nameKana: z.string().min(1).max(100),
  role: z.nativeEnum(UserRole).default(UserRole.User),
});

export const UpdateUserSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  nameKana: z.string().min(1).max(100).optional(),
  role: z.nativeEnum(UserRole).optional(),
});

export type CreateUserInput = z.infer<typeof CreateUserSchema>;
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;
