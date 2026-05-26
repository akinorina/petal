import type { HTMLAttributes, ReactNode } from 'react';
import './TopBar.css';

export type TopBarVariant = 'default' | 'sticky' | 'transparent';

export interface TopBarProps extends HTMLAttributes<HTMLElement> {
  /** 左スロット: ロゴ / タイトル / メニューボタン等 */
  start?: ReactNode;
  /** 中央スロット: ナビ / 検索バー等 */
  center?: ReactNode;
  /** 右スロット: アクション / Avatar 等 */
  end?: ReactNode;
  variant?: TopBarVariant;
  /** label for the nav landmark (省略時は "global navigation") */
  ariaLabel?: string;
}

export const TopBar = ({
  start,
  center,
  end,
  variant = 'default',
  ariaLabel = 'global navigation',
  className,
  children,
  ...rest
}: TopBarProps) => {
  const classes = [
    'ds-topbar',
    `ds-topbar--${variant}`,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  // children が渡された場合は完全カスタム
  if (children) {
    return (
      <header className={classes} {...rest}>
        <nav aria-label={ariaLabel} className="ds-topbar__inner">
          {children}
        </nav>
      </header>
    );
  }

  return (
    <header className={classes} {...rest}>
      <nav aria-label={ariaLabel} className="ds-topbar__inner">
        {start && <div className="ds-topbar__start">{start}</div>}
        {center && <div className="ds-topbar__center">{center}</div>}
        {end && <div className="ds-topbar__end">{end}</div>}
      </nav>
    </header>
  );
};
