import type { ChatContentPart } from '../domain/llm-message';
import { toGeminiParts } from './gemini.client';

describe('toGeminiParts', () => {
  it('string は単一 text part の配列にする', () => {
    expect(toGeminiParts('こんにちは')).toEqual([{ text: 'こんにちは' }]);
  });

  it('text＋image 混在を Gemini の Part 配列へ変換する', () => {
    const content: ChatContentPart[] = [
      { type: 'text', text: 'この画像は？' },
      { type: 'image', mediaType: 'image/png', data: 'YmFzZTY0' },
    ];
    expect(toGeminiParts(content)).toEqual([
      { text: 'この画像は？' },
      { inlineData: { mimeType: 'image/png', data: 'YmFzZTY0' } },
    ]);
  });
});
