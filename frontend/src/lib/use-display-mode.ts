'use client';

import { useEffect, useState } from 'react';

export type DisplayMode = 'standalone' | 'browser';

export function detectDisplayMode(): DisplayMode {
  if (typeof window === 'undefined') return 'browser';
  if (window.matchMedia?.('(display-mode: standalone)').matches) {
    return 'standalone';
  }
  const nav = navigator as Navigator & { standalone?: boolean };
  if (nav.standalone === true) return 'standalone';
  return 'browser';
}

/**
 * 現在のアプリ起動モードを返す。SSR では `'browser'` を初期値とし、effect 内で
 * 実値に更新する。PWA の起動モードはセッション中に切り替わらない前提のため、
 * `matchMedia` の change イベント監視は行わない。
 */
export function useDisplayMode(): DisplayMode {
  const [mode, setMode] = useState<DisplayMode>('browser');

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMode(detectDisplayMode());
  }, []);

  return mode;
}
