import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';
import { ProviderIdSchema, type ProviderId } from '../domain/llm-provider';

// chat フィーチャの env スキーマ。provider 別キーをすべて optional で受ける
// （未設定でもアプリ起動は妨げない。「必須」性は active provider 利用時の
// 遅延エラーで担保する。§13 D6）。空文字は呼び出し側で undefined へ正規化する。
export const LlmEnvSchema = z.object({
  // Chat が使う provider。未設定時は後方互換で 'local'。
  LLM_PROVIDER: ProviderIdSchema.default('local'),
  // Claude（@anthropic-ai/sdk）
  CLAUDE_API_KEY: z.string().min(1).optional(),
  CLAUDE_MODEL: z.string().min(1).optional(),
  // Gemini（@google/genai）
  GEMINI_API_KEY: z.string().min(1).optional(),
  GEMINI_MODEL: z.string().min(1).optional(),
  // OpenAI（本家・OpenAI 互換）
  OPENAI_API_KEY: z.string().min(1).optional(),
  OPENAI_MODEL: z.string().min(1).optional(),
  OPENAI_BASE_URL: z.string().url().default('https://api.openai.com/v1'),
  // LocalLLM（LM Studio 等・OpenAI 互換）
  LOCALLLM_BASE_URL: z.string().url().optional(),
  LOCALLLM_API_KEY: z.string().min(1).default('not-needed'),
  LOCALLLM_MODEL: z.string().min(1).optional(),
});

export type LlmEnv = z.infer<typeof LlmEnvSchema>;

// OpenAI 互換クライアント（openai / local で共用）の設定。
export interface OpenAiCompatConfig {
  baseUrl: string | undefined;
  apiKey: string | undefined;
  defaultModel: string | undefined;
  // エラーメッセージ用の表示名（'OpenAI' / 'LocalLLM'）。
  label: string;
}

export interface ClaudeConfig {
  apiKey: string | undefined;
  defaultModel: string | undefined;
}

export interface GeminiConfig {
  apiKey: string | undefined;
  defaultModel: string | undefined;
}

@Injectable()
export class LlmConfig {
  // Chat が使う有効 provider の id。
  readonly activeProviderId: ProviderId;
  private readonly env: LlmEnv;

  constructor(config: ConfigService) {
    // 環境変数が空文字（serverless の `''` 既定や .env の `KEY=`）の場合は
    // undefined へ正規化し、Zod の optional / default を機能させる。
    this.env = LlmEnvSchema.parse({
      LLM_PROVIDER: config.get<string>('LLM_PROVIDER') || undefined,
      CLAUDE_API_KEY: config.get<string>('CLAUDE_API_KEY') || undefined,
      CLAUDE_MODEL: config.get<string>('CLAUDE_MODEL') || undefined,
      GEMINI_API_KEY: config.get<string>('GEMINI_API_KEY') || undefined,
      GEMINI_MODEL: config.get<string>('GEMINI_MODEL') || undefined,
      OPENAI_API_KEY: config.get<string>('OPENAI_API_KEY') || undefined,
      OPENAI_MODEL: config.get<string>('OPENAI_MODEL') || undefined,
      OPENAI_BASE_URL: config.get<string>('OPENAI_BASE_URL') || undefined,
      LOCALLLM_BASE_URL: config.get<string>('LOCALLLM_BASE_URL') || undefined,
      LOCALLLM_API_KEY: config.get<string>('LOCALLLM_API_KEY') || undefined,
      LOCALLLM_MODEL: config.get<string>('LOCALLLM_MODEL') || undefined,
    });
    this.activeProviderId = this.env.LLM_PROVIDER;
  }

  get claudeConfig(): ClaudeConfig {
    return {
      apiKey: this.env.CLAUDE_API_KEY,
      defaultModel: this.env.CLAUDE_MODEL,
    };
  }

  get geminiConfig(): GeminiConfig {
    return {
      apiKey: this.env.GEMINI_API_KEY,
      defaultModel: this.env.GEMINI_MODEL,
    };
  }

  get openaiConfig(): OpenAiCompatConfig {
    return {
      baseUrl: this.env.OPENAI_BASE_URL,
      apiKey: this.env.OPENAI_API_KEY,
      defaultModel: this.env.OPENAI_MODEL,
      label: 'OpenAI',
    };
  }

  get localConfig(): OpenAiCompatConfig {
    return {
      baseUrl: this.env.LOCALLLM_BASE_URL,
      apiKey: this.env.LOCALLLM_API_KEY,
      defaultModel: this.env.LOCALLLM_MODEL,
      label: 'LocalLLM',
    };
  }

  // その provider が利用可能な最低限の env が揃っているか。
  // レジストリはこれが true の provider のみ実体生成する。
  isConfigured(id: ProviderId): boolean {
    switch (id) {
      case 'claude':
        return this.env.CLAUDE_API_KEY !== undefined;
      case 'gemini':
        return this.env.GEMINI_API_KEY !== undefined;
      case 'openai':
        return this.env.OPENAI_API_KEY !== undefined;
      case 'local':
        return this.env.LOCALLLM_BASE_URL !== undefined;
    }
  }
}
