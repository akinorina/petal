import type { HTMLAttributes, ReactNode } from 'react';
import './Divider.css';

export type DividerOrientation = 'horizontal' | 'vertical';
export type DividerVariant = 'subtle' | 'default';

export interface DividerProps extends HTMLAttributes<HTMLDivElement> {
  orientation?: DividerOrientation;
  variant?: DividerVariant;
  /** horizontal のみ: 中央ラベル */
  children?: ReactNode;
}

export const Divider = ({
  orientation = 'horizontal',
  variant = 'subtle',
  className,
  children,
  ...rest
}: DividerProps) => {
  const hasLabel = children != null && orientation === 'horizontal';

  const classes = [
    'ds-divider',
    `ds-divider--${orientation}`,
    `ds-divider--${variant}`,
    hasLabel && 'ds-divider--with-label',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      role="separator"
      aria-orientation={orientation}
      className={classes}
      {...rest}
    >
      {hasLabel && <span className="ds-divider__label">{children}</span>}
    </div>
  );
};
