'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/design-system/components/Button';
import { Dialog } from '@/design-system/components/Dialog';

const STORAGE_DISMISSED_AT = 'petal:install:dismissedAt';
const STORAGE_INSTALLED = 'petal:install:installed';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

const isSuppressed = (): boolean => {
  try {
    return (
      localStorage.getItem(STORAGE_DISMISSED_AT) !== null ||
      localStorage.getItem(STORAGE_INSTALLED) !== null
    );
  } catch {
    return false;
  }
};

const setDismissed = () => {
  try {
    localStorage.setItem(STORAGE_DISMISSED_AT, new Date().toISOString());
  } catch {
    // localStorage が使えない環境（プライベートブラウズ等）は次回も表示で許容
  }
};

const setInstalled = () => {
  try {
    localStorage.setItem(STORAGE_INSTALLED, '1');
  } catch {
    // 同上
  }
};

const isStandalone = (): boolean => {
  if (typeof window === 'undefined') return false;
  if (window.matchMedia?.('(display-mode: standalone)').matches) return true;
  const nav = navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true;
};

const isIosDevice = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return true;
  // iPadOS 13+ は UA に Macintosh と出る。タッチ対応で判別する。
  return /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
};

/**
 * PWA インストール導線。
 * - Android / Desktop Chrome: `beforeinstallprompt` を捕捉してネイティブダイアログを起動。
 * - iOS Safari: 共有 → ホーム画面に追加の手順をモーダルで案内。
 * - 「あとで」/ `appinstalled` は localStorage に保存し、以降は表示しない。
 * - スタンドアロン起動中（インストール済み）は無条件に非表示。
 */
export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [showIosBanner, setShowIosBanner] = useState(false);
  const [iosDialogOpen, setIosDialogOpen] = useState(false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (isStandalone() || isSuppressed()) return;

    if (isIosDevice()) {
      // iOS 判定はブラウザ API（navigator）依存のため、SSR を避けて effect 内で
      // 一度だけ state を確定させる。cascading render は初回マウント時のみ。
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShowIosBanner(true);
    }

    const onBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    const onAppInstalled = () => {
      setInstalled();
      setDeferredPrompt(null);
      setShowIosBanner(false);
      setHidden(true);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onAppInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onAppInstalled);
    };
  }, []);

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'dismissed') {
      setDismissed();
    }
    // accepted の場合は appinstalled イベントで installed を保存する。
    setDeferredPrompt(null);
    setHidden(true);
  }, [deferredPrompt]);

  const handleDismiss = useCallback(() => {
    setDismissed();
    setDeferredPrompt(null);
    setShowIosBanner(false);
    setHidden(true);
  }, []);

  const handleIosNeverShow = useCallback(() => {
    setDismissed();
    setIosDialogOpen(false);
    setShowIosBanner(false);
    setHidden(true);
  }, []);

  if (hidden) return null;

  const showAndroidBanner = deferredPrompt !== null;
  if (!showAndroidBanner && !showIosBanner) return null;

  return (
    <>
      <div
        role="status"
        aria-live="polite"
        className="fixed inset-x-0 bottom-0 z-40 px-4 pb-4 sm:flex sm:justify-center"
      >
        <div className="flex flex-col gap-3 rounded-lg border border-border-subtle bg-surface-raised px-4 py-3 shadow-lg sm:flex-row sm:items-center sm:gap-4">
          <p className="text-sm text-text-primary">
            Petal をホーム画面に追加すると、より快適に使えます。
          </p>
          <div className="flex items-center gap-2 sm:ml-auto">
            <Button variant="ghost" size="sm" onClick={handleDismiss}>
              あとで
            </Button>
            {showAndroidBanner ? (
              <Button variant="primary" size="sm" onClick={handleInstall}>
                ホーム画面に追加
              </Button>
            ) : (
              <Button
                variant="primary"
                size="sm"
                onClick={() => setIosDialogOpen(true)}
              >
                インストール方法を見る
              </Button>
            )}
          </div>
        </div>
      </div>

      <Dialog open={iosDialogOpen} onOpenChange={setIosDialogOpen} size="sm">
        <Dialog.Content>
          <Dialog.Header>
            <Dialog.Title>ホーム画面に追加する</Dialog.Title>
          </Dialog.Header>
          <Dialog.Body>
            <ol className="ml-5 list-decimal space-y-2 text-sm text-text-primary">
              <li>
                Safari 下部の <strong>共有</strong> ボタン（
                <span aria-label="共有アイコン" role="img">
                  □↑
                </span>
                ）をタップします。
              </li>
              <li>
                メニューをスクロールし、
                <strong>「ホーム画面に追加」</strong> を選択します。
              </li>
              <li>
                右上の <strong>「追加」</strong> をタップすると、ホーム画面に
                Petal のアイコンが追加されます。
              </li>
            </ol>
          </Dialog.Body>
          <Dialog.Footer>
            <Button variant="ghost" size="sm" onClick={handleIosNeverShow}>
              今後表示しない
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIosDialogOpen(false)}
            >
              閉じる
            </Button>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog>
    </>
  );
}
