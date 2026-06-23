import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { S3StorageClient } from '../../common/storage/s3.client';
import { User } from '../../user/domain/user';
import { Audio, AudioMimeType } from '../domain/audio';
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

  // 所有者本人の音声本体を S3 から取得し base64 として返す（LLM への音声送信用）。
  async getOwnedAudioBase64(
    currentUser: User,
    id: string,
  ): Promise<{ mediaType: AudioMimeType; data: string }> {
    const audio = await this.findOneForOwner(currentUser, id);
    const bytes = await this.s3.getObjectBytes(audio.s3Key);
    return {
      mediaType: audio.mimeType,
      data: Buffer.from(bytes).toString('base64'),
    };
  }

  // 所有者本人の音声の表示用 view（署名付き URL＋メタ）を返す（履歴応答用）。
  async getOwnedAudioView(
    currentUser: User,
    id: string,
  ): Promise<{
    audioId: string;
    mimeType: AudioMimeType;
    originalFilename: string;
    downloadUrl: string;
    expiresInSeconds: number;
  }> {
    const audio = await this.findOneForOwner(currentUser, id);
    const downloadUrl = await this.s3.createDownloadUrl(audio.s3Key);
    return {
      audioId: audio.id,
      mimeType: audio.mimeType,
      originalFilename: audio.originalFilename,
      downloadUrl,
      expiresInSeconds: this.s3.presignTtlSeconds,
    };
  }
}
