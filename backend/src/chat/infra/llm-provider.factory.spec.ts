import type { ConfigService } from '@nestjs/config';
import { ClaudeClient } from './claude.client';
import { GeminiClient } from './gemini.client';
import { buildLlmProviders } from './llm-provider.factory';
import { LlmConfig } from './llm.config';
import { OpenAiCompatibleClient } from './openai-compatible.client';

// ダミー ConfigService（env を Record から返す。実 API には一切接続しない）。
function buildConfig(env: Record<string, string>): LlmConfig {
  const configService = {
    get: (key: string): string | undefined => env[key],
  } as unknown as ConfigService;
  return new LlmConfig(configService);
}

describe('buildLlmProviders', () => {
  it('設定済み provider のみ生成し、provider 別の具象型になる', () => {
    const providers = buildLlmProviders(
      buildConfig({
        CLAUDE_API_KEY: 'sk-claude',
        GEMINI_API_KEY: 'sk-gemini',
        OPENAI_API_KEY: 'sk-openai',
        LOCALLLM_BASE_URL: 'http://localhost:1234/v1',
      }),
    );
    expect(providers.get('claude')).toBeInstanceOf(ClaudeClient);
    expect(providers.get('gemini')).toBeInstanceOf(GeminiClient);
    // openai / local はどちらも OpenAI 互換クライアント（別インスタンス）。
    expect(providers.get('openai')).toBeInstanceOf(OpenAiCompatibleClient);
    expect(providers.get('local')).toBeInstanceOf(OpenAiCompatibleClient);
    expect(providers.get('openai')).not.toBe(providers.get('local'));
  });

  it('必須 env が無い provider は含まれない', () => {
    const providers = buildLlmProviders(
      buildConfig({ CLAUDE_API_KEY: 'sk-claude' }),
    );
    expect([...providers.keys()]).toEqual(['claude']);
  });
});
