/**
 * 初期 Admin ユーザー作成スクリプト
 *
 * 実行方法:
 *   ADMIN_EMAIL=admin@example.com \
 *   ADMIN_PASSWORD=Password123! \
 *   ADMIN_NAME=管理者 \
 *   ADMIN_NAME_KANA=カンリシャ \
 *   pnpm run create-admin
 */
import 'dotenv/config';
import {
  AdminCreateUserCommand,
  AdminSetUserPasswordCommand,
  CognitoIdentityProviderClient,
} from '@aws-sdk/client-cognito-identity-provider';
import { randomUUID } from 'crypto';
import { AppDataSource } from '../database/data-source';

async function main(): Promise<void> {
  const email = requireEnv('ADMIN_EMAIL');
  const password = requireEnv('ADMIN_PASSWORD');
  const name = requireEnv('ADMIN_NAME');
  const nameKana = requireEnv('ADMIN_NAME_KANA');
  const userPoolId = requireEnv('COGNITO_USER_POOL_ID');
  const region = requireEnv('COGNITO_REGION');

  const cognito = new CognitoIdentityProviderClient({ region });

  // 1. Cognito にユーザーを作成
  console.log(`Cognito にユーザーを作成します: ${email}`);
  const createResult = await cognito.send(
    new AdminCreateUserCommand({
      UserPoolId: userPoolId,
      Username: email,
      TemporaryPassword: password,
      MessageAction: 'SUPPRESS', // 招待メールを送らない
      UserAttributes: [
        { Name: 'email', Value: email },
        { Name: 'email_verified', Value: 'true' },
      ],
    }),
  );

  const sub = createResult.User?.Attributes?.find((a) => a.Name === 'sub')?.Value;
  if (!sub) throw new Error('Cognito から sub を取得できませんでした');

  // 2. パスワードを永続化（FORCE_CHANGE_PASSWORD ステータスを解除）
  await cognito.send(
    new AdminSetUserPasswordCommand({
      UserPoolId: userPoolId,
      Username: email,
      Password: password,
      Permanent: true,
    }),
  );
  console.log('Cognito ユーザーを作成しました');

  // 3. PostgreSQL に admin ユーザーを挿入
  console.log('DB に admin ユーザーを登録します');
  await AppDataSource.initialize();

  await AppDataSource.query(
    `INSERT INTO "petal"."users" (id, cognito_sub, email, name, name_kana, role)
     VALUES ($1, $2, $3, $4, $5, 'admin')`,
    [randomUUID(), sub, email, name, nameKana],
  );

  await AppDataSource.destroy();

  console.log('完了: Admin ユーザーを作成しました');
  console.log(`  email:     ${email}`);
  console.log(`  cognito_sub: ${sub}`);
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
