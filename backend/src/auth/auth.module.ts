import { Module } from '@nestjs/common';
import { UserModule } from '../user/user.module';
import { AuthService } from './application/auth.service';
import { AuthController } from './controller/auth.controller';
import { CognitoAuthClient } from './infra/cognito-auth.client';

@Module({
  imports: [UserModule],
  providers: [AuthService, CognitoAuthClient],
  controllers: [AuthController],
})
export class AuthModule {}
