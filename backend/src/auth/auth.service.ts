import * as crypto from 'crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  AuthFlowType,
} from '@aws-sdk/client-cognito-identity-provider';
import { LoginResponseDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  private readonly cognitoClient: CognitoIdentityProviderClient;
  private readonly clientId: string;
  private readonly clientSecret: string;

  constructor(config: ConfigService) {
    this.clientId = config.getOrThrow('COGNITO_CLIENT_ID');
    this.clientSecret = config.getOrThrow('COGNITO_CLIENT_SECRET');
    this.cognitoClient = new CognitoIdentityProviderClient({
      region: config.getOrThrow('COGNITO_REGION'),
    });
  }

  async login(email: string, password: string): Promise<LoginResponseDto> {
    const secretHash = this.computeSecretHash(email);

    try {
      const command = new InitiateAuthCommand({
        AuthFlow: AuthFlowType.USER_PASSWORD_AUTH,
        ClientId: this.clientId,
        AuthParameters: {
          USERNAME: email,
          PASSWORD: password,
          SECRET_HASH: secretHash,
        },
      });

      const response = await this.cognitoClient.send(command);
      const result = response.AuthenticationResult;

      if (!result?.AccessToken) {
        throw new UnauthorizedException('認証に失敗しました');
      }

      return {
        accessToken: result.AccessToken,
        idToken: result.IdToken!,
        refreshToken: result.RefreshToken!,
        expiresIn: result.ExpiresIn!,
        email,
      };
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      throw new UnauthorizedException(
        'メールアドレスまたはパスワードが正しくありません',
      );
    }
  }

  private computeSecretHash(username: string): string {
    return crypto
      .createHmac('sha256', this.clientSecret)
      .update(username + this.clientId)
      .digest('base64');
  }
}
