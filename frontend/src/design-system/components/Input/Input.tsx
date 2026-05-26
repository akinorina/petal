import { forwardRef } from 'react';
import type { InputHTMLAttributes, ReactNode } from 'react';
import './Input.css';

export type InputSize = 'sm' | 'md' | 'lg';

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size' | 'prefix'> {
  size?: InputSize;
  hasError?: boolean;
  isFullWidth?: boolean;
  prefix?: ReactNode;
  suffix?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    size = 'md',
    hasError = false,
    isFullWidth = true,
    prefix,
    suffix,
    disabled,
    className,
    type = 'text',
    'aria-invalid': ariaInvalid,
    ...rest
  },
  ref,
) {
  const wrapClass = [
    'ds-input-wrap',
    `ds-input-wrap--${size}`,
    isFullWidth && 'ds-input-wrap--full-width',
    hasError && 'ds-input-wrap--error',
    disabled && 'ds-input-wrap--disabled',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={wrapClass}>
      {prefix && <span className="ds-input__prefix">{prefix}</span>}
      <input
        ref={ref}
        type={type}
        disabled={disabled}
        className="ds-input"
        aria-invalid={ariaInvalid ?? (hasError || undefined)}
        {...rest}
      />
      {suffix && <span className="ds-input__suffix">{suffix}</span>}
    </div>
  );
});
