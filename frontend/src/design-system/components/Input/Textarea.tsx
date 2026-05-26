import { forwardRef } from 'react';
import type { TextareaHTMLAttributes } from 'react';
import './Input.css';

export type TextareaSize = 'md' | 'lg';

export interface TextareaProps
  extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'size'> {
  size?: TextareaSize;
  hasError?: boolean;
  isFullWidth?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  {
    size = 'md',
    hasError = false,
    isFullWidth = true,
    disabled,
    className,
    rows = 3,
    'aria-invalid': ariaInvalid,
    ...rest
  },
  ref,
) {
  const wrapClass = [
    'ds-input-wrap',
    'ds-input-wrap--textarea',
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
      <textarea
        ref={ref}
        rows={rows}
        disabled={disabled}
        className="ds-textarea"
        aria-invalid={ariaInvalid ?? (hasError || undefined)}
        {...rest}
      />
    </div>
  );
});
