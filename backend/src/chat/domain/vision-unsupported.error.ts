// 画像入力（vision）に対応していない provider へ画像付き content を
// 送ろうとしたときに投げる専用エラー。
// メッセージには provider の表示名のみを含め、接続先 URL・API キー等の
// 秘密情報は含めない（判断 3）。TSK-③ が instanceof で 4xx へマップする。
export class VisionUnsupportedError extends Error {
  constructor(providerLabel: string) {
    super(`この LLM (${providerLabel}) は画像入力に対応していません。`);
    this.name = 'VisionUnsupportedError';
  }
}
