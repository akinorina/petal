import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AdminCreateUserCommand,
  AdminDeleteUserCommand,
  AdminDisableUserCommand,
  CognitoIdentityProviderClient,
  UsernameExistsException,
  UserNotFoundException,
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

  isUsernameExists(err: unknown): boolean {
    return err instanceof UsernameExistsException;
  }
}
