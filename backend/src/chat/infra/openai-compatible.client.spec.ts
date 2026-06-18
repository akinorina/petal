import type { ChatContentPart } from '../domain/llm-message';
import { VisionUnsupportedError } from '../domain/vision-unsupported.error';
import {
  OpenAiCompatibleClient,
  toOpenAiContent,
} from './openai-compatible.client';
import type { OpenAiCompatConfig } from './llm.config';

const baseConfig: OpenAiCompatConfig = {
  baseUrl: 'http://localhost:1234/v1',
  apiKey: 'not-needed',
  defaultModel: 'local-model',
  label: 'LocalLLM',
  supportsVision: false,
};

describe('OpenAiCompatibleClient.supportsVision', () => {
  it('config の supportsVision=false を返す', () => {
    const client = new OpenAiCompatibleClient({
      ...baseConfig,
      supportsVision: false,
    });
    expect(client.supportsVision()).toBe(false);
  });

  it('config の supportsVision=true を返す', () => {
    const client = new OpenAiCompatibleClient({
      ...baseConfig,
      supportsVision: true,
    });
    expect(client.supportsVision()).toBe(true);
  });
});

describe('OpenAiCompatibleClient.generateStream（vision guard）', () => {
  it('vision 非対応 & 画像付き content は SDK 生成前に VisionUnsupportedError', async () => {
    // baseUrl/apiKey は設定済みだが supportsVision=false。
    // SDK 生成前に throw されるため、ネットワークは発生しない。
    const client = new OpenAiCompatibleClient({
      ...baseConfig,
      supportsVision: false,
    });
    const content: ChatContentPart[] = [
      { type: 'text', text: 'これは何？' },
      { type: 'image', mediaType: 'image/png', data: 'YmFzZTY0' },
    ];
    const gen = client.generateStream({
      messages: [{ role: 'user', content }],
    });
    await expect(gen.next()).rejects.toBeInstanceOf(VisionUnsupportedError);
  });
});

describe('toOpenAiContent', () => {
  it('string はそのまま返す', () => {
    expect(toOpenAiContent('こんにちは')).toBe('こんにちは');
  });

  it('text＋image 混在を OpenAI content parts へ変換する', () => {
    const content: ChatContentPart[] = [
      { type: 'text', text: '説明して' },
      { type: 'image', mediaType: 'image/png', data: 'YmFzZTY0' },
    ];
    expect(toOpenAiContent(content)).toEqual([
      { type: 'text', text: '説明して' },
      {
        type: 'image_url',
        image_url: { url: 'data:image/png;base64,YmFzZTY0' },
      },
    ]);
  });
});
