import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StorageModule } from '../common/storage/storage.module';
import { UserModule } from '../user/user.module';
import { ImageService } from './application/image.service';
import { ImageController } from './controller/image.controller';
import { IMAGE_REPOSITORY } from './domain/image.repository';
import { ImageEntity } from './infra/image.entity';
import { ImageRepositoryImpl } from './infra/image.repository.impl';

@Module({
  imports: [TypeOrmModule.forFeature([ImageEntity]), UserModule, StorageModule],
  controllers: [ImageController],
  providers: [
    {
      provide: IMAGE_REPOSITORY,
      useClass: ImageRepositoryImpl,
    },
    ImageService,
  ],
})
export class ImageModule {}
