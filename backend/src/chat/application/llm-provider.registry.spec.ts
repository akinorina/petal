import type { ConfigService } from '@nestjs/config';
import type { ChatGenerationInput } from '../domain/llm-generation';
import { ClaudeClient } from '../infra/claude.client';
import { GeminiClient } from '../infra/gemini.client';
import { LlmConfig } from '../infra/llm.config';
import { OpenAiCompatibleClient } from '../infra/openai-compatible.client';
import { LlmProviderRegistry } from './llm-provider.registry';

// ダミー ConfigService（env を Record から返す。実 API には一切接続しない）。
function buildConfig(env: Record<string, string>): LlmConfig {
  const configService = {
    get: (key: string): string | undefined => env[key],
  } as unknown as ConfigService;
  return new LlmConfig(configService);
}

const input: ChatGenerationInput = {
  messages: [{ role: 'user', content: 'hi' }],
};

describe('LlmProviderRegistry', () => {
  it('設定済み provider のみ availableIds に並ぶ', () => {
    const registry = new LlmProviderRegistry(
      buildConfig({
        LLM_PROVIDER: 'claude',
        CLAUDE_API_KEY: 'sk-claude',
        GEMINI_API_KEY: 'sk-gemini',
      }),
    );
    expect(registry.availableIds().sort()).toEqual(['claude', 'gemini']);
    expect(registry.has('claude')).toBe(true);
    expect(registry.has('openai')).toBe(false);
    expect(registry.has('local')).toBe(false);
  });

  it('get(id) が provider 別の具象を返す（openai/local は OpenAI 互換）', () => {
    const registry = new LlmProviderRegistry(
      buildConfig({
        LLM_PROVIDER: 'claude',
        CLAUDE_API_KEY: 'sk-claude',
        GEMINI_API_KEY: 'sk-gemini',
        OPENAI_API_KEY: 'sk-openai',
        LOCALLLM_BASE_URL: 'http://localhost:1234/v1',
      }),
    );
    expect(registry.get('claude')).toBeInstanceOf(ClaudeClient);
    expect(registry.get('gemini')).toBeInstanceOf(GeminiClient);
    expect(registry.get('openai')).toBeInstanceOf(OpenAiCompatibleClient);
    expect(registry.get('local')).toBeInstanceOf(OpenAiCompatibleClient);
  });

  it('getActive() が LLM_PROVIDER 指定の provider を返す', () => {
    const registry = new LlmProviderRegistry(
      buildConfig({ LLM_PROVIDER: 'gemini', GEMINI_API_KEY: 'sk-gemini' }),
    );
    expect(registry.getActive()).toBeInstanceOf(GeminiClient);
  });

  it('LLM_PROVIDER 未指定なら既定 local', () => {
    const registry = new LlmProviderRegistry(
      buildConfig({ LOCALLLM_BASE_URL: 'http://localhost:1234/v1' }),
    );
    expect(registry.getActive()).toBeInstanceOf(OpenAiCompatibleClient);
    expect(registry.availableIds()).toEqual(['local']);
  });

  it('未登録 id への get は明確なエラー', () => {
    const registry = new LlmProviderRegistry(
      buildConfig({
        LLM_PROVIDER: 'local',
        LOCALLLM_BASE_URL: 'http://localhost:1234/v1',
      }),
    );
    expect(() => registry.get('claude')).toThrow(/claude/);
  });

  describe('active が未設定（必須 env 欠落）のとき', () => {
    it('has は false だが getActive は遅延スタブを返し、利用時に明確なエラー', async () => {
      const registry = new LlmProviderRegistry(
        buildConfig({ LLM_PROVIDER: 'claude' }), // CLAUDE_API_KEY 無し
      );
      expect(registry.has('claude')).toBe(false);

      const provider = registry.getActive();
      await expect(provider.listModels()).rejects.toThrow(/claude/);
      await expect(provider.generate(input)).rejects.toThrow(/claude/);
      await expect(
        (async () => {
          for await (const chunk of provider.generateStream(input)) {
            // 最初の next() で throw されるため到達しない
            void chunk;
          }
        })(),
      ).rejects.toThrow(/claude/);
    });
  });
});
