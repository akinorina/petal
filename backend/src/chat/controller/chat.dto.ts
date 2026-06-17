import { ApiProperty } from '@nestjs/swagger';
import { ChatRoleSchema } from '../domain/llm-message';

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
}

export class CreateThreadRequestDto {
  title?: string | null;
}

export class UpdateThreadRequestDto {
  title?: string | null;
}

export class SendMessageRequestDto {
  content!: string;
}
