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
import { ImageEntity } from '../../image/infra/image.entity';
import { ChatMessageEntity } from './chat-message.entity';

@Entity({ schema: 'petal', name: 'chat_message_images' })
@Index('IDX_chat_message_images_message', ['messageId'])
export class ChatMessageImageEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'message_id', type: 'uuid' })
  messageId!: string;

  @ManyToOne(() => ChatMessageEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'message_id' })
  message!: ChatMessageEntity;

  @Column({ name: 'image_id', type: 'uuid' })
  imageId!: string;

  @ManyToOne(() => ImageEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'image_id' })
  image!: ImageEntity;

  @Column({ type: 'int' })
  position!: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;
}
