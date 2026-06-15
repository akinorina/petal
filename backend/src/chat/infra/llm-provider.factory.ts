import type { LlmProvider, ProviderId } from '../domain/llm-provider';
import { ClaudeClient } from './claude.client';
import { GeminiClient } from './gemini.client';
import { LlmConfig } from './llm.config';
import { OpenAiCompatibleClient } from './openai-compatible.client';

// 設定済み（isConfigured=true）の provider のみ具象を生成し Map で返す。
// 具象（infra アダプタ）の生成はこの infra コンポジションに隔離し、
// application 層（レジストリ）が infra に依存しないようにする（オニオン維持）。
export function buildLlmProviders(
  config: LlmConfig,
): Map<ProviderId, LlmProvider> {
  const providers = new Map<ProviderId, LlmProvider>();
  if (config.isConfigured('claude')) {
    providers.set('claude', new ClaudeClient(config.claudeConfig));
  }
  if (config.isConfigured('gemini')) {
    providers.set('gemini', new GeminiClient(config.geminiConfig));
  }
  if (config.isConfigured('openai')) {
    providers.set('openai', new OpenAiCompatibleClient(config.openaiConfig));
  }
  if (config.isConfigured('local')) {
    providers.set('local', new OpenAiCompatibleClient(config.localConfig));
  }
  return providers;
}
