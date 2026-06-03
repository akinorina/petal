import { LoginAttempt } from './login-attempt';

export const LOGIN_ATTEMPT_REPOSITORY = Symbol('LOGIN_ATTEMPT_REPOSITORY');

export interface ILoginAttemptRepository {
  findByEmail(email: string): Promise<LoginAttempt | null>;
  /** email を主キーに upsert する。 */
  save(attempt: LoginAttempt): Promise<void>;
  /** 該当 email のカウンタ行を削除する（成功時のリセット）。 */
  reset(email: string): Promise<void>;
}
