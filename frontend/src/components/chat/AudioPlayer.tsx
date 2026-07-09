'use client';

import { useEffect, useState } from 'react';
import { useAudioDownloadApi } from '@/lib/api-hooks/use-audios-api';

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
 * 音声のインライン再生（画像版 `ImageThumb` と対称）。`src`（署名付き URL）があれば
 * 直接 `<audio>` に渡し、なければ `useAudioDownloadApi().getDownloadUrl(audioId)` で
 * 都度取得する。取得失敗時は再読込ボタンを出す（`ImageThumb` のふるまいを踏襲）。
 */
export function AudioPlayer({ audioId, src, label }: AudioPlayerProps) {
  const { getDownloadUrl } = useAudioDownloadApi();
  // 呼び出し側が URL を渡した場合は取得 state を持たず直接再生する。
  const [fetchedUrl, setFetchedUrl] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    // src が渡されている場合は取得しない（履歴の downloadUrl 等）。
    if (src) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFetchedUrl(null);
    setLoadError(false);
    getDownloadUrl(audioId)
      .then((res) => {
        if (!cancelled) setFetchedUrl(res.url);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [audioId, src, reloadKey, getDownloadUrl]);

  const url = src ?? fetchedUrl;

  if (loadError) {
    return (
      <div className="flex items-center gap-2 text-xs text-text-tertiary">
        <span>読み込み失敗</span>
        <button
          type="button"
          onClick={() => setReloadKey((k) => k + 1)}
          className="ds-link ds-link--inline"
        >
          再読込
        </button>
      </div>
    );
  }

  if (!url) {
    return <div className="h-8 w-full animate-pulse rounded bg-surface-sunken" />;
  }

  return (
    <audio
      controls
      preload="metadata"
      src={url}
      aria-label={label ?? '添付音声'}
      className="w-full"
      onError={() => setLoadError(true)}
    />
  );
}
