import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserModule } from '../user/user.module';
import { ImageService } from './application/image.service';
import { ImageController } from './controller/image.controller';
import { IMAGE_REPOSITORY } from './domain/image.repository';
import { ImageEntity } from './infra/image.entity';
import { ImageRepositoryImpl } from './infra/image.repository.impl';
import { S3StorageClient } from './infra/s3.client';

@Module({
  imports: [TypeOrmModule.forFeature([ImageEntity]), UserModule],
  controllers: [ImageController],
  providers: [
    {
      provide: IMAGE_REPOSITORY,
      useClass: ImageRepositoryImpl,
    },
    S3StorageClient,
    ImageService,
  ],
})
export class ImageModule {}
