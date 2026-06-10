import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Ip,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiExtraModels,
  ApiOkResponse,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import { AuthService } from '../application/auth.service';
import { Public } from '../../common/decorators/public.decorator';
import {
  ChangePasswordSchema,
  ConfirmForgotPasswordSchema,
  ConfirmSignupSchema,
  ForgotPasswordSchema,
  LoginSchema,
  MfaChallengeSchema,
  MfaVerifySchema,
  NewPasswordChallengeSchema,
  RefreshSchema,
  SignupSchema,
} from '../application/auth.schemas';
import {
  AuthenticatedResponseDto,
  ChallengeResponseDto,
  ChangePasswordRequestDto,
  ConfirmForgotPasswordRequestDto,
  ConfirmSignupRequestDto,
  ForgotPasswordRequestDto,
  LoginRequestDto,
  LoginResponseDto,
  MfaChallengeRequestDto,
  MfaChallengeResponseDto,
  MfaSetupResponseDto,
  MfaVerifyRequestDto,
  NewPasswordChallengeRequestDto,
  RefreshRequestDto,
  RefreshResponseDto,
  SignupConfigResponseDto,
  SignupRequestDto,
} from './auth.dto';

@ApiTags('auth')
@ApiExtraModels(
  AuthenticatedResponseDto,
  ChallengeResponseDto,
  MfaChallengeResponseDto,
)
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  @ApiOkResponse({
    schema: {
      oneOf: [
        { $ref: getSchemaPath(AuthenticatedResponseDto) },
        { $ref: getSchemaPath(ChallengeResponseDto) },
        { $ref: getSchemaPath(MfaChallengeResponseDto) },
      ],
      discriminator: {
        propertyName: 'status',
        mapping: {
          AUTHENTICATED: getSchemaPath(AuthenticatedResponseDto),
          CHALLENGE: getSchemaPath(ChallengeResponseDto),
          MFA_REQUIRED: getSchemaPath(MfaChallengeResponseDto),
        },
      },
    },
  })
  async login(
    @Body() body: LoginRequestDto,
    @Ip() ip: string,
    @Headers('x-forwarded-for') forwardedFor: string | undefined,
  ): Promise<LoginResponseDto> {
    const parsed = LoginSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    const clientIp = forwardedFor?.split(',')[0]?.trim() || ip;
    return this.authService.login(
      parsed.data.email,
      parsed.data.password,
      clientIp,
    );
  }

  @Post('logout')
  @HttpCode(204)
  async logout(
    @Headers('authorization') authorization: string | undefined,
  ): Promise<void> {
    const token = extractBearer(authorization);
    if (!token) {
      throw new UnauthorizedException('Authorization ヘッダーが不正です');
    }
    await this.authService.logout(token);
  }

  @Public()
  @Get('signup-config')
  @HttpCode(200)
  @ApiOkResponse({ type: SignupConfigResponseDto })
  getSignupConfig(): SignupConfigResponseDto {
    return this.authService.getSignupConfig();
  }

  @Public()
  @Post('signup')
  @HttpCode(204)
  async signup(@Body() body: SignupRequestDto): Promise<void> {
    const parsed = SignupSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    await this.authService.signup(parsed.data.email, parsed.data.password);
  }

  @Public()
  @Post('confirm-signup')
  @HttpCode(204)
  async confirmSignup(@Body() body: ConfirmSignupRequestDto): Promise<void> {
    const parsed = ConfirmSignupSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    await this.authService.confirmSignup(
      parsed.data.email,
      parsed.data.code,
      parsed.data.name,
      parsed.data.nameKana,
    );
  }

  @Post('change-password')
  @HttpCode(204)
  async changePassword(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: ChangePasswordRequestDto,
  ): Promise<void> {
    const token = extractBearer(authorization);
    if (!token) {
      throw new UnauthorizedException('Authorization ヘッダーが不正です');
    }
    const parsed = ChangePasswordSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    await this.authService.changePassword(
      token,
      parsed.data.previousPassword,
      parsed.data.proposedPassword,
    );
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(204)
  async forgotPassword(@Body() body: ForgotPasswordRequestDto): Promise<void> {
    const parsed = ForgotPasswordSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    await this.authService.forgotPassword(parsed.data.email);
  }

  @Public()
  @Post('confirm-forgot-password')
  @HttpCode(204)
  async confirmForgotPassword(
    @Body() body: ConfirmForgotPasswordRequestDto,
  ): Promise<void> {
    const parsed = ConfirmForgotPasswordSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    await this.authService.confirmForgotPassword(
      parsed.data.email,
      parsed.data.code,
      parsed.data.newPassword,
    );
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  @ApiOkResponse({ type: RefreshResponseDto })
  async refresh(@Body() body: RefreshRequestDto): Promise<RefreshResponseDto> {
    const parsed = RefreshSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return this.authService.refresh(
      parsed.data.refreshToken,
      parsed.data.email,
    );
  }

  @Public()
  @Post('challenge/new-password')
  @HttpCode(200)
  @ApiOkResponse({ type: AuthenticatedResponseDto })
  async completeNewPassword(
    @Body() body: NewPasswordChallengeRequestDto,
  ): Promise<AuthenticatedResponseDto> {
    const parsed = NewPasswordChallengeSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return this.authService.completeNewPassword(
      parsed.data.email,
      parsed.data.newPassword,
      parsed.data.session,
    );
  }

  @Public()
  @Post('challenge/mfa')
  @HttpCode(200)
  @ApiOkResponse({ type: AuthenticatedResponseDto })
  async respondMfaChallenge(
    @Body() body: MfaChallengeRequestDto,
  ): Promise<AuthenticatedResponseDto> {
    const parsed = MfaChallengeSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return this.authService.respondMfaChallenge(
      parsed.data.email,
      parsed.data.code,
      parsed.data.session,
    );
  }

  @Post('mfa/setup')
  @HttpCode(200)
  @ApiOkResponse({ type: MfaSetupResponseDto })
  async setupMfa(
    @Headers('authorization') authorization: string | undefined,
  ): Promise<MfaSetupResponseDto> {
    const token = extractBearer(authorization);
    if (!token) {
      throw new UnauthorizedException('Authorization ヘッダーが不正です');
    }
    return this.authService.setupMfa(token);
  }

  @Post('mfa/verify')
  @HttpCode(204)
  async verifyMfa(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: MfaVerifyRequestDto,
  ): Promise<void> {
    const token = extractBearer(authorization);
    if (!token) {
      throw new UnauthorizedException('Authorization ヘッダーが不正です');
    }
    const parsed = MfaVerifySchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    await this.authService.verifyMfaSetup(token, parsed.data.code);
  }

  @Post('mfa/disable')
  @HttpCode(204)
  async disableMfa(
    @Headers('authorization') authorization: string | undefined,
  ): Promise<void> {
    const token = extractBearer(authorization);
    if (!token) {
      throw new UnauthorizedException('Authorization ヘッダーが不正です');
    }
    await this.authService.disableMfa(token);
  }
}

function extractBearer(authorization: string | undefined): string | null {
  if (!authorization) return null;
  const match = /^Bearer\s+(.+)$/i.exec(authorization);
  return match ? match[1] : null;
}
