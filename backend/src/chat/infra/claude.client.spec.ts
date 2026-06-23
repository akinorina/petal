import { AudioUnsupportedError } from '../domain/audio-unsupported.error';
import type { ChatContentPart } from '../domain/llm-message';
import { ClaudeClient, toClaudeContent } from './claude.client';

describe('toClaudeContent', () => {
  it('string はそのまま返す', () => {
    expect(toClaudeContent('こんにちは')).toBe('こんにちは');
  });

  it('text＋image 混在を Anthropic の content block 配列へ変換する', () => {
    const content: ChatContentPart[] = [
      { type: 'text', text: 'この画像は？' },
      { type: 'image', mediaType: 'image/png', data: 'YmFzZTY0' },
    ];
    expect(toClaudeContent(content)).toEqual([
      { type: 'text', text: 'この画像は？' },
      {
        type: 'image',
        source: {
          type: 'base64',
          media_type: 'image/png',
          data: 'YmFzZTY0',
        },
      },
    ]);
  });

  it('audio part は AudioUnsupportedError を投げる（Claude 非対応）', () => {
    const content: ChatContentPart[] = [
      { type: 'audio', mediaType: 'audio/mpeg', data: 'YmFzZTY0' },
    ];
    expect(() => toClaudeContent(content)).toThrow(AudioUnsupportedError);
  });
});

describe('ClaudeClient.supportsAudio', () => {
  it('音声入力に非対応（false）', () => {
    const client = new ClaudeClient({
      apiKey: undefined,
      defaultModel: undefined,
    });
    expect(client.supportsAudio()).toBe(false);
  });
});
