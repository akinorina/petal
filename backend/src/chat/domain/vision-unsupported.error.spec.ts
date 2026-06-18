import { VisionUnsupportedError } from './vision-unsupported.error';

describe('VisionUnsupportedError', () => {
  it('name が VisionUnsupportedError', () => {
    const error = new VisionUnsupportedError('LocalLLM');
    expect(error.name).toBe('VisionUnsupportedError');
  });

  it('message に表示名を含む', () => {
    const error = new VisionUnsupportedError('LocalLLM');
    expect(error.message).toContain('LocalLLM');
    expect(error.message).toBe(
      'この LLM (LocalLLM) は画像入力に対応していません。',
    );
  });

  it('Error のインスタンスである', () => {
    expect(new VisionUnsupportedError('OpenAI')).toBeInstanceOf(Error);
  });

  it('message に接続先 URL や API キー等の秘密情報を含まない', () => {
    // 表示名のみを渡しても、URL・キーらしき文字列は出力に混入しない。
    const error = new VisionUnsupportedError('LocalLLM');
    expect(error.message).not.toMatch(/https?:\/\//);
    expect(error.message).not.toContain('api');
    expect(error.message).not.toContain('key');
  });
});
