import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { User } from '../../domain/user/user';
import {
  IUserRepository,
  USER_REPOSITORY,
} from '../../domain/user/user.repository';
import { CreateUserInput, UpdateUserInput } from './user.schemas';

@Injectable()
export class UserService {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
  ) {}

  findAll(): Promise<User[]> {
    return this.userRepository.findAll();
  }

  async findById(id: string): Promise<User> {
    const user = await this.userRepository.findById(id);
    if (!user) throw new NotFoundException(`ユーザーが見つかりません: ${id}`);
    return user;
  }

  async create(input: CreateUserInput): Promise<User> {
    const existing = await this.userRepository.findByCognitoSub(
      input.cognitoSub,
    );
    if (existing) throw new ConflictException('すでに登録済みのユーザーです');

    const now = new Date();
    const user = new User(
      randomUUID(),
      input.cognitoSub,
      input.name,
      input.nameKana,
      input.role,
      now,
      now,
      null,
    );
    return this.userRepository.save(user);
  }

  async update(id: string, input: UpdateUserInput): Promise<User> {
    const user = await this.findById(id);

    if (input.name !== undefined) user.name = input.name;
    if (input.nameKana !== undefined) user.nameKana = input.nameKana;
    if (input.role !== undefined) user.role = input.role;

    return this.userRepository.save(user);
  }

  async remove(id: string): Promise<void> {
    await this.findById(id);
    await this.userRepository.softDelete(id);
  }
}
