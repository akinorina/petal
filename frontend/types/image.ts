export const ALLOWED_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
] as const;

export type ImageMimeType = (typeof ALLOWED_IMAGE_MIME_TYPES)[number];

export const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;

export type ImageItem = {
  id: string;
  ownerUserId: string;
  originalFilename: string;
  mimeType: ImageMimeType;
  sizeBytes: number;
  title: string | null;
  description: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateImageRequest = {
  originalFilename: string;
  mimeType: ImageMimeType;
  sizeBytes: number;
  title?: string;
  description?: string;
};

export type UploadInstruction = {
  url: string;
  method: 'PUT';
  expiresInSeconds: number;
  headers: { 'Content-Type': string };
};

export type CreateImageResponse = {
  image: ImageItem;
  upload: UploadInstruction;
};

export type DownloadUrlResponse = {
  url: string;
  expiresInSeconds: number;
};
