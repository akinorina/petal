import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  HttpCode,
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
  ConfirmForgotPasswordSchema,
  ForgotPasswordSchema,
  LoginSchema,
  NewPasswordChallengeSchema,
  RefreshSchema,
} from '../application/auth.schemas';
import {
  AuthenticatedResponseDto,
  ChallengeResponseDto,
  ConfirmForgotPasswordRequestDto,
  ForgotPasswordRequestDto,
  LoginRequestDto,
  LoginResponseDto,
  NewPasswordChallengeRequestDto,
  RefreshRequestDto,
  RefreshResponseDto,
} from './auth.dto';

@ApiTags('auth')
@ApiExtraModels(AuthenticatedResponseDto, ChallengeResponseDto)
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
      ],
      discriminator: {
        propertyName: 'status',
        mapping: {
          AUTHENTICATED: getSchemaPath(AuthenticatedResponseDto),
          CHALLENGE: getSchemaPath(ChallengeResponseDto),
        },
      },
    },
  })
  async login(@Body() body: LoginRequestDto): Promise<LoginResponseDto> {
    const parsed = LoginSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return this.authService.login(parsed.data.email, parsed.data.password);
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
  @Post('forgot-password')
  @HttpCode(204)
  async forgotPassword(
    @Body() body: ForgotPasswordRequestDto,
  ): Promise<void> {
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
    return this.authService.refresh(parsed.data.refreshToken, parsed.data.email);
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
}

function extractBearer(authorization: string | undefined): string | null {
  if (!authorization) return null;
  const match = /^Bearer\s+(.+)$/i.exec(authorization);
  return match ? match[1] : null;
}
