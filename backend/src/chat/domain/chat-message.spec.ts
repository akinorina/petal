import { randomUUID } from 'crypto';
import { ChatMessage, ChatMessageProps } from './chat-message';

function buildProps(
  overrides: Partial<ChatMessageProps> = {},
): ChatMessageProps {
  const now = new Date();
  return {
    id: randomUUID(),
    threadId: randomUUID(),
    seq: 0,
    role: 'user',
    content: 'こんにちは',
    attachments: [],
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    ...overrides,
  };
}

describe('ChatMessage', () => {
  it('attachments を position 付きで保持する', () => {
    const imageId = randomUUID();
    const message = new ChatMessage(
      buildProps({ attachments: [{ imageId, position: 0 }] }),
    );

    expect(message.attachments).toEqual([{ imageId, position: 0 }]);
  });

  it('attachments 未指定なら既定 [] になる', () => {
    const now = new Date();
    const message = new ChatMessage({
      id: randomUUID(),
      threadId: randomUUID(),
      seq: 0,
      role: 'user',
      content: 'こんにちは',
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });

    expect(message.attachments).toEqual([]);
  });

  it('不正な imageId（非 UUID）は parse 失敗', () => {
    expect(
      () =>
        new ChatMessage(
          buildProps({ attachments: [{ imageId: 'not-a-uuid', position: 0 }] }),
        ),
    ).toThrow();
  });

  it('負の position は parse 失敗', () => {
    expect(
      () =>
        new ChatMessage(
          buildProps({
            attachments: [{ imageId: randomUUID(), position: -1 }],
          }),
        ),
    ).toThrow();
  });
});
