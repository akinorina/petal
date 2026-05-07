import { z } from 'zod';
import { AuditAction } from './audit-action.enum';

export const AuditLogSchema = z.object({
  id: z.uuid(),
  actorUserId: z.uuid(),
  action: z.enum(AuditAction),
  targetUserId: z.uuid().nullable(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
  createdAt: z.date(),
});

export type AuditLogProps = z.infer<typeof AuditLogSchema>;

export class AuditLog {
  readonly id: string;
  readonly actorUserId: string;
  readonly action: AuditAction;
  readonly targetUserId: string | null;
  readonly metadata: Record<string, unknown> | null;
  readonly createdAt: Date;

  constructor(props: AuditLogProps) {
    const validated = AuditLogSchema.parse(props);
    this.id = validated.id;
    this.actorUserId = validated.actorUserId;
    this.action = validated.action;
    this.targetUserId = validated.targetUserId;
    this.metadata = validated.metadata;
    this.createdAt = validated.createdAt;
  }
}
