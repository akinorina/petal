import type { HTMLAttributes, ReactNode } from 'react';
import './Tag.css';

export type TagVariant = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'accent';
export type TagSize = 'sm' | 'md';

export interface TagProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: TagVariant;
  size?: TagSize;
  /** 左アイコン（任意） */
  leading?: ReactNode;
  /** 削除可能化。クリックで onRemove を発火 */
  isRemovable?: boolean;
  /** 削除ボタンのクリック時 */
  onRemove?: () => void;
  /** 削除ボタンの aria-label（isRemovable 時必須相当。デフォルト "削除"） */
  removeLabel?: string;
}

export const Tag = ({
  variant = 'neutral',
  size = 'md',
  leading,
  isRemovable = false,
  onRemove,
  removeLabel = '削除',
  className,
  children,
  ...rest
}: TagProps) => {
  const classes = [
    'ds-tag',
    `ds-tag--${variant}`,
    `ds-tag--${size}`,
    isRemovable && 'ds-tag--removable',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <span className={classes} {...rest}>
      {leading && <span className="ds-tag__leading">{leading}</span>}
      <span className="ds-tag__label">{children}</span>
      {isRemovable && (
        <button
          type="button"
          className="ds-tag__remove"
          aria-label={removeLabel}
          onClick={onRemove}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
          </svg>
        </button>
      )}
    </span>
  );
};
