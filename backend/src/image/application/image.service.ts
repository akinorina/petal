import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { User } from '../../user/domain/user';
import { Image } from '../domain/image';
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

  async remove(currentUser: User, id: string): Promise<void> {
    const image = await this.findOneForOwner(currentUser, id);
    await this.imageRepository.softDelete(image.id);
  }
}
