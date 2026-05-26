import type { HTMLAttributes, ReactNode } from 'react';
import './EmptyState.css';

export type EmptyStateSize = 'sm' | 'md' | 'lg';

export interface EmptyStateProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  /** アイコン or イラスト（任意の ReactNode） */
  illustration?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  /** 主アクション / 副アクション */
  primaryAction?: ReactNode;
  secondaryAction?: ReactNode;
  size?: EmptyStateSize;
}

export const EmptyState = ({
  illustration,
  title,
  description,
  primaryAction,
  secondaryAction,
  size = 'md',
  className,
  ...rest
}: EmptyStateProps) => {
  const classes = ['ds-empty', `ds-empty--${size}`, className].filter(Boolean).join(' ');

  return (
    <div className={classes} role="status" {...rest}>
      {illustration && <div className="ds-empty__illustration" aria-hidden="true">{illustration}</div>}
      <div className="ds-empty__title">{title}</div>
      {description && <div className="ds-empty__description">{description}</div>}
      {(primaryAction || secondaryAction) && (
        <div className="ds-empty__actions">
          {primaryAction}
          {secondaryAction}
        </div>
      )}
    </div>
  );
};
