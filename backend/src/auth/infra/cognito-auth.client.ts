import * as crypto from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { runWithCognitoMetrics } from '../../common/observability/cognito-metrics';
import {
  AdminInitiateAuthCommand,
  AdminRespondToAuthChallengeCommand,
  AssociateSoftwareTokenCommand,
  AuthFlowType,
  ChallengeNameType,
  ChangePasswordCommand,
  CodeMismatchException,
  CognitoIdentityProviderClient,
  ConfirmForgotPasswordCommand,
  ConfirmSignUpCommand,
  EnableSoftwareTokenMFAException,
  ExpiredCodeException,
  ForgotPasswordCommand,
  GlobalSignOutCommand,
  InvalidParameterException,
  InvalidPasswordException,
  LimitExceededException,
  NotAuthorizedException,
  SetUserMFAPreferenceCommand,
  SignUpCommand,
  TooManyRequestsException,
  UsernameExistsException,
  UserNotFoundException,
  VerifySoftwareTokenCommand,
  VerifySoftwareTokenResponseType,
} from '@aws-sdk/client-cognito-identity-provider';

export type CognitoAuthTokens = {
  accessToken: string;
  idToken: string;
  refreshToken: string;
  expiresIn: number;
};

export type CognitoRefreshedTokens = {
  accessToken: string;
  idToken: string;
  expiresIn: number;
};

export type CognitoAuthResult =
  | { kind: 'authenticated'; tokens: CognitoAuthTokens }
  | {
      kind: 'challenge';
      challengeName: 'NEW_PASSWORD_REQUIRED';
      session: string;
    }
  | {
      kind: 'mfa_challenge';
      challengeName: 'SOFTWARE_TOKEN_MFA';
      session: string;
    };

@Injectable()
export class CognitoAuthClient {
  private readonly logger = new Logger(CognitoAuthClient.name);
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

    const response = await runWithCognitoMetrics(
      'AdminInitiateAuth',
      () => this.client.send(command),
      this.logger,
    );

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

    if (
      response.ChallengeName === ChallengeNameType.SOFTWARE_TOKEN_MFA &&
      response.Session
    ) {
      return {
        kind: 'mfa_challenge',
        challengeName: 'SOFTWARE_TOKEN_MFA',
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

    const response = await runWithCognitoMetrics(
      'AdminRespondToAuthChallenge.NEW_PASSWORD_REQUIRED',
      () => this.client.send(command),
      this.logger,
    );
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
    await runWithCognitoMetrics(
      'GlobalSignOut',
      () =>
        this.client.send(
          new GlobalSignOutCommand({ AccessToken: accessToken }),
        ),
      this.logger,
    );
  }

  /**
   * ログイン中ユーザーが自身のパスワードを変更する（access token を使用）。
   */
  async changePassword(
    accessToken: string,
    previousPassword: string,
    proposedPassword: string,
  ): Promise<void> {
    await runWithCognitoMetrics(
      'ChangePassword',
      () =>
        this.client.send(
          new ChangePasswordCommand({
            AccessToken: accessToken,
            PreviousPassword: previousPassword,
            ProposedPassword: proposedPassword,
          }),
        ),
      this.logger,
    );
  }

  async refreshAccessToken(
    refreshToken: string,
    username: string,
  ): Promise<CognitoRefreshedTokens | null> {
    const command = new AdminInitiateAuthCommand({
      UserPoolId: this.userPoolId,
      ClientId: this.clientId,
      AuthFlow: AuthFlowType.REFRESH_TOKEN_AUTH,
      AuthParameters: {
        REFRESH_TOKEN: refreshToken,
        SECRET_HASH: this.computeSecretHash(username),
      },
    });

    const response = await runWithCognitoMetrics(
      'AdminInitiateAuth.REFRESH_TOKEN',
      () => this.client.send(command),
      this.logger,
    );
    const result = response.AuthenticationResult;
    if (!result?.AccessToken || !result.IdToken) return null;

    return {
      accessToken: result.AccessToken,
      idToken: result.IdToken,
      expiresIn: result.ExpiresIn ?? 3600,
    };
  }

  async respondToMfaChallenge(
    username: string,
    code: string,
    session: string,
  ): Promise<CognitoAuthTokens | null> {
    const command = new AdminRespondToAuthChallengeCommand({
      UserPoolId: this.userPoolId,
      ClientId: this.clientId,
      ChallengeName: ChallengeNameType.SOFTWARE_TOKEN_MFA,
      Session: session,
      ChallengeResponses: {
        USERNAME: username,
        SOFTWARE_TOKEN_MFA_CODE: code,
        SECRET_HASH: this.computeSecretHash(username),
      },
    });

    const response = await runWithCognitoMetrics(
      'AdminRespondToAuthChallenge.SOFTWARE_TOKEN_MFA',
      () => this.client.send(command),
      this.logger,
    );
    const result = response.AuthenticationResult;
    if (!result?.AccessToken) return null;

    return {
      accessToken: result.AccessToken,
      idToken: result.IdToken!,
      refreshToken: result.RefreshToken!,
      expiresIn: result.ExpiresIn!,
    };
  }

  async associateSoftwareToken(
    accessToken: string,
  ): Promise<{ secretCode: string }> {
    const response = await runWithCognitoMetrics(
      'AssociateSoftwareToken',
      () =>
        this.client.send(
          new AssociateSoftwareTokenCommand({ AccessToken: accessToken }),
        ),
      this.logger,
    );
    if (!response.SecretCode) {
      throw new Error('Cognito から SecretCode を取得できませんでした');
    }
    return { secretCode: response.SecretCode };
  }

  async verifySoftwareToken(
    accessToken: string,
    userCode: string,
    friendlyDeviceName?: string,
  ): Promise<{ status: 'SUCCESS' | 'ERROR' }> {
    const response = await runWithCognitoMetrics(
      'VerifySoftwareToken',
      () =>
        this.client.send(
          new VerifySoftwareTokenCommand({
            AccessToken: accessToken,
            UserCode: userCode,
            FriendlyDeviceName: friendlyDeviceName,
          }),
        ),
      this.logger,
    );
    const status =
      response.Status === VerifySoftwareTokenResponseType.SUCCESS
        ? 'SUCCESS'
        : 'ERROR';
    return { status };
  }

  async setSoftwareTokenMfaEnabled(
    accessToken: string,
    enabled: boolean,
  ): Promise<void> {
    await runWithCognitoMetrics(
      'SetUserMFAPreference',
      () =>
        this.client.send(
          new SetUserMFAPreferenceCommand({
            AccessToken: accessToken,
            SoftwareTokenMfaSettings: {
              Enabled: enabled,
              PreferredMfa: enabled,
            },
          }),
        ),
      this.logger,
    );
  }

  /**
   * セルフサインアップ（未認証ユーザーが自分で登録）。
   * Cognito が検証コードをメール送信し、ユーザーは UNCONFIRMED 状態になる。
   */
  async signUp(email: string, password: string): Promise<void> {
    await runWithCognitoMetrics(
      'SignUp',
      () =>
        this.client.send(
          new SignUpCommand({
            ClientId: this.clientId,
            Username: email,
            Password: password,
            SecretHash: this.computeSecretHash(email),
            UserAttributes: [{ Name: 'email', Value: email }],
          }),
        ),
      this.logger,
    );
  }

  /**
   * サインアップの検証コードを確定し、ユーザーを CONFIRMED にする。
   */
  async confirmSignUp(email: string, code: string): Promise<void> {
    await runWithCognitoMetrics(
      'ConfirmSignUp',
      () =>
        this.client.send(
          new ConfirmSignUpCommand({
            ClientId: this.clientId,
            Username: email,
            ConfirmationCode: code,
            SecretHash: this.computeSecretHash(email),
          }),
        ),
      this.logger,
    );
  }

  async forgotPassword(email: string): Promise<void> {
    await runWithCognitoMetrics(
      'ForgotPassword',
      () =>
        this.client.send(
          new ForgotPasswordCommand({
            ClientId: this.clientId,
            Username: email,
            SecretHash: this.computeSecretHash(email),
          }),
        ),
      this.logger,
    );
  }

  async confirmForgotPassword(
    email: string,
    code: string,
    newPassword: string,
  ): Promise<void> {
    await runWithCognitoMetrics(
      'ConfirmForgotPassword',
      () =>
        this.client.send(
          new ConfirmForgotPasswordCommand({
            ClientId: this.clientId,
            Username: email,
            ConfirmationCode: code,
            Password: newPassword,
            SecretHash: this.computeSecretHash(email),
          }),
        ),
      this.logger,
    );
  }

  isUserNotFound(err: unknown): boolean {
    return err instanceof UserNotFoundException;
  }

  isUsernameExists(err: unknown): boolean {
    return err instanceof UsernameExistsException;
  }

  isInvalidParameter(err: unknown): boolean {
    return err instanceof InvalidParameterException;
  }

  /**
   * ConfirmSignUp を既に CONFIRMED 済みのユーザーに対して呼んだ場合、
   * Cognito は NotAuthorizedException（"Current status is CONFIRMED"）を投げる。
   * 冪等な再実行のため、これを「確認済み」として識別する。
   */
  isUserAlreadyConfirmed(err: unknown): boolean {
    return (
      err instanceof NotAuthorizedException &&
      /CONFIRMED/i.test(err.message ?? '')
    );
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

  /**
   * Cognito のスロットリング系例外を判定する。
   * `LimitExceededException`（試行上限）と `TooManyRequestsException`（汎用スロットリング）
   * の両方を「回数制限」として扱う。
   */
  isThrottled(err: unknown): boolean {
    return (
      err instanceof LimitExceededException ||
      err instanceof TooManyRequestsException
    );
  }

  isNotAuthorized(err: unknown): boolean {
    return err instanceof NotAuthorizedException;
  }

  isEnableSoftwareTokenMfa(err: unknown): boolean {
    return err instanceof EnableSoftwareTokenMFAException;
  }

  private computeSecretHash(username: string): string {
    return crypto
      .createHmac('sha256', this.clientSecret)
      .update(username + this.clientId)
      .digest('base64');
  }
}
