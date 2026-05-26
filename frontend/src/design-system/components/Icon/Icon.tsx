import type { HTMLAttributes, ReactNode } from 'react';
import './Icon.css';

export type IconSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export type IconColor =
  | 'current'
  | 'primary'
  | 'secondary'
  | 'tertiary'
  | 'accent'
  | 'danger'
  | 'success'
  | 'warning'
  | 'info';

export interface IconProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'color'> {
  size?: IconSize;
  color?: IconColor;
  /** 指定すると `role="img" aria-label`。未指定なら `aria-hidden="true"` */
  label?: string;
  children: ReactNode;
}

export const Icon = ({
  size = 'md',
  color = 'current',
  label,
  className,
  children,
  ...rest
}: IconProps) => {
  const classes = [
    'ds-icon',
    `ds-icon--${size}`,
    `ds-icon--color-${color}`,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  if (label) {
    return (
      <span className={classes} role="img" aria-label={label} {...rest}>
        {children}
      </span>
    );
  }

  return (
    <span className={classes} aria-hidden="true" {...rest}>
      {children}
    </span>
  );
};
