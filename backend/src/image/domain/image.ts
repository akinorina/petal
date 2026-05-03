import { z } from 'zod';

export const ALLOWED_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
] as const;

export const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;

export const ImageSchema = z.object({
  id: z.uuid(),
  ownerUserId: z.uuid(),
  s3Key: z.string().min(1).max(512),
  originalFilename: z.string().min(1).max(255),
  mimeType: z.enum(ALLOWED_IMAGE_MIME_TYPES),
  sizeBytes: z.number().int().positive().max(MAX_IMAGE_SIZE_BYTES),
  title: z.string().max(255).nullable(),
  description: z.string().max(1000).nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  deletedAt: z.date().nullable(),
});

export type ImageProps = z.infer<typeof ImageSchema>;
export type ImageMimeType = (typeof ALLOWED_IMAGE_MIME_TYPES)[number];

export class Image {
  readonly id: string;
  readonly ownerUserId: string;
  readonly s3Key: string;
  readonly originalFilename: string;
  readonly mimeType: ImageMimeType;
  readonly sizeBytes: number;
  title: string | null;
  description: string | null;
  readonly createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;

  constructor(props: ImageProps) {
    const validated = ImageSchema.parse(props);
    this.id = validated.id;
    this.ownerUserId = validated.ownerUserId;
    this.s3Key = validated.s3Key;
    this.originalFilename = validated.originalFilename;
    this.mimeType = validated.mimeType;
    this.sizeBytes = validated.sizeBytes;
    this.title = validated.title;
    this.description = validated.description;
    this.createdAt = validated.createdAt;
    this.updatedAt = validated.updatedAt;
    this.deletedAt = validated.deletedAt;
  }

  isOwnedBy(userId: string): boolean {
    return this.ownerUserId === userId;
  }
}
