import { LoginAttempt } from './login-attempt';

const MAX = 5;
const DURATION_MS = 15 * 60 * 1000;
const NOW = new Date('2026-06-03T12:00:00Z');

describe('LoginAttempt.isLocked', () => {
  it('lockedUntil が未来ならロック中', () => {
    const attempt = new LoginAttempt({
      email: 'me@example.com',
      failCount: 5,
      firstFailedAt: NOW,
      lockedUntil: new Date(NOW.getTime() + 60_000),
    });
    expect(attempt.isLocked(NOW)).toBe(true);
  });

  it('lockedUntil が過去なら未ロック', () => {
    const attempt = new LoginAttempt({
      email: 'me@example.com',
      failCount: 5,
      firstFailedAt: NOW,
      lockedUntil: new Date(NOW.getTime() - 60_000),
    });
    expect(attempt.isLocked(NOW)).toBe(false);
  });

  it('lockedUntil が null なら未ロック', () => {
    expect(LoginAttempt.empty('me@example.com').isLocked(NOW)).toBe(false);
  });
});

describe('LoginAttempt.registerFailure', () => {
  it('初回失敗で failCount=1・未ロック', () => {
    const updated = LoginAttempt.empty('me@example.com').registerFailure(
      NOW,
      MAX,
      DURATION_MS,
    );
    expect(updated.failCount).toBe(1);
    expect(updated.firstFailedAt).toEqual(NOW);
    expect(updated.lockedUntil).toBeNull();
  });

  it('窓内の連続失敗で加算される', () => {
    const first = LoginAttempt.empty('me@example.com').registerFailure(
      NOW,
      MAX,
      DURATION_MS,
    );
    const second = first.registerFailure(
      new Date(NOW.getTime() + 1000),
      MAX,
      DURATION_MS,
    );
    expect(second.failCount).toBe(2);
    expect(second.firstFailedAt).toEqual(NOW);
  });

  it('しきい値到達で lockedUntil がセットされる', () => {
    let attempt = LoginAttempt.empty('me@example.com');
    let lastFailureAt = NOW;
    for (let i = 0; i < MAX; i++) {
      lastFailureAt = new Date(NOW.getTime() + i * 1000);
      attempt = attempt.registerFailure(lastFailureAt, MAX, DURATION_MS);
    }
    expect(attempt.failCount).toBe(MAX);
    expect(attempt.lockedUntil).toEqual(
      new Date(lastFailureAt.getTime() + DURATION_MS),
    );
    expect(attempt.isLocked(new Date(lastFailureAt.getTime() + 1000))).toBe(
      true,
    );
  });

  it('窓を超えた失敗はカウントを 1 に数え直す', () => {
    const old = new LoginAttempt({
      email: 'me@example.com',
      failCount: 4,
      firstFailedAt: new Date(NOW.getTime() - DURATION_MS - 1000),
      lockedUntil: null,
    });
    const updated = old.registerFailure(NOW, MAX, DURATION_MS);
    expect(updated.failCount).toBe(1);
    expect(updated.firstFailedAt).toEqual(NOW);
    expect(updated.lockedUntil).toBeNull();
  });
});
