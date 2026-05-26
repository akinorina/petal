import { forwardRef } from 'react';
import type { InputHTMLAttributes, ReactNode } from 'react';
import './Switch.css';

export type SwitchSize = 'sm' | 'md';

export interface SwitchProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size' | 'type'> {
  label?: ReactNode;
  description?: ReactNode;
  size?: SwitchSize;
  /** label を右ではなく左に配置（行末に switch を置きたい場合） */
  labelPosition?: 'right' | 'left';
}

export const Switch = forwardRef<HTMLInputElement, SwitchProps>(function Switch(
  {
    label,
    description,
    size = 'md',
    labelPosition = 'right',
    disabled,
    className,
    id,
    'aria-label': ariaLabel,
    ...rest
  },
  ref,
) {
  const wrapClass = [
    'ds-switch',
    `ds-switch--${size}`,
    `ds-switch--label-${labelPosition}`,
    disabled && 'ds-switch--disabled',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const text = (label || description) && (
    <span className="ds-switch__text">
      {label && <span className="ds-switch__label">{label}</span>}
      {description && <span className="ds-switch__description">{description}</span>}
    </span>
  );

  return (
    <label className={wrapClass} htmlFor={id}>
      {labelPosition === 'left' && text}
      <span className="ds-switch__control">
        <input
          ref={ref}
          id={id}
          type="checkbox"
          role="switch"
          disabled={disabled}
          aria-label={ariaLabel}
          className="ds-switch__input"
          {...rest}
        />
        <span className="ds-switch__track" aria-hidden="true">
          <span className="ds-switch__thumb" />
        </span>
      </span>
      {labelPosition === 'right' && text}
    </label>
  );
});
