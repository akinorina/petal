import type { HTMLAttributes } from 'react';
import './Tag.css';

export type BadgeVariant = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'accent';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  /** 数値を表示。99 超は "99+" に丸める */
  count?: number;
  /** count > max のとき "max+" に丸める */
  max?: number;
  /** ドットのみ表示（数値なし。状態通知用） */
  isDot?: boolean;
}

export const Badge = ({
  variant = 'danger',
  count,
  max = 99,
  isDot = false,
  className,
  children,
  ...rest
}: BadgeProps) => {
  const classes = [
    'ds-badge',
    `ds-badge--${variant}`,
    isDot && 'ds-badge--dot',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const displayCount =
    typeof count === 'number' ? (count > max ? `${max}+` : String(count)) : undefined;

  return (
    <span className={classes} {...rest}>
      {!isDot && (displayCount ?? children)}
    </span>
  );
};
