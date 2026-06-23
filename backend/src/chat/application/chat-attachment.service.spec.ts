import { HttpException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { randomUUID } from 'crypto';
import { AudioService } from '../../audio/application/audio.service';
import { ImageService } from '../../image/application/image.service';
import type { User } from '../../user/domain/user';
import type {
  ChatMessageAudioRef,
  ChatMessageImageRef,
} from '../domain/chat-message';
import type { ChatContentPart } from '../domain/llm-message';
import { ChatAttachmentService } from './chat-attachment.service';

type MockImageService = {
  findOneForOwner: jest.Mock;
  getOwnedImageBase64: jest.Mock;
  getOwnedImageView: jest.Mock;
};

type MockAudioService = {
  findOneForOwner: jest.Mock;
  getOwnedAudioBase64: jest.Mock;
  getOwnedAudioView: jest.Mock;
};

function buildImageServiceMock(): MockImageService {
  return {
    findOneForOwner: jest.fn(),
    getOwnedImageBase64: jest.fn(),
    getOwnedImageView: jest.fn(),
  };
}

function buildAudioServiceMock(): MockAudioService {
  return {
    findOneForOwner: jest.fn(),
    getOwnedAudioBase64: jest.fn(),
    getOwnedAudioView: jest.fn(),
  };
}

const currentUser = { id: randomUUID() } as User;

async function buildService(
  imageService: MockImageService,
  audioService: MockAudioService,
): Promise<ChatAttachmentService> {
  const moduleRef: TestingModule = await Test.createTestingModule({
    providers: [
      ChatAttachmentService,
      { provide: ImageService, useValue: imageService },
      { provide: AudioService, useValue: audioService },
    ],
  }).compile();
  return moduleRef.get(ChatAttachmentService);
}

describe('ChatAttachmentService.assertAttachmentsSendable', () => {
  let service: ChatAttachmentService;
  let imageService: MockImageService;
  let audioService: MockAudioService;

  beforeEach(async () => {
    imageService = buildImageServiceMock();
    audioService = buildAudioServiceMock();
    service = await buildService(imageService, audioService);
  });

  it('添付無: no-op で Image/Audio Service を呼ばない', async () => {
    await expect(
      service.assertAttachmentsSendable(currentUser, [], [], false, false),
    ).resolves.toBeUndefined();
    expect(imageService.findOneForOwner).not.toHaveBeenCalled();
    expect(audioService.findOneForOwner).not.toHaveBeenCalled();
  });

  it('vision 非対応 & 画像付き: 422 HttpException(LLM_VISION_UNSUPPORTED) を投げ所有者認可しない', async () => {
    const id = randomUUID();
    try {
      await service.assertAttachmentsSendable(
        currentUser,
        [id],
        [],
        false,
        true,
      );
      throw new Error('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(HttpException);
      const response = (err as HttpException).getResponse() as {
        code: string;
        retryable: boolean;
      };
      expect(response.code).toBe('LLM_VISION_UNSUPPORTED');
      expect(response.retryable).toBe(false);
      expect((err as HttpException).getStatus()).toBe(422);
    }
    expect(imageService.findOneForOwner).not.toHaveBeenCalled();
  });

  it('audio 非対応 & 音声付き: 422 HttpException(LLM_AUDIO_UNSUPPORTED) を投げ所有者認可しない', async () => {
    const id = randomUUID();
    try {
      await service.assertAttachmentsSendable(
        currentUser,
        [],
        [id],
        true,
        false,
      );
      throw new Error('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(HttpException);
      const response = (err as HttpException).getResponse() as {
        code: string;
        retryable: boolean;
      };
      expect(response.code).toBe('LLM_AUDIO_UNSUPPORTED');
      expect(response.retryable).toBe(false);
      expect((err as HttpException).getStatus()).toBe(422);
    }
    expect(audioService.findOneForOwner).not.toHaveBeenCalled();
  });

  it('vision/audio 対応: 各 image/audio id を所有者認可する', async () => {
    const imageIds = [randomUUID(), randomUUID()];
    const audioIds = [randomUUID()];
    imageService.findOneForOwner.mockResolvedValue({});
    audioService.findOneForOwner.mockResolvedValue({});
    await service.assertAttachmentsSendable(
      currentUser,
      imageIds,
      audioIds,
      true,
      true,
    );
    expect(imageService.findOneForOwner).toHaveBeenCalledTimes(2);
    expect(audioService.findOneForOwner).toHaveBeenCalledTimes(1);
    expect(audioService.findOneForOwner).toHaveBeenCalledWith(
      currentUser,
      audioIds[0],
    );
  });

  it('非所有/不在 audio: findOneForOwner の NotFoundException が伝播する', async () => {
    const id = randomUUID();
    audioService.findOneForOwner.mockRejectedValue(
      new NotFoundException('音声が見つかりません'),
    );
    await expect(
      service.assertAttachmentsSendable(currentUser, [], [id], true, true),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('ChatAttachmentService.toLlmContent', () => {
  let service: ChatAttachmentService;
  let imageService: MockImageService;
  let audioService: MockAudioService;

  beforeEach(async () => {
    imageService = buildImageServiceMock();
    audioService = buildAudioServiceMock();
    service = await buildService(imageService, audioService);
  });

  it('添付無: content 文字列をそのまま返す', async () => {
    const result = await service.toLlmContent(
      currentUser,
      'こんにちは',
      [],
      [],
    );
    expect(result).toBe('こんにちは');
    expect(imageService.getOwnedImageBase64).not.toHaveBeenCalled();
    expect(audioService.getOwnedAudioBase64).not.toHaveBeenCalled();
  });

  it('画像＋音声添付有: text→画像(昇順)→音声(昇順) の順に parts を返す', async () => {
    const imgA = randomUUID();
    const imgB = randomUUID();
    const audA = randomUUID();
    const audB = randomUUID();
    // 入力は position 降順だが、出力は昇順に並ぶこと。
    const imageAttachments: ChatMessageImageRef[] = [
      { imageId: imgB, position: 1 },
      { imageId: imgA, position: 0 },
    ];
    const audioAttachments: ChatMessageAudioRef[] = [
      { audioId: audB, position: 1 },
      { audioId: audA, position: 0 },
    ];
    imageService.getOwnedImageBase64.mockImplementation(
      (_user: User, id: string) => {
        if (id === imgA)
          return Promise.resolve({ mediaType: 'image/png', data: 'AAA' });
        return Promise.resolve({ mediaType: 'image/jpeg', data: 'BBB' });
      },
    );
    audioService.getOwnedAudioBase64.mockImplementation(
      (_user: User, id: string) => {
        if (id === audA)
          return Promise.resolve({ mediaType: 'audio/mpeg', data: 'CCC' });
        return Promise.resolve({ mediaType: 'audio/wav', data: 'DDD' });
      },
    );

    const result = (await service.toLlmContent(
      currentUser,
      '本文',
      imageAttachments,
      audioAttachments,
    )) as ChatContentPart[];

    expect(result).toEqual([
      { type: 'text', text: '本文' },
      { type: 'image', mediaType: 'image/png', data: 'AAA' },
      { type: 'image', mediaType: 'image/jpeg', data: 'BBB' },
      { type: 'audio', mediaType: 'audio/mpeg', data: 'CCC' },
      { type: 'audio', mediaType: 'audio/wav', data: 'DDD' },
    ]);
  });
});

describe('ChatAttachmentService.toAttachmentViews', () => {
  let service: ChatAttachmentService;
  let imageService: MockImageService;
  let audioService: MockAudioService;

  beforeEach(async () => {
    imageService = buildImageServiceMock();
    audioService = buildAudioServiceMock();
    service = await buildService(imageService, audioService);
  });

  it('position 昇順に getOwnedImageView 由来の view＋position を返す', async () => {
    const idA = randomUUID();
    const idB = randomUUID();
    const attachments: ChatMessageImageRef[] = [
      { imageId: idB, position: 1 },
      { imageId: idA, position: 0 },
    ];
    imageService.getOwnedImageView.mockImplementation(
      (_user: User, id: string) =>
        Promise.resolve({
          imageId: id,
          mimeType: 'image/png',
          originalFilename: `${id}.png`,
          downloadUrl: `https://example/${id}`,
          expiresInSeconds: 300,
        }),
    );

    const result = await service.toAttachmentViews(currentUser, attachments);

    expect(result).toEqual([
      {
        imageId: idA,
        position: 0,
        mimeType: 'image/png',
        originalFilename: `${idA}.png`,
        downloadUrl: `https://example/${idA}`,
        expiresInSeconds: 300,
      },
      {
        imageId: idB,
        position: 1,
        mimeType: 'image/png',
        originalFilename: `${idB}.png`,
        downloadUrl: `https://example/${idB}`,
        expiresInSeconds: 300,
      },
    ]);
  });
});

describe('ChatAttachmentService.toAudioAttachmentViews', () => {
  let service: ChatAttachmentService;
  let imageService: MockImageService;
  let audioService: MockAudioService;

  beforeEach(async () => {
    imageService = buildImageServiceMock();
    audioService = buildAudioServiceMock();
    service = await buildService(imageService, audioService);
  });

  it('position 昇順に getOwnedAudioView 由来の view＋position を返す', async () => {
    const idA = randomUUID();
    const idB = randomUUID();
    const attachments: ChatMessageAudioRef[] = [
      { audioId: idB, position: 1 },
      { audioId: idA, position: 0 },
    ];
    audioService.getOwnedAudioView.mockImplementation(
      (_user: User, id: string) =>
        Promise.resolve({
          audioId: id,
          mimeType: 'audio/mpeg',
          originalFilename: `${id}.mp3`,
          downloadUrl: `https://example/${id}`,
          expiresInSeconds: 300,
        }),
    );

    const result = await service.toAudioAttachmentViews(
      currentUser,
      attachments,
    );

    expect(result).toEqual([
      {
        audioId: idA,
        position: 0,
        mimeType: 'audio/mpeg',
        originalFilename: `${idA}.mp3`,
        downloadUrl: `https://example/${idA}`,
        expiresInSeconds: 300,
      },
      {
        audioId: idB,
        position: 1,
        mimeType: 'audio/mpeg',
        originalFilename: `${idB}.mp3`,
        downloadUrl: `https://example/${idB}`,
        expiresInSeconds: 300,
      },
    ]);
  });
});
