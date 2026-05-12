import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { CognitoJwtVerifier } from 'aws-jwt-verify';
import type { CognitoJwtVerifierSingleUserPool } from 'aws-jwt-verify/cognito-verifier';
import { Request } from 'express';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { AuthUser } from '../types/auth-user';
import {
  IUserRepository,
  USER_REPOSITORY,
} from '../../user/domain/user.repository';
import { User } from '../../user/domain/user';

type VerifierProps = {
  userPoolId: string;
  tokenUse: 'access';
  clientId: string;
};

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly verifier: CognitoJwtVerifierSingleUserPool<VerifierProps>;
  private readonly skipAuth: boolean;
  private readonly skipAuthUserId: string | undefined;
  private readonly skipAuthCognitoSub: string;

  constructor(
    config: ConfigService,
    private readonly reflector: Reflector,
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
  ) {
    this.skipAuth = config.get<string>('SKIP_AUTH') === 'true';
    this.skipAuthUserId = config.get<string>('SKIP_AUTH_USER_ID') || undefined;
    this.skipAuthCognitoSub = 'test-user';

    this.verifier = CognitoJwtVerifier.create({
      userPoolId: config.getOrThrow<string>('COGNITO_USER_POOL_ID'),
      clientId: config.getOrThrow<string>('COGNITO_CLIENT_ID'),
      tokenUse: 'access',
    });
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request>();

    if (this.skipAuth) {
      const user = await this.resolveSkipAuthUser();
      request.user = toAuthUser(user);
      return true;
    }

    const token = extractBearerToken(request);
    if (!token) throw new UnauthorizedException('認証トークンがありません');

    let sub: string;
    try {
      const payload = await this.verifier.verify(token);
      sub = payload.sub;
    } catch {
      throw new UnauthorizedException('認証トークンが無効です');
    }

    const user = await this.userRepository.findByCognitoSub(sub);
    if (!user || user.deletedAt !== null) {
      throw new UnauthorizedException(
        '認証ユーザーに対応するレコードがありません',
      );
    }

    request.user = toAuthUser(user);
    return true;
  }

  private async resolveSkipAuthUser(): Promise<User> {
    const user = this.skipAuthUserId
      ? await this.userRepository.findById(this.skipAuthUserId)
      : await this.userRepository.findByCognitoSub(this.skipAuthCognitoSub);
    if (!user || user.deletedAt !== null) {
      throw new UnauthorizedException(
        'SKIP_AUTH 用ダミーユーザーが見つかりません',
      );
    }
    return user;
  }
}

function toAuthUser(user: User): AuthUser {
  return {
    sub: user.cognitoSub,
    userId: user.id,
    email: user.email,
    role: user.role,
  };
}

function extractBearerToken(request: Request): string | null {
  const auth = request.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return null;
  return auth.slice(7);
}
