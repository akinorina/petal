import { z } from 'zod';
import {
  ALLOWED_IMAGE_MIME_TYPES,
  MAX_IMAGE_SIZE_BYTES,
} from '../domain/image';

export const CreateImageSchema = z.object({
  originalFilename: z.string().min(1).max(255),
  mimeType: z.enum(ALLOWED_IMAGE_MIME_TYPES),
  sizeBytes: z.number().int().positive().max(MAX_IMAGE_SIZE_BYTES),
  title: z.string().max(255).optional(),
  description: z.string().max(1000).optional(),
});

export type CreateImageInput = z.infer<typeof CreateImageSchema>;
