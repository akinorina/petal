import { HttpException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { randomUUID } from 'crypto';
import { ImageService } from '../../image/application/image.service';
import type { User } from '../../user/domain/user';
import type { ChatMessageImageRef } from '../domain/chat-message';
import type { ChatContentPart } from '../domain/llm-message';
import { ChatAttachmentService } from './chat-attachment.service';

type MockImageService = {
  findOneForOwner: jest.Mock;
  getOwnedImageBase64: jest.Mock;
  getOwnedImageView: jest.Mock;
};

function buildImageServiceMock(): MockImageService {
  return {
    findOneForOwner: jest.fn(),
    getOwnedImageBase64: jest.fn(),
    getOwnedImageView: jest.fn(),
  };
}

const currentUser = { id: randomUUID() } as User;

async function buildService(
  imageService: MockImageService,
): Promise<ChatAttachmentService> {
  const moduleRef: TestingModule = await Test.createTestingModule({
    providers: [
      ChatAttachmentService,
      { provide: ImageService, useValue: imageService },
    ],
  }).compile();
  return moduleRef.get(ChatAttachmentService);
}

describe('ChatAttachmentService.assertAttachmentsSendable', () => {
  let service: ChatAttachmentService;
  let imageService: MockImageService;

  beforeEach(async () => {
    imageService = buildImageServiceMock();
    service = await buildService(imageService);
  });

  it('添付無: no-op で ImageService を呼ばない', async () => {
    await expect(
      service.assertAttachmentsSendable(currentUser, [], false),
    ).resolves.toBeUndefined();
    expect(imageService.findOneForOwner).not.toHaveBeenCalled();
  });

  it('vision 非対応 & 画像付き: 422 HttpException(LLM_VISION_UNSUPPORTED) を投げ所有者認可しない', async () => {
    const id = randomUUID();
    try {
      await service.assertAttachmentsSendable(currentUser, [id], false);
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

  it('vision 対応: 各 id を所有者認可する', async () => {
    const ids = [randomUUID(), randomUUID()];
    imageService.findOneForOwner.mockResolvedValue({});
    await service.assertAttachmentsSendable(currentUser, ids, true);
    expect(imageService.findOneForOwner).toHaveBeenCalledTimes(2);
    expect(imageService.findOneForOwner).toHaveBeenNthCalledWith(
      1,
      currentUser,
      ids[0],
    );
  });

  it('非所有/不在: findOneForOwner の NotFoundException が伝播する', async () => {
    const id = randomUUID();
    imageService.findOneForOwner.mockRejectedValue(
      new NotFoundException('画像が見つかりません'),
    );
    await expect(
      service.assertAttachmentsSendable(currentUser, [id], true),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('ChatAttachmentService.toLlmContent', () => {
  let service: ChatAttachmentService;
  let imageService: MockImageService;

  beforeEach(async () => {
    imageService = buildImageServiceMock();
    service = await buildService(imageService);
  });

  it('添付無: content 文字列をそのまま返す', async () => {
    const result = await service.toLlmContent(currentUser, 'こんにちは', []);
    expect(result).toBe('こんにちは');
    expect(imageService.getOwnedImageBase64).not.toHaveBeenCalled();
  });

  it('添付有: 先頭 text part＋position 昇順 image part を返す', async () => {
    const idA = randomUUID();
    const idB = randomUUID();
    // 入力は position 降順だが、出力は昇順に並ぶこと。
    const attachments: ChatMessageImageRef[] = [
      { imageId: idB, position: 1 },
      { imageId: idA, position: 0 },
    ];
    imageService.getOwnedImageBase64.mockImplementation(
      (_user: User, id: string) => {
        if (id === idA)
          return Promise.resolve({ mediaType: 'image/png', data: 'AAA' });
        return Promise.resolve({ mediaType: 'image/jpeg', data: 'BBB' });
      },
    );

    const result = (await service.toLlmContent(
      currentUser,
      '本文',
      attachments,
    )) as ChatContentPart[];

    expect(result).toEqual([
      { type: 'text', text: '本文' },
      { type: 'image', mediaType: 'image/png', data: 'AAA' },
      { type: 'image', mediaType: 'image/jpeg', data: 'BBB' },
    ]);
  });
});

describe('ChatAttachmentService.toAttachmentViews', () => {
  let service: ChatAttachmentService;
  let imageService: MockImageService;

  beforeEach(async () => {
    imageService = buildImageServiceMock();
    service = await buildService(imageService);
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
