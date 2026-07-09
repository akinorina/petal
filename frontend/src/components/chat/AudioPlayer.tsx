'use client';

import { AudioPlayer as DsAudioPlayer } from '@/design-system/components/AudioPlayer';
import { useSignedAudioUrl } from './use-signed-audio-url';

type AudioPlayerProps = {
  /** 再生する音声 id。`src` 未指定時にこの id から署名付き URL を取得する。 */
  audioId: string;
  /**
   * 署名付き URL を呼び出し側が既に持っている場合に直接渡す（履歴の `downloadUrl` 等）。
   * 指定時は取得をスキップする。
   */
  src?: string;
  /** `<audio>` の aria-label（ファイル名等）。 */
  label?: string;
};

/**
 * 音声のインライン再生（画像版 `ImageThumb` と対称）。署名付き URL の取得 state は
 * `useSignedAudioUrl` が所有し、読込中・失敗・再読込・再生の見た目は DS `AudioPlayer`
 * （controlled 純表示・別名 import）が担う薄いアダプタ。`src` があれば取得をスキップする。
 */
export function AudioPlayer({ audioId, src, label }: AudioPlayerProps) {
  const state = useSignedAudioUrl(audioId, src);
  return (
    <DsAudioPlayer
      src={state.src}
      label={label}
      isLoading={state.isLoading}
      hasError={state.hasError}
      onRetry={state.retry}
      onError={state.onError}
    />
  );
}
