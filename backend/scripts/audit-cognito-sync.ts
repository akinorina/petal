/**
 * DB と Cognito の不整合 検知/修復スクリプト
 *
 * 実行方法（backend/ で実行）:
 *   pnpm audit-cognito-sync            # レポートのみ
 *   pnpm audit-cognito-sync --fix      # 低リスクな不整合を自動修復
 *
 * 修復対象（--fix 時）は「DB 削除済 かつ Cognito 有効」のユーザーを
 * Cognito で無効化（AdminDisableUser）するケースのみ。
 * それ以外（片側のみ存在・email ずれ・DB 有効×Cognito 無効）はレポートのみ。
 */
import 'dotenv/config';
import {
  AdminDisableUserCommand,
  CognitoIdentityProviderClient,
  ListUsersCommand,
  UserType,
} from '@aws-sdk/client-cognito-identity-provider';
import { AppDataSource } from '../database/data-source';
import {
  CognitoUser,
  DbUser,
  Discrepancy,
  classifyDiscrepancies,
} from './cognito-sync-diff';

type CognitoRecord = CognitoUser & { username: string };

async function main(): Promise<void> {
  const fix = process.argv.includes('--fix');
  const userPoolId = requireEnv('COGNITO_USER_POOL_ID');
  const region = requireEnv('COGNITO_REGION');
  const cognito = new CognitoIdentityProviderClient({ region });

  await AppDataSource.initialize();
  try {
    const dbUsers = await fetchDbUsers();
    const cognitoRecords = await fetchCognitoUsers(cognito, userPoolId);
    const discrepancies = classifyDiscrepancies(dbUsers, cognitoRecords);

    printReport(dbUsers, cognitoRecords, discrepancies);

    const fixable = discrepancies.filter(
      (d): d is Extract<Discrepancy, { kind: 'state_mismatch' }> =>
        d.kind === 'state_mismatch' && d.fixable,
    );
    const cognitoBySub = new Map(cognitoRecords.map((c) => [c.sub, c]));

    console.log('');
    if (fixable.length === 0) {
      console.log('修復対象: なし');
    } else if (!fix) {
      console.log(
        `修復対象: ${fixable.length} 件（--fix 未指定のため修復していません）`,
      );
    } else {
      console.log(`修復対象: ${fixable.length} 件を無効化します`);
      for (const d of fixable) {
        const username = cognitoBySub.get(d.sub)?.username;
        if (!username) continue;
        await cognito.send(
          new AdminDisableUserCommand({
            UserPoolId: userPoolId,
            Username: username,
          }),
        );
        console.log(`  無効化しました: ${d.email} (sub: ${d.sub})`);
      }
    }
  } finally {
    await AppDataSource.destroy();
  }
}

async function fetchDbUsers(): Promise<DbUser[]> {
  const rows: Array<{ cognito_sub: string; email: string; deleted: boolean }> =
    await AppDataSource.query(
      `SELECT cognito_sub, email, (deleted_at IS NOT NULL) AS deleted
       FROM "petal"."users"`,
    );
  return rows.map((r) => ({
    cognitoSub: r.cognito_sub,
    email: r.email,
    deleted: r.deleted,
  }));
}

async function fetchCognitoUsers(
  cognito: CognitoIdentityProviderClient,
  userPoolId: string,
): Promise<CognitoRecord[]> {
  const records: CognitoRecord[] = [];
  let paginationToken: string | undefined;

  do {
    const response = await cognito.send(
      new ListUsersCommand({
        UserPoolId: userPoolId,
        Limit: 60,
        PaginationToken: paginationToken,
      }),
    );

    for (const user of response.Users ?? []) {
      const record = toCognitoRecord(user);
      if (record) records.push(record);
    }
    paginationToken = response.PaginationToken;
  } while (paginationToken);

  return records;
}

function toCognitoRecord(user: UserType): CognitoRecord | null {
  const sub = user.Attributes?.find((a) => a.Name === 'sub')?.Value;
  const email = user.Attributes?.find((a) => a.Name === 'email')?.Value;
  if (!sub || !email || !user.Username) {
    console.warn(
      `属性が不足する Cognito ユーザーをスキップしました: ${user.Username ?? '(no username)'}`,
    );
    return null;
  }
  return {
    sub,
    email,
    enabled: user.Enabled ?? false,
    username: user.Username,
  };
}

function printReport(
  dbUsers: DbUser[],
  cognitoUsers: CognitoRecord[],
  discrepancies: Discrepancy[],
): void {
  const deletedCount = dbUsers.filter((u) => u.deleted).length;
  console.log('=== Cognito ↔ DB 整合性監査 ===');
  console.log(
    `DB: ${dbUsers.length} 件（削除済 ${deletedCount} 件） / Cognito: ${cognitoUsers.length} 件`,
  );

  const dbOnly = discrepancies.filter((d) => d.kind === 'db_only');
  const cognitoOnly = discrepancies.filter((d) => d.kind === 'cognito_only');
  const stateMismatch = discrepancies.filter(
    (d) => d.kind === 'state_mismatch',
  );
  const emailMismatch = discrepancies.filter(
    (d) => d.kind === 'email_mismatch',
  );

  console.log('');
  console.log(`[a] DB のみ存在 (Cognito 無し): ${dbOnly.length} 件`);
  for (const d of dbOnly) {
    if (d.kind === 'db_only') console.log(`  - ${d.email} (sub: ${d.sub})`);
  }

  console.log(`[b] Cognito のみ存在 (DB 無し): ${cognitoOnly.length} 件`);
  for (const d of cognitoOnly) {
    if (d.kind === 'cognito_only')
      console.log(`  - ${d.email} (sub: ${d.sub})`);
  }

  console.log(`[c] 状態ミスマッチ: ${stateMismatch.length} 件`);
  for (const d of stateMismatch) {
    if (d.kind !== 'state_mismatch') continue;
    const tag = d.fixable ? '[修復可]' : '[要確認]';
    const state = `DB=${d.dbDeleted ? '削除済' : '有効'} / Cognito=${
      d.cognitoEnabled ? '有効' : '無効'
    }`;
    console.log(`  - ${tag} ${d.email}  ${state}`);
  }

  console.log(`[d] email ミスマッチ: ${emailMismatch.length} 件`);
  for (const d of emailMismatch) {
    if (d.kind !== 'email_mismatch') continue;
    console.log(
      `  - sub ${d.sub}: DB=${d.dbEmail} / Cognito=${d.cognitoEmail}`,
    );
  }
}

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`環境変数 ${key} が設定されていません`);
  return value;
}

main().catch((err) => {
  console.error('エラーが発生しました:', err);
  process.exit(1);
});
