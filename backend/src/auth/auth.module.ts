import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserModule } from '../user/user.module';
import { AuthService } from './application/auth.service';
import { AuthController } from './controller/auth.controller';
import { LOGIN_ATTEMPT_REPOSITORY } from './domain/login-attempt.repository';
import { CognitoAuthClient } from './infra/cognito-auth.client';
import { LoginAttemptEntity } from './infra/login-attempt.entity';
import { LoginAttemptRepositoryImpl } from './infra/login-attempt.repository.impl';

@Module({
  imports: [UserModule, TypeOrmModule.forFeature([LoginAttemptEntity])],
  providers: [
    AuthService,
    CognitoAuthClient,
    {
      provide: LOGIN_ATTEMPT_REPOSITORY,
      useClass: LoginAttemptRepositoryImpl,
    },
  ],
  controllers: [AuthController],
})
export class AuthModule {}
