import { Module } from '@nestjs/common';
import { AuthService } from './application/auth.service';
import { AuthController } from './controller/auth.controller';
import { CognitoAuthClient } from './infra/cognito-auth.client';

@Module({
  providers: [AuthService, CognitoAuthClient],
  controllers: [AuthController],
})
export class AuthModule {}
