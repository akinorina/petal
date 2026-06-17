import { Module } from '@nestjs/common';
import { S3StorageClient } from './s3.client';

@Module({
  providers: [S3StorageClient],
  exports: [S3StorageClient],
})
export class StorageModule {}
