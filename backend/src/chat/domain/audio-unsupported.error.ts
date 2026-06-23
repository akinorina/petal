// 音声入力に対応していない provider へ音声付き content を
// 送ろうとしたときに投げる専用エラー（VisionUnsupportedError と同型・TSK-131）。
// メッセージには provider の表示名のみを含め、接続先 URL・API キー等の
// 秘密情報は含めない。application が instanceof で 4xx へマップする。
export class AudioUnsupportedError extends Error {
  constructor(providerLabel: string) {
    super(`この LLM (${providerLabel}) は音声入力に対応していません。`);
    this.name = 'AudioUnsupportedError';
  }
}
