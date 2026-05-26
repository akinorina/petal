import { createContext, forwardRef, useContext, useId } from 'react';
import type { ChangeEvent, InputHTMLAttributes, ReactNode } from 'react';
import './Radio.css';

export type RadioSize = 'sm' | 'md';

// ── Context for RadioGroup ──
interface RadioGroupContextValue {
  name: string;
  value?: string;
  onChange?: (value: string, event: ChangeEvent<HTMLInputElement>) => void;
  disabled?: boolean;
  hasError?: boolean;
  size?: RadioSize;
}
const RadioGroupContext = createContext<RadioGroupContextValue | null>(null);

// ── Radio ──
export interface RadioProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size' | 'type' | 'onChange'> {
  label?: ReactNode;
  description?: ReactNode;
  size?: RadioSize;
  hasError?: boolean;
  value: string;
  onChange?: (event: ChangeEvent<HTMLInputElement>) => void;
}

export const Radio = forwardRef<HTMLInputElement, RadioProps>(function Radio(
  {
    label,
    description,
    size,
    hasError,
    disabled,
    className,
    id,
    value,
    name: nameProp,
    checked: checkedProp,
    onChange,
    'aria-label': ariaLabel,
    ...rest
  },
  ref,
) {
  const group = useContext(RadioGroupContext);
  const resolvedSize = size ?? group?.size ?? 'md';
  const resolvedDisabled = disabled ?? group?.disabled;
  const resolvedError = hasError ?? group?.hasError;
  const resolvedName = nameProp ?? group?.name;
  const resolvedChecked = checkedProp ?? (group ? group.value === value : undefined);

  const wrapClass = [
    'ds-radio',
    `ds-radio--${resolvedSize}`,
    resolvedDisabled && 'ds-radio--disabled',
    resolvedError && 'ds-radio--error',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <label className={wrapClass} htmlFor={id}>
      <span className="ds-radio__control">
        <input
          ref={ref}
          id={id}
          type="radio"
          name={resolvedName}
          value={value}
          disabled={resolvedDisabled}
          checked={resolvedChecked}
          aria-label={ariaLabel}
          aria-invalid={resolvedError || undefined}
          className="ds-radio__input"
          onChange={(e) => {
            onChange?.(e);
            group?.onChange?.(value, e);
          }}
          {...rest}
        />
        <span className="ds-radio__circle" aria-hidden="true">
          <span className="ds-radio__dot" />
        </span>
      </span>
      {(label || description) && (
        <span className="ds-radio__text">
          {label && <span className="ds-radio__label">{label}</span>}
          {description && <span className="ds-radio__description">{description}</span>}
        </span>
      )}
    </label>
  );
});

// ── RadioGroup ──
export interface RadioGroupProps {
  /** グループのラベル（`<legend>`）。視覚的に隠したい場合は `isLabelHidden`。 */
  label?: ReactNode;
  /** ラベルを sr-only にする */
  isLabelHidden?: boolean;
  /** 必須項目（`<input>` には Radio 側へ委譲、視覚的な `*` を表示） */
  isRequired?: boolean;
  /** name 属性（省略時は自動生成） */
  name?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string, event: ChangeEvent<HTMLInputElement>) => void;
  disabled?: boolean;
  hasError?: boolean;
  size?: RadioSize;
  /** 縦並び (default) / 横並び */
  orientation?: 'vertical' | 'horizontal';
  className?: string;
  children: ReactNode;
}

export const RadioGroup = ({
  label,
  isLabelHidden = false,
  isRequired = false,
  name,
  value,
  onChange,
  disabled,
  hasError,
  size,
  orientation = 'vertical',
  className,
  children,
}: RadioGroupProps) => {
  const autoName = useId();
  const resolvedName = name ?? `ds-radio-${autoName}`;
  const classes = [
    'ds-radio-group',
    `ds-radio-group--${orientation}`,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <fieldset
      className={classes}
      disabled={disabled}
      aria-invalid={hasError || undefined}
      aria-required={isRequired || undefined}
    >
      {label && (
        <legend
          className={
            isLabelHidden ? 'ds-radio-group__legend ds-radio-group__legend--sr-only' : 'ds-radio-group__legend'
          }
        >
          {label}
          {isRequired && (
            <span className="ds-radio-group__required" aria-hidden="true">*</span>
          )}
        </legend>
      )}
      <div className="ds-radio-group__items">
        <RadioGroupContext.Provider
          value={{ name: resolvedName, value, onChange, disabled, hasError, size }}
        >
          {children}
        </RadioGroupContext.Provider>
      </div>
    </fieldset>
  );
};
