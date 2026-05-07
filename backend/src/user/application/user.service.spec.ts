import { BadGatewayException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { randomUUID } from 'crypto';
import { User } from '../domain/user';
import { UserRole } from '../domain/user-role.enum';
import { USER_REPOSITORY } from '../domain/user.repository';
import { CognitoUserClient } from '../infra/cognito-user.client';
import { UserService } from './user.service';

describe('UserService.remove', () => {
  const targetId = randomUUID();
  const targetEmail = 'taro@example.com';

  function buildUser(): User {
    const now = new Date('2026-05-01T00:00:00Z');
    return new User({
      id: targetId,
      cognitoSub: 'sub-xxx',
      email: targetEmail,
      name: '山田 太郎',
      nameKana: 'やまだ たろう',
      role: UserRole.User,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });
  }

  let service: UserService;
  let userRepository: {
    findById: jest.Mock;
    softDelete: jest.Mock;
  };
  let cognitoUser: {
    globalSignOut: jest.Mock;
    disableUser: jest.Mock;
  };

  beforeEach(async () => {
    userRepository = {
      findById: jest.fn().mockResolvedValue(buildUser()),
      softDelete: jest.fn().mockResolvedValue(undefined),
    };
    cognitoUser = {
      globalSignOut: jest.fn().mockResolvedValue(undefined),
      disableUser: jest.fn().mockResolvedValue(undefined),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: USER_REPOSITORY, useValue: userRepository },
        { provide: CognitoUserClient, useValue: cognitoUser },
      ],
    }).compile();

    service = moduleRef.get(UserService);
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

    await service.remove(targetId);

    expect(calls).toEqual(['softDelete', 'globalSignOut', 'disableUser']);
    expect(userRepository.softDelete).toHaveBeenCalledWith(targetId);
    expect(cognitoUser.globalSignOut).toHaveBeenCalledWith(targetEmail);
    expect(cognitoUser.disableUser).toHaveBeenCalledWith(targetEmail);
  });

  it('globalSignOut が失敗しても disableUser まで進み、メソッドは成功する', async () => {
    cognitoUser.globalSignOut.mockRejectedValue(new Error('signout boom'));

    await expect(service.remove(targetId)).resolves.toBeUndefined();

    expect(userRepository.softDelete).toHaveBeenCalledTimes(1);
    expect(cognitoUser.disableUser).toHaveBeenCalledWith(targetEmail);
  });

  it('disableUser が失敗した場合は BadGatewayException を投げる', async () => {
    cognitoUser.disableUser.mockRejectedValue(new Error('disable boom'));

    await expect(service.remove(targetId)).rejects.toBeInstanceOf(
      BadGatewayException,
    );

    expect(userRepository.softDelete).toHaveBeenCalledTimes(1);
    expect(cognitoUser.globalSignOut).toHaveBeenCalledTimes(1);
  });
});
