import { z } from 'zod';
import { ChatMessageSchema } from './llm-message';

// テキスト生成の入力。外部入力検証はこのスキーマに集約する
// （application 層が外部から受ける入力もこれで parse する）。
export const ChatGenerationInputSchema = z.object({
  // 省略時は LlmConfig の既定モデル（LLM_MODEL）を用いる。
  model: z.string().min(1).optional(),
  messages: z.array(ChatMessageSchema).min(1),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().positive().optional(),
});

export type ChatGenerationInput = z.infer<typeof ChatGenerationInputSchema>;

// ストリームの 1 片。done: true は終端マーカーで delta は空文字、
// finishReason/model は終端チャンクにのみ載る。
export interface ChatChunk {
  delta: string;
  done: boolean;
  finishReason?: string | null;
  model?: string;
}

// 集約結果（非ストリーミング用途）。
export interface ChatResult {
  model: string;
  content: string;
  finishReason: string | null;
}
