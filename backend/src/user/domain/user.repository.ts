import { User } from './user';

export const USER_REPOSITORY = Symbol('IUserRepository');

export interface IUserRepository {
  findById(id: string): Promise<User | null>;
  findByIdWithDeleted(id: string): Promise<User | null>;
  findByCognitoSub(cognitoSub: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  findAll(): Promise<User[]>;
  findAllDeleted(): Promise<User[]>;
  save(user: User): Promise<User>;
  softDelete(id: string): Promise<void>;
  restore(id: string): Promise<void>;
}
