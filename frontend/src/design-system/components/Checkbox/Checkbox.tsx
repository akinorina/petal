import { forwardRef, useEffect, useRef } from 'react';
import type { InputHTMLAttributes, ReactNode } from 'react';
import './Checkbox.css';

export type CheckboxSize = 'sm' | 'md';

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size' | 'type'> {
  /** ラベル。省略時は `aria-label` を必ず指定すること。 */
  label?: ReactNode;
  /** ラベル下の補助テキスト */
  description?: ReactNode;
  size?: CheckboxSize;
  /** 中間状態（部分選択）。`checked` の値は影響しない */
  isIndeterminate?: boolean;
  /** エラー状態 */
  hasError?: boolean;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  {
    label,
    description,
    size = 'md',
    isIndeterminate = false,
    hasError = false,
    disabled,
    className,
    id,
    'aria-label': ariaLabel,
    ...rest
  },
  ref,
) {
  const innerRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (innerRef.current) {
      innerRef.current.indeterminate = isIndeterminate;
    }
  }, [isIndeterminate]);

  const setRefs = (el: HTMLInputElement | null) => {
    innerRef.current = el;
    if (typeof ref === 'function') ref(el);
    else if (ref) (ref as React.MutableRefObject<HTMLInputElement | null>).current = el;
  };

  const wrapClass = [
    'ds-checkbox',
    `ds-checkbox--${size}`,
    disabled && 'ds-checkbox--disabled',
    hasError && 'ds-checkbox--error',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <label className={wrapClass} htmlFor={id}>
      <span className="ds-checkbox__control">
        <input
          ref={setRefs}
          id={id}
          type="checkbox"
          disabled={disabled}
          aria-label={ariaLabel}
          aria-invalid={hasError || undefined}
          className="ds-checkbox__input"
          {...rest}
        />
        <span className="ds-checkbox__box" aria-hidden="true">
          {isIndeterminate ? (
            <svg viewBox="0 0 16 16" className="ds-checkbox__icon">
              <line x1="3.5" y1="8" x2="12.5" y2="8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          ) : (
            <svg viewBox="0 0 16 16" className="ds-checkbox__icon">
              <path
                d="M3.5 8.5l3 3 6-6.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </span>
      </span>
      {(label || description) && (
        <span className="ds-checkbox__text">
          {label && <span className="ds-checkbox__label">{label}</span>}
          {description && <span className="ds-checkbox__description">{description}</span>}
        </span>
      )}
    </label>
  );
});
