import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthService } from '../application/auth.service';
import { Public } from '../../common/decorators/public.decorator';
import { LoginRequestDto, LoginResponseDto } from './auth.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  async login(@Body() body: LoginRequestDto): Promise<LoginResponseDto> {
    return this.authService.login(body.email, body.password);
  }
}
