import { z } from 'zod';

export const ALLOWED_AUDIO_MIME_TYPES = [
  'audio/mpeg',
  'audio/wav',
  'audio/webm',
  'audio/mp4',
  'audio/ogg',
] as const;

export const MAX_AUDIO_SIZE_BYTES = 20 * 1024 * 1024;

export const AudioSchema = z.object({
  id: z.uuid(),
  ownerUserId: z.uuid(),
  s3Key: z.string().min(1).max(512),
  originalFilename: z.string().min(1).max(255),
  mimeType: z.enum(ALLOWED_AUDIO_MIME_TYPES),
  sizeBytes: z.number().int().positive().max(MAX_AUDIO_SIZE_BYTES),
  durationSeconds: z.number().int().positive().nullable(),
  title: z.string().max(255).nullable(),
  description: z.string().max(1000).nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  deletedAt: z.date().nullable(),
});

export type AudioProps = z.infer<typeof AudioSchema>;
export type AudioMimeType = (typeof ALLOWED_AUDIO_MIME_TYPES)[number];

export class Audio {
  readonly id: string;
  readonly ownerUserId: string;
  readonly s3Key: string;
  readonly originalFilename: string;
  readonly mimeType: AudioMimeType;
  readonly sizeBytes: number;
  durationSeconds: number | null;
  title: string | null;
  description: string | null;
  readonly createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;

  constructor(props: AudioProps) {
    const validated = AudioSchema.parse(props);
    this.id = validated.id;
    this.ownerUserId = validated.ownerUserId;
    this.s3Key = validated.s3Key;
    this.originalFilename = validated.originalFilename;
    this.mimeType = validated.mimeType;
    this.sizeBytes = validated.sizeBytes;
    this.durationSeconds = validated.durationSeconds;
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
