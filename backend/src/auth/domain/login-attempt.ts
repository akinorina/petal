import { z } from 'zod';

export const LoginAttemptSchema = z.object({
  email: z.email(),
  failCount: z.number().int().min(0),
  firstFailedAt: z.date().nullable(),
  lockedUntil: z.date().nullable(),
});

export type LoginAttemptProps = z.infer<typeof LoginAttemptSchema>;

/**
 * ログイン失敗のレート制限カウンタ（email 単位）。
 * しきい値・ロック時間は呼び出し側（AuthService）から渡す。
 */
export class LoginAttempt {
  readonly email: string;
  readonly failCount: number;
  readonly firstFailedAt: Date | null;
  readonly lockedUntil: Date | null;

  constructor(props: LoginAttemptProps) {
    const validated = LoginAttemptSchema.parse(props);
    this.email = validated.email;
    this.failCount = validated.failCount;
    this.firstFailedAt = validated.firstFailedAt;
    this.lockedUntil = validated.lockedUntil;
  }

  /** まだ失敗のない初期状態を作る。 */
  static empty(email: string): LoginAttempt {
    return new LoginAttempt({
      email,
      failCount: 0,
      firstFailedAt: null,
      lockedUntil: null,
    });
  }

  /** 指定時刻においてロック中かどうか。 */
  isLocked(now: Date): boolean {
    return this.lockedUntil !== null && this.lockedUntil > now;
  }

  /**
   * 失敗を 1 件加算した新しい状態を返す（不変）。
   * 直近失敗から durationMs 以上経過していればカウントを 1 から数え直す。
   * 加算後の回数が maxAttempts 以上なら lockedUntil をセットする。
   */
  registerFailure(
    now: Date,
    maxAttempts: number,
    durationMs: number,
  ): LoginAttempt {
    const windowExpired =
      this.firstFailedAt === null ||
      now.getTime() - this.firstFailedAt.getTime() > durationMs;

    const failCount = windowExpired ? 1 : this.failCount + 1;
    const firstFailedAt = windowExpired ? now : this.firstFailedAt;
    const lockedUntil =
      failCount >= maxAttempts ? new Date(now.getTime() + durationMs) : null;

    return new LoginAttempt({
      email: this.email,
      failCount,
      firstFailedAt,
      lockedUntil,
    });
  }
}
