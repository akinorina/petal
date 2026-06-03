/**
 * 初期 Admin ユーザー作成スクリプト（TSK-29 で冪等化）
 *
 * 詳細は docs/65_create-admin-idempotent.md 参照。
 *
 * 実行方法:
 *   ADMIN_EMAIL=admin@example.com \
 *   ADMIN_PASSWORD=Password123! \
 *   ADMIN_NAME=管理者 \
 *   ADMIN_NAME_KANA=カンリシャ \
 *   pnpm run create-admin
 *
 *   # 既存ユーザーのパスワードを env の値で上書きしたいとき:
 *   pnpm run create-admin -- --force-reset-password
 *
 * 何度実行しても安全。各ケースのメッセージは標準出力で可視化する。
 */
import 'dotenv/config';
import {
  AdminCreateUserCommand,
  AdminGetUserCommand,
  AdminSetUserPasswordCommand,
  CognitoIdentityProviderClient,
  UserNotFoundException,
} from '@aws-sdk/client-cognito-identity-provider';
import { randomUUID } from 'crypto';
import { AppDataSource } from '../database/data-source';

type Options = {
  forceResetPassword: boolean;
};

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));

  const email = requireEnv('ADMIN_EMAIL');
  const password = requireEnv('ADMIN_PASSWORD');
  const name = requireEnv('ADMIN_NAME');
  const nameKana = requireEnv('ADMIN_NAME_KANA');
  const userPoolId = requireEnv('COGNITO_USER_POOL_ID');
  const region = requireEnv('COGNITO_REGION');

  const cognito = new CognitoIdentityProviderClient({ region });

  console.log(
    `=== create-admin (email=${email}, force=${options.forceResetPassword}) ===`,
  );

  // 1. Cognito の状態確認
  const cognitoSub = await getOrCreateCognitoUser({
    cognito,
    userPoolId,
    email,
    password,
  });

  // 2. DB の状態確認
  await AppDataSource.initialize();
  try {
    const dbState = await queryDbState(email);

    if (dbState === null) {
      // DB に該当 email がいない → INSERT
      await insertAdmin({ cognitoSub, email, name, nameKana });
      console.log('DB に admin を INSERT しました');
    } else if (dbState.cognitoSub === cognitoSub) {
      // 同 sub の admin が既に居る → スキップ
      if (dbState.role !== 'admin') {
        console.warn(
          `  注意: 既存ユーザーの role は '${dbState.role}' です。本スクリプトでは昇格しません`,
        );
      }
      console.log('DB に同 sub の admin が既に存在します。スキップ');
    } else {
      // 同 email・別 sub の admin が居る異常
      console.error(
        `異常: 同じ email で別 sub の admin が DB に既に存在します（DB sub=${dbState.cognitoSub}, Cognito sub=${cognitoSub}）。手動対応が必要です`,
      );
      process.exitCode = 1;
      return;
    }
  } finally {
    await AppDataSource.destroy();
  }

  // 3. パスワードの永続化（force=true のとき、または新規作成時）
  if (options.forceResetPassword) {
    await setPermanentPassword({ cognito, userPoolId, email, password });
    console.log('Cognito ユーザーのパスワードを上書きしました');
  }

  console.log('完了');
}

// ---- Cognito ----

async function getOrCreateCognitoUser(params: {
  cognito: CognitoIdentityProviderClient;
  userPoolId: string;
  email: string;
  password: string;
}): Promise<string> {
  const existingSub = await tryGetCognitoSub(params);
  if (existingSub) {
    console.log(`Cognito に既存ユーザーがいます（sub=${existingSub}）`);
    return existingSub;
  }

  console.log('Cognito にユーザーを作成します');
  const createResult = await params.cognito.send(
    new AdminCreateUserCommand({
      UserPoolId: params.userPoolId,
      Username: params.email,
      TemporaryPassword: params.password,
      MessageAction: 'SUPPRESS', // 招待メールを送らない
      UserAttributes: [
        { Name: 'email', Value: params.email },
        { Name: 'email_verified', Value: 'true' },
      ],
    }),
  );

  const sub = createResult.User?.Attributes?.find(
    (a) => a.Name === 'sub',
  )?.Value;
  if (!sub) throw new Error('Cognito から sub を取得できませんでした');

  // 新規作成時は常にパスワードを永続化（FORCE_CHANGE_PASSWORD を解除）
  await setPermanentPassword({
    cognito: params.cognito,
    userPoolId: params.userPoolId,
    email: params.email,
    password: params.password,
  });
  console.log(`Cognito ユーザーを作成しました（sub=${sub}）`);
  return sub;
}

async function tryGetCognitoSub(params: {
  cognito: CognitoIdentityProviderClient;
  userPoolId: string;
  email: string;
}): Promise<string | null> {
  try {
    const result = await params.cognito.send(
      new AdminGetUserCommand({
        UserPoolId: params.userPoolId,
        Username: params.email,
      }),
    );
    const sub = result.UserAttributes?.find((a) => a.Name === 'sub')?.Value;
    return sub ?? null;
  } catch (err) {
    if (err instanceof UserNotFoundException) return null;
    throw err;
  }
}

async function setPermanentPassword(params: {
  cognito: CognitoIdentityProviderClient;
  userPoolId: string;
  email: string;
  password: string;
}): Promise<void> {
  await params.cognito.send(
    new AdminSetUserPasswordCommand({
      UserPoolId: params.userPoolId,
      Username: params.email,
      Password: params.password,
      Permanent: true,
    }),
  );
}

// ---- DB ----

type DbAdminState = {
  cognitoSub: string;
  role: string;
};

async function queryDbState(email: string): Promise<DbAdminState | null> {
  const rows: Array<{ cognito_sub: string; role: string }> =
    await AppDataSource.query(
      `SELECT cognito_sub, role FROM "petal"."users" WHERE email = $1 AND deleted_at IS NULL`,
      [email],
    );
  const row = rows[0];
  if (!row) return null;
  return { cognitoSub: row.cognito_sub, role: row.role };
}

async function insertAdmin(params: {
  cognitoSub: string;
  email: string;
  name: string;
  nameKana: string;
}): Promise<void> {
  await AppDataSource.query(
    `INSERT INTO "petal"."users" (id, cognito_sub, email, name, name_kana, role)
     VALUES ($1, $2, $3, $4, $5, 'admin')
     ON CONFLICT (cognito_sub) DO NOTHING`,
    [
      randomUUID(),
      params.cognitoSub,
      params.email,
      params.name,
      params.nameKana,
    ],
  );
}

// ---- ヘルパ ----

function parseArgs(argv: string[]): Options {
  let forceResetPassword = false;
  for (const a of argv) {
    if (a === '--') {
      // pnpm が `pnpm <script> -- <args>` 形式で渡してくる区切り。読み飛ばす。
      continue;
    } else if (a === '--force-reset-password') {
      forceResetPassword = true;
    } else if (a === '-h' || a === '--help') {
      console.log(
        `使用方法:
  ADMIN_EMAIL=... ADMIN_PASSWORD=... ADMIN_NAME=... ADMIN_NAME_KANA=... \\
  COGNITO_USER_POOL_ID=... COGNITO_REGION=... \\
  pnpm create-admin [-- --force-reset-password]`,
      );
      process.exit(0);
    } else {
      throw new Error(`未知の引数: ${a}`);
    }
  }
  return { forceResetPassword };
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
