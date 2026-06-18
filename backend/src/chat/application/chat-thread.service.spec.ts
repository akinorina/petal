import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { randomUUID } from 'crypto';
import { User } from '../../user/domain/user';
import { UserRole } from '../../user/domain/user-role.enum';
import { ChatMessage } from '../domain/chat-message';
import { ChatThread } from '../domain/chat-thread';
import {
  CHAT_THREAD_REPOSITORY,
  IChatThreadRepository,
} from '../domain/chat-thread.repository';
import { ChatThreadService } from './chat-thread.service';

type MockRepository = {
  [K in keyof IChatThreadRepository]: jest.Mock;
};

function buildMockRepository(): MockRepository {
  return {
    findById: jest.fn(),
    findAllByOwner: jest.fn(),
    saveThread: jest.fn(),
    updateThreadTitle: jest.fn(),
    findMessages: jest.fn(),
    findMaxSeq: jest.fn(),
    addMessage: jest.fn(),
    softDeleteThread: jest.fn(),
  };
}

function buildUser(id: string): User {
  const now = new Date();
  return new User({
    id,
    cognitoSub: 'sub',
    email: 'owner@example.com',
    name: '所有者',
    nameKana: 'しょゆうしゃ',
    role: UserRole.User,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  });
}

function buildThread(id: string, ownerUserId: string): ChatThread {
  const now = new Date();
  return new ChatThread({
    id,
    ownerUserId,
    title: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  });
}

async function buildService(repo: MockRepository): Promise<ChatThreadService> {
  const moduleRef: TestingModule = await Test.createTestingModule({
    providers: [
      ChatThreadService,
      { provide: CHAT_THREAD_REPOSITORY, useValue: repo },
    ],
  }).compile();
  return moduleRef.get(ChatThreadService);
}

const OWNER_ID = randomUUID();
const OTHER_ID = randomUUID();
const THREAD_ID = randomUUID();

describe('ChatThreadService.createThread', () => {
  let service: ChatThreadService;
  let repo: MockRepository;

  beforeEach(async () => {
    repo = buildMockRepository();
    service = await buildService(repo);
    repo.saveThread.mockImplementation((t: ChatThread) => Promise.resolve(t));
  });

  it('title 指定ありでスレッドを生成し owner を currentUser にして save する', async () => {
    const user = buildUser(OWNER_ID);

    const result = await service.createThread(user, { title: 'マイ会話' });

    expect(result.title).toBe('マイ会話');
    expect(result.ownerUserId).toBe(OWNER_ID);
    expect(repo.saveThread).toHaveBeenCalledTimes(1);
    const saved = (repo.saveThread.mock.calls as Array<[ChatThread]>)[0][0];
    expect(saved).toBeInstanceOf(ChatThread);
    expect(saved.title).toBe('マイ会話');
    expect(saved.ownerUserId).toBe(OWNER_ID);
  });

  it('title 未指定なら null でスレッドを生成する', async () => {
    const user = buildUser(OWNER_ID);

    const result = await service.createThread(user, {});

    expect(result.title).toBeNull();
    expect(repo.saveThread).toHaveBeenCalledTimes(1);
  });
});

describe('ChatThreadService.findThreadForOwner', () => {
  let service: ChatThreadService;
  let repo: MockRepository;

  beforeEach(async () => {
    repo = buildMockRepository();
    service = await buildService(repo);
  });

  it('所有者ならスレッドを返す', async () => {
    const thread = buildThread(THREAD_ID, OWNER_ID);
    repo.findById.mockResolvedValue(thread);

    await expect(
      service.findThreadForOwner(buildUser(OWNER_ID), THREAD_ID),
    ).resolves.toBe(thread);
  });

  it('非所有者なら NotFoundException', async () => {
    repo.findById.mockResolvedValue(buildThread(THREAD_ID, OWNER_ID));

    await expect(
      service.findThreadForOwner(buildUser(OTHER_ID), THREAD_ID),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('不在なら NotFoundException', async () => {
    repo.findById.mockResolvedValue(null);

    await expect(
      service.findThreadForOwner(buildUser(OWNER_ID), THREAD_ID),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('ChatThreadService.findThreadsForOwner', () => {
  it('リポジトリの所有者別一覧をそのまま返す', async () => {
    const repo = buildMockRepository();
    const service = await buildService(repo);
    const threads = [buildThread(THREAD_ID, OWNER_ID)];
    repo.findAllByOwner.mockResolvedValue(threads);

    await expect(
      service.findThreadsForOwner(buildUser(OWNER_ID)),
    ).resolves.toBe(threads);
    expect(repo.findAllByOwner).toHaveBeenCalledWith(OWNER_ID);
  });
});

describe('ChatThreadService.addMessage', () => {
  let service: ChatThreadService;
  let repo: MockRepository;

  beforeEach(async () => {
    repo = buildMockRepository();
    service = await buildService(repo);
    repo.findById.mockResolvedValue(buildThread(THREAD_ID, OWNER_ID));
    repo.addMessage.mockImplementation((m: ChatMessage) => Promise.resolve(m));
  });

  it('既存メッセージ無し（max=null）なら seq=0 で追加する', async () => {
    repo.findMaxSeq.mockResolvedValue(null);

    const result = await service.addMessage(buildUser(OWNER_ID), THREAD_ID, {
      role: 'user',
      content: 'こんにちは',
    });

    expect(result.seq).toBe(0);
    expect(result.role).toBe('user');
    expect(result.content).toBe('こんにちは');
    expect(result.threadId).toBe(THREAD_ID);
  });

  it('既存 max=2 なら seq=3 で追加する', async () => {
    repo.findMaxSeq.mockResolvedValue(2);

    const result = await service.addMessage(buildUser(OWNER_ID), THREAD_ID, {
      role: 'assistant',
      content: '返答',
    });

    expect(result.seq).toBe(3);
    expect(result.role).toBe('assistant');
  });

  it('非所有スレッドへの追加は NotFoundException で addMessage 未呼出', async () => {
    repo.findMaxSeq.mockResolvedValue(null);

    await expect(
      service.addMessage(buildUser(OTHER_ID), THREAD_ID, {
        role: 'user',
        content: 'x',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(repo.addMessage).not.toHaveBeenCalled();
  });

  it('attachmentImageIds を配列順の position 付きで attachments に載せて渡す', async () => {
    repo.findMaxSeq.mockResolvedValue(null);
    const imageA = randomUUID();
    const imageB = randomUUID();

    const result = await service.addMessage(buildUser(OWNER_ID), THREAD_ID, {
      role: 'user',
      content: '画像を見て',
      attachmentImageIds: [imageA, imageB],
    });

    expect(result.attachments).toEqual([
      { imageId: imageA, position: 0 },
      { imageId: imageB, position: 1 },
    ]);
    const saved = (repo.addMessage.mock.calls as Array<[ChatMessage]>)[0][0];
    expect(saved.attachments).toEqual([
      { imageId: imageA, position: 0 },
      { imageId: imageB, position: 1 },
    ]);
  });

  it('attachmentImageIds 未指定なら attachments は空配列', async () => {
    repo.findMaxSeq.mockResolvedValue(null);

    const result = await service.addMessage(buildUser(OWNER_ID), THREAD_ID, {
      role: 'user',
      content: 'テキストのみ',
    });

    expect(result.attachments).toEqual([]);
  });
});

describe('ChatThreadService.findMessages', () => {
  let service: ChatThreadService;
  let repo: MockRepository;

  beforeEach(async () => {
    repo = buildMockRepository();
    service = await buildService(repo);
  });

  it('所有者はリポジトリの seq ASC 結果をそのまま受け取る', async () => {
    repo.findById.mockResolvedValue(buildThread(THREAD_ID, OWNER_ID));
    const now = new Date();
    const messages = [
      new ChatMessage({
        id: randomUUID(),
        threadId: THREAD_ID,
        seq: 0,
        role: 'user',
        content: 'a',
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      }),
    ];
    repo.findMessages.mockResolvedValue(messages);

    await expect(
      service.findMessages(buildUser(OWNER_ID), THREAD_ID),
    ).resolves.toBe(messages);
    expect(repo.findMessages).toHaveBeenCalledWith(THREAD_ID);
  });

  it('非所有者は NotFoundException で findMessages 未呼出', async () => {
    repo.findById.mockResolvedValue(buildThread(THREAD_ID, OWNER_ID));

    await expect(
      service.findMessages(buildUser(OTHER_ID), THREAD_ID),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(repo.findMessages).not.toHaveBeenCalled();
  });
});

describe('ChatThreadService.updateThreadTitle', () => {
  let service: ChatThreadService;
  let repo: MockRepository;

  beforeEach(async () => {
    repo = buildMockRepository();
    service = await buildService(repo);
    repo.updateThreadTitle.mockImplementation(
      (id: string, title: string | null) => {
        const thread = buildThread(id, OWNER_ID);
        thread.title = title;
        return Promise.resolve(thread);
      },
    );
  });

  it('所有者のタイトルを更新し repo.updateThreadTitle を 1 回呼ぶ', async () => {
    repo.findById.mockResolvedValue(buildThread(THREAD_ID, OWNER_ID));

    const result = await service.updateThreadTitle(
      buildUser(OWNER_ID),
      THREAD_ID,
      '新しいタイトル',
    );

    expect(result.title).toBe('新しいタイトル');
    expect(repo.updateThreadTitle).toHaveBeenCalledTimes(1);
    expect(repo.updateThreadTitle).toHaveBeenCalledWith(
      THREAD_ID,
      '新しいタイトル',
    );
  });

  it('title=null も反映する', async () => {
    repo.findById.mockResolvedValue(buildThread(THREAD_ID, OWNER_ID));

    const result = await service.updateThreadTitle(
      buildUser(OWNER_ID),
      THREAD_ID,
      null,
    );

    expect(result.title).toBeNull();
    expect(repo.updateThreadTitle).toHaveBeenCalledWith(THREAD_ID, null);
  });

  it('非所有者は NotFoundException で updateThreadTitle 未呼出', async () => {
    repo.findById.mockResolvedValue(buildThread(THREAD_ID, OWNER_ID));

    await expect(
      service.updateThreadTitle(buildUser(OTHER_ID), THREAD_ID, 'x'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(repo.updateThreadTitle).not.toHaveBeenCalled();
  });
});

describe('ChatThreadService.removeThread', () => {
  let service: ChatThreadService;
  let repo: MockRepository;

  beforeEach(async () => {
    repo = buildMockRepository();
    service = await buildService(repo);
  });

  it('所有者なら softDeleteThread が呼ばれる', async () => {
    repo.findById.mockResolvedValue(buildThread(THREAD_ID, OWNER_ID));

    await service.removeThread(buildUser(OWNER_ID), THREAD_ID);

    expect(repo.softDeleteThread).toHaveBeenCalledWith(THREAD_ID);
  });

  it('非所有者は NotFoundException で softDeleteThread 未呼出', async () => {
    repo.findById.mockResolvedValue(buildThread(THREAD_ID, OWNER_ID));

    await expect(
      service.removeThread(buildUser(OTHER_ID), THREAD_ID),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(repo.softDeleteThread).not.toHaveBeenCalled();
  });
});
