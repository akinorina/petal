import { UpdateThreadInputSchema } from './chat-thread.schemas';

describe('UpdateThreadInputSchema', () => {
  it('通常の文字列はそのまま受け取る', () => {
    const result = UpdateThreadInputSchema.safeParse({ title: 'マイ会話' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.title).toBe('マイ会話');
  });

  it('前後の空白を trim する', () => {
    const result = UpdateThreadInputSchema.safeParse({ title: '  会話  ' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.title).toBe('会話');
  });

  it('空文字は null になる', () => {
    const result = UpdateThreadInputSchema.safeParse({ title: '' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.title).toBeNull();
  });

  it('空白のみは null になる', () => {
    const result = UpdateThreadInputSchema.safeParse({ title: '   ' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.title).toBeNull();
  });

  it('null は null のまま', () => {
    const result = UpdateThreadInputSchema.safeParse({ title: null });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.title).toBeNull();
  });

  it('trim 後 255 文字は許容する', () => {
    const title = `  ${'あ'.repeat(255)}  `;
    const result = UpdateThreadInputSchema.safeParse({ title });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.title).toBe('あ'.repeat(255));
  });

  it('trim 後 256 文字は失敗する', () => {
    const result = UpdateThreadInputSchema.safeParse({
      title: 'あ'.repeat(256),
    });
    expect(result.success).toBe(false);
  });

  it('title が欠落していると失敗する', () => {
    const result = UpdateThreadInputSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});
