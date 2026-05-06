import * as crypto from 'crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AdminInitiateAuthCommand,
  AdminRespondToAuthChallengeCommand,
  AuthFlowType,
  ChallengeNameType,
  CodeMismatchException,
  CognitoIdentityProviderClient,
  ConfirmForgotPasswordCommand,
  ExpiredCodeException,
  ForgotPasswordCommand,
  GlobalSignOutCommand,
  InvalidPasswordException,
  UserNotFoundException,
} from '@aws-sdk/client-cognito-identity-provider';

export type CognitoAuthTokens = {
  accessToken: string;
  idToken: string;
  refreshToken: string;
  expiresIn: number;
};

export type CognitoAuthResult =
  | { kind: 'authenticated'; tokens: CognitoAuthTokens }
  | {
      kind: 'challenge';
      challengeName: 'NEW_PASSWORD_REQUIRED';
      session: string;
    };

@Injectable()
export class CognitoAuthClient {
  private readonly client: CognitoIdentityProviderClient;
  private readonly userPoolId: string;
  private readonly clientId: string;
  private readonly clientSecret: string;

  constructor(config: ConfigService) {
    this.userPoolId = config.getOrThrow('COGNITO_USER_POOL_ID');
    this.clientId = config.getOrThrow('COGNITO_CLIENT_ID');
    this.clientSecret = config.getOrThrow('COGNITO_CLIENT_SECRET');
    this.client = new CognitoIdentityProviderClient({
      region: config.getOrThrow('COGNITO_REGION'),
    });
  }

  async authenticate(
    username: string,
    password: string,
  ): Promise<CognitoAuthResult | null> {
    const command = new AdminInitiateAuthCommand({
      UserPoolId: this.userPoolId,
      ClientId: this.clientId,
      AuthFlow: AuthFlowType.ADMIN_USER_PASSWORD_AUTH,
      AuthParameters: {
        USERNAME: username,
        PASSWORD: password,
        SECRET_HASH: this.computeSecretHash(username),
      },
    });

    const response = await this.client.send(command);

    if (
      response.ChallengeName === ChallengeNameType.NEW_PASSWORD_REQUIRED &&
      response.Session
    ) {
      return {
        kind: 'challenge',
        challengeName: 'NEW_PASSWORD_REQUIRED',
        session: response.Session,
      };
    }

    const result = response.AuthenticationResult;
    if (!result?.AccessToken) return null;

    return {
      kind: 'authenticated',
      tokens: {
        accessToken: result.AccessToken,
        idToken: result.IdToken!,
        refreshToken: result.RefreshToken!,
        expiresIn: result.ExpiresIn!,
      },
    };
  }

  async respondToNewPasswordChallenge(
    username: string,
    newPassword: string,
    session: string,
  ): Promise<CognitoAuthTokens | null> {
    const command = new AdminRespondToAuthChallengeCommand({
      UserPoolId: this.userPoolId,
      ClientId: this.clientId,
      ChallengeName: ChallengeNameType.NEW_PASSWORD_REQUIRED,
      Session: session,
      ChallengeResponses: {
        USERNAME: username,
        NEW_PASSWORD: newPassword,
        SECRET_HASH: this.computeSecretHash(username),
      },
    });

    const response = await this.client.send(command);
    const result = response.AuthenticationResult;
    if (!result?.AccessToken) return null;

    return {
      accessToken: result.AccessToken,
      idToken: result.IdToken!,
      refreshToken: result.RefreshToken!,
      expiresIn: result.ExpiresIn!,
    };
  }

  async globalSignOut(accessToken: string): Promise<void> {
    await this.client.send(
      new GlobalSignOutCommand({ AccessToken: accessToken }),
    );
  }

  async forgotPassword(email: string): Promise<void> {
    await this.client.send(
      new ForgotPasswordCommand({
        ClientId: this.clientId,
        Username: email,
        SecretHash: this.computeSecretHash(email),
      }),
    );
  }

  async confirmForgotPassword(
    email: string,
    code: string,
    newPassword: string,
  ): Promise<void> {
    await this.client.send(
      new ConfirmForgotPasswordCommand({
        ClientId: this.clientId,
        Username: email,
        ConfirmationCode: code,
        Password: newPassword,
        SecretHash: this.computeSecretHash(email),
      }),
    );
  }

  isUserNotFound(err: unknown): boolean {
    return err instanceof UserNotFoundException;
  }

  isCodeMismatch(err: unknown): boolean {
    return err instanceof CodeMismatchException;
  }

  isExpiredCode(err: unknown): boolean {
    return err instanceof ExpiredCodeException;
  }

  isInvalidPassword(err: unknown): boolean {
    return err instanceof InvalidPasswordException;
  }

  private computeSecretHash(username: string): string {
    return crypto
      .createHmac('sha256', this.clientSecret)
      .update(username + this.clientId)
      .digest('base64');
  }
}
