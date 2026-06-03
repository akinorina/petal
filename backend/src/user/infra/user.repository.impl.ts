import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { User } from '../domain/user';
import { UserRole } from '../domain/user-role.enum';
import { IUserRepository, UserPageQuery } from '../domain/user.repository';
import { UserEntity } from './user.entity';

@Injectable()
export class UserRepositoryImpl implements IUserRepository {
  constructor(
    @InjectRepository(UserEntity)
    private readonly repo: Repository<UserEntity>,
  ) {}

  async runInTransaction<T>(
    fn: (txRepo: IUserRepository) => Promise<T>,
  ): Promise<T> {
    return this.repo.manager.transaction(async (manager) => {
      const txRepo = new UserRepositoryImpl(manager.getRepository(UserEntity));
      return fn(txRepo);
    });
  }

  async findById(id: string): Promise<User | null> {
    const entity = await this.repo.findOne({ where: { id } });
    return entity ? this.toDomain(entity) : null;
  }

  async findByIdWithDeleted(id: string): Promise<User | null> {
    const entity = await this.repo.findOne({
      where: { id },
      withDeleted: true,
    });
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

  async findPage(
    query: UserPageQuery,
  ): Promise<{ items: User[]; total: number }> {
    const qb = this.repo.createQueryBuilder('u');

    if (query.deleted) {
      qb.withDeleted().andWhere('u.deleted_at IS NOT NULL');
    }

    if (query.role !== undefined) {
      qb.andWhere('u.role = :role', { role: query.role });
    }

    if (query.q) {
      qb.andWhere(
        new Brackets((b) => {
          b.where('u.email ILIKE :q', { q: `%${query.q}%` })
            .orWhere('u.name ILIKE :q', { q: `%${query.q}%` })
            .orWhere('u.name_kana ILIKE :q', { q: `%${query.q}%` });
        }),
      );
    }

    qb.orderBy('u.created_at', 'DESC')
      .addOrderBy('u.id', 'ASC')
      .take(query.limit)
      .skip(query.offset);

    const [entities, total] = await qb.getManyAndCount();
    return { items: entities.map((e) => this.toDomain(e)), total };
  }

  async save(user: User): Promise<User> {
    const entity = this.toEntity(user);
    const saved = await this.repo.save(entity);
    return this.toDomain(saved);
  }

  async softDelete(id: string): Promise<void> {
    await this.repo.softDelete(id);
  }

  async restore(id: string): Promise<void> {
    await this.repo.restore(id);
  }

  async countActiveAdmins(): Promise<number> {
    return this.repo.count({ where: { role: UserRole.Admin } });
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
    entity.createdAt = user.createdAt;
    entity.updatedAt = user.updatedAt;
    entity.deletedAt = user.deletedAt;
    return entity;
  }
}
