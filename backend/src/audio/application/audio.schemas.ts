import { z } from 'zod';
import {
  ALLOWED_AUDIO_MIME_TYPES,
  MAX_AUDIO_SIZE_BYTES,
} from '../domain/audio';

export const CreateAudioSchema = z.object({
  originalFilename: z.string().min(1).max(255),
  mimeType: z.enum(ALLOWED_AUDIO_MIME_TYPES),
  sizeBytes: z.number().int().positive().max(MAX_AUDIO_SIZE_BYTES),
  durationSeconds: z.number().int().positive().optional(),
  title: z.string().max(255).optional(),
  description: z.string().max(1000).optional(),
});

export type CreateAudioInput = z.infer<typeof CreateAudioSchema>;
