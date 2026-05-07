import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { randomUUID } from 'crypto';
import { AuditLogService } from '../../audit/application/audit-log.service';
import { AuditAction } from '../../audit/domain/audit-action.enum';
import { LastAdminConflictException } from '../../common/exceptions/last-admin-conflict.exception';
import { User } from '../domain/user';
import { UserRole } from '../domain/user-role.enum';
import { IUserRepository, USER_REPOSITORY } from '../domain/user.repository';
import { CognitoUserClient } from '../infra/cognito-user.client';
import { UserService } from './user.service';

type MockUserRepository = {
  [K in keyof IUserRepository]: jest.Mock;
};

type MockCognitoUserClient = {
  [K in keyof CognitoUserClient]: jest.Mock;
};

type MockAuditLogService = {
  record: jest.Mock;
  findAll: jest.Mock;
};

const ACTOR_ID = randomUUID();

function buildUser(overrides: Partial<ConstructorParameters<typeof User>[0]> = {}): User {
  const now = new Date('2026-05-01T00:00:00Z');
  return new User({
    id: randomUUID(),
    cognitoSub: 'sub-xxx',
    email: 'taro@example.com',
    name: '山田 太郎',
    nameKana: 'やまだ たろう',
    role: UserRole.User,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    ...overrides,
  });
}

function buildMockRepository(): MockUserRepository {
  return {
    findById: jest.fn(),
    findByIdWithDeleted: jest.fn(),
    findByCognitoSub: jest.fn(),
    findByEmail: jest.fn(),
    findAll: jest.fn(),
    findAllDeleted: jest.fn(),
    save: jest.fn(),
    softDelete: jest.fn(),
    restore: jest.fn(),
    runInTransaction: jest.fn(),
    countActiveAdmins: jest.fn().mockResolvedValue(2),
  };
}

function buildMockCognitoUser(): MockCognitoUserClient {
  return {
    createUser: jest.fn(),
    deleteUser: jest.fn(),
    disableUser: jest.fn(),
    enableUser: jest.fn(),
    globalSignOut: jest.fn(),
    updateUserEmail: jest.fn(),
    verifyUserEmail: jest.fn(),
    getUserEmail: jest.fn(),
    isUsernameExists: jest.fn().mockReturnValue(false),
    isUserNotFound: jest.fn().mockReturnValue(false),
    isCodeMismatch: jest.fn().mockReturnValue(false),
    isExpiredCode: jest.fn().mockReturnValue(false),
    isAliasExists: jest.fn().mockReturnValue(false),
    isNotAuthorized: jest.fn().mockReturnValue(false),
  };
}

function buildMockAuditLog(): MockAuditLogService {
  return {
    record: jest.fn().mockResolvedValue(undefined),
    findAll: jest.fn(),
  };
}

async function buildService(
  userRepository: MockUserRepository,
  cognitoUser: MockCognitoUserClient,
  auditLog: MockAuditLogService = buildMockAuditLog(),
): Promise<UserService> {
  const moduleRef: TestingModule = await Test.createTestingModule({
    providers: [
      UserService,
      { provide: USER_REPOSITORY, useValue: userRepository },
      { provide: CognitoUserClient, useValue: cognitoUser },
      { provide: AuditLogService, useValue: auditLog },
    ],
  }).compile();
  return moduleRef.get(UserService);
}

describe('UserService.create', () => {
  let service: UserService;
  let userRepository: MockUserRepository;
  let cognitoUser: MockCognitoUserClient;

  beforeEach(async () => {
    userRepository = buildMockRepository();
    cognitoUser = buildMockCognitoUser();
    service = await buildService(userRepository, cognitoUser);
  });

  const input = {
    email: 'new@example.com',
    name: '新人 一郎',
    nameKana: 'しんじん いちろう',
    role: UserRole.User,
  };

  it('Cognito 登録 → DB save が成功し User を返す', async () => {
    userRepository.findByEmail.mockResolvedValue(null);
    cognitoUser.createUser.mockResolvedValue({ sub: 'sub-new' });
    userRepository.save.mockImplementation(async (u: User) => u);

    const result = await service.create(input, ACTOR_ID);

    expect(cognitoUser.createUser).toHaveBeenCalledWith(input.email);
    expect(userRepository.save).toHaveBeenCalledTimes(1);
    expect(result.email).toBe(input.email);
    expect(result.cognitoSub).toBe('sub-new');
  });

  it('既存 email で ConflictException', async () => {
    userRepository.findByEmail.mockResolvedValue(buildUser({ email: input.email }));

    await expect(service.create(input, ACTOR_ID)).rejects.toBeInstanceOf(ConflictException);
    expect(cognitoUser.createUser).not.toHaveBeenCalled();
  });

  it('Cognito 失敗（UsernameExists）で ConflictException', async () => {
    userRepository.findByEmail.mockResolvedValue(null);
    cognitoUser.createUser.mockRejectedValue(new Error('boom'));
    cognitoUser.isUsernameExists.mockReturnValue(true);

    await expect(service.create(input, ACTOR_ID)).rejects.toBeInstanceOf(ConflictException);
    expect(userRepository.save).not.toHaveBeenCalled();
  });

  it('Cognito 失敗（その他）で BadGatewayException', async () => {
    userRepository.findByEmail.mockResolvedValue(null);
    cognitoUser.createUser.mockRejectedValue(new Error('boom'));

    await expect(service.create(input, ACTOR_ID)).rejects.toBeInstanceOf(BadGatewayException);
  });

  it('DB save 失敗で Cognito 補償削除が呼ばれ、元の例外を再 throw する', async () => {
    userRepository.findByEmail.mockResolvedValue(null);
    cognitoUser.createUser.mockResolvedValue({ sub: 'sub-new' });
    const saveError = new Error('save boom');
    userRepository.save.mockRejectedValue(saveError);
    cognitoUser.deleteUser.mockResolvedValue(undefined);

    await expect(service.create(input, ACTOR_ID)).rejects.toBe(saveError);
    expect(cognitoUser.deleteUser).toHaveBeenCalledWith(input.email);
  });
});

describe('UserService.update', () => {
  let service: UserService;
  let userRepository: MockUserRepository;
  let cognitoUser: MockCognitoUserClient;
  let target: User;

  beforeEach(async () => {
    userRepository = buildMockRepository();
    cognitoUser = buildMockCognitoUser();
    service = await buildService(userRepository, cognitoUser);
    target = buildUser();
    userRepository.findById.mockResolvedValue(target);
    userRepository.save.mockImplementation(async (u: User) => u);
  });

  it('name / nameKana / role を更新できる', async () => {
    const result = await service.update(
      target.id,
      {
        name: '改名 太郎',
        nameKana: 'かいめい たろう',
        role: UserRole.Admin,
      },
      ACTOR_ID,
    );

    expect(result.name).toBe('改名 太郎');
    expect(result.nameKana).toBe('かいめい たろう');
    expect(result.role).toBe(UserRole.Admin);
    expect(userRepository.save).toHaveBeenCalledWith(target);
  });

  it('findById が見つからないと NotFoundException', async () => {
    userRepository.findById.mockResolvedValue(null);

    await expect(
      service.update(target.id, { name: 'X' }, ACTOR_ID),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('admin → user 降格で admin 数 1 のとき LastAdminConflictException', async () => {
    target = buildUser({ role: UserRole.Admin });
    userRepository.findById.mockResolvedValue(target);
    userRepository.countActiveAdmins.mockResolvedValue(1);

    await expect(
      service.update(target.id, { role: UserRole.User }, ACTOR_ID),
    ).rejects.toBeInstanceOf(LastAdminConflictException);
    expect(userRepository.save).not.toHaveBeenCalled();
  });

  it('admin → user 降格で admin 数 2 以上なら成功', async () => {
    target = buildUser({ role: UserRole.Admin });
    userRepository.findById.mockResolvedValue(target);
    userRepository.countActiveAdmins.mockResolvedValue(2);

    const result = await service.update(
      target.id,
      { role: UserRole.User },
      ACTOR_ID,
    );

    expect(result.role).toBe(UserRole.User);
    expect(userRepository.save).toHaveBeenCalledTimes(1);
  });

  it('user → admin 昇格は admin 数を見ずに成功', async () => {
    target = buildUser({ role: UserRole.User });
    userRepository.findById.mockResolvedValue(target);

    const result = await service.update(
      target.id,
      { role: UserRole.Admin },
      ACTOR_ID,
    );

    expect(result.role).toBe(UserRole.Admin);
    expect(userRepository.countActiveAdmins).not.toHaveBeenCalled();
  });

  it('role 変更なしの更新では countActiveAdmins を呼ばない', async () => {
    target = buildUser({ role: UserRole.Admin });
    userRepository.findById.mockResolvedValue(target);

    await service.update(target.id, { name: '改名' }, ACTOR_ID);

    expect(userRepository.countActiveAdmins).not.toHaveBeenCalled();
  });
});

describe('UserService.findById', () => {
  let service: UserService;
  let userRepository: MockUserRepository;
  let cognitoUser: MockCognitoUserClient;

  beforeEach(async () => {
    userRepository = buildMockRepository();
    cognitoUser = buildMockCognitoUser();
    service = await buildService(userRepository, cognitoUser);
  });

  it('取得成功', async () => {
    const user = buildUser();
    userRepository.findById.mockResolvedValue(user);

    await expect(service.findById(user.id)).resolves.toBe(user);
  });

  it('null のとき NotFoundException', async () => {
    userRepository.findById.mockResolvedValue(null);

    await expect(service.findById('missing')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('UserService.restore', () => {
  let service: UserService;
  let userRepository: MockUserRepository;
  let cognitoUser: MockCognitoUserClient;
  let deletedUser: User;

  beforeEach(async () => {
    userRepository = buildMockRepository();
    cognitoUser = buildMockCognitoUser();
    service = await buildService(userRepository, cognitoUser);
    deletedUser = buildUser({ deletedAt: new Date('2026-04-01T00:00:00Z') });
  });

  it('削除済みユーザーを復元すると enableUser が呼ばれる', async () => {
    userRepository.findByIdWithDeleted.mockResolvedValue(deletedUser);
    userRepository.restore.mockResolvedValue(undefined);
    cognitoUser.enableUser.mockResolvedValue(undefined);
    userRepository.findById.mockResolvedValue(buildUser({ id: deletedUser.id }));

    await service.restore(deletedUser.id, ACTOR_ID);

    expect(userRepository.restore).toHaveBeenCalledWith(deletedUser.id);
    expect(cognitoUser.enableUser).toHaveBeenCalledWith(deletedUser.email);
  });

  it('既に有効なら BadRequestException', async () => {
    userRepository.findByIdWithDeleted.mockResolvedValue(buildUser({ deletedAt: null }));

    await expect(service.restore('id', ACTOR_ID)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(userRepository.restore).not.toHaveBeenCalled();
  });

  it('Cognito にユーザーが居ないと BadGatewayException', async () => {
    userRepository.findByIdWithDeleted.mockResolvedValue(deletedUser);
    userRepository.restore.mockResolvedValue(undefined);
    cognitoUser.enableUser.mockRejectedValue(new Error('boom'));
    cognitoUser.isUserNotFound.mockReturnValue(true);

    await expect(service.restore(deletedUser.id, ACTOR_ID)).rejects.toBeInstanceOf(
      BadGatewayException,
    );
  });

  it('その他失敗で BadGatewayException', async () => {
    userRepository.findByIdWithDeleted.mockResolvedValue(deletedUser);
    userRepository.restore.mockResolvedValue(undefined);
    cognitoUser.enableUser.mockRejectedValue(new Error('boom'));

    await expect(service.restore(deletedUser.id, ACTOR_ID)).rejects.toBeInstanceOf(
      BadGatewayException,
    );
  });
});

describe('UserService.requestEmailChange', () => {
  let service: UserService;
  let userRepository: MockUserRepository;
  let cognitoUser: MockCognitoUserClient;
  let actor: User;

  beforeEach(async () => {
    userRepository = buildMockRepository();
    cognitoUser = buildMockCognitoUser();
    service = await buildService(userRepository, cognitoUser);
    actor = buildUser({ email: 'me@example.com' });
  });

  it('同一 email で BadRequestException', async () => {
    await expect(
      service.requestEmailChange(actor, actor.email, 'AT'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('他ユーザーが既に使用中で ConflictException', async () => {
    userRepository.findByEmail.mockResolvedValue(buildUser({ email: 'new@example.com' }));

    await expect(
      service.requestEmailChange(actor, 'new@example.com', 'AT'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('Cognito の AliasExists で ConflictException', async () => {
    userRepository.findByEmail.mockResolvedValue(null);
    cognitoUser.updateUserEmail.mockRejectedValue(new Error('boom'));
    cognitoUser.isAliasExists.mockReturnValue(true);

    await expect(
      service.requestEmailChange(actor, 'new@example.com', 'AT'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('NotAuthorized で UnauthorizedException', async () => {
    userRepository.findByEmail.mockResolvedValue(null);
    cognitoUser.updateUserEmail.mockRejectedValue(new Error('boom'));
    cognitoUser.isNotAuthorized.mockReturnValue(true);

    await expect(
      service.requestEmailChange(actor, 'new@example.com', 'AT'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('その他 Cognito 失敗で BadGatewayException', async () => {
    userRepository.findByEmail.mockResolvedValue(null);
    cognitoUser.updateUserEmail.mockRejectedValue(new Error('boom'));

    await expect(
      service.requestEmailChange(actor, 'new@example.com', 'AT'),
    ).rejects.toBeInstanceOf(BadGatewayException);
  });
});

describe('UserService.confirmEmailChange', () => {
  let service: UserService;
  let userRepository: MockUserRepository;
  let cognitoUser: MockCognitoUserClient;
  let actor: User;

  beforeEach(async () => {
    userRepository = buildMockRepository();
    cognitoUser = buildMockCognitoUser();
    service = await buildService(userRepository, cognitoUser);
    actor = buildUser({ email: 'me@example.com' });

    userRepository.runInTransaction.mockImplementation(
      async <T>(fn: (txRepo: IUserRepository) => Promise<T>): Promise<T> =>
        fn(userRepository as unknown as IUserRepository),
    );
  });

  it('正常系: トランザクション内で email を更新し Verify が呼ばれる', async () => {
    cognitoUser.getUserEmail.mockResolvedValue('new@example.com');
    userRepository.findByEmail.mockResolvedValue(null);
    userRepository.findById.mockResolvedValue(actor);
    userRepository.save.mockImplementation(async (u: User) => u);
    cognitoUser.verifyUserEmail.mockResolvedValue(undefined);

    await service.confirmEmailChange(actor, '123456', 'AT');

    expect(userRepository.save).toHaveBeenCalledTimes(1);
    expect(cognitoUser.verifyUserEmail).toHaveBeenCalledWith('AT', '123456');
    expect(actor.email).toBe('new@example.com');
  });

  it('保留中 email が現状と同じなら BadRequestException', async () => {
    cognitoUser.getUserEmail.mockResolvedValue(actor.email);

    await expect(service.confirmEmailChange(actor, '123', 'AT')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(userRepository.runInTransaction).not.toHaveBeenCalled();
  });

  it('Verify が CodeMismatch で BadRequestException', async () => {
    cognitoUser.getUserEmail.mockResolvedValue('new@example.com');
    userRepository.findByEmail.mockResolvedValue(null);
    userRepository.findById.mockResolvedValue(actor);
    userRepository.save.mockImplementation(async (u: User) => u);
    cognitoUser.verifyUserEmail.mockRejectedValue(new Error('boom'));
    cognitoUser.isCodeMismatch.mockReturnValue(true);

    await expect(
      service.confirmEmailChange(actor, '999', 'AT'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(userRepository.save).toHaveBeenCalledTimes(1);
  });

  it('Verify が ExpiredCode で BadRequestException', async () => {
    cognitoUser.getUserEmail.mockResolvedValue('new@example.com');
    userRepository.findByEmail.mockResolvedValue(null);
    userRepository.findById.mockResolvedValue(actor);
    userRepository.save.mockImplementation(async (u: User) => u);
    cognitoUser.verifyUserEmail.mockRejectedValue(new Error('boom'));
    cognitoUser.isExpiredCode.mockReturnValue(true);

    await expect(
      service.confirmEmailChange(actor, '999', 'AT'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('UserService.remove', () => {
  const targetEmail = 'taro@example.com';
  const actorId = randomUUID();

  let service: UserService;
  let userRepository: MockUserRepository;
  let cognitoUser: MockCognitoUserClient;
  let target: User;

  beforeEach(async () => {
    userRepository = buildMockRepository();
    cognitoUser = buildMockCognitoUser();
    target = buildUser({ email: targetEmail });
    userRepository.findById.mockResolvedValue(target);
    userRepository.softDelete.mockResolvedValue(undefined);
    cognitoUser.globalSignOut.mockResolvedValue(undefined);
    cognitoUser.disableUser.mockResolvedValue(undefined);
    service = await buildService(userRepository, cognitoUser);
  });

  it('softDelete → globalSignOut → disableUser の順で実行される', async () => {
    const calls: string[] = [];
    userRepository.softDelete.mockImplementation(async () => {
      calls.push('softDelete');
    });
    cognitoUser.globalSignOut.mockImplementation(async () => {
      calls.push('globalSignOut');
    });
    cognitoUser.disableUser.mockImplementation(async () => {
      calls.push('disableUser');
    });

    await service.remove(target.id, actorId);

    expect(calls).toEqual(['softDelete', 'globalSignOut', 'disableUser']);
    expect(userRepository.softDelete).toHaveBeenCalledWith(target.id);
    expect(cognitoUser.globalSignOut).toHaveBeenCalledWith(targetEmail);
    expect(cognitoUser.disableUser).toHaveBeenCalledWith(targetEmail);
  });

  it('globalSignOut が失敗しても disableUser まで進み、メソッドは成功する', async () => {
    cognitoUser.globalSignOut.mockRejectedValue(new Error('signout boom'));

    await expect(service.remove(target.id, actorId)).resolves.toBeUndefined();

    expect(userRepository.softDelete).toHaveBeenCalledTimes(1);
    expect(cognitoUser.disableUser).toHaveBeenCalledWith(targetEmail);
  });

  it('disableUser が失敗した場合は BadGatewayException を投げる', async () => {
    cognitoUser.disableUser.mockRejectedValue(new Error('disable boom'));

    await expect(service.remove(target.id, actorId)).rejects.toBeInstanceOf(
      BadGatewayException,
    );

    expect(userRepository.softDelete).toHaveBeenCalledTimes(1);
    expect(cognitoUser.globalSignOut).toHaveBeenCalledTimes(1);
  });

  it('自身削除（id === actorId）で LastAdminConflictException、副作用なし', async () => {
    await expect(service.remove(target.id, target.id)).rejects.toBeInstanceOf(
      LastAdminConflictException,
    );

    expect(userRepository.findById).not.toHaveBeenCalled();
    expect(userRepository.softDelete).not.toHaveBeenCalled();
    expect(cognitoUser.globalSignOut).not.toHaveBeenCalled();
    expect(cognitoUser.disableUser).not.toHaveBeenCalled();
  });

  it('対象が admin かつ admin 数 1 で LastAdminConflictException、副作用なし', async () => {
    target = buildUser({ email: targetEmail, role: UserRole.Admin });
    userRepository.findById.mockResolvedValue(target);
    userRepository.countActiveAdmins.mockResolvedValue(1);

    await expect(service.remove(target.id, actorId)).rejects.toBeInstanceOf(
      LastAdminConflictException,
    );

    expect(userRepository.softDelete).not.toHaveBeenCalled();
    expect(cognitoUser.globalSignOut).not.toHaveBeenCalled();
    expect(cognitoUser.disableUser).not.toHaveBeenCalled();
  });

  it('対象が admin かつ admin 数 2 以上なら通常削除フロー', async () => {
    target = buildUser({ email: targetEmail, role: UserRole.Admin });
    userRepository.findById.mockResolvedValue(target);
    userRepository.countActiveAdmins.mockResolvedValue(2);

    await expect(service.remove(target.id, actorId)).resolves.toBeUndefined();

    expect(userRepository.softDelete).toHaveBeenCalledWith(target.id);
    expect(cognitoUser.disableUser).toHaveBeenCalledWith(targetEmail);
  });

  it('対象が user なら countActiveAdmins を呼ばずに通常削除', async () => {
    await service.remove(target.id, actorId);

    expect(userRepository.countActiveAdmins).not.toHaveBeenCalled();
    expect(userRepository.softDelete).toHaveBeenCalledWith(target.id);
  });
});

describe('UserService の監査ログ連動', () => {
  let service: UserService;
  let userRepository: MockUserRepository;
  let cognitoUser: MockCognitoUserClient;
  let auditLog: MockAuditLogService;

  beforeEach(async () => {
    userRepository = buildMockRepository();
    cognitoUser = buildMockCognitoUser();
    auditLog = buildMockAuditLog();
    service = await buildService(userRepository, cognitoUser, auditLog);
  });

  it('create 成功で CREATE_USER が記録される', async () => {
    userRepository.findByEmail.mockResolvedValue(null);
    cognitoUser.createUser.mockResolvedValue({ sub: 'sub-new' });
    userRepository.save.mockImplementation(async (u: User) => u);

    const result = await service.create(
      {
        email: 'new@example.com',
        name: '新人',
        nameKana: 'しんじん',
        role: UserRole.User,
      },
      ACTOR_ID,
    );

    expect(auditLog.record).toHaveBeenCalledWith({
      actorUserId: ACTOR_ID,
      action: AuditAction.CreateUser,
      targetUserId: result.id,
      metadata: {
        email: 'new@example.com',
        role: UserRole.User,
        name: '新人',
      },
    });
  });

  it('create 失敗（Cognito エラー）では監査ログを記録しない', async () => {
    userRepository.findByEmail.mockResolvedValue(null);
    cognitoUser.createUser.mockRejectedValue(new Error('boom'));

    await expect(
      service.create(
        {
          email: 'x@example.com',
          name: 'X',
          nameKana: 'えっくす',
          role: UserRole.User,
        },
        ACTOR_ID,
      ),
    ).rejects.toBeInstanceOf(BadGatewayException);
    expect(auditLog.record).not.toHaveBeenCalled();
  });

  it('update で実際に変更があれば UPDATE_USER が記録される', async () => {
    const target = buildUser({ name: '旧名', role: UserRole.User });
    userRepository.findById.mockResolvedValue(target);
    userRepository.save.mockImplementation(async (u: User) => u);

    await service.update(
      target.id,
      { name: '新名', role: UserRole.Admin },
      ACTOR_ID,
    );

    expect(auditLog.record).toHaveBeenCalledTimes(1);
    const call = auditLog.record.mock.calls[0][0];
    expect(call.action).toBe(AuditAction.UpdateUser);
    expect(call.targetUserId).toBe(target.id);
    expect(call.metadata).toEqual({
      changes: {
        name: { before: '旧名', after: '新名' },
        role: { before: UserRole.User, after: UserRole.Admin },
      },
    });
  });

  it('update で何も変わらないなら監査ログを記録しない', async () => {
    const target = buildUser();
    userRepository.findById.mockResolvedValue(target);
    userRepository.save.mockImplementation(async (u: User) => u);

    await service.update(target.id, {}, ACTOR_ID);

    expect(auditLog.record).not.toHaveBeenCalled();
  });

  it('remove 成功で DELETE_USER が forcedLogout=true で記録される', async () => {
    const target = buildUser();
    userRepository.findById.mockResolvedValue(target);
    userRepository.softDelete.mockResolvedValue(undefined);
    cognitoUser.globalSignOut.mockResolvedValue(undefined);
    cognitoUser.disableUser.mockResolvedValue(undefined);

    await service.remove(target.id, ACTOR_ID);

    expect(auditLog.record).toHaveBeenCalledWith({
      actorUserId: ACTOR_ID,
      action: AuditAction.DeleteUser,
      targetUserId: target.id,
      metadata: { targetEmail: target.email, forcedLogout: true },
    });
  });

  it('remove で globalSignOut 失敗時 forcedLogout=false で記録される', async () => {
    const target = buildUser();
    userRepository.findById.mockResolvedValue(target);
    userRepository.softDelete.mockResolvedValue(undefined);
    cognitoUser.globalSignOut.mockRejectedValue(new Error('boom'));
    cognitoUser.disableUser.mockResolvedValue(undefined);

    await service.remove(target.id, ACTOR_ID);

    const call = auditLog.record.mock.calls[0][0];
    expect(call.metadata).toEqual({
      targetEmail: target.email,
      forcedLogout: false,
    });
  });

  it('remove の disableUser 失敗時は監査ログを記録しない', async () => {
    const target = buildUser();
    userRepository.findById.mockResolvedValue(target);
    userRepository.softDelete.mockResolvedValue(undefined);
    cognitoUser.globalSignOut.mockResolvedValue(undefined);
    cognitoUser.disableUser.mockRejectedValue(new Error('boom'));

    await expect(service.remove(target.id, ACTOR_ID)).rejects.toBeInstanceOf(
      BadGatewayException,
    );
    expect(auditLog.record).not.toHaveBeenCalled();
  });

  it('restore 成功で RESTORE_USER が記録される', async () => {
    const deleted = buildUser({ deletedAt: new Date('2026-04-01T00:00:00Z') });
    userRepository.findByIdWithDeleted.mockResolvedValue(deleted);
    userRepository.restore.mockResolvedValue(undefined);
    cognitoUser.enableUser.mockResolvedValue(undefined);
    userRepository.findById.mockResolvedValue(buildUser({ id: deleted.id }));

    await service.restore(deleted.id, ACTOR_ID);

    expect(auditLog.record).toHaveBeenCalledWith({
      actorUserId: ACTOR_ID,
      action: AuditAction.RestoreUser,
      targetUserId: deleted.id,
      metadata: { targetEmail: deleted.email },
    });
  });
});
