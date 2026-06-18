import type { ChatContentPart } from '../domain/llm-message';
import { toClaudeContent } from './claude.client';

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
});
