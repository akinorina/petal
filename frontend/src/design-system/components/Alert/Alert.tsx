import type { HTMLAttributes, ReactNode } from 'react';
import './Alert.css';

export type AlertVariant = 'info' | 'success' | 'warning' | 'danger';
export type AlertTone = 'subtle' | 'solid';

export interface AlertProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  variant?: AlertVariant;
  /** 色の主張度 */
  tone?: AlertTone;
  title?: ReactNode;
  /** 子コンテンツ (本文) */
  children?: ReactNode;
  /** 右側のアクション (Button 等) */
  action?: ReactNode;
  /** 閉じるボタンを表示 + クリックで onClose を呼ぶ */
  isClosable?: boolean;
  onClose?: () => void;
  /** アイコンを差し替え。`false` で非表示 */
  icon?: ReactNode | false;
  /** 強く目立たせる (緊急時)。role が alert になる */
  isUrgent?: boolean;
}

const defaultIcons: Record<AlertVariant, ReactNode> = {
  info: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <circle cx="12" cy="12" r="9" />
      <line x1="12" y1="8" x2="12" y2="8" strokeLinecap="round" strokeWidth="2.5" />
      <line x1="12" y1="11" x2="12" y2="17" strokeLinecap="round" />
    </svg>
  ),
  success: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12l3 3 5-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  warning: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M10.3 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.7 3.86a2 2 0 00-3.4 0z" strokeLinejoin="round" />
      <line x1="12" y1="9" x2="12" y2="13" strokeLinecap="round" />
      <line x1="12" y1="17" x2="12" y2="17" strokeLinecap="round" strokeWidth="2.5" />
    </svg>
  ),
  danger: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <circle cx="12" cy="12" r="9" />
      <line x1="15" y1="9" x2="9" y2="15" strokeLinecap="round" />
      <line x1="9" y1="9" x2="15" y2="15" strokeLinecap="round" />
    </svg>
  ),
};

export const Alert = ({
  variant = 'info',
  tone = 'subtle',
  title,
  children,
  action,
  isClosable = false,
  onClose,
  icon,
  isUrgent = false,
  className,
  ...rest
}: AlertProps) => {
  const classes = [
    'ds-alert',
    `ds-alert--${variant}`,
    `ds-alert--${tone}`,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const role = isUrgent || variant === 'danger' ? 'alert' : 'status';
  const ariaLive = role === 'alert' ? 'assertive' : 'polite';
  const showIcon = icon !== false;
  const iconNode = icon === undefined || icon === false ? defaultIcons[variant] : icon;

  return (
    <div className={classes} role={role} aria-live={ariaLive} {...rest}>
      {showIcon && <div className="ds-alert__icon" aria-hidden="true">{iconNode}</div>}
      <div className="ds-alert__content">
        {title && <div className="ds-alert__title">{title}</div>}
        {children && <div className="ds-alert__body">{children}</div>}
      </div>
      {action && <div className="ds-alert__action">{action}</div>}
      {isClosable && (
        <button
          type="button"
          className="ds-alert__close"
          aria-label="閉じる"
          onClick={onClose}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
          </svg>
        </button>
      )}
    </div>
  );
};
