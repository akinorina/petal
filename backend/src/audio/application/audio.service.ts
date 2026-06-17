import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { S3StorageClient } from '../../common/storage/s3.client';
import { User } from '../../user/domain/user';
import { Audio } from '../domain/audio';
import { IAudioRepository, AUDIO_REPOSITORY } from '../domain/audio.repository';
import { CreateAudioInput } from './audio.schemas';

export type UploadInstruction = {
  url: string;
  method: 'PUT';
  expiresInSeconds: number;
  headers: { 'Content-Type': string };
};

export type CreateAudioResult = {
  audio: Audio;
  upload: UploadInstruction;
};

export type DownloadInstruction = {
  url: string;
  expiresInSeconds: number;
};

@Injectable()
export class AudioService {
  constructor(
    @Inject(AUDIO_REPOSITORY)
    private readonly audioRepository: IAudioRepository,
    private readonly s3: S3StorageClient,
  ) {}

  async createWithUploadUrl(
    currentUser: User,
    input: CreateAudioInput,
  ): Promise<CreateAudioResult> {
    const id = randomUUID();
    const s3Key = `audios/${currentUser.id}/${id}`;
    const now = new Date();
    const audio = new Audio({
      id,
      ownerUserId: currentUser.id,
      s3Key,
      originalFilename: input.originalFilename,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      durationSeconds: input.durationSeconds ?? null,
      title: input.title ?? null,
      description: input.description ?? null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });

    const saved = await this.audioRepository.save(audio);
    const url = await this.s3.createUploadUrl(s3Key, input.mimeType);

    return {
      audio: saved,
      upload: {
        url,
        method: 'PUT',
        expiresInSeconds: this.s3.presignTtlSeconds,
        headers: { 'Content-Type': input.mimeType },
      },
    };
  }

  findAllForOwner(currentUser: User): Promise<Audio[]> {
    return this.audioRepository.findAllByOwner(currentUser.id);
  }

  async findOneForOwner(currentUser: User, id: string): Promise<Audio> {
    const audio = await this.audioRepository.findById(id);
    if (!audio || !audio.isOwnedBy(currentUser.id)) {
      throw new NotFoundException(`音声が見つかりません: ${id}`);
    }
    return audio;
  }

  async createDownloadUrl(
    currentUser: User,
    id: string,
  ): Promise<DownloadInstruction> {
    const audio = await this.findOneForOwner(currentUser, id);
    const url = await this.s3.createDownloadUrl(audio.s3Key);
    return { url, expiresInSeconds: this.s3.presignTtlSeconds };
  }

  async remove(currentUser: User, id: string): Promise<void> {
    const audio = await this.findOneForOwner(currentUser, id);
    await this.audioRepository.softDelete(audio.id);
  }
}
