/// <reference lib="esnext" />
/// <reference lib="webworker" />
import { defaultCache } from '@serwist/next/worker';
import type {
  PrecacheEntry,
  RuntimeCaching,
  SerwistGlobalConfig,
} from 'serwist';
import { NetworkOnly, Serwist } from 'serwist';

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    // ビルド時に Serwist が precache 対象（アプリシェル）を注入する。
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

// backend API のオリジン。SW バンドルへビルド時にインライン化される。
// Petal の API は常に別オリジン（API Gateway）。同一オリジンのページルート
// （/images 等）と衝突させないよう、パスではなく「オリジン一致」で判定する。
const apiOrigin = (() => {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!baseUrl) return undefined;
  try {
    return new URL(baseUrl).origin;
  } catch {
    return undefined;
  }
})();

// 認証を伴う API レスポンスは機密かつユーザー依存のためキャッシュ禁止（NetworkOnly）。
// defaultCache より前に登録し、確実に優先させる（Serwist は先勝ちで route を解決する）。
const apiNetworkOnly: RuntimeCaching = {
  matcher({ url }) {
    return apiOrigin !== undefined && url.origin === apiOrigin;
  },
  handler: new NetworkOnly(),
};

const serwist = new Serwist({
  // アプリシェル（_next/static / JS / CSS / フォント）の precache。
  precacheEntries: self.__SW_MANIFEST,
  // 新しい SW を即時適用する（更新承認 UI は後続タスク T2 で被せる）。
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  // API は NetworkOnly、それ以外は Next 向け defaultCache
  // （ページは NetworkFirst、静的画像は CacheFirst 等）。
  runtimeCaching: [apiNetworkOnly, ...defaultCache],
  fallbacks: {
    entries: [
      {
        // オフライン時、未キャッシュのページ遷移はオフライン用ページへフォールバック。
        url: '/~offline',
        matcher({ request }) {
          return request.destination === 'document';
        },
      },
    ],
  },
});

serwist.addEventListeners();
