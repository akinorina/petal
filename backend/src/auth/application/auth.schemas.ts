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

export const ForgotPasswordSchema = z.object({
  email: z.email(),
});

export const ConfirmForgotPasswordSchema = z.object({
  email: z.email(),
  code: z.string().min(1),
  newPassword: z.string().min(8),
});

export type LoginInput = z.infer<typeof LoginSchema>;
export type NewPasswordChallengeInput = z.infer<
  typeof NewPasswordChallengeSchema
>;
export type ForgotPasswordInput = z.infer<typeof ForgotPasswordSchema>;
export type ConfirmForgotPasswordInput = z.infer<
  typeof ConfirmForgotPasswordSchema
>;
