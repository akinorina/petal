import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CognitoAuthClient,
  CognitoAuthResult,
} from '../infra/cognito-auth.client';
import { CognitoUserClient } from '../../user/infra/cognito-user.client';
import { UserService } from '../../user/application/user.service';
import { LoginAttempt } from '../domain/login-attempt';
import {
  ILoginAttemptRepository,
  LOGIN_ATTEMPT_REPOSITORY,
} from '../domain/login-attempt.repository';
import { TooManyLoginAttemptsException } from '../../common/exceptions/too-many-login-attempts.exception';
import {
  AuthenticatedResponseDto,
  ChallengeResponseDto,
  LoginResponseDto,
  MfaChallengeResponseDto,
  MfaSetupResponseDto,
  RefreshResponseDto,
} from '../controller/auth.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly maxAttempts: number;
  private readonly lockDurationMs: number;

  constructor(
    private readonly cognitoAuth: CognitoAuthClient,
    private readonly cognitoUser: CognitoUserClient,
    private readonly userService: UserService,
    @Inject(LOGIN_ATTEMPT_REPOSITORY)
    private readonly loginAttempts: ILoginAttemptRepository,
    config: ConfigService,
  ) {
    this.maxAttempts = parsePositiveInt(
      config.get<string>('LOGIN_LOCKOUT_MAX_ATTEMPTS'),
      5,
    );
    this.lockDurationMs =
      parsePositiveInt(
        config.get<string>('LOGIN_LOCKOUT_DURATION_MINUTES'),
        15,
      ) *
      60 *
      1000;
  }

  /**
   * セルフサインアップ: Cognito SignUp を呼び、検証コードをメール送信させる。
   * DB へはまだ書き込まない（confirm 確定後に作成する）。
   */
  async signup(email: string, password: string): Promise<void> {
    try {
      await this.cognitoAuth.signUp(email, password);
    } catch (err) {
      if (this.cognitoAuth.isUsernameExists(err)) {
        throw new ConflictException('すでに登録済みのメールアドレスです');
      }
      if (this.cognitoAuth.isInvalidPassword(err)) {
        throw new BadRequestException('パスワードがポリシーに合致していません');
      }
      if (this.cognitoAuth.isInvalidParameter(err)) {
        throw new BadRequestException('入力内容が正しくありません');
      }
      this.logger.error(
        `セルフサインアップに失敗しました: ${email}`,
        err instanceof Error ? err.stack : String(err),
      );
      throw new BadGatewayException('サインアップに失敗しました');
    }
  }

  /**
   * サインアップの検証コードを確定し、DB に users 行を作成する。
   * ConfirmSignUp → AdminGetUser(sub) → DB INSERT の順。
   * 既に確認済み / 既に DB 行ありのケースは冪等に成功扱いとする。
   */
  async confirmSignup(
    email: string,
    code: string,
    name: string,
    nameKana: string,
  ): Promise<void> {
    try {
      await this.cognitoAuth.confirmSignUp(email, code);
    } catch (err) {
      if (this.cognitoAuth.isUserAlreadyConfirmed(err)) {
        // 既に確認済み: 冪等に DB 作成へ進む
      } else if (this.cognitoAuth.isCodeMismatch(err)) {
        throw new BadRequestException('コードが正しくありません');
      } else if (this.cognitoAuth.isExpiredCode(err)) {
        throw new BadRequestException('コードの有効期限が切れています');
      } else if (this.cognitoUser.isUserNotFound(err)) {
        throw new BadRequestException('ユーザーが見つかりません');
      } else {
        this.logger.error(
          `サインアップ確定に失敗しました: ${email}`,
          err instanceof Error ? err.stack : String(err),
        );
        throw new BadGatewayException('サインアップの確定に失敗しました');
      }
    }

    let sub: string;
    try {
      sub = await this.cognitoUser.adminGetUserSub(email);
    } catch (err) {
      this.logger.error(
        `confirm 後の sub 取得に失敗しました: ${email}`,
        err instanceof Error ? err.stack : String(err),
      );
      throw new BadGatewayException('サインアップの確定に失敗しました');
    }

    await this.userService.createSelfSignup({
      cognitoSub: sub,
      email,
      name,
      nameKana,
    });
  }

  async forgotPassword(email: string): Promise<void> {
    try {
      await this.cognitoAuth.forgotPassword(email);
    } catch (err) {
      if (this.cognitoAuth.isUserNotFound(err)) {
        this.logger.warn(
          `存在しない email へのパスワードリセット要求: ${email}`,
        );
        return;
      }
      this.logger.error(
        'ForgotPassword に失敗しました',
        err instanceof Error ? err.stack : String(err),
      );
      throw new BadGatewayException('パスワードリセット要求に失敗しました');
    }
  }

  async confirmForgotPassword(
    email: string,
    code: string,
    newPassword: string,
  ): Promise<void> {
    try {
      await this.cognitoAuth.confirmForgotPassword(email, code, newPassword);
    } catch (err) {
      if (this.cognitoAuth.isCodeMismatch(err)) {
        throw new BadRequestException('コードが正しくありません');
      }
      if (this.cognitoAuth.isExpiredCode(err)) {
        throw new BadRequestException('コードの有効期限が切れています');
      }
      if (this.cognitoAuth.isInvalidPassword(err)) {
        throw new BadRequestException('パスワードがポリシーに合致していません');
      }
      this.logger.error(
        'ConfirmForgotPassword に失敗しました',
        err instanceof Error ? err.stack : String(err),
      );
      throw new BadRequestException('パスワード変更に失敗しました');
    }

    try {
      await this.cognitoUser.globalSignOut(email);
    } catch (err) {
      this.logger.error(
        `AdminUserGlobalSignOut に失敗（パスワードリセットは成功）: ${email}`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }

  async refresh(
    refreshToken: string,
    email: string,
  ): Promise<RefreshResponseDto> {
    try {
      const tokens = await this.cognitoAuth.refreshAccessToken(
        refreshToken,
        email,
      );
      if (!tokens) {
        throw new UnauthorizedException('リフレッシュトークンが無効です');
      }
      return { ...tokens, email };
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      if (this.cognitoAuth.isNotAuthorized(err)) {
        throw new UnauthorizedException(
          'リフレッシュトークンが無効または失効しています',
        );
      }
      this.logger.error(
        'Cognito refresh に失敗しました',
        err instanceof Error ? err.stack : String(err),
      );
      throw new BadGatewayException('トークン更新に失敗しました');
    }
  }

  /**
   * ログイン中ユーザーのパスワードを変更し、成功後に全セッションを失効させる。
   * GlobalSignOut の失敗は warn ログのみで、パスワード変更は成功扱いとする。
   */
  async changePassword(
    accessToken: string,
    previousPassword: string,
    proposedPassword: string,
  ): Promise<void> {
    try {
      await this.cognitoAuth.changePassword(
        accessToken,
        previousPassword,
        proposedPassword,
      );
    } catch (err) {
      // 旧パスワード誤りは「業務エラー」のため 400 を使う。
      // access token は JwtAuthGuard で検証済みであり、ここで 401 を返すと
      // フロントの「401=トークン期限切れ」処理（refresh/再ログイン誘導）と衝突する。
      if (this.cognitoAuth.isNotAuthorized(err)) {
        throw new BadRequestException('現在のパスワードが正しくありません');
      }
      if (this.cognitoAuth.isInvalidPassword(err)) {
        throw new BadRequestException(
          '新しいパスワードがポリシーに合致していません',
        );
      }
      if (this.cognitoAuth.isLimitExceeded(err)) {
        throw new HttpException(
          '回数が多すぎます。しばらくしてから再度お試しください',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
      this.logger.error(
        'ChangePassword に失敗しました',
        err instanceof Error ? err.stack : String(err),
      );
      throw new BadGatewayException('パスワード変更に失敗しました');
    }

    try {
      await this.cognitoAuth.globalSignOut(accessToken);
    } catch (err) {
      this.logger.warn(
        `GlobalSignOut に失敗（パスワード変更は成功）: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  async logout(accessToken: string): Promise<void> {
    try {
      await this.cognitoAuth.globalSignOut(accessToken);
    } catch (err) {
      this.logger.error(
        'Cognito ログアウトに失敗しました',
        err instanceof Error ? err.stack : String(err),
      );
      throw new BadGatewayException('ログアウトに失敗しました');
    }
  }

  async login(
    email: string,
    password: string,
    ipAddress?: string,
  ): Promise<LoginResponseDto> {
    const now = new Date();
    const existing = await this.loginAttempts.findByEmail(email);
    if (existing && existing.isLocked(now)) {
      throw new TooManyLoginAttemptsException();
    }

    let result: CognitoAuthResult | null;
    try {
      result = await this.cognitoAuth.authenticate(email, password);
    } catch (err) {
      // 認証拒否のみ失敗としてカウント。Cognito 障害（5xx 等）はカウントしない。
      if (this.cognitoAuth.isNotAuthorized(err)) {
        await this.registerFailure(existing, email, ipAddress, now);
      } else {
        this.logger.error(
          'Cognito authenticate に失敗しました',
          err instanceof Error ? err.stack : String(err),
        );
      }
      throw new UnauthorizedException(
        'メールアドレスまたはパスワードが正しくありません',
      );
    }

    if (!result) {
      await this.registerFailure(existing, email, ipAddress, now);
      throw new UnauthorizedException(
        'メールアドレスまたはパスワードが正しくありません',
      );
    }

    // 認証成功（CHALLENGE / MFA も資格情報は正しい）→ カウンタをリセット
    await this.loginAttempts.reset(email);

    if (result.kind === 'challenge') {
      const challenge: ChallengeResponseDto = {
        status: 'CHALLENGE',
        challengeName: result.challengeName,
        session: result.session,
        email,
      };
      return challenge;
    }

    if (result.kind === 'mfa_challenge') {
      const mfa: MfaChallengeResponseDto = {
        status: 'MFA_REQUIRED',
        challengeName: result.challengeName,
        session: result.session,
        email,
      };
      return mfa;
    }

    return this.toAuthenticated(result.tokens, email);
  }

  /** ログイン失敗を 1 件記録し、しきい値到達でロックする。IP はログにのみ残す。 */
  private async registerFailure(
    existing: LoginAttempt | null,
    email: string,
    ipAddress: string | undefined,
    now: Date,
  ): Promise<void> {
    const base = existing ?? LoginAttempt.empty(email);
    const updated = base.registerFailure(
      now,
      this.maxAttempts,
      this.lockDurationMs,
    );
    await this.loginAttempts.save(updated);
    this.logger.warn(
      `ログイン失敗: email=${email} ip=${ipAddress ?? 'unknown'} failCount=${updated.failCount}`,
    );
  }

  async respondMfaChallenge(
    email: string,
    code: string,
    session: string,
  ): Promise<AuthenticatedResponseDto> {
    try {
      const tokens = await this.cognitoAuth.respondToMfaChallenge(
        email,
        code,
        session,
      );
      if (!tokens) {
        throw new UnauthorizedException('MFA 認証に失敗しました');
      }
      return this.toAuthenticated(tokens, email);
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      if (this.cognitoAuth.isCodeMismatch(err)) {
        throw new UnauthorizedException('コードが正しくありません');
      }
      throw new UnauthorizedException(
        'MFA 認証に失敗しました。セッションが切れているかコードが正しくありません。',
      );
    }
  }

  async setupMfa(accessToken: string): Promise<MfaSetupResponseDto> {
    let email: string;
    try {
      email = await this.cognitoUser.getUserEmail(accessToken);
    } catch (err) {
      if (this.cognitoUser.isNotAuthorized(err)) {
        throw new UnauthorizedException('認証情報が無効です');
      }
      this.logger.error(
        'GetUser (email) に失敗しました',
        err instanceof Error ? err.stack : String(err),
      );
      throw new BadGatewayException('MFA 設定の開始に失敗しました');
    }

    try {
      const { secretCode } =
        await this.cognitoAuth.associateSoftwareToken(accessToken);
      const otpauthUri =
        `otpauth://totp/Petal:${encodeURIComponent(email)}` +
        `?secret=${secretCode}&issuer=Petal&algorithm=SHA1&digits=6&period=30`;
      return { secretCode, otpauthUri };
    } catch (err) {
      if (this.cognitoAuth.isNotAuthorized(err)) {
        throw new UnauthorizedException('認証情報が無効です');
      }
      this.logger.error(
        'AssociateSoftwareToken に失敗しました',
        err instanceof Error ? err.stack : String(err),
      );
      throw new BadGatewayException('MFA 設定の開始に失敗しました');
    }
  }

  async verifyMfaSetup(accessToken: string, code: string): Promise<void> {
    try {
      const { status } = await this.cognitoAuth.verifySoftwareToken(
        accessToken,
        code,
        'Petal',
      );
      if (status !== 'SUCCESS') {
        throw new BadRequestException('コードが正しくありません');
      }
      await this.cognitoAuth.setSoftwareTokenMfaEnabled(accessToken, true);
    } catch (err) {
      if (
        err instanceof BadRequestException ||
        err instanceof UnauthorizedException
      ) {
        throw err;
      }
      if (this.cognitoAuth.isCodeMismatch(err)) {
        throw new BadRequestException('コードが正しくありません');
      }
      if (this.cognitoAuth.isEnableSoftwareTokenMfa(err)) {
        throw new BadRequestException(
          'MFA を有効化できませんでした。再度コードを入力してください。',
        );
      }
      if (this.cognitoAuth.isNotAuthorized(err)) {
        throw new UnauthorizedException('認証情報が無効です');
      }
      this.logger.error(
        'VerifySoftwareToken / SetUserMFAPreference に失敗しました',
        err instanceof Error ? err.stack : String(err),
      );
      throw new BadGatewayException('MFA の有効化に失敗しました');
    }
  }

  async disableMfa(accessToken: string): Promise<void> {
    try {
      await this.cognitoAuth.setSoftwareTokenMfaEnabled(accessToken, false);
    } catch (err) {
      if (this.cognitoAuth.isNotAuthorized(err)) {
        throw new UnauthorizedException('認証情報が無効です');
      }
      this.logger.error(
        'SetUserMFAPreference (disable) に失敗しました',
        err instanceof Error ? err.stack : String(err),
      );
      throw new BadGatewayException('MFA の無効化に失敗しました');
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

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
