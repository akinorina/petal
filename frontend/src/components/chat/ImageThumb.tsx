'use client';

import { MediaThumb } from '@/design-system/components/MediaThumb';
import { useSignedImageUrl } from './use-signed-image-url';

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
 * ライブラリ画像のサムネイル。署名付き URL の取得 state は `useSignedImageUrl` が所有し、
 * 読込中・失敗・再読込・表示の見た目は DS `MediaThumb`（controlled 純表示）が担う薄いアダプタ。
 * `src`（署名付き URL）があれば取得をスキップして直接表示する。
 */
export function ImageThumb({ imageId, alt, src, className }: ImageThumbProps) {
  const state = useSignedImageUrl(imageId, src);
  return (
    <MediaThumb
      src={state.src}
      alt={alt}
      isLoading={state.isLoading}
      hasError={state.hasError}
      onRetry={state.retry}
      onError={state.onError}
      imgClassName={className}
    />
  );
}
