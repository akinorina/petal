import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { User } from '../../user/domain/user';
import { ChatMessage } from '../domain/chat-message';
import { ChatThread } from '../domain/chat-thread';
import {
  CHAT_THREAD_REPOSITORY,
  IChatThreadRepository,
} from '../domain/chat-thread.repository';
import { AddMessageInput, CreateThreadInput } from './chat-thread.schemas';

@Injectable()
export class ChatThreadService {
  constructor(
    @Inject(CHAT_THREAD_REPOSITORY)
    private readonly chatThreadRepository: IChatThreadRepository,
  ) {}

  createThread(
    currentUser: User,
    input: CreateThreadInput,
  ): Promise<ChatThread> {
    const now = new Date();
    const thread = new ChatThread({
      id: randomUUID(),
      ownerUserId: currentUser.id,
      title: input.title ?? null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });
    return this.chatThreadRepository.saveThread(thread);
  }

  findThreadsForOwner(currentUser: User): Promise<ChatThread[]> {
    return this.chatThreadRepository.findAllByOwner(currentUser.id);
  }

  async findThreadForOwner(currentUser: User, id: string): Promise<ChatThread> {
    const thread = await this.chatThreadRepository.findById(id);
    if (!thread || !thread.isOwnedBy(currentUser.id)) {
      throw new NotFoundException(`会話スレッドが見つかりません: ${id}`);
    }
    return thread;
  }

  async addMessage(
    currentUser: User,
    threadId: string,
    input: AddMessageInput,
  ): Promise<ChatMessage> {
    const thread = await this.findThreadForOwner(currentUser, threadId);
    const maxSeq = await this.chatThreadRepository.findMaxSeq(thread.id);
    const seq = maxSeq === null ? 0 : maxSeq + 1;
    const now = new Date();
    const message = new ChatMessage({
      id: randomUUID(),
      threadId: thread.id,
      seq,
      role: input.role,
      content: input.content,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });
    return this.chatThreadRepository.addMessage(message);
  }

  async findMessages(
    currentUser: User,
    threadId: string,
  ): Promise<ChatMessage[]> {
    const thread = await this.findThreadForOwner(currentUser, threadId);
    return this.chatThreadRepository.findMessages(thread.id);
  }

  async updateThreadTitle(
    currentUser: User,
    id: string,
    title: string | null,
  ): Promise<ChatThread> {
    const thread = await this.findThreadForOwner(currentUser, id);
    const updated = await this.chatThreadRepository.updateThreadTitle(
      thread.id,
      title,
    );
    if (!updated) {
      throw new NotFoundException(`会話スレッドが見つかりません: ${id}`);
    }
    return updated;
  }

  async removeThread(currentUser: User, id: string): Promise<void> {
    const thread = await this.findThreadForOwner(currentUser, id);
    await this.chatThreadRepository.softDeleteThread(thread.id);
  }
}
