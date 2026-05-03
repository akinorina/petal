import { Injectable, UnauthorizedException } from '@nestjs/common';
import { CognitoAuthClient } from '../infra/cognito-auth.client';
import { LoginResponseDto } from '../controller/auth.dto';

@Injectable()
export class AuthService {
  constructor(private readonly cognitoAuth: CognitoAuthClient) {}

  async login(email: string, password: string): Promise<LoginResponseDto> {
    try {
      const tokens = await this.cognitoAuth.authenticate(email, password);
      if (!tokens) throw new UnauthorizedException('認証に失敗しました');
      return { ...tokens, email };
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      throw new UnauthorizedException(
        'メールアドレスまたはパスワードが正しくありません',
      );
    }
  }
}
