import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ChatThreadEntity } from './chat-thread.entity';

@Entity({ schema: 'petal', name: 'chat_messages' })
export class ChatMessageEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'thread_id', type: 'uuid' })
  threadId!: string;

  @ManyToOne(() => ChatThreadEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'thread_id' })
  thread!: ChatThreadEntity;

  @Column({ type: 'bigint' })
  seq!: string;

  @Column({ type: 'varchar', length: 20 })
  role!: string;

  @Column({ type: 'text' })
  content!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;
}
