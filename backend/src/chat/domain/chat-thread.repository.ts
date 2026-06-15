import { ChatMessage } from './chat-message';
import { ChatThread } from './chat-thread';

export const CHAT_THREAD_REPOSITORY = Symbol('IChatThreadRepository');

export interface IChatThreadRepository {
  findById(id: string): Promise<ChatThread | null>;
  findAllByOwner(ownerUserId: string): Promise<ChatThread[]>;
  saveThread(thread: ChatThread): Promise<ChatThread>;
  findMessages(threadId: string): Promise<ChatMessage[]>;
  findMaxSeq(threadId: string): Promise<number | null>;
  addMessage(message: ChatMessage): Promise<ChatMessage>;
  softDeleteThread(id: string): Promise<void>;
}
