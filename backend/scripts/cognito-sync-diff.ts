/**
 * DB と Cognito の不整合を分類する純粋ロジック（I/O を持たない）。
 * スクリプト本体（backend/scripts/audit-cognito-sync.ts）から呼ばれる。
 */

export type DbUser = {
  cognitoSub: string;
  email: string;
  deleted: boolean;
};

export type CognitoUser = {
  sub: string;
  email: string;
  enabled: boolean;
};

export type Discrepancy =
  | { kind: 'db_only'; sub: string; email: string }
  | { kind: 'cognito_only'; sub: string; email: string }
  | {
      kind: 'state_mismatch';
      sub: string;
      email: string;
      dbDeleted: boolean;
      cognitoEnabled: boolean;
      fixable: boolean;
    }
  | {
      kind: 'email_mismatch';
      sub: string;
      dbEmail: string;
      cognitoEmail: string;
    };

/**
 * DB ユーザーと Cognito ユーザーを sub で突き合わせ、不整合を分類して返す。
 * 状態ミスマッチと email ミスマッチが同時に起きている場合は両方を計上する。
 */
export function classifyDiscrepancies(
  dbUsers: DbUser[],
  cognitoUsers: CognitoUser[],
): Discrepancy[] {
  const dbBySub = new Map(dbUsers.map((u) => [u.cognitoSub, u]));
  const cognitoBySub = new Map(cognitoUsers.map((u) => [u.sub, u]));
  const result: Discrepancy[] = [];

  for (const db of dbUsers) {
    if (!cognitoBySub.has(db.cognitoSub)) {
      result.push({ kind: 'db_only', sub: db.cognitoSub, email: db.email });
    }
  }

  for (const cognito of cognitoUsers) {
    if (!dbBySub.has(cognito.sub)) {
      result.push({
        kind: 'cognito_only',
        sub: cognito.sub,
        email: cognito.email,
      });
    }
  }

  for (const db of dbUsers) {
    const cognito = cognitoBySub.get(db.cognitoSub);
    if (!cognito) continue;

    // 状態ミスマッチ:
    //  - DB 削除済 かつ Cognito 有効 → 修復可（無効化対象）
    //  - DB 有効   かつ Cognito 無効 → 要確認（自動修復しない）
    if (db.deleted && cognito.enabled) {
      result.push({
        kind: 'state_mismatch',
        sub: db.cognitoSub,
        email: db.email,
        dbDeleted: true,
        cognitoEnabled: true,
        fixable: true,
      });
    } else if (!db.deleted && !cognito.enabled) {
      result.push({
        kind: 'state_mismatch',
        sub: db.cognitoSub,
        email: db.email,
        dbDeleted: false,
        cognitoEnabled: false,
        fixable: false,
      });
    }

    if (db.email.toLowerCase() !== cognito.email.toLowerCase()) {
      result.push({
        kind: 'email_mismatch',
        sub: db.cognitoSub,
        dbEmail: db.email,
        cognitoEmail: cognito.email,
      });
    }
  }

  return result;
}
