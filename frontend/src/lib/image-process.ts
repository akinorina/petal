import { MAX_UPLOAD_LONG_EDGE, UPLOAD_JPEG_QUALITY } from './image-constants';

function readExifOrientation(buffer: ArrayBuffer): number {
  const view = new DataView(buffer);
  if (view.getUint16(0) !== 0xffd8) return 1;

  let offset = 2;
  while (offset < view.byteLength - 2) {
    const marker = view.getUint16(offset);
    offset += 2;
    if (marker === 0xffe1) {
      offset += 2; // segment length
      if (view.getUint32(offset) !== 0x45786966) return 1; // "Exif"
      offset += 6;
      const littleEndian = view.getUint16(offset) === 0x4949;
      const ifdOffset = offset + view.getUint32(offset + 4, littleEndian);
      const entryCount = view.getUint16(ifdOffset, littleEndian);
      for (let i = 0; i < entryCount; i++) {
        const entryOffset = ifdOffset + 2 + i * 12;
        if (view.getUint16(entryOffset, littleEndian) === 0x0112) {
          return view.getUint16(entryOffset + 8, littleEndian);
        }
      }
      return 1;
    } else if ((marker & 0xff00) !== 0xff00) {
      break;
    } else {
      offset += view.getUint16(offset);
    }
  }
  return 1;
}

// EXIF orientation に対応する canvas 2D transform matrix を適用して描画する。
// transform(a,b,c,d,e,f): canvas_x = a*dx + c*dy + e, canvas_y = b*dx + d*dy + f
// 各行列は標準 EXIF orientation 仕様に基づく。
function renderToCanvas(
  img: HTMLImageElement,
  orientation: number,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas 2d context unavailable');

  const srcW = img.naturalWidth;
  const srcH = img.naturalHeight;
  const scale =
    Math.max(srcW, srcH) > MAX_UPLOAD_LONG_EDGE
      ? MAX_UPLOAD_LONG_EDGE / Math.max(srcW, srcH)
      : 1;
  const w = Math.round(srcW * scale);
  const h = Math.round(srcH * scale);

  // orientations 5-8 は幅と高さが入れ替わる（90/270度回転）
  const swapDims = orientation >= 5 && orientation <= 8;
  canvas.width = swapDims ? h : w;
  canvas.height = swapDims ? w : h;

  switch (orientation) {
    case 2: ctx.transform(-1, 0, 0, 1, w, 0); break;
    case 3: ctx.transform(-1, 0, 0, -1, w, h); break;
    case 4: ctx.transform(1, 0, 0, -1, 0, h); break;
    case 5: ctx.transform(0, 1, 1, 0, 0, 0); break;
    case 6: ctx.transform(0, 1, -1, 0, h, 0); break; // 90° CW
    case 7: ctx.transform(0, -1, -1, 0, h, w); break;
    case 8: ctx.transform(0, -1, 1, 0, 0, w); break; // 90° CCW
    default: break;
  }

  ctx.drawImage(img, 0, 0, w, h);
  return canvas;
}

export async function processImageFile(file: File): Promise<File> {
  const buffer = await file.arrayBuffer();
  const orientation = readExifOrientation(buffer);

  const blobUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('画像の読み込みに失敗しました'));
      el.src = blobUrl;
    });

    const canvas = renderToCanvas(img, orientation);

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
