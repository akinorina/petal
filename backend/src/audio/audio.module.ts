import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StorageModule } from '../common/storage/storage.module';
import { UserModule } from '../user/user.module';
import { AudioService } from './application/audio.service';
import { AudioController } from './controller/audio.controller';
import { AUDIO_REPOSITORY } from './domain/audio.repository';
import { AudioEntity } from './infra/audio.entity';
import { AudioRepositoryImpl } from './infra/audio.repository.impl';

@Module({
  imports: [TypeOrmModule.forFeature([AudioEntity]), UserModule, StorageModule],
  controllers: [AudioController],
  providers: [
    {
      provide: AUDIO_REPOSITORY,
      useClass: AudioRepositoryImpl,
    },
    AudioService,
  ],
  // ChatModule から添付音声の解決に AudioService を使うため export する（TSK-131）。
  exports: [AudioService],
})
export class AudioModule {}
