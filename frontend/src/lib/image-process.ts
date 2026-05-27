import { MAX_UPLOAD_LONG_EDGE, UPLOAD_JPEG_QUALITY } from './image-constants';

// モダンブラウザ（iOS Safari 15+、Chrome 81+）は HTMLImageElement のロード時に
// EXIF Orientation を自動適用するため、canvas への drawImage() も補正済みで描画される。
// 手動の EXIF 補正は二重補正になるため行わない。
export async function processImageFile(file: File): Promise<File> {
  const blobUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('画像の読み込みに失敗しました'));
      el.src = blobUrl;
    });

    // img.naturalWidth/Height はブラウザが EXIF 補正済みの寸法を返す
    const srcW = img.naturalWidth;
    const srcH = img.naturalHeight;
    const scale =
      Math.max(srcW, srcH) > MAX_UPLOAD_LONG_EDGE
        ? MAX_UPLOAD_LONG_EDGE / Math.max(srcW, srcH)
        : 1;
    const w = Math.round(srcW * scale);
    const h = Math.round(srcH * scale);

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas 2d context unavailable');
    ctx.drawImage(img, 0, 0, w, h);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) =>
          b ? resolve(b) : reject(new Error('画像の変換に失敗しました')),
        'image/jpeg',
        UPLOAD_JPEG_QUALITY,
      );
    });

    const baseName = file.name.replace(/\.[^.]+$/, '');
    return new File([blob], `${baseName}.jpg`, { type: 'image/jpeg' });
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
}
