export class ImageResponseDto {
  id!: string;
  ownerUserId!: string;
  originalFilename!: string;
  mimeType!: string;
  sizeBytes!: number;
  title!: string | null;
  description!: string | null;
  createdAt!: Date;
  updatedAt!: Date;
}

export class UploadInstructionDto {
  url!: string;
  method!: 'PUT';
  expiresInSeconds!: number;
  headers!: { 'Content-Type': string };
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
  mimeType!: string;
  sizeBytes!: number;
  title?: string;
  description?: string;
}
