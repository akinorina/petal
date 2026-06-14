import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';

// chat フィーチャ専用の env スキーマ。外部入力（環境変数）を Zod で検証する。
export const LlmEnvSchema = z.object({
  // 接続先 OpenAI 互換エンドポイント（例: http://localhost:1234/v1）。
  // 任意。未設定時はチャット利用時にのみエラーとし、アプリ起動は妨げない。
  LLM_BASE_URL: z.string().url().optional(),
  // 任意。未設定時は SDK 初期化用に 'not-needed' を既定とする（LM Studio 等は無視する）。
  LLM_API_KEY: z.string().min(1).default('not-needed'),
  // 任意。既定モデル。入力 model も LLM_MODEL も無ければ生成時にエラーを投げる。
  LLM_MODEL: z.string().min(1).optional(),
});

export type LlmEnv = z.infer<typeof LlmEnvSchema>;

@Injectable()
export class LlmConfig {
  readonly baseUrl: string | undefined;
  readonly apiKey: string;
  readonly defaultModel: string | undefined;

  constructor(config: ConfigService) {
    // 環境変数が空文字（serverless の `''` 既定や .env の `KEY=`）で渡る場合は
    // undefined に正規化し、Zod の optional / default を機能させる。
    const env = LlmEnvSchema.parse({
      LLM_BASE_URL: config.get<string>('LLM_BASE_URL') || undefined,
      LLM_API_KEY: config.get<string>('LLM_API_KEY') || undefined,
      LLM_MODEL: config.get<string>('LLM_MODEL') || undefined,
    });
    this.baseUrl = env.LLM_BASE_URL;
    this.apiKey = env.LLM_API_KEY;
    this.defaultModel = env.LLM_MODEL;
  }
}
