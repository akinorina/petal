import {
  BadRequestException,
  Controller,
  Get,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../user/domain/user-role.enum';
import { AuditLogService } from '../application/audit-log.service';
import { ListAuditLogsQuerySchema } from '../application/audit-log.schemas';
import { AuditLog } from '../domain/audit-log';
import {
  AuditLogResponseDto,
  ListAuditLogsQueryDto,
  ListAuditLogsResponseDto,
} from './audit-log.dto';

@ApiTags('audit-logs')
@ApiBearerAuth('bearer')
@Controller('audit-logs')
@Roles(UserRole.Admin)
export class AuditLogController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @Get()
  async findAll(
    @Query() query: ListAuditLogsQueryDto,
  ): Promise<ListAuditLogsResponseDto> {
    const parsed = ListAuditLogsQuerySchema.safeParse(query);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    const { limit, offset } = parsed.data;
    const { items, total } = await this.auditLogService.findAll(limit, offset);
    return {
      items: items.map(toResponse),
      total,
      limit,
      offset,
    };
  }
}

function toResponse(log: AuditLog): AuditLogResponseDto {
  return {
    id: log.id,
    actorUserId: log.actorUserId,
    action: log.action,
    targetUserId: log.targetUserId,
    metadata: log.metadata,
    createdAt: log.createdAt.toISOString(),
  };
}
