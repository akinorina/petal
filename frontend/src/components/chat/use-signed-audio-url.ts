'use client';

import { useEffect, useState } from 'react';
import { useAudioDownloadApi } from '@/lib/api-hooks/use-audios-api';

export type SignedAudioUrlState = {
  /** 再生する URL（`src` 指定時はそれ、未指定時は取得結果）。未確定は undefined。 */
  src?: string;
  /** 取得中（URL 未確定 かつ 失敗していない）。 */
  isLoading: boolean;
  /** 取得失敗。 */
  hasError: boolean;
  /** 再取得（「再読込」）。 */
  retry: () => void;
  /** `<audio>` の onError（再生失敗）を受けて失敗状態にする。 */
  onError: () => void;
};

/**
 * 音声の署名付き URL 取得 state を所有するフック（DS `AudioPlayer` の controlled props を供給する）。
 * 画像版 `useSignedImageUrl` と対称。`src` が渡されたら取得をスキップする。
 */
export function useSignedAudioUrl(audioId: string, src?: string): SignedAudioUrlState {
  const { getDownloadUrl } = useAudioDownloadApi();
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

  const url = src ?? fetchedUrl ?? undefined;

  return {
    src: url,
    isLoading: !url && !loadError,
    hasError: loadError,
    retry: () => setReloadKey((k) => k + 1),
    onError: () => setLoadError(true),
  };
}
