import {
  ChatContentPartSchema,
  contentToText,
  hasAudioContent,
  hasImageContent,
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

  it('audio part を判別して parse できる', () => {
    const parsed = ChatContentPartSchema.parse({
      type: 'audio',
      mediaType: 'audio/mpeg',
      data: 'YmFzZTY0',
    });
    expect(parsed.type).toBe('audio');
  });

  it('未知の type は parse 失敗', () => {
    expect(() =>
      ChatContentPartSchema.parse({ type: 'video', data: 'x' }),
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

  it('audio part の data 空は parse 失敗', () => {
    expect(() =>
      ChatContentPartSchema.parse({
        type: 'audio',
        mediaType: 'audio/mpeg',
        data: '',
      }),
    ).toThrow();
  });
});

describe('hasImageContent', () => {
  it('string content のみなら false', () => {
    expect(
      hasImageContent([{ content: 'こんにちは' }, { content: 'やあ' }]),
    ).toBe(false);
  });

  it('image part を含む配列があれば true', () => {
    const content: ChatContentPart[] = [
      { type: 'text', text: '前' },
      { type: 'image', mediaType: 'image/png', data: 'YmFzZTY0' },
    ];
    expect(hasImageContent([{ content: 'やあ' }, { content }])).toBe(true);
  });

  it('text part のみの配列なら false', () => {
    const content: ChatContentPart[] = [
      { type: 'text', text: 'あ' },
      { type: 'text', text: 'い' },
    ];
    expect(hasImageContent([{ content }])).toBe(false);
  });
});

describe('hasAudioContent', () => {
  it('string content のみなら false', () => {
    expect(
      hasAudioContent([{ content: 'こんにちは' }, { content: 'やあ' }]),
    ).toBe(false);
  });

  it('audio part を含む配列があれば true', () => {
    const content: ChatContentPart[] = [
      { type: 'text', text: '前' },
      { type: 'audio', mediaType: 'audio/mpeg', data: 'YmFzZTY0' },
    ];
    expect(hasAudioContent([{ content: 'やあ' }, { content }])).toBe(true);
  });

  it('image part のみの配列なら false', () => {
    const content: ChatContentPart[] = [
      { type: 'text', text: 'あ' },
      { type: 'image', mediaType: 'image/png', data: 'YmFzZTY0' },
    ];
    expect(hasAudioContent([{ content }])).toBe(false);
  });
});
