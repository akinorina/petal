'use client';

import { useEffect, useState } from 'react';
import { useSerwist } from '@serwist/next/react';
import { Button } from '@/design-system/components/Button';

/**
 * 新しい Service Worker が `waiting` 状態になったときに、画面下部にバナーを表示し
 * ユーザーに再読み込みを促す。承認したら `controlling` イベントを待ってから
 * `location.reload()` し、確実に新リソースで再描画させる。
 *
 * dev 環境では `SerwistProvider` が `disable` のため `serwist === null` となり、
 * 本コンポーネントは何も描画しない。
 */
export function UpdateNotice() {
  const { serwist } = useSerwist();
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [reloading, setReloading] = useState(false);

  useEffect(() => {
    if (!serwist) return;
    const onWaiting = () => {
      // 新たな waiting が来たら、前回「あとで」で抑制していても再表示する。
      setDismissed(false);
      setUpdateAvailable(true);
    };
    serwist.addEventListener('waiting', onWaiting);
    // SerwistEventTarget は本アプリ生存期間で 1 度しか購読しない singleton 利用のため、
    // cleanup は不要（SerwistProvider 配下に常駐する）。
  }, [serwist]);

  if (!updateAvailable || dismissed || !serwist) return null;

  const handleReload = () => {
    if (reloading) return;
    setReloading(true);
    // 新 SW が controlling になってからリロードする。直後にリロードすると旧 SW の
    // キャッシュから応答される恐れがあるため、必ず controlling を待つ。
    serwist.addEventListener('controlling', () => {
      window.location.reload();
    });
    serwist.messageSkipWaiting();
  };

  const handleDismiss = () => {
    setDismissed(true);
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 bottom-0 z-50 px-4 pb-4 sm:flex sm:justify-center"
    >
      <div className="flex flex-col gap-3 rounded-lg border border-border-subtle bg-surface-raised px-4 py-3 shadow-lg sm:flex-row sm:items-center sm:gap-4">
        <p className="text-sm text-text-primary">
          新しいバージョンがあります。再読み込みしますか？
        </p>
        <div className="flex items-center gap-2 sm:ml-auto">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDismiss}
            disabled={reloading}
          >
            あとで
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleReload}
            disabled={reloading}
          >
            {reloading ? '更新中...' : '再読み込み'}
          </Button>
        </div>
      </div>
    </div>
  );
}
