import { ApiProperty } from '@nestjs/swagger';
import {
  ALLOWED_IMAGE_MIME_TYPES,
  type ImageMimeType,
} from '../../image/domain/image';
import { ChatRoleSchema } from '../domain/llm-message';

export class ChatMessageAttachmentDto {
  imageId!: string;
  position!: number;
  @ApiProperty({ enum: ALLOWED_IMAGE_MIME_TYPES })
  mimeType!: ImageMimeType;
  originalFilename!: string;
  downloadUrl!: string;
  @ApiProperty()
  expiresInSeconds!: number;
}

export class ChatThreadResponseDto {
  id!: string;
  ownerUserId!: string;
  title!: string | null;
  @ApiProperty({ format: 'date-time' })
  createdAt!: string;
  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
}

export class ChatMessageResponseDto {
  id!: string;
  threadId!: string;
  seq!: number;
  @ApiProperty({ enum: ChatRoleSchema.options })
  role!: (typeof ChatRoleSchema.options)[number];
  content!: string;
  @ApiProperty({ format: 'date-time' })
  createdAt!: string;
  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
  @ApiProperty({ type: [ChatMessageAttachmentDto] })
  attachments!: ChatMessageAttachmentDto[];
}

export class CreateThreadRequestDto {
  title?: string | null;
}

export class UpdateThreadRequestDto {
  title?: string | null;
}

export class SendMessageRequestDto {
  content!: string;
  @ApiProperty({ type: [String], required: false })
  attachmentImageIds?: string[];
}
