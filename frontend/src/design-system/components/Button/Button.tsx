import { forwardRef } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import './Button.css';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'link';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  isFullWidth?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  children?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    isLoading = false,
    isFullWidth = false,
    disabled,
    leftIcon,
    rightIcon,
    children,
    className,
    type = 'button',
    ...rest
  },
  ref,
) {
  const isDisabled = disabled || isLoading;
  const classes = [
    'ds-button',
    `ds-button--${variant}`,
    `ds-button--${size}`,
    isFullWidth && 'ds-button--full-width',
    isLoading && 'ds-button--loading',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      ref={ref}
      type={type}
      disabled={isDisabled}
      aria-busy={isLoading || undefined}
      className={classes}
      {...rest}
    >
      {isLoading && <span className="ds-button__spinner" aria-hidden="true" />}
      <span className="ds-button__content">
        {leftIcon && (
          <span className="ds-button__icon" aria-hidden="true">
            {leftIcon}
          </span>
        )}
        {children}
        {rightIcon && (
          <span className="ds-button__icon" aria-hidden="true">
            {rightIcon}
          </span>
        )}
      </span>
    </button>
  );
});
