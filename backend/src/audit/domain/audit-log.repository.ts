import { AuditLog } from './audit-log';

export const AUDIT_LOG_REPOSITORY = Symbol('IAuditLogRepository');

export interface IAuditLogRepository {
  save(log: AuditLog): Promise<void>;
  /**
   * 監査ログを新しい順で取得する。limit / offset でページング。
   * 戻り値の total は softDelete を持たない監査ログテーブル全体の件数。
   */
  findAll(
    limit: number,
    offset: number,
  ): Promise<{ items: AuditLog[]; total: number }>;
}
