import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { randomUUID } from 'crypto';
import { S3StorageClient } from '../../common/storage/s3.client';
import type { User } from '../../user/domain/user';
import { Audio } from '../domain/audio';
import { AUDIO_REPOSITORY, IAudioRepository } from '../domain/audio.repository';
import { AudioService } from './audio.service';

type MockAudioRepository = jest.Mocked<IAudioRepository>;

type MockS3 = {
  getObjectBytes: jest.Mock;
  createDownloadUrl: jest.Mock;
  presignTtlSeconds: number;
};

function buildAudioRepositoryMock(): MockAudioRepository {
  return {
    findById: jest.fn(),
    findAllByOwner: jest.fn(),
    save: jest.fn(),
    softDelete: jest.fn(),
  };
}

function buildS3Mock(): MockS3 {
  return {
    getObjectBytes: jest.fn(),
    createDownloadUrl: jest.fn(),
    presignTtlSeconds: 300,
  };
}

const ownerUser = { id: randomUUID() } as User;

function buildAudio(
  overrides: Partial<ConstructorParameters<typeof Audio>[0]> = {},
): Audio {
  const now = new Date();
  return new Audio({
    id: randomUUID(),
    ownerUserId: ownerUser.id,
    s3Key: `audios/${ownerUser.id}/${randomUUID()}`,
    originalFilename: 'voice.mp3',
    mimeType: 'audio/mpeg',
    sizeBytes: 1024,
    durationSeconds: 12,
    title: null,
    description: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    ...overrides,
  });
}

async function buildService(
  repo: MockAudioRepository,
  s3: MockS3,
): Promise<AudioService> {
  const moduleRef: TestingModule = await Test.createTestingModule({
    providers: [
      AudioService,
      { provide: AUDIO_REPOSITORY, useValue: repo },
      { provide: S3StorageClient, useValue: s3 },
    ],
  }).compile();
  return moduleRef.get(AudioService);
}

describe('AudioService.getOwnedAudioBase64', () => {
  let service: AudioService;
  let repo: MockAudioRepository;
  let s3: MockS3;

  beforeEach(async () => {
    repo = buildAudioRepositoryMock();
    s3 = buildS3Mock();
    service = await buildService(repo, s3);
  });

  it('所有音声の本体を base64 と mediaType で返す', async () => {
    const audio = buildAudio({ mimeType: 'audio/wav' });
    repo.findById.mockResolvedValue(audio);
    s3.getObjectBytes.mockResolvedValue(new Uint8Array([1, 2, 3]));

    const result = await service.getOwnedAudioBase64(ownerUser, audio.id);

    expect(result).toEqual({
      mediaType: 'audio/wav',
      data: Buffer.from([1, 2, 3]).toString('base64'),
    });
    expect(s3.getObjectBytes).toHaveBeenCalledWith(audio.s3Key);
  });

  it('非所有/不在: NotFoundException を投げ S3 を呼ばない', async () => {
    repo.findById.mockResolvedValue(null);

    await expect(
      service.getOwnedAudioBase64(ownerUser, randomUUID()),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(s3.getObjectBytes).not.toHaveBeenCalled();
  });

  it('他者所有: NotFoundException を投げる', async () => {
    const audio = buildAudio({ ownerUserId: randomUUID() });
    repo.findById.mockResolvedValue(audio);

    await expect(
      service.getOwnedAudioBase64(ownerUser, audio.id),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(s3.getObjectBytes).not.toHaveBeenCalled();
  });
});

describe('AudioService.getOwnedAudioView', () => {
  let service: AudioService;
  let repo: MockAudioRepository;
  let s3: MockS3;

  beforeEach(async () => {
    repo = buildAudioRepositoryMock();
    s3 = buildS3Mock();
    service = await buildService(repo, s3);
  });

  it('署名付き再生 URL とメタを返す', async () => {
    const audio = buildAudio({
      originalFilename: 'memo.m4a',
      mimeType: 'audio/mp4',
    });
    repo.findById.mockResolvedValue(audio);
    s3.createDownloadUrl.mockResolvedValue('https://example/signed');

    const result = await service.getOwnedAudioView(ownerUser, audio.id);

    expect(result).toEqual({
      audioId: audio.id,
      mimeType: 'audio/mp4',
      originalFilename: 'memo.m4a',
      downloadUrl: 'https://example/signed',
      expiresInSeconds: 300,
    });
    expect(s3.createDownloadUrl).toHaveBeenCalledWith(audio.s3Key);
  });

  it('非所有/不在: NotFoundException を投げ S3 を呼ばない', async () => {
    repo.findById.mockResolvedValue(null);

    await expect(
      service.getOwnedAudioView(ownerUser, randomUUID()),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(s3.createDownloadUrl).not.toHaveBeenCalled();
  });
});
