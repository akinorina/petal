import { ApiProperty } from '@nestjs/swagger';
import { AuditAction } from '../domain/audit-action.enum';

export class AuditLogResponseDto {
  id!: string;
  actorUserId!: string;
  @ApiProperty({ enum: AuditAction })
  action!: AuditAction;
  targetUserId!: string | null;
  metadata!: Record<string, unknown> | null;
  createdAt!: string;
}

export class ListAuditLogsQueryDto {
  @ApiProperty({ required: false, default: 20 })
  limit?: number;
  @ApiProperty({ required: false, default: 0 })
  offset?: number;
}

export class ListAuditLogsResponseDto {
  @ApiProperty({ type: [AuditLogResponseDto] })
  items!: AuditLogResponseDto[];
  total!: number;
  limit!: number;
  offset!: number;
}
