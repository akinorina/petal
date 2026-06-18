import { Test, TestingModule } from '@nestjs/testing';
import { ZodError } from 'zod';
import type {
  ChatChunk,
  ChatGenerationInput,
  ChatResult,
} from '../domain/llm-generation';
import type { LlmModel } from '../domain/llm-model';
import { LLM_PROVIDER, type LlmProvider } from '../domain/llm-provider';
import { ChatService } from './chat.service';

type MockLlmProvider = {
  [K in keyof LlmProvider]: jest.Mock;
};

function buildMockProvider(): MockLlmProvider {
  return {
    listModels: jest.fn(),
    generate: jest.fn(),
    generateStream: jest.fn(),
    supportsVision: jest.fn(),
  };
}

async function buildService(provider: MockLlmProvider): Promise<ChatService> {
  const moduleRef: TestingModule = await Test.createTestingModule({
    providers: [ChatService, { provide: LLM_PROVIDER, useValue: provider }],
  }).compile();
  return moduleRef.get(ChatService);
}

async function* toAsyncGenerator(
  chunks: ChatChunk[],
): AsyncGenerator<ChatChunk> {
  for (const chunk of chunks) {
    await Promise.resolve();
    yield chunk;
  }
}

const validInput: ChatGenerationInput = {
  messages: [{ role: 'user', content: 'こんにちは' }],
};

describe('ChatService.listModels', () => {
  let service: ChatService;
  let provider: MockLlmProvider;

  beforeEach(async () => {
    provider = buildMockProvider();
    service = await buildService(provider);
  });

  it('provider のモデル一覧をそのまま返す', async () => {
    const models: LlmModel[] = [
      { id: 'model-a', ownedBy: 'local' },
      { id: 'model-b', ownedBy: null },
    ];
    provider.listModels.mockResolvedValue(models);

    await expect(service.listModels()).resolves.toEqual(models);
    expect(provider.listModels).toHaveBeenCalledTimes(1);
  });
});

describe('ChatService.generate', () => {
  let service: ChatService;
  let provider: MockLlmProvider;

  beforeEach(async () => {
    provider = buildMockProvider();
    service = await buildService(provider);
  });

  it('正常系: 入力を parse して provider.generate の結果を返す', async () => {
    const result: ChatResult = {
      model: 'model-a',
      content: 'やあ',
      finishReason: 'stop',
    };
    provider.generate.mockResolvedValue(result);

    await expect(service.generate(validInput)).resolves.toEqual(result);
    expect(provider.generate).toHaveBeenCalledWith(validInput);
  });

  it('入力検証: messages が空なら ZodError を投げ provider を呼ばない', async () => {
    await expect(service.generate({ messages: [] })).rejects.toBeInstanceOf(
      ZodError,
    );
    expect(provider.generate).not.toHaveBeenCalled();
  });
});

describe('ChatService.generateStream', () => {
  let service: ChatService;
  let provider: MockLlmProvider;

  beforeEach(async () => {
    provider = buildMockProvider();
    service = await buildService(provider);
  });

  it('正常系: チャンク列を for await で収集でき終端に done:true が来る', async () => {
    const chunks: ChatChunk[] = [
      { delta: 'こん', done: false },
      { delta: 'にちは', done: false },
      { delta: '', done: true, finishReason: 'stop', model: 'model-a' },
    ];
    provider.generateStream.mockReturnValue(toAsyncGenerator(chunks));

    const received: ChatChunk[] = [];
    for await (const chunk of service.generateStream(validInput)) {
      received.push(chunk);
    }

    expect(received).toEqual(chunks);
    expect(received[received.length - 1].done).toBe(true);
    expect(provider.generateStream).toHaveBeenCalledWith(validInput);
  });

  it('入力検証: messages が空なら parse 時点で ZodError を投げ provider を呼ばない', () => {
    expect(() => service.generateStream({ messages: [] })).toThrow(ZodError);
    expect(provider.generateStream).not.toHaveBeenCalled();
  });
});

describe('ChatService.supportsVision', () => {
  let service: ChatService;
  let provider: MockLlmProvider;

  beforeEach(async () => {
    provider = buildMockProvider();
    service = await buildService(provider);
  });

  it.each([true, false])(
    'provider.supportsVision の結果 %p をそのまま返す',
    (supported) => {
      provider.supportsVision.mockReturnValue(supported);
      expect(service.supportsVision()).toBe(supported);
      expect(provider.supportsVision).toHaveBeenCalledTimes(1);
    },
  );
});
