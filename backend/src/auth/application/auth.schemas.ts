import { z } from 'zod';

export const LoginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

export const NewPasswordChallengeSchema = z.object({
  email: z.email(),
  newPassword: z.string().min(8),
  session: z.string().min(1),
});

export type LoginInput = z.infer<typeof LoginSchema>;
export type NewPasswordChallengeInput = z.infer<
  typeof NewPasswordChallengeSchema
>;
