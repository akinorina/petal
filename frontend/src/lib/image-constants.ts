import type { Schemas } from './openapi/client';

export const ALLOWED_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
] as const;

export const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;

export type ImageMimeType = Schemas['CreateImageRequestDto']['mimeType'];

export function formatImageSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export type ImageFileValidation =
  | { ok: true; file: File; mimeType: ImageMimeType }
  | { ok: false; message: string };

export function validateImageFile(file: File): ImageFileValidation {
  if (!(ALLOWED_IMAGE_MIME_TYPES as readonly string[]).includes(file.type)) {
    return {
      ok: false,
      message: `対応していないファイル形式です: ${file.type || '不明'}（JPEG/PNG/GIF/WebP のみ）`,
    };
  }
  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    return {
      ok: false,
      message: `ファイルサイズが上限 (${formatImageSize(MAX_IMAGE_SIZE_BYTES)}) を超えています`,
    };
  }
  return { ok: true, file, mimeType: file.type as ImageMimeType };
}
