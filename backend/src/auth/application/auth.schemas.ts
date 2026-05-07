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

export const RefreshSchema = z.object({
  refreshToken: z.string().min(1),
  email: z.email(),
});

export const MfaChallengeSchema = z.object({
  email: z.email(),
  code: z.string().min(6).max(6),
  session: z.string().min(1),
});

export const MfaVerifySchema = z.object({
  code: z.string().min(6).max(6),
});

export type LoginInput = z.infer<typeof LoginSchema>;
export type NewPasswordChallengeInput = z.infer<
  typeof NewPasswordChallengeSchema
>;
export type ForgotPasswordInput = z.infer<typeof ForgotPasswordSchema>;
export type ConfirmForgotPasswordInput = z.infer<
  typeof ConfirmForgotPasswordSchema
>;
export type RefreshInput = z.infer<typeof RefreshSchema>;
export type MfaChallengeInput = z.infer<typeof MfaChallengeSchema>;
export type MfaVerifyInput = z.infer<typeof MfaVerifySchema>;
