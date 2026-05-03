import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ALLOWED_IMAGE_MIME_TYPES, Image, ImageMimeType } from '../domain/image';
import { IImageRepository } from '../domain/image.repository';
import { ImageEntity } from './image.entity';

@Injectable()
export class ImageRepositoryImpl implements IImageRepository {
  constructor(
    @InjectRepository(ImageEntity)
    private readonly repo: Repository<ImageEntity>,
  ) {}

  async findById(id: string): Promise<Image | null> {
    const entity = await this.repo.findOne({ where: { id } });
    return entity ? this.toDomain(entity) : null;
  }

  async findAllByOwner(ownerUserId: string): Promise<Image[]> {
    const entities = await this.repo.find({
      where: { ownerUserId },
      order: { createdAt: 'DESC' },
    });
    return entities.map((e) => this.toDomain(e));
  }

  async save(image: Image): Promise<Image> {
    const entity = this.toEntity(image);
    const saved = await this.repo.save(entity);
    return this.toDomain(saved);
  }

  async softDelete(id: string): Promise<void> {
    await this.repo.softDelete(id);
  }

  private toDomain(entity: ImageEntity): Image {
    if (!isAllowedMime(entity.mimeType)) {
      throw new Error(`不正な mime_type が DB に存在: ${entity.mimeType}`);
    }
    return new Image({
      id: entity.id,
      ownerUserId: entity.ownerUserId,
      s3Key: entity.s3Key,
      originalFilename: entity.originalFilename,
      mimeType: entity.mimeType,
      sizeBytes: Number(entity.sizeBytes),
      title: entity.title,
      description: entity.description,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      deletedAt: entity.deletedAt,
    });
  }

  private toEntity(image: Image): ImageEntity {
    const entity = new ImageEntity();
    entity.id = image.id;
    entity.ownerUserId = image.ownerUserId;
    entity.s3Key = image.s3Key;
    entity.originalFilename = image.originalFilename;
    entity.mimeType = image.mimeType;
    entity.sizeBytes = String(image.sizeBytes);
    entity.title = image.title;
    entity.description = image.description;
    return entity;
  }
}

function isAllowedMime(value: string): value is ImageMimeType {
  return (ALLOWED_IMAGE_MIME_TYPES as readonly string[]).includes(value);
}
