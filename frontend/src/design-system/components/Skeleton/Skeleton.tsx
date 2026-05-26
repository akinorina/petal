import type { CSSProperties, HTMLAttributes } from 'react';
import './Skeleton.css';

export type SkeletonShape = 'line' | 'circle' | 'rect';
export type SkeletonAnimation = 'pulse' | 'shimmer' | 'none';

export interface SkeletonProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'children'> {
  shape?: SkeletonShape;
  animation?: SkeletonAnimation;
  /** 幅。数値は px、文字列はそのまま (例: '60%') */
  width?: number | string;
  /** 高さ。line のデフォルトは 1em */
  height?: number | string;
  /** circle 用: 直径。指定すると width/height を上書き */
  size?: number | string;
}

const toCss = (v?: number | string) => (typeof v === 'number' ? `${v}px` : v);

export const Skeleton = ({
  shape = 'line',
  animation = 'shimmer',
  width,
  height,
  size,
  className,
  style,
  ...rest
}: SkeletonProps) => {
  const dims: CSSProperties = {};
  if (shape === 'circle') {
    const d = toCss(size ?? width ?? 40);
    dims.width = d;
    dims.height = d;
  } else if (shape === 'rect') {
    dims.width = toCss(width ?? '100%');
    dims.height = toCss(height ?? 120);
  } else {
    dims.width = toCss(width ?? '100%');
    dims.height = toCss(height ?? '1em');
  }

  const classes = [
    'ds-skeleton',
    `ds-skeleton--${shape}`,
    `ds-skeleton--${animation}`,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <span
      className={classes}
      style={{ ...dims, ...style }}
      aria-hidden="true"
      {...rest}
    />
  );
};

// ── SkeletonGroup: aria-busy ラッパー ──
export interface SkeletonGroupProps extends HTMLAttributes<HTMLDivElement> {
  /** ローディング中。false で children をそのまま返す */
  isLoading: boolean;
  /** ローディング中に表示する内容 */
  loadingContent: React.ReactNode;
}

export const SkeletonGroup = ({
  isLoading,
  loadingContent,
  children,
  ...rest
}: SkeletonGroupProps) => {
  if (!isLoading) return <>{children}</>;
  return (
    <div aria-busy="true" aria-live="polite" {...rest}>
      {loadingContent}
    </div>
  );
};
