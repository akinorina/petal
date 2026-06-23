import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { AudioEntity } from '../../audio/infra/audio.entity';
import { ChatMessageEntity } from './chat-message.entity';

// メッセージに添付された音声参照（chat_message_images と対称・TSK-131）。
@Entity({ schema: 'petal', name: 'chat_message_audios' })
@Index('IDX_chat_message_audios_message', ['messageId'])
export class ChatMessageAudioEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'message_id', type: 'uuid' })
  messageId!: string;

  @ManyToOne(() => ChatMessageEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'message_id' })
  message!: ChatMessageEntity;

  @Column({ name: 'audio_id', type: 'uuid' })
  audioId!: string;

  @ManyToOne(() => AudioEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'audio_id' })
  audio!: AudioEntity;

  @Column({ type: 'int' })
  position!: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;
}
