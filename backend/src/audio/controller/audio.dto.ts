import { ApiProperty } from '@nestjs/swagger';
import { ALLOWED_AUDIO_MIME_TYPES } from '../domain/audio';

export class AudioResponseDto {
  id!: string;
  ownerUserId!: string;
  originalFilename!: string;
  @ApiProperty({ enum: ALLOWED_AUDIO_MIME_TYPES })
  mimeType!: (typeof ALLOWED_AUDIO_MIME_TYPES)[number];
  sizeBytes!: number;
  durationSeconds!: number | null;
  title!: string | null;
  description!: string | null;
  @ApiProperty({ format: 'date-time' })
  createdAt!: string;
  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
}

export class UploadInstructionHeadersDto {
  @ApiProperty({ name: 'Content-Type' })
  'Content-Type'!: string;
}

export class UploadInstructionDto {
  url!: string;
  @ApiProperty({ enum: ['PUT'] })
  method!: 'PUT';
  expiresInSeconds!: number;
  headers!: UploadInstructionHeadersDto;
}

export class CreateAudioResponseDto {
  audio!: AudioResponseDto;
  upload!: UploadInstructionDto;
}

export class DownloadUrlResponseDto {
  url!: string;
  expiresInSeconds!: number;
}

export class CreateAudioRequestDto {
  originalFilename!: string;
  @ApiProperty({ enum: ALLOWED_AUDIO_MIME_TYPES })
  mimeType!: (typeof ALLOWED_AUDIO_MIME_TYPES)[number];
  sizeBytes!: number;
  durationSeconds?: number;
  title?: string;
  description?: string;
}
