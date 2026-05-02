import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CognitoJwtVerifier } from 'aws-jwt-verify';
import type { CognitoJwtVerifierSingleUserPool } from 'aws-jwt-verify/cognito-verifier';
import { Request } from 'express';

type VerifierProps = {
  userPoolId: string;
  tokenUse: 'access';
  clientId: string;
};

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly verifier: CognitoJwtVerifierSingleUserPool<VerifierProps>;
  private readonly skipAuth: boolean;

  constructor(private readonly config: ConfigService) {
    this.skipAuth = config.get<string>('SKIP_AUTH') === 'true';

    this.verifier = CognitoJwtVerifier.create({
      userPoolId: config.getOrThrow<string>('COGNITO_USER_POOL_ID'),
      clientId: config.getOrThrow<string>('COGNITO_CLIENT_ID'),
      tokenUse: 'access',
    });
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.skipAuth) {
      // テスト用: 認証をスキップしてダミーユーザーをセット
      const req = context.switchToHttp().getRequest<Request>();
      req['user'] = { sub: 'test-user' };
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const token = extractBearerToken(request);
    if (!token) throw new UnauthorizedException('認証トークンがありません');

    try {
      const payload = await this.verifier.verify(token);
      request['user'] = payload;
      return true;
    } catch {
      throw new UnauthorizedException('認証トークンが無効です');
    }
  }
}

function extractBearerToken(request: Request): string | null {
  const auth = request.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return null;
  return auth.slice(7);
}
