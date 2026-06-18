import { HttpException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { randomUUID } from 'crypto';
import type { User } from '../../user/domain/user';
import { ChatMessage } from '../domain/chat-message';
import type { ChatChunk } from '../domain/llm-generation';
import { ChatAttachmentService } from './chat-attachment.service';
import { ChatCompletionService } from './chat-completion.service';
import type { ChatStreamEvent } from './chat-stream';
import { ChatService } from './chat.service';
import { ChatThreadService } from './chat-thread.service';

type MockChatThreadService = {
  addMessage: jest.Mock;
  findMessages: jest.Mock;
};

type MockChatService = {
  generateStream: jest.Mock;
  supportsVision: jest.Mock;
};

type MockChatAttachmentService = {
  assertAttachmentsSendable: jest.Mock;
  toLlmContent: jest.Mock;
  toAttachmentViews: jest.Mock;
};

function buildThreadServiceMock(): MockChatThreadService {
  return {
    addMessage: jest.fn(),
    findMessages: jest.fn(),
  };
}

function buildChatServiceMock(): MockChatService {
  return {
    generateStream: jest.fn(),
    supportsVision: jest.fn().mockReturnValue(true),
  };
}

function buildAttachmentServiceMock(): MockChatAttachmentService {
  return {
    assertAttachmentsSendable: jest.fn().mockResolvedValue(undefined),
    // デフォルトでは content 文字列をそのまま返す（テキストのみ後方互換）。
    toLlmContent: jest
      .fn()
      .mockImplementation((_user: User, content: string) =>
        Promise.resolve(content),
      ),
    toAttachmentViews: jest.fn().mockResolvedValue([]),
  };
}

async function* toAsyncGenerator(
  chunks: ChatChunk[],
): AsyncGenerator<ChatChunk> {
  for (const chunk of chunks) {
    await Promise.resolve();
    yield chunk;
  }
}

async function* throwingGenerator(
  before: ChatChunk[],
  error: unknown,
): AsyncGenerator<ChatChunk> {
  for (const chunk of before) {
    await Promise.resolve();
    yield chunk;
  }
  await Promise.resolve();
  throw error;
}

const threadId = randomUUID();
const userMessageId = randomUUID();
const assistantMessageId = randomUUID();
const partialMessageId = randomUUID();

function buildMessage(props: Partial<ChatMessage> = {}): ChatMessage {
  const now = new Date('2026-06-10T00:00:00.000Z');
  return new ChatMessage({
    id: props.id ?? userMessageId,
    threadId: props.threadId ?? threadId,
    seq: props.seq ?? 0,
    role: props.role ?? 'user',
    content: props.content ?? 'こんにちは',
    createdAt: props.createdAt ?? now,
    updatedAt: props.updatedAt ?? now,
    deletedAt: null,
  });
}

const currentUser = {
  id: randomUUID(),
} as User;
const input = { content: 'こんにちは' };

async function collect(
  gen: AsyncGenerator<ChatStreamEvent>,
): Promise<ChatStreamEvent[]> {
  const events: ChatStreamEvent[] = [];
  for await (const event of gen) {
    events.push(event);
  }
  return events;
}

describe('ChatCompletionService.streamCompletion', () => {
  let service: ChatCompletionService;
  let threadService: MockChatThreadService;
  let chatService: MockChatService;
  let attachmentService: MockChatAttachmentService;

  beforeEach(async () => {
    threadService = buildThreadServiceMock();
    chatService = buildChatServiceMock();
    attachmentService = buildAttachmentServiceMock();
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        ChatCompletionService,
        { provide: ChatThreadService, useValue: threadService },
        { provide: ChatService, useValue: chatService },
        { provide: ChatAttachmentService, useValue: attachmentService },
      ],
    }).compile();
    service = moduleRef.get(ChatCompletionService);
  });

  it('正常系: 全 delta を yield しアシスタント全文を保存して done を返す', async () => {
    const savedAssistant = buildMessage({
      id: assistantMessageId,
      seq: 1,
      role: 'assistant',
      content: 'こんにちは',
    });
    threadService.addMessage
      .mockResolvedValueOnce(buildMessage({ role: 'user' }))
      .mockResolvedValueOnce(savedAssistant);
    threadService.findMessages.mockResolvedValue([
      buildMessage({ role: 'user', content: 'こんにちは' }),
    ]);
    chatService.generateStream.mockReturnValue(
      toAsyncGenerator([
        { delta: 'こん', done: false },
        { delta: 'にちは', done: false },
        { delta: '', done: true, finishReason: 'stop', model: 'm' },
      ]),
    );

    const events = await collect(
      service.streamCompletion(currentUser, threadId, input),
    );

    expect(events).toEqual([
      { type: 'delta', delta: 'こん' },
      { type: 'delta', delta: 'にちは' },
      {
        type: 'done',
        messageId: assistantMessageId,
        seq: 1,
        finishReason: 'stop',
      },
    ]);
    expect(threadService.addMessage).toHaveBeenNthCalledWith(
      1,
      currentUser,
      threadId,
      {
        role: 'user',
        content: 'こんにちは',
      },
    );
    expect(threadService.addMessage).toHaveBeenNthCalledWith(
      2,
      currentUser,
      threadId,
      {
        role: 'assistant',
        content: 'こんにちは',
      },
    );
    expect(threadService.addMessage).toHaveBeenCalledTimes(2);
  });

  it('非所有者: user addMessage が NotFoundException を投げ generateStream を呼ばない', async () => {
    threadService.addMessage.mockRejectedValue(
      new NotFoundException('会話スレッドが見つかりません'),
    );

    await expect(
      collect(service.streamCompletion(currentUser, threadId, input)),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(chatService.generateStream).not.toHaveBeenCalled();
  });

  it('pre-stream 失敗: delta 前の throw で HttpException を投げアシスタント保存しない', async () => {
    threadService.addMessage.mockResolvedValueOnce(
      buildMessage({ role: 'user' }),
    );
    threadService.findMessages.mockResolvedValue([
      buildMessage({ role: 'user' }),
    ]);
    chatService.generateStream.mockReturnValue(
      throwingGenerator([], {
        code: 'ECONNREFUSED',
        message: 'connect failed',
      }),
    );

    const gen = service.streamCompletion(currentUser, threadId, input);
    await expect(collect(gen)).rejects.toBeInstanceOf(HttpException);
    // user 保存の 1 回のみ。assistant 保存はされない。
    expect(threadService.addMessage).toHaveBeenCalledTimes(1);
  });

  it('pre-stream 失敗: HttpException の本文に code/retryable が載り上流本文を含まない', async () => {
    threadService.addMessage.mockResolvedValueOnce(
      buildMessage({ role: 'user' }),
    );
    threadService.findMessages.mockResolvedValue([
      buildMessage({ role: 'user' }),
    ]);
    chatService.generateStream.mockReturnValue(
      throwingGenerator([], {
        code: 'ECONNREFUSED',
        message: 'connect ECONNREFUSED 1.2.3.4',
      }),
    );

    try {
      await collect(service.streamCompletion(currentUser, threadId, input));
      throw new Error('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(HttpException);
      const response = (err as HttpException).getResponse() as {
        code: string;
        message: string;
        retryable: boolean;
      };
      expect(response.code).toBe('LLM_UPSTREAM_UNAVAILABLE');
      expect(response.retryable).toBe(true);
      expect(response.message).not.toContain('1.2.3.4');
      expect((err as HttpException).getStatus()).toBe(502);
    }
  });

  it('mid-stream エラー: delta 後の throw で部分保存し error イベントを yield', async () => {
    const savedPartial = buildMessage({
      id: partialMessageId,
      seq: 1,
      role: 'assistant',
      content: 'こん',
    });
    threadService.addMessage
      .mockResolvedValueOnce(buildMessage({ role: 'user' }))
      .mockResolvedValueOnce(savedPartial);
    threadService.findMessages.mockResolvedValue([
      buildMessage({ role: 'user' }),
    ]);
    chatService.generateStream.mockReturnValue(
      throwingGenerator([{ delta: 'こん', done: false }], { message: 'boom' }),
    );

    const events = await collect(
      service.streamCompletion(currentUser, threadId, input),
    );

    expect(events[0]).toEqual({ type: 'delta', delta: 'こん' });
    const errorEvent = events[1];
    expect(errorEvent.type).toBe('error');
    if (errorEvent.type === 'error') {
      expect(errorEvent.retryable).toBe(true);
    }
    expect(threadService.addMessage).toHaveBeenNthCalledWith(
      2,
      currentUser,
      threadId,
      {
        role: 'assistant',
        content: 'こん',
      },
    );
    expect(threadService.addMessage).toHaveBeenCalledTimes(2);
  });

  it('切断: gen.return() で finally の部分保存が 1 回呼ばれ以降のイベントは出ない', async () => {
    threadService.addMessage
      .mockResolvedValueOnce(buildMessage({ role: 'user' }))
      .mockResolvedValueOnce(
        buildMessage({ role: 'assistant', content: 'こん' }),
      );
    threadService.findMessages.mockResolvedValue([
      buildMessage({ role: 'user' }),
    ]);
    chatService.generateStream.mockReturnValue(
      toAsyncGenerator([
        { delta: 'こん', done: false },
        { delta: 'にちは', done: false },
      ]),
    );

    const gen = service.streamCompletion(currentUser, threadId, input);
    const first = await gen.next();
    expect(first.value).toEqual({ type: 'delta', delta: 'こん' });
    const afterReturn = await gen.return(undefined);
    expect(afterReturn.done).toBe(true);
    const next = await gen.next();
    expect(next.done).toBe(true);

    expect(threadService.addMessage).toHaveBeenNthCalledWith(
      2,
      currentUser,
      threadId,
      {
        role: 'assistant',
        content: 'こん',
      },
    );
    expect(threadService.addMessage).toHaveBeenCalledTimes(2);
  });

  it('空生成: delta 0 件なら assistant 保存せず done の messageId/seq が null', async () => {
    threadService.addMessage.mockResolvedValueOnce(
      buildMessage({ role: 'user' }),
    );
    threadService.findMessages.mockResolvedValue([
      buildMessage({ role: 'user' }),
    ]);
    chatService.generateStream.mockReturnValue(
      toAsyncGenerator([
        { delta: '', done: true, finishReason: 'stop', model: 'm' },
      ]),
    );

    const events = await collect(
      service.streamCompletion(currentUser, threadId, input),
    );

    expect(events).toEqual([
      { type: 'done', messageId: null, seq: null, finishReason: 'stop' },
    ]);
    // user 保存のみ。assistant 保存はされない。
    expect(threadService.addMessage).toHaveBeenCalledTimes(1);
  });

  it('finishReason 欠落 / 空 delta: 空チャンクはスキップし done の finishReason は null', async () => {
    const savedAssistant = buildMessage({
      id: assistantMessageId,
      seq: 1,
      role: 'assistant',
      content: 'こん',
    });
    threadService.addMessage
      .mockResolvedValueOnce(buildMessage({ role: 'user' }))
      .mockResolvedValueOnce(savedAssistant);
    threadService.findMessages.mockResolvedValue([
      buildMessage({ role: 'user' }),
    ]);
    chatService.generateStream.mockReturnValue(
      toAsyncGenerator([
        { delta: 'こん', done: false },
        // 空 delta かつ非 done のチャンクは yield されず無視される
        { delta: '', done: false },
        // finishReason 欠落の done チャンク
        { delta: '', done: true },
      ]),
    );

    const events = await collect(
      service.streamCompletion(currentUser, threadId, input),
    );

    expect(events).toEqual([
      { type: 'delta', delta: 'こん' },
      {
        type: 'done',
        messageId: assistantMessageId,
        seq: 1,
        finishReason: null,
      },
    ]);
  });

  it('二重保存ガード: 正常終了後に finally が走っても assistant 保存は 1 回のみ', async () => {
    threadService.addMessage
      .mockResolvedValueOnce(buildMessage({ role: 'user' }))
      .mockResolvedValueOnce(
        buildMessage({ role: 'assistant', seq: 1, content: 'こん' }),
      );
    threadService.findMessages.mockResolvedValue([
      buildMessage({ role: 'user' }),
    ]);
    chatService.generateStream.mockReturnValue(
      toAsyncGenerator([
        { delta: 'こん', done: false },
        { delta: '', done: true, finishReason: 'stop', model: 'm' },
      ]),
    );

    await collect(service.streamCompletion(currentUser, threadId, input));

    // user + assistant の 2 回。finally の二重 persist は no-op。
    expect(threadService.addMessage).toHaveBeenCalledTimes(2);
  });

  it('添付検証: assertAttachmentsSendable が addMessage より前に supportsVision 結果で呼ばれる', async () => {
    const imageId = randomUUID();
    chatService.supportsVision.mockReturnValue(true);
    threadService.addMessage.mockResolvedValue(buildMessage({ role: 'user' }));
    threadService.findMessages.mockResolvedValue([
      buildMessage({ role: 'user' }),
    ]);
    chatService.generateStream.mockReturnValue(
      toAsyncGenerator([
        { delta: '', done: true, finishReason: 'stop', model: 'm' },
      ]),
    );
    const callOrder: string[] = [];
    attachmentService.assertAttachmentsSendable.mockImplementation(() => {
      callOrder.push('assert');
      return Promise.resolve();
    });
    threadService.addMessage.mockImplementation(() => {
      callOrder.push('addMessage');
      return Promise.resolve(buildMessage({ role: 'user' }));
    });

    await collect(
      service.streamCompletion(currentUser, threadId, {
        content: 'こんにちは',
        attachmentImageIds: [imageId],
      }),
    );

    expect(attachmentService.assertAttachmentsSendable).toHaveBeenCalledWith(
      currentUser,
      [imageId],
      true,
    );
    expect(callOrder[0]).toBe('assert');
    expect(callOrder.indexOf('assert')).toBeLessThan(
      callOrder.indexOf('addMessage'),
    );
  });

  it('添付検証: assert が 422 を投げると pre-stream で伝播し addMessage を呼ばない', async () => {
    attachmentService.assertAttachmentsSendable.mockRejectedValue(
      new HttpException({ code: 'LLM_VISION_UNSUPPORTED' }, 422),
    );

    await expect(
      collect(
        service.streamCompletion(currentUser, threadId, {
          content: 'x',
          attachmentImageIds: [randomUUID()],
        }),
      ),
    ).rejects.toBeInstanceOf(HttpException);
    expect(threadService.addMessage).not.toHaveBeenCalled();
    expect(chatService.generateStream).not.toHaveBeenCalled();
  });

  it('添付検証: assert が 404 を投げると pre-stream で伝播し addMessage を呼ばない', async () => {
    attachmentService.assertAttachmentsSendable.mockRejectedValue(
      new NotFoundException('画像が見つかりません'),
    );

    await expect(
      collect(
        service.streamCompletion(currentUser, threadId, {
          content: 'x',
          attachmentImageIds: [randomUUID()],
        }),
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(threadService.addMessage).not.toHaveBeenCalled();
  });

  it('添付永続化: addMessage に attachmentImageIds が渡る', async () => {
    const imageId = randomUUID();
    threadService.addMessage.mockResolvedValue(buildMessage({ role: 'user' }));
    threadService.findMessages.mockResolvedValue([
      buildMessage({ role: 'user' }),
    ]);
    chatService.generateStream.mockReturnValue(
      toAsyncGenerator([
        { delta: '', done: true, finishReason: 'stop', model: 'm' },
      ]),
    );

    await collect(
      service.streamCompletion(currentUser, threadId, {
        content: 'こんにちは',
        attachmentImageIds: [imageId],
      }),
    );

    expect(threadService.addMessage).toHaveBeenNthCalledWith(
      1,
      currentUser,
      threadId,
      {
        role: 'user',
        content: 'こんにちは',
        attachmentImageIds: [imageId],
      },
    );
  });

  it('履歴 content: 各履歴メッセージが toLlmContent 経由で構築され generateStream へ渡る', async () => {
    const historyMessage = buildMessage({ role: 'user', content: '本文' });
    threadService.addMessage.mockResolvedValue(buildMessage({ role: 'user' }));
    threadService.findMessages.mockResolvedValue([historyMessage]);
    attachmentService.toLlmContent.mockResolvedValue([
      { type: 'text', text: '本文' },
      { type: 'image', mediaType: 'image/png', data: 'AAA' },
    ]);
    chatService.generateStream.mockReturnValue(
      toAsyncGenerator([
        { delta: '', done: true, finishReason: 'stop', model: 'm' },
      ]),
    );

    await collect(service.streamCompletion(currentUser, threadId, input));

    expect(attachmentService.toLlmContent).toHaveBeenCalledWith(
      currentUser,
      '本文',
      historyMessage.attachments,
    );
    expect(chatService.generateStream).toHaveBeenCalledWith({
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: '本文' },
            { type: 'image', mediaType: 'image/png', data: 'AAA' },
          ],
        },
      ],
    });
  });
});
