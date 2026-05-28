import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'オフライン - Petal',
};

// Service Worker のフォールバック先。オフライン時に未キャッシュのページへ
// 遷移した際に表示される（src/app/sw.ts の fallbacks 参照）。
export default function OfflinePage() {
  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-3 px-4 text-center">
      <h1 className="text-lg font-semibold text-text-primary">
        オフラインです
      </h1>
      <p className="text-sm text-text-tertiary">
        インターネット接続がありません。接続を確認してから再度お試しください。
        <br />
        一度表示したページはオフラインでも閲覧できます。
      </p>
    </div>
  );
}
