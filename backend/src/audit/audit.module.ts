import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLogService } from './application/audit-log.service';
import { AuditLogController } from './controller/audit-log.controller';
import { AUDIT_LOG_REPOSITORY } from './domain/audit-log.repository';
import { AuditLogEntity } from './infra/audit-log.entity';
import { AuditLogRepositoryImpl } from './infra/audit-log.repository.impl';

@Module({
  imports: [TypeOrmModule.forFeature([AuditLogEntity])],
  controllers: [AuditLogController],
  providers: [
    {
      provide: AUDIT_LOG_REPOSITORY,
      useClass: AuditLogRepositoryImpl,
    },
    AuditLogService,
  ],
  exports: [AuditLogService],
})
export class AuditModule {}
