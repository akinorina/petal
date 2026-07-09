import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import './MediaThumb.css';

export interface MediaThumbProps extends HTMLAttributes<HTMLDivElement> {
  /** 表示する画像 URL。未確定（取得中）は undefined。 */
  src?: string;
  /** `<img>` の alt テキスト。 */
  alt: string;
  /** src 未確定（取得中）。true の間は読込プレースホルダーを表示する。 */
  isLoading?: boolean;
  /** 取得/デコード失敗。true のとき失敗ボックス（再読込）を表示する。 */
  hasError?: boolean;
  /** 「再読込」押下時のハンドラ。 */
  onRetry?: () => void;
  /** `<img>` の onError（デコード失敗）を親へ通知する。 */
  onError?: () => void;
  /** `<img>` に付与するクラス（既定は h-full w-full object-cover 相当）。 */
  imgClassName?: string;
}

/**
 * 非同期メディア（署名 URL 画像など）の純表示 shell。
 * 取得ロジックは持たず、`src` / `isLoading` / `hasError` を親から受けて
 * 「読込中プレースホルダー / 失敗+再読込 / 画像表示」を切り替える controlled 部品。
 */
export const MediaThumb = forwardRef<HTMLDivElement, MediaThumbProps>(function MediaThumb(
  { src, alt, isLoading = false, hasError = false, onRetry, onError, imgClassName, className, ...rest },
  ref,
) {
  const rootClass = ['ds-media-thumb', className].filter(Boolean).join(' ');

  if (hasError) {
    return (
      <div ref={ref} className={[rootClass, 'ds-media-thumb--error'].join(' ')} {...rest}>
        <span className="ds-media-thumb__error-label">読み込み失敗</span>
        <button
          type="button"
          className="ds-media-thumb__retry"
          onClick={(e) => {
            e.preventDefault();
            onRetry?.();
          }}
        >
          再読込
        </button>
      </div>
    );
  }

  if (!src || isLoading) {
    return <div ref={ref} className={[rootClass, 'ds-media-thumb--loading'].join(' ')} {...rest} />;
  }

  return (
    <div ref={ref} className={rootClass} {...rest}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        className={imgClassName ?? 'ds-media-thumb__img'}
        onError={onError}
      />
    </div>
  );
});
