import { z } from 'zod';

// /v1/models の 1 件。SDK 応答（外部入力）の検証に用いる。
export const LlmModelSchema = z.object({
  id: z.string(),
  ownedBy: z.string().nullish(),
});

export type LlmModel = z.infer<typeof LlmModelSchema>;
