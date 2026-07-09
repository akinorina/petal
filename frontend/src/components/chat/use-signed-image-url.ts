'use client';

import { useEffect, useState } from 'react';
import { useImageDownloadApi } from '@/lib/api-hooks/use-images-api';

export type SignedImageUrlState = {
  /** 表示する URL（`src` 指定時はそれ、未指定時は取得結果）。未確定は undefined。 */
  src?: string;
  /** 取得中（URL 未確定 かつ 失敗していない）。 */
  isLoading: boolean;
  /** 取得/デコード失敗。 */
  hasError: boolean;
  /** 再取得（「再読込」）。 */
  retry: () => void;
  /** `<img>` の onError（デコード失敗）を受けて失敗状態にする。 */
  onError: () => void;
};

/**
 * 画像の署名付き URL 取得 state を所有するフック（DS `MediaThumb` の controlled props を供給する）。
 * `src`（呼び出し側が既に URL を持つ場合）が渡されたら取得をスキップする。
 * 取得・loadError・再読込のふるまいは旧 `ImageThumb` から等価に移送。
 */
export function useSignedImageUrl(imageId: string, src?: string): SignedImageUrlState {
  const { getDownloadUrl } = useImageDownloadApi();
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
    getDownloadUrl(imageId)
      .then((res) => {
        if (!cancelled) setFetchedUrl(res.url);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [imageId, src, reloadKey, getDownloadUrl]);

  const url = src ?? fetchedUrl ?? undefined;

  return {
    src: url,
    isLoading: !url && !loadError,
    hasError: loadError,
    retry: () => setReloadKey((k) => k + 1),
    onError: () => setLoadError(true),
  };
}
