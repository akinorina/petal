import { z } from 'zod';
import type {
  ChatChunk,
  ChatGenerationInput,
  ChatResult,
} from './llm-generation';
import type { LlmModel } from './llm-model';

// provider 識別子。env(LLM_PROVIDER) という外部入力の検証に使うため Zod enum。
// claude/gemini=専用 SDK、openai/local=OpenAI 互換クライアントの 2 インスタンス。
export const ProviderIdSchema = z.enum(['claude', 'gemini', 'openai', 'local']);
export type ProviderId = z.infer<typeof ProviderIdSchema>;

// 有効 provider（getActive() の結果・1 つ）を束ねる DI シンボル。
// 今後は chat.module で factory（registry.getActive()）として解決する。
export const LLM_PROVIDER = Symbol('LLM_PROVIDER');

// レジストリ本体の DI シンボル。設定済みの全 provider を id で引ける基盤。
// 将来「1 つまたは複数の LLM へアクセス」する機能がこれを inject する。
export const LLM_PROVIDER_REGISTRY = Symbol('LLM_PROVIDER_REGISTRY');

// LLM プロバイダー抽象。ローカル/リモートいずれの実装もこれに適合させる。
export interface LlmProvider {
  // 接続先が公開するモデル一覧を返す。
  listModels(): Promise<LlmModel[]>;
  // テキスト生成（ストリーミング）。
  generateStream(input: ChatGenerationInput): AsyncGenerator<ChatChunk>;
  // テキスト生成（集約版・非ストリーミング）。
  generate(input: ChatGenerationInput): Promise<ChatResult>;
  // この provider が画像入力（vision）に対応しているか。
  // application/TSK-③ が送信前に判定し、非対応なら画像付き送信を block する。
  supportsVision(): boolean;
}
