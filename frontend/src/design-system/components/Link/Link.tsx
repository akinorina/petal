import { forwardRef } from 'react';
import type { AnchorHTMLAttributes, ReactNode } from 'react';
import './Link.css';

export type LinkVariant = 'inline' | 'standalone';

export interface LinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  variant?: LinkVariant;
  isExternal?: boolean;
  isDisabled?: boolean;
  children?: ReactNode;
}

const ExternalIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
    <path d="M7 17L17 7M9 7h8v8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const Link = forwardRef<HTMLAnchorElement, LinkProps>(function Link(
  {
    variant = 'inline',
    isExternal = false,
    isDisabled = false,
    className,
    children,
    target,
    rel,
    ...rest
  },
  ref,
) {
  const classes = [
    'ds-link',
    `ds-link--${variant}`,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const externalProps = isExternal
    ? {
        target: target ?? '_blank',
        rel: rel ?? 'noopener noreferrer',
      }
    : { target, rel };

  return (
    <a
      ref={ref}
      className={classes}
      aria-disabled={isDisabled || undefined}
      {...externalProps}
      {...rest}
    >
      {children}
      {isExternal && (
        <span className="ds-link__external-icon">
          <ExternalIcon />
          <span style={{ position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0 }}>
            （新しいタブで開きます）
          </span>
        </span>
      )}
    </a>
  );
});
