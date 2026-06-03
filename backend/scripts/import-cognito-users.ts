/**
 * 管理者用 Cognito ↔ DB 同期スクリプト（TSK-26）
 *
 * 詳細は docs/64_cognito-sync-import.md 参照。
 *
 * 実行例（backend/ で実行）:
 *   # Cognito → DB（特定ユーザーを取り込む）
 *   pnpm import-cognito-users --mode cognito-to-db --email alice@example.com \
 *     --name "アリス" --name-kana "ありす" --role user
 *
 *   # Cognito → DB（DB に無い全ユーザーを暫定値で取り込む）
 *   pnpm import-cognito-users --mode cognito-to-db --all --dry-run
 *
 *   # DB → Cognito（DB のみのユーザーを Cognito に作成）
 *   pnpm import-cognito-users --mode db-to-cognito --email bob@example.com
 *
 * 差分検出は scripts/cognito-sync-diff.ts の classifyDiscrepancies を再利用する。
 */
import 'dotenv/config';
import {
  AdminCreateUserCommand,
  CognitoIdentityProviderClient,
  ListUsersCommand,
  UserType,
} from '@aws-sdk/client-cognito-identity-provider';
import { randomUUID } from 'crypto';
import { AppDataSource } from '../database/data-source';
import {
  CognitoUser,
  DbUser,
  classifyDiscrepancies,
} from './cognito-sync-diff';

type Mode = 'cognito-to-db' | 'db-to-cognito';

type CognitoRecord = CognitoUser & { username: string };

type Options = {
  mode: Mode;
  email: string | null;
  all: boolean;
  dryRun: boolean;
  name: string | null;
  nameKana: string | null;
  role: 'admin' | 'user' | null;
};

const USAGE = `使用方法:
  pnpm import-cognito-users --mode cognito-to-db [--email X | --all] \\
      [--name "氏名"] [--name-kana "ふりがな"] [--role admin|user] [--dry-run]

  pnpm import-cognito-users --mode db-to-cognito [--email X | --all] [--dry-run]
`;

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));

  const userPoolId = requireEnv('COGNITO_USER_POOL_ID');
  const region = requireEnv('COGNITO_REGION');
  const cognito = new CognitoIdentityProviderClient({ region });

  await AppDataSource.initialize();
  try {
    const dbUsers = await fetchDbUsers();
    const cognitoRecords = await fetchCognitoUsers(cognito, userPoolId);

    console.log(
      `=== Cognito ↔ DB 同期スクリプト (mode=${options.mode}, dry-run=${options.dryRun}) ===`,
    );
    console.log(
      `DB: ${dbUsers.length} 件 / Cognito: ${cognitoRecords.length} 件`,
    );

    if (options.mode === 'cognito-to-db') {
      await runCognitoToDb(options, dbUsers, cognitoRecords);
    } else {
      await runDbToCognito(
        options,
        dbUsers,
        cognitoRecords,
        cognito,
        userPoolId,
      );
    }
  } finally {
    await AppDataSource.destroy();
  }
}

// ---- モード A: Cognito → DB ----

async function runCognitoToDb(
  options: Options,
  dbUsers: DbUser[],
  cognitoRecords: CognitoRecord[],
): Promise<void> {
  const discrepancies = classifyDiscrepancies(dbUsers, cognitoRecords);
  const cognitoOnly = discrepancies.flatMap((d) =>
    d.kind === 'cognito_only' ? [d] : [],
  );
  const cognitoBySub = new Map(cognitoRecords.map((c) => [c.sub, c]));

  const targets = filterTargets(
    cognitoOnly.map((d) => ({ sub: d.sub, email: d.email })),
    options,
  );

  if (targets.length === 0) {
    console.log('対象: 0 件（取り込み可能な Cognito ユーザーがいません）');
    return;
  }
  console.log(`対象: ${targets.length} 件`);

  let success = 0;
  let skip = 0;
  let failed = 0;

  for (const target of targets) {
    const cognito = cognitoBySub.get(target.sub);
    if (!cognito) {
      console.log(
        `  - sub=${target.sub} email=${target.email}  → skip (Cognito 取得に失敗)`,
      );
      skip += 1;
      continue;
    }

    const { name, nameKana, role } = resolveAttributes(options, target.email);
    if (options.dryRun) {
      console.log(
        `  - sub=${target.sub} email=${target.email}  → [dry-run] would INSERT (name=${name}, nameKana=${nameKana}, role=${role})`,
      );
      success += 1;
      continue;
    }

    try {
      const id = await insertUser({
        cognitoSub: target.sub,
        email: target.email,
        name,
        nameKana,
        role,
      });
      console.log(
        `  - sub=${target.sub} email=${target.email}  → INSERT 成功 (id=${id})`,
      );
      success += 1;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.log(
        `  - sub=${target.sub} email=${target.email}  → 失敗: ${message}`,
      );
      failed += 1;
    }
  }

  console.log(
    `完了: 成功 ${success} 件 / スキップ ${skip} 件 / 失敗 ${failed} 件`,
  );
  if (failed > 0) process.exitCode = 1;
}

// ---- モード B: DB → Cognito ----

async function runDbToCognito(
  options: Options,
  dbUsers: DbUser[],
  cognitoRecords: CognitoRecord[],
  cognito: CognitoIdentityProviderClient,
  userPoolId: string,
): Promise<void> {
  const discrepancies = classifyDiscrepancies(dbUsers, cognitoRecords);
  const dbOnly = discrepancies.flatMap((d) =>
    d.kind === 'db_only' ? [d] : [],
  );

  const targets = filterTargets(
    dbOnly.map((d) => ({ sub: d.sub, email: d.email })),
    options,
  );

  if (targets.length === 0) {
    console.log('対象: 0 件（Cognito に作成すべき DB ユーザーがいません）');
    return;
  }
  console.log(`対象: ${targets.length} 件`);

  let success = 0;
  let failed = 0;

  for (const target of targets) {
    if (options.dryRun) {
      console.log(
        `  - sub=${target.sub} email=${target.email}  → [dry-run] would AdminCreateUser (MessageAction=SUPPRESS)`,
      );
      success += 1;
      continue;
    }

    try {
      const newSub = await createCognitoAndUpdateDb({
        cognito,
        userPoolId,
        email: target.email,
        oldSub: target.sub,
      });
      console.log(
        `  - sub=${target.sub} email=${target.email}  → Cognito 作成 + DB 更新成功 (新 sub=${newSub})`,
      );
      success += 1;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.log(
        `  - sub=${target.sub} email=${target.email}  → 失敗: ${message}`,
      );
      failed += 1;
    }
  }

  console.log(`完了: 成功 ${success} 件 / 失敗 ${failed} 件`);
  if (failed > 0) process.exitCode = 1;
}

// ---- DB / Cognito 操作 ----

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

async function insertUser(params: {
  cognitoSub: string;
  email: string;
  name: string;
  nameKana: string;
  role: 'admin' | 'user';
}): Promise<string> {
  const id = randomUUID();
  await AppDataSource.query(
    `INSERT INTO "petal"."users"
       (id, cognito_sub, email, name, name_kana, role)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (cognito_sub) DO NOTHING`,
    [
      id,
      params.cognitoSub,
      params.email,
      params.name,
      params.nameKana,
      params.role,
    ],
  );
  return id;
}

async function createCognitoAndUpdateDb(params: {
  cognito: CognitoIdentityProviderClient;
  userPoolId: string;
  email: string;
  oldSub: string;
}): Promise<string> {
  const response = await params.cognito.send(
    new AdminCreateUserCommand({
      UserPoolId: params.userPoolId,
      Username: params.email,
      MessageAction: 'SUPPRESS',
      UserAttributes: [
        { Name: 'email', Value: params.email },
        { Name: 'email_verified', Value: 'true' },
      ],
    }),
  );

  const newSub = response.User?.Attributes?.find(
    (a) => a.Name === 'sub',
  )?.Value;
  if (!newSub) {
    throw new Error('Cognito から新しい sub を取得できませんでした');
  }

  try {
    await AppDataSource.query(
      `UPDATE "petal"."users" SET cognito_sub = $1 WHERE cognito_sub = $2`,
      [newSub, params.oldSub],
    );
  } catch (err) {
    console.warn(
      `WARNING: Cognito 作成は成功しましたが DB UPDATE に失敗しました。手動で対応してください。\n  email=${params.email} 旧sub=${params.oldSub} 新sub=${newSub}\n  原因: ${err instanceof Error ? err.message : String(err)}`,
    );
    throw err;
  }

  return newSub;
}

// ---- ヘルパ ----

type Target = { sub: string; email: string };

function filterTargets(candidates: Target[], options: Options): Target[] {
  if (options.email) {
    return candidates.filter((c) => c.email === options.email);
  }
  return candidates;
}

function resolveAttributes(
  options: Options,
  email: string,
): { name: string; nameKana: string; role: 'admin' | 'user' } {
  // --email 指定時は引数 or email 流用、--all 時も email 流用（暫定値）。
  // DB の name/name_kana は length 100 のため、長すぎる email は (unset) に倒す。
  const safeFallback = email.length <= 100 ? email : '(unset)';
  return {
    name: options.name ?? safeFallback,
    nameKana: options.nameKana ?? safeFallback,
    role: options.role ?? 'user',
  };
}

function parseArgs(argv: string[]): Options {
  let mode: Mode | null = null;
  let email: string | null = null;
  let all = false;
  let dryRun = false;
  let name: string | null = null;
  let nameKana: string | null = null;
  let role: 'admin' | 'user' | null = null;

  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    const next = (): string => {
      const v = argv[i + 1];
      if (v === undefined) {
        throw new Error(`${a} の値が指定されていません`);
      }
      i += 1;
      return v;
    };
    switch (a) {
      case '--mode': {
        const v = next();
        if (v !== 'cognito-to-db' && v !== 'db-to-cognito') {
          throw new Error(
            `--mode は cognito-to-db か db-to-cognito を指定してください (受信: ${v})`,
          );
        }
        mode = v;
        break;
      }
      case '--email':
        email = next();
        break;
      case '--all':
        all = true;
        break;
      case '--dry-run':
        dryRun = true;
        break;
      case '--name':
        name = next();
        break;
      case '--name-kana':
        nameKana = next();
        break;
      case '--role': {
        const v = next();
        if (v !== 'admin' && v !== 'user') {
          throw new Error(
            `--role は admin か user を指定してください (受信: ${v})`,
          );
        }
        role = v;
        break;
      }
      case '-h':
      case '--help':
        console.log(USAGE);
        process.exit(0);
        break;
      default:
        throw new Error(`未知の引数: ${a}\n\n${USAGE}`);
    }
  }

  if (!mode) {
    throw new Error(`--mode は必須です\n\n${USAGE}`);
  }
  if (!email && !all) {
    throw new Error(`--email または --all のどちらかが必須です\n\n${USAGE}`);
  }
  if (email && all) {
    throw new Error(`--email と --all は同時に指定できません\n\n${USAGE}`);
  }
  if (mode === 'db-to-cognito' && (name || nameKana || role)) {
    throw new Error(
      `--name / --name-kana / --role は --mode cognito-to-db でのみ有効です`,
    );
  }
  if (mode === 'cognito-to-db' && all && (name || nameKana || role)) {
    throw new Error(
      `--name / --name-kana / --role は --email 指定時のみ有効です（--all では暫定値が使われます）`,
    );
  }

  return { mode, email, all, dryRun, name, nameKana, role };
}

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`環境変数 ${key} が設定されていません`);
  return value;
}

main().catch((err) => {
  console.error(
    'エラーが発生しました:',
    err instanceof Error ? err.message : err,
  );
  process.exit(1);
});
