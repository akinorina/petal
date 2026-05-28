'use client';

import { useEffect, useRef } from 'react';
import { trackEvent } from '@/lib/analytics';
import { detectDisplayMode } from '@/lib/use-display-mode';

/**
 * アプリ初回マウント時に 1 回だけ `app_launch` イベントを発火する。SPA の
 * クライアント遷移では再発火しない（ページビュー計測は別概念のため別途設計する）。
 */
export function useStandaloneLaunchTracking(): void {
  const firedRef = useRef(false);

  useEffect(() => {
    if (firedRef.current) return;
    firedRef.current = true;
    trackEvent('app_launch', { displayMode: detectDisplayMode() });
  }, []);
}
