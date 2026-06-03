import {
  CognitoUser,
  DbUser,
  classifyDiscrepancies,
} from './cognito-sync-diff';

function db(overrides: Partial<DbUser> = {}): DbUser {
  return {
    cognitoSub: 'sub-1',
    email: 'taro@example.com',
    deleted: false,
    ...overrides,
  };
}

function cognito(overrides: Partial<CognitoUser> = {}): CognitoUser {
  return {
    sub: 'sub-1',
    email: 'taro@example.com',
    enabled: true,
    ...overrides,
  };
}

describe('classifyDiscrepancies', () => {
  it('整合している場合は空配列', () => {
    expect(classifyDiscrepancies([db()], [cognito()])).toEqual([]);
  });

  it('DB のみ存在は db_only', () => {
    const result = classifyDiscrepancies([db({ cognitoSub: 'x' })], []);
    expect(result).toEqual([
      { kind: 'db_only', sub: 'x', email: 'taro@example.com' },
    ]);
  });

  it('Cognito のみ存在は cognito_only', () => {
    const result = classifyDiscrepancies(
      [],
      [cognito({ sub: 'y', email: 'hanako@example.com' })],
    );
    expect(result).toEqual([
      { kind: 'cognito_only', sub: 'y', email: 'hanako@example.com' },
    ]);
  });

  it('DB 削除済 × Cognito 有効 は修復可の state_mismatch', () => {
    const result = classifyDiscrepancies(
      [db({ deleted: true })],
      [cognito({ enabled: true })],
    );
    expect(result).toEqual([
      {
        kind: 'state_mismatch',
        sub: 'sub-1',
        email: 'taro@example.com',
        dbDeleted: true,
        cognitoEnabled: true,
        fixable: true,
      },
    ]);
  });

  it('DB 有効 × Cognito 無効 は修復不可の state_mismatch', () => {
    const result = classifyDiscrepancies(
      [db({ deleted: false })],
      [cognito({ enabled: false })],
    );
    expect(result).toEqual([
      {
        kind: 'state_mismatch',
        sub: 'sub-1',
        email: 'taro@example.com',
        dbDeleted: false,
        cognitoEnabled: false,
        fixable: false,
      },
    ]);
  });

  it('DB 削除済 × Cognito 無効 は整合（不整合なし）', () => {
    expect(
      classifyDiscrepancies(
        [db({ deleted: true })],
        [cognito({ enabled: false })],
      ),
    ).toEqual([]);
  });

  it('email ずれは email_mismatch（大文字小文字差は無視）', () => {
    const same = classifyDiscrepancies(
      [db({ email: 'Taro@Example.com' })],
      [cognito({ email: 'taro@example.com' })],
    );
    expect(same).toEqual([]);

    const diff = classifyDiscrepancies(
      [db({ email: 'a@example.com' })],
      [cognito({ email: 'b@example.com' })],
    );
    expect(diff).toEqual([
      {
        kind: 'email_mismatch',
        sub: 'sub-1',
        dbEmail: 'a@example.com',
        cognitoEmail: 'b@example.com',
      },
    ]);
  });

  it('状態と email の両方ずれは両カテゴリに計上', () => {
    const result = classifyDiscrepancies(
      [db({ deleted: true, email: 'a@example.com' })],
      [cognito({ enabled: true, email: 'b@example.com' })],
    );
    expect(result).toHaveLength(2);
    expect(result.map((d) => d.kind).sort()).toEqual([
      'email_mismatch',
      'state_mismatch',
    ]);
  });
});
