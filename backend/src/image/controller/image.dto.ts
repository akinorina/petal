import { ApiProperty } from '@nestjs/swagger';
import { ALLOWED_IMAGE_MIME_TYPES } from '../domain/image';

export class ImageResponseDto {
  id!: string;
  ownerUserId!: string;
  originalFilename!: string;
  @ApiProperty({ enum: ALLOWED_IMAGE_MIME_TYPES })
  mimeType!: (typeof ALLOWED_IMAGE_MIME_TYPES)[number];
  sizeBytes!: number;
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

export class CreateImageResponseDto {
  image!: ImageResponseDto;
  upload!: UploadInstructionDto;
}

export class DownloadUrlResponseDto {
  url!: string;
  expiresInSeconds!: number;
}

export class CreateImageRequestDto {
  originalFilename!: string;
  @ApiProperty({ enum: ALLOWED_IMAGE_MIME_TYPES })
  mimeType!: (typeof ALLOWED_IMAGE_MIME_TYPES)[number];
  sizeBytes!: number;
  title?: string;
  description?: string;
}
