import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  Post,
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
  LoginSchema,
  NewPasswordChallengeSchema,
} from '../application/auth.schemas';
import {
  AuthenticatedResponseDto,
  ChallengeResponseDto,
  LoginRequestDto,
  LoginResponseDto,
  NewPasswordChallengeRequestDto,
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
