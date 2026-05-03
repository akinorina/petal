import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const PRESIGN_TTL_SECONDS = 300;

@Injectable()
export class S3StorageClient {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(config: ConfigService) {
    this.bucket = config.getOrThrow<string>('S3_BUCKET');
    const endpoint = config.get<string>('S3_ENDPOINT');
    const forcePathStyle =
      config.get<string>('S3_FORCE_PATH_STYLE') === 'true';

    const usesLocalEndpoint = !!endpoint && endpoint.length > 0;
    this.client = new S3Client({
      region: config.getOrThrow<string>('AWS_REGION'),
      endpoint: usesLocalEndpoint ? endpoint : undefined,
      forcePathStyle,
      // Localstack 等を指す場合はダミー認証情報を明示する。
      // 本番（endpoint 未設定）では default credential chain に委ねる。
      credentials: usesLocalEndpoint
        ? { accessKeyId: 'test', secretAccessKey: 'test' }
        : undefined,
      // SDK v3 のデフォルトで付与される CRC32 チェックサムは Localstack と
      // 互換性がないため、Localstack 利用時のみ必要時のみ計算する設定にする。
      requestChecksumCalculation: usesLocalEndpoint
        ? 'WHEN_REQUIRED'
        : undefined,
      responseChecksumValidation: usesLocalEndpoint
        ? 'WHEN_REQUIRED'
        : undefined,
    });
  }

  get presignTtlSeconds(): number {
    return PRESIGN_TTL_SECONDS;
  }

  async createUploadUrl(key: string, contentType: string): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    });
    return getSignedUrl(this.client, command, {
      expiresIn: PRESIGN_TTL_SECONDS,
    });
  }

  async createDownloadUrl(key: string): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });
    return getSignedUrl(this.client, command, {
      expiresIn: PRESIGN_TTL_SECONDS,
    });
  }
}
