import { Injectable, UnauthorizedException } from '@nestjs/common';
import { CognitoAuthClient } from '../infra/cognito-auth.client';
import {
  AuthenticatedResponseDto,
  ChallengeResponseDto,
  LoginResponseDto,
} from '../controller/auth.dto';

@Injectable()
export class AuthService {
  constructor(private readonly cognitoAuth: CognitoAuthClient) {}

  async login(email: string, password: string): Promise<LoginResponseDto> {
    try {
      const result = await this.cognitoAuth.authenticate(email, password);
      if (!result) throw new UnauthorizedException('認証に失敗しました');

      if (result.kind === 'challenge') {
        const challenge: ChallengeResponseDto = {
          status: 'CHALLENGE',
          challengeName: result.challengeName,
          session: result.session,
          email,
        };
        return challenge;
      }

      return this.toAuthenticated(result.tokens, email);
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      throw new UnauthorizedException(
        'メールアドレスまたはパスワードが正しくありません',
      );
    }
  }

  async completeNewPassword(
    email: string,
    newPassword: string,
    session: string,
  ): Promise<AuthenticatedResponseDto> {
    try {
      const tokens = await this.cognitoAuth.respondToNewPasswordChallenge(
        email,
        newPassword,
        session,
      );
      if (!tokens) {
        throw new UnauthorizedException('パスワード変更に失敗しました');
      }
      return this.toAuthenticated(tokens, email);
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      throw new UnauthorizedException(
        'パスワード変更に失敗しました。セッションが無効か、パスワードがポリシーに合致していません。',
      );
    }
  }

  private toAuthenticated(
    tokens: {
      accessToken: string;
      idToken: string;
      refreshToken: string;
      expiresIn: number;
    },
    email: string,
  ): AuthenticatedResponseDto {
    return {
      status: 'AUTHENTICATED',
      accessToken: tokens.accessToken,
      idToken: tokens.idToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn,
      email,
    };
  }
}
