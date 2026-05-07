import { Inject, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { AuditAction } from '../domain/audit-action.enum';
import { AuditLog } from '../domain/audit-log';
import {
  AUDIT_LOG_REPOSITORY,
  IAuditLogRepository,
} from '../domain/audit-log.repository';

export type RecordAuditLogInput = {
  actorUserId: string;
  action: AuditAction;
  targetUserId?: string | null;
  metadata?: Record<string, unknown> | null;
};

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(
    @Inject(AUDIT_LOG_REPOSITORY)
    private readonly auditLogRepository: IAuditLogRepository,
  ) {}

  /**
   * 監査ログを書き込む。書き込み失敗は best-effort（WARN ログのみ）として扱い
   * 呼び出し側に例外を伝播させない。
   */
  async record(input: RecordAuditLogInput): Promise<void> {
    try {
      const log = new AuditLog({
        id: randomUUID(),
        actorUserId: input.actorUserId,
        action: input.action,
        targetUserId: input.targetUserId ?? null,
        metadata: input.metadata ?? null,
        createdAt: new Date(),
      });
      await this.auditLogRepository.save(log);
    } catch (err) {
      this.logger.warn(
        `監査ログの書き込みに失敗しました: action=${input.action} actor=${input.actorUserId} target=${
          input.targetUserId ?? '-'
        } / ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  findAll(
    limit: number,
    offset: number,
  ): Promise<{ items: AuditLog[]; total: number }> {
    return this.auditLogRepository.findAll(limit, offset);
  }
}
