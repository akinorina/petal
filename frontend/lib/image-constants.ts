import type { Schemas } from './openapi/client';

export const ALLOWED_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
] as const;

export const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;

export type ImageMimeType = Schemas['CreateImageRequestDto']['mimeType'];
