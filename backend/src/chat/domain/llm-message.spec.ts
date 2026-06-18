import {
  ChatContentPartSchema,
  contentToText,
  type ChatContentPart,
} from './llm-message';

describe('contentToText', () => {
  it('string はそのまま返す', () => {
    expect(contentToText('こんにちは')).toBe('こんにちは');
  });

  it('text part を順に結合する', () => {
    const content: ChatContentPart[] = [
      { type: 'text', text: 'あ' },
      { type: 'text', text: 'い' },
      { type: 'text', text: 'う' },
    ];
    expect(contentToText(content)).toBe('あいう');
  });

  it('image part は無視する', () => {
    const content: ChatContentPart[] = [
      { type: 'image', mediaType: 'image/png', data: 'YmFzZTY0' },
    ];
    expect(contentToText(content)).toBe('');
  });

  it('text と image の混在は text のみを結合する', () => {
    const content: ChatContentPart[] = [
      { type: 'text', text: '前' },
      { type: 'image', mediaType: 'image/png', data: 'YmFzZTY0' },
      { type: 'text', text: '後' },
    ];
    expect(contentToText(content)).toBe('前後');
  });
});

describe('ChatContentPartSchema', () => {
  it('text part を判別して parse できる', () => {
    const parsed = ChatContentPartSchema.parse({ type: 'text', text: 'x' });
    expect(parsed.type).toBe('text');
  });

  it('image part を判別して parse できる', () => {
    const parsed = ChatContentPartSchema.parse({
      type: 'image',
      mediaType: 'image/png',
      data: 'YmFzZTY0',
    });
    expect(parsed.type).toBe('image');
  });

  it('未知の type は parse 失敗', () => {
    expect(() =>
      ChatContentPartSchema.parse({ type: 'audio', data: 'x' }),
    ).toThrow();
  });

  it('image part の data 空は parse 失敗', () => {
    expect(() =>
      ChatContentPartSchema.parse({
        type: 'image',
        mediaType: 'image/png',
        data: '',
      }),
    ).toThrow();
  });
});
