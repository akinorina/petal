import type { ChatGenerationInput } from '../domain/llm-generation';
import type { LlmProvider, ProviderId } from '../domain/llm-provider';
import { LlmProviderRegistry } from './llm-provider.registry';

// 実 API に接続しないダミー provider。
function fakeProvider(): LlmProvider {
  return {
    listModels: jest.fn(),
    generate: jest.fn(),
    generateStream: jest.fn(),
    supportsVision: jest.fn(),
    supportsAudio: jest.fn(),
  };
}

const input: ChatGenerationInput = {
  messages: [{ role: 'user', content: 'hi' }],
};

describe('LlmProviderRegistry', () => {
  const claude = fakeProvider();
  const gemini = fakeProvider();
  const map = new Map<ProviderId, LlmProvider>([
    ['claude', claude],
    ['gemini', gemini],
  ]);

  it('availableIds は保持中の id 一覧', () => {
    const registry = new LlmProviderRegistry(map, 'claude');
    expect(registry.availableIds().sort()).toEqual(['claude', 'gemini']);
    expect(registry.has('claude')).toBe(true);
    expect(registry.has('openai')).toBe(false);
  });

  it('getActive は activeId のエントリを返す', () => {
    expect(new LlmProviderRegistry(map, 'gemini').getActive()).toBe(gemini);
  });

  it('get は該当エントリ／未登録 id は明確なエラー', () => {
    const registry = new LlmProviderRegistry(map, 'claude');
    expect(registry.get('claude')).toBe(claude);
    expect(() => registry.get('openai')).toThrow(/openai/);
  });

  describe('active が未設定（map に無い）のとき', () => {
    it('has は false、getActive は遅延スタブで利用時に明確なエラー', async () => {
      const registry = new LlmProviderRegistry(
        new Map<ProviderId, LlmProvider>(),
        'claude',
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
