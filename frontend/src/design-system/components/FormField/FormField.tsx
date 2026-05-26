import {
  Children,
  cloneElement,
  createContext,
  isValidElement,
  useContext,
  useId,
} from 'react';
import type { HTMLAttributes, ReactElement, ReactNode } from 'react';
import './FormField.css';

interface FormFieldContextValue {
  controlId: string;
  describedBy?: string;
  isInvalid: boolean;
  isRequired: boolean;
}

const FormFieldContext = createContext<FormFieldContextValue | null>(null);

/** 子のフォーム要素から id / aria-describedby / aria-invalid / required を取得するフック。 */
export const useFormField = () => useContext(FormFieldContext);

export interface FormFieldProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  /** 表示ラベル。視覚的に隠したい場合は `isLabelHidden` を併用。 */
  label: ReactNode;
  /** 必須マーク表示（aria-required も付与） */
  isRequired?: boolean;
  /** 補助テキスト */
  helperText?: ReactNode;
  /** エラーメッセージ。指定がある場合 hasError 扱いになる。 */
  errorMessage?: ReactNode;
  /** ラベルを視覚的に隠す（SR には残す） */
  isLabelHidden?: boolean;
  /** 任意の id（指定なければ自動生成） */
  id?: string;
  children: ReactElement;
}

/**
 * Label + 入力要素 + HelperText + ErrorMessage の標準ラッパー。
 *
 * 子要素には Input / Textarea / Select 等を 1 つ渡す。
 * id / aria-describedby / aria-invalid / required は自動で配線される。
 */
export const FormField = ({
  label,
  isRequired = false,
  helperText,
  errorMessage,
  isLabelHidden = false,
  id,
  className,
  children,
  ...rest
}: FormFieldProps) => {
  const autoId = useId();
  const controlId = id ?? `ds-ff-${autoId}`;
  const helperId = helperText ? `${controlId}-helper` : undefined;
  const errorId = errorMessage ? `${controlId}-error` : undefined;
  const describedBy = [helperId, errorId].filter(Boolean).join(' ') || undefined;
  const isInvalid = errorMessage != null;

  const child = Children.only(children);
  const merged = isValidElement(child)
    ? cloneElement(child as ReactElement<Record<string, unknown>>, {
        id: (child.props as { id?: string }).id ?? controlId,
        'aria-describedby':
          [(child.props as { 'aria-describedby'?: string })['aria-describedby'], describedBy]
            .filter(Boolean)
            .join(' ') || undefined,
        'aria-invalid':
          (child.props as { 'aria-invalid'?: boolean })['aria-invalid'] ?? (isInvalid || undefined),
        'aria-required':
          (child.props as { 'aria-required'?: boolean })['aria-required'] ?? (isRequired || undefined),
        required: (child.props as { required?: boolean }).required ?? isRequired,
        hasError: (child.props as { hasError?: boolean }).hasError ?? isInvalid,
      })
    : child;

  const classes = ['ds-formfield', className].filter(Boolean).join(' ');

  return (
    <FormFieldContext.Provider value={{ controlId, describedBy, isInvalid, isRequired }}>
      <div className={classes} {...rest}>
        <label
          htmlFor={controlId}
          className={
            isLabelHidden ? 'ds-formfield__label ds-formfield__label--sr-only' : 'ds-formfield__label'
          }
        >
          {label}
          {isRequired && (
            <span className="ds-formfield__required" aria-hidden="true">
              *
            </span>
          )}
        </label>
        {merged}
        {helperText && !isInvalid && (
          <span id={helperId} className="ds-formfield__helper">
            {helperText}
          </span>
        )}
        {isInvalid && (
          <span id={errorId} className="ds-formfield__error" role="alert">
            {errorMessage}
          </span>
        )}
      </div>
    </FormFieldContext.Provider>
  );
};
