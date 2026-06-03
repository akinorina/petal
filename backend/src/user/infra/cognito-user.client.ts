import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AdminCreateUserCommand,
  AdminDeleteUserCommand,
  AdminDisableUserCommand,
  AdminEnableUserCommand,
  AdminGetUserCommand,
  AdminUserGlobalSignOutCommand,
  AliasExistsException,
  CodeMismatchException,
  CognitoIdentityProviderClient,
  ExpiredCodeException,
  GetUserCommand,
  NotAuthorizedException,
  UpdateUserAttributesCommand,
  UsernameExistsException,
  UserNotFoundException,
  VerifyUserAttributeCommand,
} from '@aws-sdk/client-cognito-identity-provider';

export type CognitoUserCreated = {
  sub: string;
};

@Injectable()
export class CognitoUserClient {
  private readonly logger = new Logger(CognitoUserClient.name);
  private readonly client: CognitoIdentityProviderClient;
  private readonly userPoolId: string;

  constructor(config: ConfigService) {
    this.userPoolId = config.getOrThrow('COGNITO_USER_POOL_ID');
    this.client = new CognitoIdentityProviderClient({
      region: config.getOrThrow('COGNITO_REGION'),
    });
  }

  /**
   * 招待メール送信付きでユーザーを作成する。
   * 一時パスワードは Cognito が自動生成し、招待メールに記載される。
   */
  async createUser(email: string): Promise<CognitoUserCreated> {
    const result = await this.client.send(
      new AdminCreateUserCommand({
        UserPoolId: this.userPoolId,
        Username: email,
        UserAttributes: [
          { Name: 'email', Value: email },
          { Name: 'email_verified', Value: 'true' },
        ],
        DesiredDeliveryMediums: ['EMAIL'],
      }),
    );

    const sub = result.User?.Attributes?.find((a) => a.Name === 'sub')?.Value;
    if (!sub) {
      throw new Error('Cognito から sub を取得できませんでした');
    }
    return { sub };
  }

  /**
   * 補償用：登録途中の Cognito ユーザーを削除する。
   * （DB INSERT に失敗したとき、招待状態 = FORCE_CHANGE_PASSWORD のまま残るのを防ぐ）
   * ユーザーが存在しなくても例外は握り潰す。
   */
  async deleteUser(email: string): Promise<void> {
    try {
      await this.client.send(
        new AdminDeleteUserCommand({
          UserPoolId: this.userPoolId,
          Username: email,
        }),
      );
    } catch (err) {
      if (err instanceof UserNotFoundException) {
        return;
      }
      this.logger.error(
        `Cognito ユーザー削除（補償）に失敗しました: ${email}`,
        err instanceof Error ? err.stack : String(err),
      );
      throw err;
    }
  }

  /**
   * ユーザーを無効化する（削除はしない）。
   * すでに無効、または存在しない場合は成功扱いとする（冪等）。
   */
  async disableUser(email: string): Promise<void> {
    try {
      await this.client.send(
        new AdminDisableUserCommand({
          UserPoolId: this.userPoolId,
          Username: email,
        }),
      );
    } catch (err) {
      if (err instanceof UserNotFoundException) {
        this.logger.warn(
          `Cognito 上にユーザーが存在しません（既に削除？）: ${email}`,
        );
        return;
      }
      throw err;
    }
  }

  /**
   * ユーザーを有効化する。
   * 不整合検知のため、ユーザーが存在しない場合は例外を投げる（disableUser とは異なる扱い）。
   */
  async enableUser(email: string): Promise<void> {
    await this.client.send(
      new AdminEnableUserCommand({
        UserPoolId: this.userPoolId,
        Username: email,
      }),
    );
  }

  /**
   * 管理者権限でユーザーの全セッションを失効させる（リフレッシュトークン無効化）。
   * 既に存在しないユーザーは握り潰し（呼び出し側で問題にならない）。
   */
  async globalSignOut(email: string): Promise<void> {
    try {
      await this.client.send(
        new AdminUserGlobalSignOutCommand({
          UserPoolId: this.userPoolId,
          Username: email,
        }),
      );
    } catch (err) {
      if (err instanceof UserNotFoundException) {
        this.logger.warn(`Cognito 上にユーザーが存在しません: ${email}`);
        return;
      }
      throw err;
    }
  }

  /**
   * 自分のアクセストークンで email 属性の更新を要求する。
   * Cognito は新メアドへ検証コードを送信し、`email_verified=false` に切り替える。
   */
  async updateUserEmail(accessToken: string, newEmail: string): Promise<void> {
    await this.client.send(
      new UpdateUserAttributesCommand({
        AccessToken: accessToken,
        UserAttributes: [{ Name: 'email', Value: newEmail }],
      }),
    );
  }

  /**
   * 自分のアクセストークンで email 属性の検証コードを確定する。
   * 成功すると `email_verified=true` になり、新 email が確定する。
   */
  async verifyUserEmail(accessToken: string, code: string): Promise<void> {
    await this.client.send(
      new VerifyUserAttributeCommand({
        AccessToken: accessToken,
        AttributeName: 'email',
        Code: code,
      }),
    );
  }

  /**
   * 自分のアクセストークンで Cognito 上の email 属性（保留中の新 email を含む）を取得する。
   */
  async getUserEmail(accessToken: string): Promise<string> {
    const result = await this.client.send(
      new GetUserCommand({ AccessToken: accessToken }),
    );
    const email = result.UserAttributes?.find((a) => a.Name === 'email')?.Value;
    if (!email) {
      throw new Error('Cognito から email 属性を取得できませんでした');
    }
    return email;
  }

  /**
   * 自分の MFA 設定状況を取得する（TOTP のみ判定）。
   */
  async getUserMfaSettings(
    accessToken: string,
  ): Promise<{ totpEnabled: boolean }> {
    const result = await this.client.send(
      new GetUserCommand({ AccessToken: accessToken }),
    );
    const totpEnabled = (result.UserMFASettingList ?? []).includes(
      'SOFTWARE_TOKEN_MFA',
    );
    return { totpEnabled };
  }

  /**
   * 管理者権限で email（= Username）から Cognito の sub を取得する。
   * セルフサインアップ確定後に DB へ保存する cognito_sub を引くために使う。
   */
  async adminGetUserSub(email: string): Promise<string> {
    const result = await this.client.send(
      new AdminGetUserCommand({
        UserPoolId: this.userPoolId,
        Username: email,
      }),
    );
    const sub = result.UserAttributes?.find((a) => a.Name === 'sub')?.Value;
    if (!sub) {
      throw new Error('Cognito から sub を取得できませんでした');
    }
    return sub;
  }

  isUsernameExists(err: unknown): boolean {
    return err instanceof UsernameExistsException;
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

  isAliasExists(err: unknown): boolean {
    return err instanceof AliasExistsException;
  }

  isNotAuthorized(err: unknown): boolean {
    return err instanceof NotAuthorizedException;
  }
}
