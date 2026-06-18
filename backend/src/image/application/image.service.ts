import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { User } from '../../user/domain/user';
import { Image, ImageMimeType } from '../domain/image';
import { IImageRepository, IMAGE_REPOSITORY } from '../domain/image.repository';
import { S3StorageClient } from '../../common/storage/s3.client';
import { CreateImageInput } from './image.schemas';

export type UploadInstruction = {
  url: string;
  method: 'PUT';
  expiresInSeconds: number;
  headers: { 'Content-Type': string };
};

export type CreateImageResult = {
  image: Image;
  upload: UploadInstruction;
};

export type DownloadInstruction = {
  url: string;
  expiresInSeconds: number;
};

@Injectable()
export class ImageService {
  constructor(
    @Inject(IMAGE_REPOSITORY)
    private readonly imageRepository: IImageRepository,
    private readonly s3: S3StorageClient,
  ) {}

  async createWithUploadUrl(
    currentUser: User,
    input: CreateImageInput,
  ): Promise<CreateImageResult> {
    const id = randomUUID();
    const s3Key = `images/${currentUser.id}/${id}`;
    const now = new Date();
    const image = new Image({
      id,
      ownerUserId: currentUser.id,
      s3Key,
      originalFilename: input.originalFilename,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      title: input.title ?? null,
      description: input.description ?? null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });

    const saved = await this.imageRepository.save(image);
    const url = await this.s3.createUploadUrl(s3Key, input.mimeType);

    return {
      image: saved,
      upload: {
        url,
        method: 'PUT',
        expiresInSeconds: this.s3.presignTtlSeconds,
        headers: { 'Content-Type': input.mimeType },
      },
    };
  }

  findAllForOwner(currentUser: User): Promise<Image[]> {
    return this.imageRepository.findAllByOwner(currentUser.id);
  }

  async findOneForOwner(currentUser: User, id: string): Promise<Image> {
    const image = await this.imageRepository.findById(id);
    if (!image || !image.isOwnedBy(currentUser.id)) {
      throw new NotFoundException(`画像が見つかりません: ${id}`);
    }
    return image;
  }

  async createDownloadUrl(
    currentUser: User,
    id: string,
  ): Promise<DownloadInstruction> {
    const image = await this.findOneForOwner(currentUser, id);
    const url = await this.s3.createDownloadUrl(image.s3Key);
    return { url, expiresInSeconds: this.s3.presignTtlSeconds };
  }

  // 所有者本人の画像本体を S3 から取得し base64 として返す（LLM への画像送信用）。
  async getOwnedImageBase64(
    currentUser: User,
    id: string,
  ): Promise<{ mediaType: ImageMimeType; data: string }> {
    const image = await this.findOneForOwner(currentUser, id);
    const bytes = await this.s3.getObjectBytes(image.s3Key);
    return {
      mediaType: image.mimeType,
      data: Buffer.from(bytes).toString('base64'),
    };
  }

  // 所有者本人の画像の表示用 view（署名付き URL＋メタ）を返す（履歴応答用）。
  async getOwnedImageView(
    currentUser: User,
    id: string,
  ): Promise<{
    imageId: string;
    mimeType: ImageMimeType;
    originalFilename: string;
    downloadUrl: string;
    expiresInSeconds: number;
  }> {
    const image = await this.findOneForOwner(currentUser, id);
    const downloadUrl = await this.s3.createDownloadUrl(image.s3Key);
    return {
      imageId: image.id,
      mimeType: image.mimeType,
      originalFilename: image.originalFilename,
      downloadUrl,
      expiresInSeconds: this.s3.presignTtlSeconds,
    };
  }

  async remove(currentUser: User, id: string): Promise<void> {
    const image = await this.findOneForOwner(currentUser, id);
    await this.imageRepository.softDelete(image.id);
  }
}
