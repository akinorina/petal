import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LoginAttempt } from '../domain/login-attempt';
import { ILoginAttemptRepository } from '../domain/login-attempt.repository';
import { LoginAttemptEntity } from './login-attempt.entity';

@Injectable()
export class LoginAttemptRepositoryImpl implements ILoginAttemptRepository {
  constructor(
    @InjectRepository(LoginAttemptEntity)
    private readonly repo: Repository<LoginAttemptEntity>,
  ) {}

  async findByEmail(email: string): Promise<LoginAttempt | null> {
    const entity = await this.repo.findOne({ where: { email } });
    return entity ? this.toDomain(entity) : null;
  }

  async save(attempt: LoginAttempt): Promise<void> {
    await this.repo.save({
      email: attempt.email,
      failCount: attempt.failCount,
      firstFailedAt: attempt.firstFailedAt,
      lockedUntil: attempt.lockedUntil,
    });
  }

  async reset(email: string): Promise<void> {
    await this.repo.delete({ email });
  }

  private toDomain(entity: LoginAttemptEntity): LoginAttempt {
    return new LoginAttempt({
      email: entity.email,
      failCount: entity.failCount,
      firstFailedAt: entity.firstFailedAt,
      lockedUntil: entity.lockedUntil,
    });
  }
}
