'use client';

import { useStandaloneLaunchTracking } from '@/lib/use-standalone-launch-tracking';

/**
 * アプリ起動時にスタンドアロン / ブラウザ起動を計測するための薄いマウント先。
 * UI は描画しない。
 */
export function StandaloneLaunchTracker() {
  useStandaloneLaunchTracking();
  return null;
}
