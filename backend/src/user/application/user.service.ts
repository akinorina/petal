import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { User } from '../domain/user';
import {
  IUserRepository,
  USER_REPOSITORY,
} from '../domain/user.repository';
import { CognitoUserClient } from '../infra/cognito-user.client';
import { CreateUserInput, UpdateUserInput } from './user.schemas';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    private readonly cognitoUser: CognitoUserClient,
  ) {}

  findAll(): Promise<User[]> {
    return this.userRepository.findAll();
  }

  findAllDeleted(): Promise<User[]> {
    return this.userRepository.findAllDeleted();
  }

  async findById(id: string): Promise<User> {
    const user = await this.userRepository.findById(id);
    if (!user) throw new NotFoundException(`ユーザーが見つかりません: ${id}`);
    return user;
  }

  findByCognitoSub(cognitoSub: string): Promise<User | null> {
    return this.userRepository.findByCognitoSub(cognitoSub);
  }

  async create(input: CreateUserInput): Promise<User> {
    const existing = await this.userRepository.findByEmail(input.email);
    if (existing) {
      throw new ConflictException('すでに登録済みのメールアドレスです');
    }

    let cognitoSub: string;
    try {
      const created = await this.cognitoUser.createUser(input.email);
      cognitoSub = created.sub;
    } catch (err) {
      if (this.cognitoUser.isUsernameExists(err)) {
        throw new ConflictException(
          'すでに Cognito に登録済みのメールアドレスです',
        );
      }
      this.logger.error(
        `Cognito ユーザー作成に失敗しました: ${input.email}`,
        err instanceof Error ? err.stack : String(err),
      );
      throw new BadGatewayException('Cognito 連携に失敗しました');
    }

    try {
      const now = new Date();
      const user = new User({
        id: randomUUID(),
        cognitoSub,
        email: input.email,
        name: input.name,
        nameKana: input.nameKana,
        role: input.role,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      });
      return await this.userRepository.save(user);
    } catch (err) {
      this.logger.error(
        `DB 登録に失敗したため Cognito 側を補償削除します: ${input.email}`,
        err instanceof Error ? err.stack : String(err),
      );
      await this.cognitoUser.deleteUser(input.email).catch((compErr) => {
        this.logger.error(
          `Cognito 補償削除に失敗しました: ${input.email}`,
          compErr instanceof Error ? compErr.stack : String(compErr),
        );
      });
      throw err;
    }
  }

  async update(id: string, input: UpdateUserInput): Promise<User> {
    const user = await this.findById(id);

    if (input.name !== undefined) user.name = input.name;
    if (input.nameKana !== undefined) user.nameKana = input.nameKana;
    if (input.role !== undefined) user.role = input.role;

    return this.userRepository.save(user);
  }

  async restore(id: string): Promise<User> {
    const user = await this.userRepository.findByIdWithDeleted(id);
    if (!user) {
      throw new NotFoundException(`ユーザーが見つかりません: ${id}`);
    }
    if (user.deletedAt === null) {
      throw new BadRequestException('既に有効なユーザーです');
    }

    await this.userRepository.restore(id);

    try {
      await this.cognitoUser.enableUser(user.email);
    } catch (err) {
      if (this.cognitoUser.isUserNotFound(err)) {
        this.logger.error(
          `Cognito 上にユーザーが存在しません（DB は restore 済み）: ${user.email}`,
          err instanceof Error ? err.stack : String(err),
        );
        throw new BadGatewayException(
          'Cognito 上にユーザーが存在しません。整合性復旧が必要です。',
        );
      }
      this.logger.error(
        `Cognito ユーザー有効化に失敗しました（DB は restore 済み）: ${user.email}`,
        err instanceof Error ? err.stack : String(err),
      );
      throw new BadGatewayException(
        'Cognito 側のユーザー有効化に失敗しました。運用で再実行してください。',
      );
    }

    return this.findById(id);
  }

  /**
   * メールアドレス変更要求: Cognito へ新メアドの検証コード送信を依頼する。
   * DB の email はまだ書き換えない（verify 確定後に行う）。
   */
  async requestEmailChange(
    actor: User,
    newEmail: string,
    accessToken: string,
  ): Promise<void> {
    if (actor.email === newEmail) {
      throw new BadRequestException(
        '現在のメールアドレスと同じです',
      );
    }

    const existing = await this.userRepository.findByEmail(newEmail);
    if (existing && existing.id !== actor.id) {
      throw new ConflictException('すでに使用中のメールアドレスです');
    }

    try {
      await this.cognitoUser.updateUserEmail(accessToken, newEmail);
    } catch (err) {
      if (this.cognitoUser.isAliasExists(err)) {
        throw new ConflictException('すでに使用中のメールアドレスです');
      }
      if (this.cognitoUser.isNotAuthorized(err)) {
        throw new UnauthorizedException('認証情報が無効です');
      }
      this.logger.error(
        `Cognito UpdateUserAttributes 失敗: user=${actor.id}`,
        err instanceof Error ? err.stack : String(err),
      );
      throw new BadGatewayException(
        'メールアドレス変更要求に失敗しました',
      );
    }
  }

  /**
   * 検証コードを確定して DB の email も更新する。
   * 「DB UPDATE → Cognito Verify → COMMIT」の順でトランザクション境界を引き、
   * Verify が失敗した場合は DB をロールバックして整合性を保つ。
   */
  async confirmEmailChange(
    actor: User,
    code: string,
    accessToken: string,
  ): Promise<void> {
    let pendingEmail: string;
    try {
      pendingEmail = await this.cognitoUser.getUserEmail(accessToken);
    } catch (err) {
      if (this.cognitoUser.isNotAuthorized(err)) {
        throw new UnauthorizedException('認証情報が無効です');
      }
      this.logger.error(
        `Cognito GetUser 失敗: user=${actor.id}`,
        err instanceof Error ? err.stack : String(err),
      );
      throw new BadGatewayException('メールアドレス取得に失敗しました');
    }

    if (pendingEmail === actor.email) {
      throw new BadRequestException(
        '保留中のメールアドレス変更がありません',
      );
    }

    await this.userRepository.runInTransaction(async (txRepo) => {
      const dup = await txRepo.findByEmail(pendingEmail);
      if (dup && dup.id !== actor.id) {
        throw new ConflictException('すでに使用中のメールアドレスです');
      }

      const target = await txRepo.findById(actor.id);
      if (!target) {
        throw new NotFoundException(`ユーザーが見つかりません: ${actor.id}`);
      }
      target.email = pendingEmail;
      await txRepo.save(target);

      try {
        await this.cognitoUser.verifyUserEmail(accessToken, code);
      } catch (err) {
        if (this.cognitoUser.isCodeMismatch(err)) {
          throw new BadRequestException('コードが正しくありません');
        }
        if (this.cognitoUser.isExpiredCode(err)) {
          throw new BadRequestException('コードの有効期限が切れています');
        }
        if (this.cognitoUser.isNotAuthorized(err)) {
          throw new UnauthorizedException('認証情報が無効です');
        }
        this.logger.error(
          `Cognito VerifyUserAttribute 失敗: user=${actor.id}`,
          err instanceof Error ? err.stack : String(err),
        );
        throw new BadGatewayException('メールアドレス変更に失敗しました');
      }
    });
  }

  async remove(id: string): Promise<void> {
    const user = await this.findById(id);
    await this.userRepository.softDelete(id);

    try {
      await this.cognitoUser.globalSignOut(user.email);
    } catch (err) {
      this.logger.warn(
        `Cognito 強制サインアウトに失敗しました（処理は継続）: ${user.email} / ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }

    try {
      await this.cognitoUser.disableUser(user.email);
    } catch (err) {
      this.logger.error(
        `Cognito ユーザー無効化に失敗しました（DB は softDelete 済み）: ${user.email}`,
        err instanceof Error ? err.stack : String(err),
      );
      throw new BadGatewayException(
        'Cognito 側のユーザー無効化に失敗しました。運用で再実行してください。',
      );
    }
  }
}
