import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { NodeHttpHandler } from '@smithy/node-http-handler';
import { Agent } from 'node:https';

const PRESIGN_TTL_SECONDS = 300;

@Injectable()
export class S3StorageClient {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly internalEndpoint: string | undefined;
  private readonly publicEndpoint: string | undefined;

  constructor(config: ConfigService) {
    this.bucket = config.getOrThrow<string>('S3_BUCKET');
    const endpoint = config.get<string>('S3_ENDPOINT');
    this.internalEndpoint = endpoint || undefined;
    this.publicEndpoint = config.get<string>('S3_PUBLIC_ENDPOINT') || undefined;
    const forcePathStyle = config.get<string>('S3_FORCE_PATH_STYLE') === 'true';

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
      // ローカル LocalStack は自己署名の HTTPS 証明書を使うため、サーバから
      // 実 GET（getObjectBytes 等）すると Node が検証に失敗する。presign は署名
      // 計算のみで通信しないため顕在化しない。ローカル限定で TLS 検証を緩める。
      // 本番（endpoint 未設定）では既定の厳格な TLS 検証を維持する。
      requestHandler: usesLocalEndpoint
        ? new NodeHttpHandler({
            httpsAgent: new Agent({ rejectUnauthorized: false }),
          })
        : undefined,
    });
  }

  get presignTtlSeconds(): number {
    return PRESIGN_TTL_SECONDS;
  }

  // S3_PUBLIC_ENDPOINT が設定されている場合、署名付き URL の内部エンドポイントを
  // 公開エンドポイントに置き換える（LAN 端末から LocalStack に届かない問題の対処）。
  private rewriteUrl(url: string): string {
    if (this.internalEndpoint && this.publicEndpoint) {
      return url.replace(this.internalEndpoint, this.publicEndpoint);
    }
    return url;
  }

  async createUploadUrl(key: string, contentType: string): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    });
    const url = await getSignedUrl(this.client, command, {
      expiresIn: PRESIGN_TTL_SECONDS,
    });
    return this.rewriteUrl(url);
  }

  async createDownloadUrl(key: string): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });
    const url = await getSignedUrl(this.client, command, {
      expiresIn: PRESIGN_TTL_SECONDS,
    });
    return this.rewriteUrl(url);
  }

  // オブジェクト本体をバイト列で取得する（base64 化など in-process 用途）。
  async getObjectBytes(key: string): Promise<Uint8Array> {
    const res = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    );
    if (!res.Body) {
      throw new Error(`オブジェクト本体を取得できません: ${key}`);
    }
    return res.Body.transformToByteArray();
  }
}
