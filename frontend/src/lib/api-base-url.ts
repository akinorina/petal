// API のベース URL を解決する。
//
// `NEXT_PUBLIC_API_BASE_URL` はビルド時に単一値として埋め込まれるため、
// 開発時に LAN 端末（例: http://192.168.x.x:3001）からアクセスすると
// ブラウザは `localhost:3000` を叩いてしまい疎通しない。
//
// 開発時はブラウザ実行時に `window.location.hostname` を優先採用し、
// 同一ホスト名で API を呼ぶことで複数端末からのアクセスに追従する。
// 本番（NODE_ENV=production）は API Gateway 等の固定ドメインを使うため env をそのまま返す。
export function resolveApiBaseUrl(): string {
  const envUrl =
    process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3000';
  if (process.env.NODE_ENV === 'production' || typeof window === 'undefined') {
    return envUrl;
  }
  try {
    const parsed = new URL(envUrl);
    return `${window.location.protocol}//${window.location.hostname}:${parsed.port || '3000'}`;
  } catch {
    return envUrl;
  }
}
