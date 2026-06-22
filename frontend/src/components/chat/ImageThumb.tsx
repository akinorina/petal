'use client';

import { useEffect, useState } from 'react';
import { useImageDownloadApi } from '@/lib/api-hooks/use-images-api';

type ImageThumbProps = {
  /** 表示する画像 id。`src` 未指定時にこの id から署名付き URL を取得する。 */
  imageId: string;
  /** alt テキスト（ファイル名等）。 */
  alt: string;
  /**
   * 署名付き URL を呼び出し側が既に持っている場合に直接渡す（履歴の `downloadUrl` 等）。
   * 指定時は取得をスキップする。
   */
  src?: string;
  className?: string;
};

/**
 * ライブラリ画像のサムネイル。`src`（署名付き URL）があれば直接表示し、
 * なければ `useImageDownloadApi().getDownloadUrl(imageId)` で都度取得する。
 * 取得・loadError・再読込のふるまいは `images/page.tsx` のサムネイル実装を踏襲する。
 */
export function ImageThumb({ imageId, alt, src, className }: ImageThumbProps) {
  const { getDownloadUrl } = useImageDownloadApi();
  // 呼び出し側が URL を渡した場合は取得 state を持たず直接表示する。
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

  const url = src ?? fetchedUrl;

  if (loadError) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-zinc-100 text-[10px] text-zinc-500">
        <span>読み込み失敗</span>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            setReloadKey((k) => k + 1);
          }}
          className="ds-link ds-link--inline"
        >
          再読込
        </button>
      </div>
    );
  }

  if (!url) {
    return <div className="h-full w-full animate-pulse bg-zinc-200" />;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={alt}
      className={className ?? 'h-full w-full object-cover'}
      onError={() => setLoadError(true)}
    />
  );
}
