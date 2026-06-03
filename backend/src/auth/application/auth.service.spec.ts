import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  HttpException,
  UnauthorizedException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { CognitoUserClient } from '../../user/infra/cognito-user.client';
import { UserService } from '../../user/application/user.service';
import { TooManyLoginAttemptsException } from '../../common/exceptions/too-many-login-attempts.exception';
import { LoginAttempt } from '../domain/login-attempt';
import {
  ILoginAttemptRepository,
  LOGIN_ATTEMPT_REPOSITORY,
} from '../domain/login-attempt.repository';
import {
  CognitoAuthClient,
  CognitoAuthTokens,
} from '../infra/cognito-auth.client';
import { AuthService } from './auth.service';

type MockCognitoAuthClient = {
  [K in keyof CognitoAuthClient]: jest.Mock;
};

type MockCognitoUserClient = {
  [K in keyof CognitoUserClient]: jest.Mock;
};

function buildMockCognitoAuth(): MockCognitoAuthClient {
  return {
    authenticate: jest.fn(),
    respondToNewPasswordChallenge: jest.fn(),
    respondToMfaChallenge: jest.fn(),
    associateSoftwareToken: jest.fn(),
    verifySoftwareToken: jest.fn(),
    setSoftwareTokenMfaEnabled: jest.fn(),
    globalSignOut: jest.fn(),
    changePassword: jest.fn(),
    signUp: jest.fn(),
    confirmSignUp: jest.fn(),
    forgotPassword: jest.fn(),
    confirmForgotPassword: jest.fn(),
    refreshAccessToken: jest.fn(),
    isUserNotFound: jest.fn().mockReturnValue(false),
    isUsernameExists: jest.fn().mockReturnValue(false),
    isInvalidParameter: jest.fn().mockReturnValue(false),
    isUserAlreadyConfirmed: jest.fn().mockReturnValue(false),
    isCodeMismatch: jest.fn().mockReturnValue(false),
    isExpiredCode: jest.fn().mockReturnValue(false),
    isInvalidPassword: jest.fn().mockReturnValue(false),
    isLimitExceeded: jest.fn().mockReturnValue(false),
    isNotAuthorized: jest.fn().mockReturnValue(false),
    isEnableSoftwareTokenMfa: jest.fn().mockReturnValue(false),
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
    getUserMfaSettings: jest.fn(),
    adminGetUserSub: jest.fn(),
    isUsernameExists: jest.fn().mockReturnValue(false),
    isUserNotFound: jest.fn().mockReturnValue(false),
    isCodeMismatch: jest.fn().mockReturnValue(false),
    isExpiredCode: jest.fn().mockReturnValue(false),
    isAliasExists: jest.fn().mockReturnValue(false),
    isNotAuthorized: jest.fn().mockReturnValue(false),
  };
}

type MockUserService = {
  createSelfSignup: jest.Mock;
};

function buildMockUserService(): MockUserService {
  return {
    createSelfSignup: jest.fn(),
  };
}

type MockLoginAttemptRepository = {
  [K in keyof ILoginAttemptRepository]: jest.Mock;
};

function buildMockLoginAttempts(): MockLoginAttemptRepository {
  return {
    findByEmail: jest.fn().mockResolvedValue(null),
    save: jest.fn().mockResolvedValue(undefined),
    reset: jest.fn().mockResolvedValue(undefined),
  };
}

const configValues: Record<string, string> = {
  LOGIN_LOCKOUT_MAX_ATTEMPTS: '5',
  LOGIN_LOCKOUT_DURATION_MINUTES: '15',
};

function buildMockConfig(): Pick<ConfigService, 'get'> {
  return {
    get: jest.fn((key: string) => configValues[key]),
  };
}

async function buildService(
  cognitoAuth: MockCognitoAuthClient,
  cognitoUser: MockCognitoUserClient,
  userService: MockUserService = buildMockUserService(),
  loginAttempts: MockLoginAttemptRepository = buildMockLoginAttempts(),
): Promise<AuthService> {
  const moduleRef: TestingModule = await Test.createTestingModule({
    providers: [
      AuthService,
      { provide: CognitoAuthClient, useValue: cognitoAuth },
      { provide: CognitoUserClient, useValue: cognitoUser },
      { provide: UserService, useValue: userService },
      { provide: LOGIN_ATTEMPT_REPOSITORY, useValue: loginAttempts },
      { provide: ConfigService, useValue: buildMockConfig() },
    ],
  }).compile();
  return moduleRef.get(AuthService);
}

const tokens: CognitoAuthTokens = {
  accessToken: 'AT',
  idToken: 'IT',
  refreshToken: 'RT',
  expiresIn: 3600,
};

describe('AuthService.signup', () => {
  let service: AuthService;
  let cognitoAuth: MockCognitoAuthClient;
  let cognitoUser: MockCognitoUserClient;

  beforeEach(async () => {
    cognitoAuth = buildMockCognitoAuth();
    cognitoUser = buildMockCognitoUser();
    service = await buildService(cognitoAuth, cognitoUser);
  });

  it('正常系: Cognito SignUp を呼ぶ', async () => {
    cognitoAuth.signUp.mockResolvedValue(undefined);

    await expect(
      service.signup('new@example.com', 'Passw0rd!'),
    ).resolves.toBeUndefined();
    expect(cognitoAuth.signUp).toHaveBeenCalledWith(
      'new@example.com',
      'Passw0rd!',
    );
  });

  it('UsernameExists で ConflictException', async () => {
    cognitoAuth.signUp.mockRejectedValue(new Error('boom'));
    cognitoAuth.isUsernameExists.mockReturnValue(true);

    await expect(
      service.signup('dup@example.com', 'Passw0rd!'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('InvalidPassword で BadRequestException', async () => {
    cognitoAuth.signUp.mockRejectedValue(new Error('boom'));
    cognitoAuth.isInvalidPassword.mockReturnValue(true);

    await expect(
      service.signup('new@example.com', 'weak'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('その他失敗で BadGatewayException', async () => {
    cognitoAuth.signUp.mockRejectedValue(new Error('boom'));

    await expect(
      service.signup('new@example.com', 'Passw0rd!'),
    ).rejects.toBeInstanceOf(BadGatewayException);
  });
});

describe('AuthService.confirmSignup', () => {
  let service: AuthService;
  let cognitoAuth: MockCognitoAuthClient;
  let cognitoUser: MockCognitoUserClient;
  let userService: MockUserService;

  beforeEach(async () => {
    cognitoAuth = buildMockCognitoAuth();
    cognitoUser = buildMockCognitoUser();
    userService = buildMockUserService();
    service = await buildService(cognitoAuth, cognitoUser, userService);
  });

  it('正常系: confirm → sub 取得 → createSelfSignup を呼ぶ', async () => {
    cognitoAuth.confirmSignUp.mockResolvedValue(undefined);
    cognitoUser.adminGetUserSub.mockResolvedValue('sub-123');
    userService.createSelfSignup.mockResolvedValue(undefined);

    await service.confirmSignup('new@example.com', '123456', '名前', 'なまえ');

    expect(cognitoAuth.confirmSignUp).toHaveBeenCalledWith(
      'new@example.com',
      '123456',
    );
    expect(cognitoUser.adminGetUserSub).toHaveBeenCalledWith('new@example.com');
    expect(userService.createSelfSignup).toHaveBeenCalledWith({
      cognitoSub: 'sub-123',
      email: 'new@example.com',
      name: '名前',
      nameKana: 'なまえ',
    });
  });

  it('既に確認済みでも DB 作成へ進む（冪等）', async () => {
    cognitoAuth.confirmSignUp.mockRejectedValue(new Error('boom'));
    cognitoAuth.isUserAlreadyConfirmed.mockReturnValue(true);
    cognitoUser.adminGetUserSub.mockResolvedValue('sub-123');
    userService.createSelfSignup.mockResolvedValue(undefined);

    await service.confirmSignup('new@example.com', '123456', '名前', 'なまえ');

    expect(userService.createSelfSignup).toHaveBeenCalledTimes(1);
  });

  it('CodeMismatch で BadRequestException（DB 作成しない）', async () => {
    cognitoAuth.confirmSignUp.mockRejectedValue(new Error('boom'));
    cognitoAuth.isCodeMismatch.mockReturnValue(true);

    await expect(
      service.confirmSignup('new@example.com', '999', '名前', 'なまえ'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(userService.createSelfSignup).not.toHaveBeenCalled();
  });

  it('ExpiredCode で BadRequestException', async () => {
    cognitoAuth.confirmSignUp.mockRejectedValue(new Error('boom'));
    cognitoAuth.isExpiredCode.mockReturnValue(true);

    await expect(
      service.confirmSignup('new@example.com', '123', '名前', 'なまえ'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('その他失敗で BadGatewayException', async () => {
    cognitoAuth.confirmSignUp.mockRejectedValue(new Error('boom'));

    await expect(
      service.confirmSignup('new@example.com', '123456', '名前', 'なまえ'),
    ).rejects.toBeInstanceOf(BadGatewayException);
    expect(userService.createSelfSignup).not.toHaveBeenCalled();
  });
});

describe('AuthService.login lockout', () => {
  let cognitoAuth: MockCognitoAuthClient;
  let cognitoUser: MockCognitoUserClient;
  let loginAttempts: MockLoginAttemptRepository;

  beforeEach(() => {
    cognitoAuth = buildMockCognitoAuth();
    cognitoUser = buildMockCognitoUser();
    loginAttempts = buildMockLoginAttempts();
  });

  async function service(): Promise<AuthService> {
    return buildService(
      cognitoAuth,
      cognitoUser,
      buildMockUserService(),
      loginAttempts,
    );
  }

  it('ロック中は 429 を投げ Cognito を呼ばない', async () => {
    loginAttempts.findByEmail.mockResolvedValue(
      new LoginAttempt({
        email: 'me@example.com',
        failCount: 5,
        firstFailedAt: new Date(),
        lockedUntil: new Date(Date.now() + 60_000),
      }),
    );
    const svc = await service();

    await expect(svc.login('me@example.com', 'pass')).rejects.toBeInstanceOf(
      TooManyLoginAttemptsException,
    );
    expect(cognitoAuth.authenticate).not.toHaveBeenCalled();
  });

  it('認証失敗(null)で save を呼び 401', async () => {
    cognitoAuth.authenticate.mockResolvedValue(null);
    const svc = await service();

    await expect(svc.login('me@example.com', 'bad')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(loginAttempts.save).toHaveBeenCalledTimes(1);
  });

  it('NotAuthorized 例外で save を呼び 401', async () => {
    cognitoAuth.authenticate.mockRejectedValue(new Error('boom'));
    cognitoAuth.isNotAuthorized.mockReturnValue(true);
    const svc = await service();

    await expect(svc.login('me@example.com', 'bad')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(loginAttempts.save).toHaveBeenCalledTimes(1);
  });

  it('Cognito 障害（NotAuthorized 以外）は save を呼ばない', async () => {
    cognitoAuth.authenticate.mockRejectedValue(new Error('boom'));
    const svc = await service();

    await expect(svc.login('me@example.com', 'pass')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(loginAttempts.save).not.toHaveBeenCalled();
  });

  it('認証成功でカウンタを reset する', async () => {
    cognitoAuth.authenticate.mockResolvedValue({
      kind: 'authenticated',
      tokens,
    });
    const svc = await service();

    await svc.login('me@example.com', 'good');

    expect(loginAttempts.reset).toHaveBeenCalledWith('me@example.com');
  });
});

describe('AuthService.login', () => {
  let service: AuthService;
  let cognitoAuth: MockCognitoAuthClient;
  let cognitoUser: MockCognitoUserClient;

  beforeEach(async () => {
    cognitoAuth = buildMockCognitoAuth();
    cognitoUser = buildMockCognitoUser();
    service = await buildService(cognitoAuth, cognitoUser);
  });

  it('mfa_challenge 結果で MFA_REQUIRED レスポンスを返す', async () => {
    cognitoAuth.authenticate.mockResolvedValue({
      kind: 'mfa_challenge',
      challengeName: 'SOFTWARE_TOKEN_MFA',
      session: 'sess-mfa',
    });

    const result = await service.login('me@example.com', 'pass');

    expect(result).toEqual({
      status: 'MFA_REQUIRED',
      challengeName: 'SOFTWARE_TOKEN_MFA',
      session: 'sess-mfa',
      email: 'me@example.com',
    });
  });

  it('authenticated 結果で AUTHENTICATED レスポンスを返す', async () => {
    cognitoAuth.authenticate.mockResolvedValue({
      kind: 'authenticated',
      tokens,
    });

    const result = await service.login('me@example.com', 'pass');

    expect(result).toEqual({
      status: 'AUTHENTICATED',
      accessToken: 'AT',
      idToken: 'IT',
      refreshToken: 'RT',
      expiresIn: 3600,
      email: 'me@example.com',
    });
  });

  it('challenge 結果（NEW_PASSWORD_REQUIRED）で CHALLENGE レスポンスを返す', async () => {
    cognitoAuth.authenticate.mockResolvedValue({
      kind: 'challenge',
      challengeName: 'NEW_PASSWORD_REQUIRED',
      session: 'sess-1',
    });

    const result = await service.login('me@example.com', 'pass');

    expect(result).toEqual({
      status: 'CHALLENGE',
      challengeName: 'NEW_PASSWORD_REQUIRED',
      session: 'sess-1',
      email: 'me@example.com',
    });
  });

  it('null 戻りで UnauthorizedException', async () => {
    cognitoAuth.authenticate.mockResolvedValue(null);

    await expect(
      service.login('me@example.com', 'pass'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('例外で UnauthorizedException', async () => {
    cognitoAuth.authenticate.mockRejectedValue(new Error('boom'));

    await expect(
      service.login('me@example.com', 'pass'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});

describe('AuthService.completeNewPassword', () => {
  let service: AuthService;
  let cognitoAuth: MockCognitoAuthClient;
  let cognitoUser: MockCognitoUserClient;

  beforeEach(async () => {
    cognitoAuth = buildMockCognitoAuth();
    cognitoUser = buildMockCognitoUser();
    service = await buildService(cognitoAuth, cognitoUser);
  });

  it('正常系: AUTHENTICATED レスポンスを返す', async () => {
    cognitoAuth.respondToNewPasswordChallenge.mockResolvedValue(tokens);

    const result = await service.completeNewPassword(
      'me@example.com',
      'NewPass1!',
      'sess',
    );

    expect(result).toMatchObject({
      status: 'AUTHENTICATED',
      accessToken: 'AT',
      email: 'me@example.com',
    });
  });

  it('null 戻りで UnauthorizedException', async () => {
    cognitoAuth.respondToNewPasswordChallenge.mockResolvedValue(null);

    await expect(
      service.completeNewPassword('me@example.com', 'NewPass1!', 'sess'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('例外で UnauthorizedException', async () => {
    cognitoAuth.respondToNewPasswordChallenge.mockRejectedValue(
      new Error('boom'),
    );

    await expect(
      service.completeNewPassword('me@example.com', 'NewPass1!', 'sess'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});

describe('AuthService.forgotPassword', () => {
  let service: AuthService;
  let cognitoAuth: MockCognitoAuthClient;
  let cognitoUser: MockCognitoUserClient;

  beforeEach(async () => {
    cognitoAuth = buildMockCognitoAuth();
    cognitoUser = buildMockCognitoUser();
    service = await buildService(cognitoAuth, cognitoUser);
  });

  it('正常系: 例外なく完了', async () => {
    cognitoAuth.forgotPassword.mockResolvedValue(undefined);

    await expect(
      service.forgotPassword('me@example.com'),
    ).resolves.toBeUndefined();
    expect(cognitoAuth.forgotPassword).toHaveBeenCalledWith('me@example.com');
  });

  it('UserNotFound は WARN ログのみで成功扱い', async () => {
    cognitoAuth.forgotPassword.mockRejectedValue(new Error('boom'));
    cognitoAuth.isUserNotFound.mockReturnValue(true);

    await expect(
      service.forgotPassword('missing@example.com'),
    ).resolves.toBeUndefined();
  });

  it('その他失敗で BadGatewayException', async () => {
    cognitoAuth.forgotPassword.mockRejectedValue(new Error('boom'));

    await expect(
      service.forgotPassword('me@example.com'),
    ).rejects.toBeInstanceOf(BadGatewayException);
  });
});

describe('AuthService.confirmForgotPassword', () => {
  let service: AuthService;
  let cognitoAuth: MockCognitoAuthClient;
  let cognitoUser: MockCognitoUserClient;

  beforeEach(async () => {
    cognitoAuth = buildMockCognitoAuth();
    cognitoUser = buildMockCognitoUser();
    service = await buildService(cognitoAuth, cognitoUser);
  });

  it('正常系: 確定後に globalSignOut が呼ばれる', async () => {
    cognitoAuth.confirmForgotPassword.mockResolvedValue(undefined);
    cognitoUser.globalSignOut.mockResolvedValue(undefined);

    await service.confirmForgotPassword(
      'me@example.com',
      '123456',
      'NewPass1!',
    );

    expect(cognitoAuth.confirmForgotPassword).toHaveBeenCalledWith(
      'me@example.com',
      '123456',
      'NewPass1!',
    );
    expect(cognitoUser.globalSignOut).toHaveBeenCalledWith('me@example.com');
  });

  it('CodeMismatch で BadRequestException', async () => {
    cognitoAuth.confirmForgotPassword.mockRejectedValue(new Error('boom'));
    cognitoAuth.isCodeMismatch.mockReturnValue(true);

    await expect(
      service.confirmForgotPassword('me@example.com', '999', 'NewPass1!'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(cognitoUser.globalSignOut).not.toHaveBeenCalled();
  });

  it('ExpiredCode で BadRequestException', async () => {
    cognitoAuth.confirmForgotPassword.mockRejectedValue(new Error('boom'));
    cognitoAuth.isExpiredCode.mockReturnValue(true);

    await expect(
      service.confirmForgotPassword('me@example.com', '123', 'NewPass1!'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('InvalidPassword で BadRequestException', async () => {
    cognitoAuth.confirmForgotPassword.mockRejectedValue(new Error('boom'));
    cognitoAuth.isInvalidPassword.mockReturnValue(true);

    await expect(
      service.confirmForgotPassword('me@example.com', '123', 'weak'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('globalSignOut 失敗は ERROR ログのみで成功扱い', async () => {
    cognitoAuth.confirmForgotPassword.mockResolvedValue(undefined);
    cognitoUser.globalSignOut.mockRejectedValue(new Error('boom'));

    await expect(
      service.confirmForgotPassword('me@example.com', '123456', 'NewPass1!'),
    ).resolves.toBeUndefined();
  });
});

describe('AuthService.changePassword', () => {
  let service: AuthService;
  let cognitoAuth: MockCognitoAuthClient;
  let cognitoUser: MockCognitoUserClient;

  beforeEach(async () => {
    cognitoAuth = buildMockCognitoAuth();
    cognitoUser = buildMockCognitoUser();
    service = await buildService(cognitoAuth, cognitoUser);
  });

  it('正常系: changePassword と globalSignOut を呼ぶ', async () => {
    cognitoAuth.changePassword.mockResolvedValue(undefined);
    cognitoAuth.globalSignOut.mockResolvedValue(undefined);

    await service.changePassword('AT', 'Old1!', 'New1234!');

    expect(cognitoAuth.changePassword).toHaveBeenCalledWith(
      'AT',
      'Old1!',
      'New1234!',
    );
    expect(cognitoAuth.globalSignOut).toHaveBeenCalledWith('AT');
  });

  it('globalSignOut が失敗してもパスワード変更は成功扱い', async () => {
    cognitoAuth.changePassword.mockResolvedValue(undefined);
    cognitoAuth.globalSignOut.mockRejectedValue(new Error('boom'));

    await expect(
      service.changePassword('AT', 'Old1!', 'New1234!'),
    ).resolves.toBeUndefined();
  });

  it('旧パスワード誤り(NotAuthorized)で BadRequestException（globalSignOut は呼ばない）', async () => {
    cognitoAuth.changePassword.mockRejectedValue(new Error('boom'));
    cognitoAuth.isNotAuthorized.mockReturnValue(true);

    await expect(
      service.changePassword('AT', 'wrong', 'New1234!'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(cognitoAuth.globalSignOut).not.toHaveBeenCalled();
  });

  it('InvalidPassword で BadRequestException', async () => {
    cognitoAuth.changePassword.mockRejectedValue(new Error('boom'));
    cognitoAuth.isInvalidPassword.mockReturnValue(true);

    await expect(
      service.changePassword('AT', 'Old1!', 'weak'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('LimitExceeded で 429 HttpException', async () => {
    cognitoAuth.changePassword.mockRejectedValue(new Error('boom'));
    cognitoAuth.isLimitExceeded.mockReturnValue(true);

    await expect(
      service.changePassword('AT', 'Old1!', 'New1234!'),
    ).rejects.toBeInstanceOf(HttpException);
    await expect(
      service.changePassword('AT', 'Old1!', 'New1234!'),
    ).rejects.toMatchObject({ status: 429 });
  });

  it('その他失敗で BadGatewayException', async () => {
    cognitoAuth.changePassword.mockRejectedValue(new Error('boom'));

    await expect(
      service.changePassword('AT', 'Old1!', 'New1234!'),
    ).rejects.toBeInstanceOf(BadGatewayException);
  });
});

describe('AuthService.logout', () => {
  let service: AuthService;
  let cognitoAuth: MockCognitoAuthClient;
  let cognitoUser: MockCognitoUserClient;

  beforeEach(async () => {
    cognitoAuth = buildMockCognitoAuth();
    cognitoUser = buildMockCognitoUser();
    service = await buildService(cognitoAuth, cognitoUser);
  });

  it('正常系', async () => {
    cognitoAuth.globalSignOut.mockResolvedValue(undefined);

    await expect(service.logout('AT')).resolves.toBeUndefined();
    expect(cognitoAuth.globalSignOut).toHaveBeenCalledWith('AT');
  });

  it('Cognito 失敗で BadGatewayException', async () => {
    cognitoAuth.globalSignOut.mockRejectedValue(new Error('boom'));

    await expect(service.logout('AT')).rejects.toBeInstanceOf(
      BadGatewayException,
    );
  });
});

describe('AuthService.refresh', () => {
  let service: AuthService;
  let cognitoAuth: MockCognitoAuthClient;
  let cognitoUser: MockCognitoUserClient;

  beforeEach(async () => {
    cognitoAuth = buildMockCognitoAuth();
    cognitoUser = buildMockCognitoUser();
    service = await buildService(cognitoAuth, cognitoUser);
  });

  it('正常系: 新しいトークンと email を返す', async () => {
    cognitoAuth.refreshAccessToken.mockResolvedValue({
      accessToken: 'AT2',
      idToken: 'IT2',
      expiresIn: 3600,
    });

    const result = await service.refresh('RT', 'me@example.com');

    expect(cognitoAuth.refreshAccessToken).toHaveBeenCalledWith(
      'RT',
      'me@example.com',
    );
    expect(result).toEqual({
      accessToken: 'AT2',
      idToken: 'IT2',
      expiresIn: 3600,
      email: 'me@example.com',
    });
  });

  it('null 戻りで UnauthorizedException', async () => {
    cognitoAuth.refreshAccessToken.mockResolvedValue(null);

    await expect(
      service.refresh('RT', 'me@example.com'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('NotAuthorized で UnauthorizedException', async () => {
    cognitoAuth.refreshAccessToken.mockRejectedValue(new Error('boom'));
    cognitoAuth.isNotAuthorized.mockReturnValue(true);

    await expect(
      service.refresh('RT', 'me@example.com'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('その他失敗で BadGatewayException', async () => {
    cognitoAuth.refreshAccessToken.mockRejectedValue(new Error('boom'));

    await expect(
      service.refresh('RT', 'me@example.com'),
    ).rejects.toBeInstanceOf(BadGatewayException);
  });
});

describe('AuthService.respondMfaChallenge', () => {
  let service: AuthService;
  let cognitoAuth: MockCognitoAuthClient;
  let cognitoUser: MockCognitoUserClient;

  beforeEach(async () => {
    cognitoAuth = buildMockCognitoAuth();
    cognitoUser = buildMockCognitoUser();
    service = await buildService(cognitoAuth, cognitoUser);
  });

  it('正常系: AUTHENTICATED レスポンスを返す', async () => {
    cognitoAuth.respondToMfaChallenge.mockResolvedValue(tokens);

    const result = await service.respondMfaChallenge(
      'me@example.com',
      '123456',
      'sess',
    );

    expect(cognitoAuth.respondToMfaChallenge).toHaveBeenCalledWith(
      'me@example.com',
      '123456',
      'sess',
    );
    expect(result.status).toBe('AUTHENTICATED');
  });

  it('null 戻りで UnauthorizedException', async () => {
    cognitoAuth.respondToMfaChallenge.mockResolvedValue(null);

    await expect(
      service.respondMfaChallenge('me@example.com', '123456', 'sess'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('CodeMismatch で UnauthorizedException', async () => {
    cognitoAuth.respondToMfaChallenge.mockRejectedValue(new Error('boom'));
    cognitoAuth.isCodeMismatch.mockReturnValue(true);

    await expect(
      service.respondMfaChallenge('me@example.com', '999999', 'sess'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('その他失敗で UnauthorizedException', async () => {
    cognitoAuth.respondToMfaChallenge.mockRejectedValue(new Error('boom'));

    await expect(
      service.respondMfaChallenge('me@example.com', '123456', 'sess'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});

describe('AuthService.setupMfa', () => {
  let service: AuthService;
  let cognitoAuth: MockCognitoAuthClient;
  let cognitoUser: MockCognitoUserClient;

  beforeEach(async () => {
    cognitoAuth = buildMockCognitoAuth();
    cognitoUser = buildMockCognitoUser();
    service = await buildService(cognitoAuth, cognitoUser);
  });

  it('正常系: secretCode と otpauthUri を返す', async () => {
    cognitoUser.getUserEmail.mockResolvedValue('me@example.com');
    cognitoAuth.associateSoftwareToken.mockResolvedValue({
      secretCode: 'JBSWY3DPEHPK3PXP',
    });

    const result = await service.setupMfa('AT');

    expect(result.secretCode).toBe('JBSWY3DPEHPK3PXP');
    expect(result.otpauthUri).toContain('otpauth://totp/Petal:');
    expect(result.otpauthUri).toContain('secret=JBSWY3DPEHPK3PXP');
    expect(result.otpauthUri).toContain('issuer=Petal');
    expect(result.otpauthUri).toContain('me%40example.com');
  });

  it('email 取得で NotAuthorized なら UnauthorizedException', async () => {
    cognitoUser.getUserEmail.mockRejectedValue(new Error('boom'));
    cognitoUser.isNotAuthorized.mockReturnValue(true);

    await expect(service.setupMfa('AT')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(cognitoAuth.associateSoftwareToken).not.toHaveBeenCalled();
  });

  it('AssociateSoftwareToken の NotAuthorized で UnauthorizedException', async () => {
    cognitoUser.getUserEmail.mockResolvedValue('me@example.com');
    cognitoAuth.associateSoftwareToken.mockRejectedValue(new Error('boom'));
    cognitoAuth.isNotAuthorized.mockReturnValue(true);

    await expect(service.setupMfa('AT')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('その他失敗で BadGatewayException', async () => {
    cognitoUser.getUserEmail.mockResolvedValue('me@example.com');
    cognitoAuth.associateSoftwareToken.mockRejectedValue(new Error('boom'));

    await expect(service.setupMfa('AT')).rejects.toBeInstanceOf(
      BadGatewayException,
    );
  });
});

describe('AuthService.verifyMfaSetup', () => {
  let service: AuthService;
  let cognitoAuth: MockCognitoAuthClient;
  let cognitoUser: MockCognitoUserClient;

  beforeEach(async () => {
    cognitoAuth = buildMockCognitoAuth();
    cognitoUser = buildMockCognitoUser();
    service = await buildService(cognitoAuth, cognitoUser);
  });

  it('SUCCESS なら setSoftwareTokenMfaEnabled(true) を呼ぶ', async () => {
    cognitoAuth.verifySoftwareToken.mockResolvedValue({ status: 'SUCCESS' });
    cognitoAuth.setSoftwareTokenMfaEnabled.mockResolvedValue(undefined);

    await service.verifyMfaSetup('AT', '123456');

    expect(cognitoAuth.verifySoftwareToken).toHaveBeenCalledWith(
      'AT',
      '123456',
      'Petal',
    );
    expect(cognitoAuth.setSoftwareTokenMfaEnabled).toHaveBeenCalledWith(
      'AT',
      true,
    );
  });

  it('ERROR なら BadRequestException', async () => {
    cognitoAuth.verifySoftwareToken.mockResolvedValue({ status: 'ERROR' });

    await expect(service.verifyMfaSetup('AT', '999999')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(cognitoAuth.setSoftwareTokenMfaEnabled).not.toHaveBeenCalled();
  });

  it('CodeMismatch で BadRequestException', async () => {
    cognitoAuth.verifySoftwareToken.mockRejectedValue(new Error('boom'));
    cognitoAuth.isCodeMismatch.mockReturnValue(true);

    await expect(service.verifyMfaSetup('AT', '999999')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});

describe('AuthService.disableMfa', () => {
  let service: AuthService;
  let cognitoAuth: MockCognitoAuthClient;
  let cognitoUser: MockCognitoUserClient;

  beforeEach(async () => {
    cognitoAuth = buildMockCognitoAuth();
    cognitoUser = buildMockCognitoUser();
    service = await buildService(cognitoAuth, cognitoUser);
  });

  it('正常系: setSoftwareTokenMfaEnabled(false) を呼ぶ', async () => {
    cognitoAuth.setSoftwareTokenMfaEnabled.mockResolvedValue(undefined);

    await service.disableMfa('AT');

    expect(cognitoAuth.setSoftwareTokenMfaEnabled).toHaveBeenCalledWith(
      'AT',
      false,
    );
  });

  it('NotAuthorized で UnauthorizedException', async () => {
    cognitoAuth.setSoftwareTokenMfaEnabled.mockRejectedValue(new Error('boom'));
    cognitoAuth.isNotAuthorized.mockReturnValue(true);

    await expect(service.disableMfa('AT')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('その他失敗で BadGatewayException', async () => {
    cognitoAuth.setSoftwareTokenMfaEnabled.mockRejectedValue(new Error('boom'));

    await expect(service.disableMfa('AT')).rejects.toBeInstanceOf(
      BadGatewayException,
    );
  });
});
