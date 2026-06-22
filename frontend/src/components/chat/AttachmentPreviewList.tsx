'use client';

import type { Schemas } from '@/lib/openapi/client';
import { ImageThumb } from './ImageThumb';

type ImageItem = Schemas['ImageResponseDto'];

type AttachmentPreviewListProps = {
  /** 選択中の画像（選択順）。 */
  images: ImageItem[];
  /** 「×」で個別取り消し。 */
  onRemove: (id: string) => void;
  /** 送信中は取り消しを無効化する。 */
  disabled?: boolean;
};

/**
 * 入力欄上の選択中サムネ列（D1）。各サムネの「×」で個別取り消しする。
 * 選択が無いときは何も描画しない。
 */
export function AttachmentPreviewList({
  images,
  onRemove,
  disabled = false,
}: AttachmentPreviewListProps) {
  if (images.length === 0) return null;

  return (
    <ul className="mb-2 flex flex-wrap gap-2">
      {images.map((image) => {
        const label = image.title || image.originalFilename;
        return (
          <li key={image.id} className="relative">
            <div className="h-16 w-16 overflow-hidden rounded-md border border-zinc-200 bg-zinc-100">
              <ImageThumb imageId={image.id} alt={label} />
            </div>
            <button
              type="button"
              onClick={() => onRemove(image.id)}
              disabled={disabled}
              aria-label={`${label} を取り消す`}
              className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-zinc-800 text-xs text-white shadow disabled:opacity-40"
            >
              ×
            </button>
          </li>
        );
      })}
    </ul>
  );
}
