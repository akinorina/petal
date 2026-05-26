import type { HTMLAttributes, ReactNode } from 'react';
import './AppShell.css';

export interface AppShellProps extends HTMLAttributes<HTMLDivElement> {
  /** TopBar コンポーネント等 */
  topBar?: ReactNode;
  /** SideNav 等 */
  sideNav?: ReactNode;
  /** ページ下部 Footer */
  footer?: ReactNode;
  /** メインコンテンツ (`<main>` でラップされる) */
  children?: ReactNode;
  /** メインの id (スキップリンクのターゲット)。デフォルト `main` */
  mainId?: string;
  /** スキップリンク非表示 (推奨: 残す) */
  disableSkipLink?: boolean;
}

export const AppShell = ({
  topBar,
  sideNav,
  footer,
  children,
  mainId = 'main',
  disableSkipLink = false,
  className,
  ...rest
}: AppShellProps) => {
  const hasSide = !!sideNav;
  const classes = [
    'ds-appshell',
    hasSide && 'ds-appshell--with-side',
    !topBar && 'ds-appshell--no-top',
    !footer && 'ds-appshell--no-footer',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes} {...rest}>
      {!disableSkipLink && (
        <a href={`#${mainId}`} className="ds-appshell__skip-link">
          メインコンテンツへスキップ
        </a>
      )}
      {topBar && <div className="ds-appshell__top">{topBar}</div>}
      {sideNav && <div className="ds-appshell__side">{sideNav}</div>}
      <main id={mainId} className="ds-appshell__main" tabIndex={-1}>
        {children}
      </main>
      {footer && (
        <footer className="ds-appshell__footer">{footer}</footer>
      )}
    </div>
  );
};
