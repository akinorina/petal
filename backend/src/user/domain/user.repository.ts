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
  /**
   * 指定したコールバックを単一の DB トランザクション内で実行する。
   * コールバックに渡されるリポジトリは同一トランザクションに紐づき、
   * コールバックが例外を throw すれば自動的にロールバックされる。
   */
  runInTransaction<T>(
    fn: (txRepo: IUserRepository) => Promise<T>,
  ): Promise<T>;
}
