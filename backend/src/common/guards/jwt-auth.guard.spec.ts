import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { Request } from 'express';
import { randomUUID } from 'crypto';
import type { CognitoJwtVerifierSingleUserPool } from 'aws-jwt-verify/cognito-verifier';
import { User } from '../../user/domain/user';
import { UserRole } from '../../user/domain/user-role.enum';
import {
  IUserRepository,
  USER_REPOSITORY,
} from '../../user/domain/user.repository';
import { JwtAuthGuard } from './jwt-auth.guard';

type MockUserRepository = {
  [K in keyof IUserRepository]: jest.Mock;
};

type MockVerifier = { verify: jest.Mock };

type GuardConfig = {
  SKIP_AUTH?: string;
  SKIP_AUTH_USER_ID?: string;
};

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
    countActiveAdmins: jest.fn(),
  };
}

function buildContext(req: Partial<Request>, isPublic = false): {
  context: ExecutionContext;
  reflector: Reflector;
} {
  const reflector = {
    getAllAndOverride: jest.fn().mockReturnValue(isPublic),
  } as unknown as Reflector;

  const context = {
    switchToHttp: () => ({
      getRequest: () => req as Request,
    }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;

  return { context, reflector };
}

async function buildGuard(
  guardConfig: GuardConfig,
  userRepository: MockUserRepository,
  reflector: Reflector,
  verifier: MockVerifier,
): Promise<JwtAuthGuard> {
  const configValues: Record<string, string> = {
    COGNITO_USER_POOL_ID: 'us-east-1_abcdef123',
    COGNITO_CLIENT_ID: 'client-1',
    ...guardConfig,
  };

  const config = {
    get: jest.fn((key: string) => configValues[key]),
    getOrThrow: jest.fn((key: string) => {
      const v = configValues[key];
      if (!v) throw new Error(`missing config: ${key}`);
      return v;
    }),
  } as unknown as ConfigService;

  const moduleRef: TestingModule = await Test.createTestingModule({
    providers: [
      JwtAuthGuard,
      { provide: ConfigService, useValue: config },
      { provide: Reflector, useValue: reflector },
      { provide: USER_REPOSITORY, useValue: userRepository },
    ],
  }).compile();

  const guard = moduleRef.get(JwtAuthGuard);
  // verifier はコンストラクタで生成され DI 経由で差し替えられないため、
  // テスト固有の都合として private プロパティを置換する。
  (
    guard as unknown as {
      verifier: CognitoJwtVerifierSingleUserPool<{
        userPoolId: string;
        tokenUse: 'access';
        clientId: string;
      }>;
    }
  ).verifier = verifier as unknown as CognitoJwtVerifierSingleUserPool<{
    userPoolId: string;
    tokenUse: 'access';
    clientId: string;
  }>;
  return guard;
}

describe('JwtAuthGuard.canActivate', () => {
  let userRepository: MockUserRepository;
  let verifier: MockVerifier;

  beforeEach(() => {
    userRepository = buildMockRepository();
    verifier = { verify: jest.fn() };
  });

  it('@Public() のとき認証なしで素通りする', async () => {
    const { context, reflector } = buildContext({ headers: {} }, true);
    const guard = await buildGuard({}, userRepository, reflector, verifier);

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(verifier.verify).not.toHaveBeenCalled();
    expect(userRepository.findByCognitoSub).not.toHaveBeenCalled();
  });

  describe('SKIP_AUTH=true', () => {
    it('SKIP_AUTH_USER_ID 指定時は findById で引いて request.user をセットする', async () => {
      const dummy = buildUser({ role: UserRole.Admin });
      userRepository.findById.mockResolvedValue(dummy);
      const req: Partial<Request> = { headers: {} };
      const { context, reflector } = buildContext(req);

      const guard = await buildGuard(
        { SKIP_AUTH: 'true', SKIP_AUTH_USER_ID: dummy.id },
        userRepository,
        reflector,
        verifier,
      );

      await expect(guard.canActivate(context)).resolves.toBe(true);
      expect(userRepository.findById).toHaveBeenCalledWith(dummy.id);
      expect(req.user).toEqual({
        sub: dummy.cognitoSub,
        userId: dummy.id,
        email: dummy.email,
        role: dummy.role,
      });
    });

    it('SKIP_AUTH_USER_ID 未指定時は cognito_sub="test-user" で DB を引く', async () => {
      const dummy = buildUser({ cognitoSub: 'test-user' });
      userRepository.findByCognitoSub.mockResolvedValue(dummy);
      const req: Partial<Request> = { headers: {} };
      const { context, reflector } = buildContext(req);

      const guard = await buildGuard(
        { SKIP_AUTH: 'true' },
        userRepository,
        reflector,
        verifier,
      );

      await expect(guard.canActivate(context)).resolves.toBe(true);
      expect(userRepository.findByCognitoSub).toHaveBeenCalledWith('test-user');
    });

    it('ダミーユーザーが見つからないと UnauthorizedException', async () => {
      userRepository.findByCognitoSub.mockResolvedValue(null);
      const { context, reflector } = buildContext({ headers: {} });
      const guard = await buildGuard(
        { SKIP_AUTH: 'true' },
        userRepository,
        reflector,
        verifier,
      );

      await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('ダミーユーザーが deletedAt !== null だと UnauthorizedException', async () => {
      userRepository.findByCognitoSub.mockResolvedValue(
        buildUser({ deletedAt: new Date('2026-04-01T00:00:00Z') }),
      );
      const { context, reflector } = buildContext({ headers: {} });
      const guard = await buildGuard(
        { SKIP_AUTH: 'true' },
        userRepository,
        reflector,
        verifier,
      );

      await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });
  });

  describe('通常フロー（SKIP_AUTH なし）', () => {
    it('Authorization ヘッダー欠落で UnauthorizedException', async () => {
      const { context, reflector } = buildContext({ headers: {} });
      const guard = await buildGuard({}, userRepository, reflector, verifier);

      await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(verifier.verify).not.toHaveBeenCalled();
    });

    it('Bearer で始まらない Authorization で UnauthorizedException', async () => {
      const { context, reflector } = buildContext({
        headers: { authorization: 'Basic xyz' },
      });
      const guard = await buildGuard({}, userRepository, reflector, verifier);

      await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('JWT 検証失敗で UnauthorizedException', async () => {
      verifier.verify.mockRejectedValue(new Error('bad token'));
      const { context, reflector } = buildContext({
        headers: { authorization: 'Bearer abc' },
      });
      const guard = await buildGuard({}, userRepository, reflector, verifier);

      await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(userRepository.findByCognitoSub).not.toHaveBeenCalled();
    });

    it('JWT 検証成功 + DB に該当 sub なしで UnauthorizedException', async () => {
      verifier.verify.mockResolvedValue({ sub: 'sub-missing' });
      userRepository.findByCognitoSub.mockResolvedValue(null);
      const { context, reflector } = buildContext({
        headers: { authorization: 'Bearer abc' },
      });
      const guard = await buildGuard({}, userRepository, reflector, verifier);

      await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(userRepository.findByCognitoSub).toHaveBeenCalledWith('sub-missing');
    });

    it('JWT 検証成功 + 該当ユーザーが deletedAt !== null で UnauthorizedException', async () => {
      verifier.verify.mockResolvedValue({ sub: 'sub-deleted' });
      userRepository.findByCognitoSub.mockResolvedValue(
        buildUser({
          cognitoSub: 'sub-deleted',
          deletedAt: new Date('2026-04-01T00:00:00Z'),
        }),
      );
      const { context, reflector } = buildContext({
        headers: { authorization: 'Bearer abc' },
      });
      const guard = await buildGuard({}, userRepository, reflector, verifier);

      await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('JWT 検証成功 + 有効ユーザーで request.user に AuthUser がセットされる', async () => {
      const user = buildUser({
        cognitoSub: 'sub-active',
        role: UserRole.Admin,
      });
      verifier.verify.mockResolvedValue({ sub: 'sub-active' });
      userRepository.findByCognitoSub.mockResolvedValue(user);
      const req: Partial<Request> = {
        headers: { authorization: 'Bearer abc' },
      };
      const { context, reflector } = buildContext(req);
      const guard = await buildGuard({}, userRepository, reflector, verifier);

      await expect(guard.canActivate(context)).resolves.toBe(true);
      expect(req.user).toEqual({
        sub: user.cognitoSub,
        userId: user.id,
        email: user.email,
        role: user.role,
      });
    });
  });
});
