import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { ChatMessage, ChatMessageImageRef } from '../domain/chat-message';
import { ChatThread } from '../domain/chat-thread';
import { IChatThreadRepository } from '../domain/chat-thread.repository';
import { ChatRoleSchema } from '../domain/llm-message';
import { ChatMessageEntity } from './chat-message.entity';
import { ChatMessageImageEntity } from './chat-message-image.entity';
import { ChatThreadEntity } from './chat-thread.entity';

@Injectable()
export class ChatThreadRepositoryImpl implements IChatThreadRepository {
  constructor(
    @InjectRepository(ChatThreadEntity)
    private readonly threadRepo: Repository<ChatThreadEntity>,
    @InjectRepository(ChatMessageEntity)
    private readonly messageRepo: Repository<ChatMessageEntity>,
    @InjectRepository(ChatMessageImageEntity)
    private readonly messageImageRepo: Repository<ChatMessageImageEntity>,
    private readonly dataSource: DataSource,
  ) {}

  async findById(id: string): Promise<ChatThread | null> {
    const entity = await this.threadRepo.findOne({ where: { id } });
    return entity ? this.toThreadDomain(entity) : null;
  }

  async findAllByOwner(ownerUserId: string): Promise<ChatThread[]> {
    const entities = await this.threadRepo.find({
      where: { ownerUserId },
      order: { createdAt: 'DESC' },
    });
    return entities.map((e) => this.toThreadDomain(e));
  }

  async saveThread(thread: ChatThread): Promise<ChatThread> {
    const entity = this.toThreadEntity(thread);
    const saved = await this.threadRepo.save(entity);
    return this.toThreadDomain(saved);
  }

  async updateThreadTitle(
    id: string,
    title: string | null,
  ): Promise<ChatThread | null> {
    // 既存行を読み込んでから更新する。部分エンティティの save では UPDATE 時に
    // 日付列（created_at 等）が補完されず toThreadDomain の検証に失敗するため。
    const entity = await this.threadRepo.findOne({ where: { id } });
    if (!entity) return null;
    entity.title = title;
    const saved = await this.threadRepo.save(entity);
    return this.toThreadDomain(saved);
  }

  async findMessages(threadId: string): Promise<ChatMessage[]> {
    const entities = await this.messageRepo.find({
      where: { threadId },
      order: { seq: 'ASC' },
    });
    if (entities.length === 0) return [];

    // 対象メッセージ群の添付行をまとめて取得し（N+1 回避）、message_id 別に分類する。
    const messageIds = entities.map((e) => e.id);
    const imageRows = await this.messageImageRepo.find({
      where: { messageId: In(messageIds) },
      order: { position: 'ASC' },
    });
    const attachmentsByMessage = new Map<string, ChatMessageImageRef[]>();
    for (const row of imageRows) {
      const list = attachmentsByMessage.get(row.messageId) ?? [];
      list.push({ imageId: row.imageId, position: row.position });
      attachmentsByMessage.set(row.messageId, list);
    }

    return entities.map((e) =>
      this.toMessageDomain(e, attachmentsByMessage.get(e.id) ?? []),
    );
  }

  async findMaxSeq(threadId: string): Promise<number | null> {
    const row = await this.messageRepo
      .createQueryBuilder('m')
      .select('MAX(m.seq)', 'max')
      .where('m.thread_id = :id', { id: threadId })
      .withDeleted()
      .getRawOne<{ max: string | null }>();
    const max = row?.max ?? null;
    return max === null ? null : Number(max);
  }

  async addMessage(message: ChatMessage): Promise<ChatMessage> {
    // メッセージ本体と添付行を 1 トランザクションで保存（全成功 or 全ロールバック）。
    const attachments = [...message.attachments].sort(
      (a, b) => a.position - b.position,
    );
    return this.dataSource.transaction(async (manager) => {
      const savedMessage = await manager.save(this.toMessageEntity(message));
      for (const attachment of attachments) {
        const imageEntity = new ChatMessageImageEntity();
        imageEntity.messageId = savedMessage.id;
        imageEntity.imageId = attachment.imageId;
        imageEntity.position = attachment.position;
        await manager.save(imageEntity);
      }
      return this.toMessageDomain(savedMessage, attachments);
    });
  }

  async softDeleteThread(id: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      // 対象スレッドのメッセージに紐づく添付行を先に落としてから
      // メッセージ → スレッドの順で論理削除する。
      const messageIds = (
        await manager.find(ChatMessageEntity, {
          where: { threadId: id },
          select: { id: true },
        })
      ).map((m) => m.id);
      if (messageIds.length > 0) {
        await manager.softDelete(ChatMessageImageEntity, {
          messageId: In(messageIds),
        });
      }
      await manager.softDelete(ChatMessageEntity, { threadId: id });
      await manager.softDelete(ChatThreadEntity, { id });
    });
  }

  private toThreadDomain(entity: ChatThreadEntity): ChatThread {
    return new ChatThread({
      id: entity.id,
      ownerUserId: entity.ownerUserId,
      title: entity.title,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      deletedAt: entity.deletedAt,
    });
  }

  private toThreadEntity(thread: ChatThread): ChatThreadEntity {
    const entity = new ChatThreadEntity();
    entity.id = thread.id;
    entity.ownerUserId = thread.ownerUserId;
    entity.title = thread.title;
    return entity;
  }

  private toMessageDomain(
    entity: ChatMessageEntity,
    attachments: ChatMessageImageRef[],
  ): ChatMessage {
    return new ChatMessage({
      id: entity.id,
      threadId: entity.threadId,
      seq: Number(entity.seq),
      role: ChatRoleSchema.parse(entity.role),
      content: entity.content,
      attachments,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      deletedAt: entity.deletedAt,
    });
  }

  private toMessageEntity(message: ChatMessage): ChatMessageEntity {
    const entity = new ChatMessageEntity();
    entity.id = message.id;
    entity.threadId = message.threadId;
    entity.seq = String(message.seq);
    entity.role = message.role;
    entity.content = message.content;
    return entity;
  }
}
