import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from '../domain/audit-log';
import { IAuditLogRepository } from '../domain/audit-log.repository';
import { AuditLogEntity } from './audit-log.entity';

@Injectable()
export class AuditLogRepositoryImpl implements IAuditLogRepository {
  constructor(
    @InjectRepository(AuditLogEntity)
    private readonly repo: Repository<AuditLogEntity>,
  ) {}

  async save(log: AuditLog): Promise<void> {
    await this.repo.save(this.toEntity(log));
  }

  async findAll(
    limit: number,
    offset: number,
  ): Promise<{ items: AuditLog[]; total: number }> {
    const [entities, total] = await this.repo.findAndCount({
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });
    return { items: entities.map((e) => this.toDomain(e)), total };
  }

  private toDomain(entity: AuditLogEntity): AuditLog {
    return new AuditLog({
      id: entity.id,
      actorUserId: entity.actorUserId,
      action: entity.action,
      targetUserId: entity.targetUserId,
      metadata: entity.metadata,
      createdAt: entity.createdAt,
    });
  }

  private toEntity(log: AuditLog): AuditLogEntity {
    const entity = new AuditLogEntity();
    entity.id = log.id;
    entity.actorUserId = log.actorUserId;
    entity.action = log.action;
    entity.targetUserId = log.targetUserId;
    entity.metadata = log.metadata;
    entity.createdAt = log.createdAt;
    return entity;
  }
}
