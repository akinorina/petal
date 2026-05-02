import {
  AuthenticationDetails,
  CognitoUser,
  CognitoUserPool,
  CognitoUserSession,
} from 'amazon-cognito-identity-js';

// ビルド時の SSR では環境変数が未設定のため、初回呼び出し時に初期化する
let _pool: CognitoUserPool | null = null;

function getPool(): CognitoUserPool {
  if (!_pool) {
    _pool = new CognitoUserPool({
      UserPoolId: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID!,
      ClientId: process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID!,
    });
  }
  return _pool;
}

export function login(
  email: string,
  password: string,
): Promise<CognitoUserSession> {
  return new Promise((resolve, reject) => {
    const user = new CognitoUser({ Username: email, Pool: getPool() });
    const authDetails = new AuthenticationDetails({
      Username: email,
      Password: password,
    });

    user.authenticateUser(authDetails, {
      onSuccess: resolve,
      onFailure: reject,
    });
  });
}

export function logout(): void {
  getPool().getCurrentUser()?.signOut();
}

export function getAccessToken(): Promise<string | null> {
  return new Promise((resolve) => {
    const user = getPool().getCurrentUser();
    if (!user) return resolve(null);

    user.getSession((err: Error | null, session: CognitoUserSession | null) => {
      if (err || !session?.isValid()) return resolve(null);
      resolve(session.getAccessToken().getJwtToken());
    });
  });
}

export function getCurrentUserEmail(): string | null {
  return getPool().getCurrentUser()?.getUsername() ?? null;
}
