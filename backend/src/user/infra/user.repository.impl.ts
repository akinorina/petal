import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../domain/user';
import { IUserRepository } from '../domain/user.repository';
import { UserEntity } from './user.entity';

@Injectable()
export class UserRepositoryImpl implements IUserRepository {
  constructor(
    @InjectRepository(UserEntity)
    private readonly repo: Repository<UserEntity>,
  ) {}

  async findById(id: string): Promise<User | null> {
    const entity = await this.repo.findOne({ where: { id } });
    return entity ? this.toDomain(entity) : null;
  }

  async findByCognitoSub(cognitoSub: string): Promise<User | null> {
    const entity = await this.repo.findOne({ where: { cognitoSub } });
    return entity ? this.toDomain(entity) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const entity = await this.repo.findOne({ where: { email } });
    return entity ? this.toDomain(entity) : null;
  }

  async findAll(): Promise<User[]> {
    const entities = await this.repo.find();
    return entities.map((e) => this.toDomain(e));
  }

  async save(user: User): Promise<User> {
    const entity = this.toEntity(user);
    const saved = await this.repo.save(entity);
    return this.toDomain(saved);
  }

  async softDelete(id: string): Promise<void> {
    await this.repo.softDelete(id);
  }

  private toDomain(entity: UserEntity): User {
    return new User({
      id: entity.id,
      cognitoSub: entity.cognitoSub,
      email: entity.email,
      name: entity.name,
      nameKana: entity.nameKana,
      role: entity.role,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      deletedAt: entity.deletedAt,
    });
  }

  private toEntity(user: User): UserEntity {
    const entity = new UserEntity();
    entity.id = user.id;
    entity.cognitoSub = user.cognitoSub;
    entity.email = user.email;
    entity.name = user.name;
    entity.nameKana = user.nameKana;
    entity.role = user.role;
    return entity;
  }
}
