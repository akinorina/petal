import type { HTMLAttributes } from 'react';
import './Spinner.css';

export type SpinnerSize = 'sm' | 'md' | 'lg' | 'xl';
export type SpinnerColor = 'current' | 'primary' | 'secondary' | 'accent';

export interface SpinnerProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'color'> {
  size?: SpinnerSize;
  color?: SpinnerColor;
  label?: string;
}

export const Spinner = ({
  size = 'md',
  color = 'current',
  label = '読み込み中',
  className,
  ...rest
}: SpinnerProps) => {
  const classes = [
    'ds-spinner',
    `ds-spinner--${size}`,
    `ds-spinner--color-${color}`,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <span role="status" aria-live="polite" {...rest}>
      <span className={classes} />
      <span className="ds-spinner__sr-only">{label}</span>
    </span>
  );
};
