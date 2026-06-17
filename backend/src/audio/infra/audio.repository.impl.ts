import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ALLOWED_AUDIO_MIME_TYPES,
  Audio,
  AudioMimeType,
} from '../domain/audio';
import { IAudioRepository } from '../domain/audio.repository';
import { AudioEntity } from './audio.entity';

@Injectable()
export class AudioRepositoryImpl implements IAudioRepository {
  constructor(
    @InjectRepository(AudioEntity)
    private readonly repo: Repository<AudioEntity>,
  ) {}

  async findById(id: string): Promise<Audio | null> {
    const entity = await this.repo.findOne({ where: { id } });
    return entity ? this.toDomain(entity) : null;
  }

  async findAllByOwner(ownerUserId: string): Promise<Audio[]> {
    const entities = await this.repo.find({
      where: { ownerUserId },
      order: { createdAt: 'DESC' },
    });
    return entities.map((e) => this.toDomain(e));
  }

  async save(audio: Audio): Promise<Audio> {
    const entity = this.toEntity(audio);
    const saved = await this.repo.save(entity);
    return this.toDomain(saved);
  }

  async softDelete(id: string): Promise<void> {
    await this.repo.softDelete(id);
  }

  private toDomain(entity: AudioEntity): Audio {
    if (!isAllowedMime(entity.mimeType)) {
      throw new Error(`不正な mime_type が DB に存在: ${entity.mimeType}`);
    }
    return new Audio({
      id: entity.id,
      ownerUserId: entity.ownerUserId,
      s3Key: entity.s3Key,
      originalFilename: entity.originalFilename,
      mimeType: entity.mimeType,
      sizeBytes: Number(entity.sizeBytes),
      durationSeconds: entity.durationSeconds,
      title: entity.title,
      description: entity.description,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      deletedAt: entity.deletedAt,
    });
  }

  private toEntity(audio: Audio): AudioEntity {
    const entity = new AudioEntity();
    entity.id = audio.id;
    entity.ownerUserId = audio.ownerUserId;
    entity.s3Key = audio.s3Key;
    entity.originalFilename = audio.originalFilename;
    entity.mimeType = audio.mimeType;
    entity.sizeBytes = String(audio.sizeBytes);
    entity.durationSeconds = audio.durationSeconds;
    entity.title = audio.title;
    entity.description = audio.description;
    return entity;
  }
}

function isAllowedMime(value: string): value is AudioMimeType {
  return (ALLOWED_AUDIO_MIME_TYPES as readonly string[]).includes(value);
}
