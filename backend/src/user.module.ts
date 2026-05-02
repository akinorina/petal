import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserService } from './application/user/user.service';
import { USER_REPOSITORY } from './domain/user/user.repository';
import { UserEntity } from './infra/database/entities/user.entity';
import { UserRepositoryImpl } from './infra/database/repositories/user.repository.impl';

@Module({
  imports: [TypeOrmModule.forFeature([UserEntity])],
  providers: [
    {
      provide: USER_REPOSITORY,
      useClass: UserRepositoryImpl,
    },
    UserService,
  ],
  exports: [USER_REPOSITORY, UserService],
})
export class UserModule {}
