import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { UserService } from './application/user.service';
import { UserController } from './controller/user.controller';
import { USER_REPOSITORY } from './domain/user.repository';
import { CognitoUserClient } from './infra/cognito-user.client';
import { UserEntity } from './infra/user.entity';
import { UserRepositoryImpl } from './infra/user.repository.impl';

@Module({
  imports: [TypeOrmModule.forFeature([UserEntity]), AuditModule],
  controllers: [UserController],
  providers: [
    {
      provide: USER_REPOSITORY,
      useClass: UserRepositoryImpl,
    },
    CognitoUserClient,
    UserService,
  ],
  exports: [USER_REPOSITORY, UserService, CognitoUserClient],
})
export class UserModule {}
