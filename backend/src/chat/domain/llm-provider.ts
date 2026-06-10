import type {
  ChatChunk,
  ChatGenerationInput,
  ChatResult,
} from './llm-generation';
import type { LlmModel } from './llm-model';

// LLM プロバイダーの DI シンボル。具象（infra）はこのシンボルで束ねる。
export const LLM_PROVIDER = Symbol('LLM_PROVIDER');

// LLM プロバイダー抽象。ローカル/リモートいずれの実装もこれに適合させる。
export interface LlmProvider {
  // 接続先が公開するモデル一覧を返す。
  listModels(): Promise<LlmModel[]>;
  // テキスト生成（ストリーミング）。
  generateStream(input: ChatGenerationInput): AsyncGenerator<ChatChunk>;
  // テキスト生成（集約版・非ストリーミング）。
  generate(input: ChatGenerationInput): Promise<ChatResult>;
}
