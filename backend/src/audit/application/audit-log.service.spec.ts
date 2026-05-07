import { Test, TestingModule } from '@nestjs/testing';
import { randomUUID } from 'crypto';
import { AuditAction } from '../domain/audit-action.enum';
import { AuditLog } from '../domain/audit-log';
import {
  AUDIT_LOG_REPOSITORY,
  IAuditLogRepository,
} from '../domain/audit-log.repository';
import { AuditLogService } from './audit-log.service';

type MockAuditLogRepository = {
  [K in keyof IAuditLogRepository]: jest.Mock;
};

function buildMockRepository(): MockAuditLogRepository {
  return {
    save: jest.fn().mockResolvedValue(undefined),
    findAll: jest.fn(),
  };
}

async function buildService(
  repo: MockAuditLogRepository,
): Promise<AuditLogService> {
  const moduleRef: TestingModule = await Test.createTestingModule({
    providers: [
      AuditLogService,
      { provide: AUDIT_LOG_REPOSITORY, useValue: repo },
    ],
  }).compile();
  return moduleRef.get(AuditLogService);
}

describe('AuditLogService.record', () => {
  let service: AuditLogService;
  let repo: MockAuditLogRepository;

  beforeEach(async () => {
    repo = buildMockRepository();
    service = await buildService(repo);
  });

  const actorId = randomUUID();
  const targetId = randomUUID();

  it('正常系: AuditLog を生成し repository.save に渡す', async () => {
    await service.record({
      actorUserId: actorId,
      action: AuditAction.CreateUser,
      targetUserId: targetId,
      metadata: { email: 'x@y.z' },
    });

    expect(repo.save).toHaveBeenCalledTimes(1);
    const saved = repo.save.mock.calls[0][0];
    expect(saved).toBeInstanceOf(AuditLog);
    expect(saved.actorUserId).toBe(actorId);
    expect(saved.action).toBe(AuditAction.CreateUser);
    expect(saved.targetUserId).toBe(targetId);
    expect(saved.metadata).toEqual({ email: 'x@y.z' });
  });

  it('targetUserId / metadata 未指定なら null で保存される', async () => {
    await service.record({
      actorUserId: actorId,
      action: AuditAction.UpdateUser,
    });

    const saved = repo.save.mock.calls[0][0];
    expect(saved.targetUserId).toBeNull();
    expect(saved.metadata).toBeNull();
  });

  it('repository.save が失敗しても例外を伝播せず WARN ログのみ', async () => {
    repo.save.mockRejectedValue(new Error('db boom'));

    await expect(
      service.record({
        actorUserId: actorId,
        action: AuditAction.DeleteUser,
      }),
    ).resolves.toBeUndefined();
  });
});

describe('AuditLogService.findAll', () => {
  let service: AuditLogService;
  let repo: MockAuditLogRepository;

  beforeEach(async () => {
    repo = buildMockRepository();
    service = await buildService(repo);
  });

  it('repository.findAll に limit / offset を渡し結果をそのまま返す', async () => {
    repo.findAll.mockResolvedValue({ items: [], total: 0 });

    const result = await service.findAll(20, 40);

    expect(repo.findAll).toHaveBeenCalledWith(20, 40);
    expect(result).toEqual({ items: [], total: 0 });
  });
});
