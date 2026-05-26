import { forwardRef } from 'react';
import type { HTMLAttributes, KeyboardEvent, ReactNode } from 'react';
import './Card.css';

export type CardVariant = 'outlined' | 'elevated';
export type CardPadding = 'sm' | 'md' | 'lg' | 'none';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  padding?: CardPadding;
  /** クリック可能なカード。role="button" + Enter/Space で onClick が発火 */
  isInteractive?: boolean;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  {
    variant = 'outlined',
    padding = 'md',
    isInteractive = false,
    className,
    children,
    onClick,
    onKeyDown,
    tabIndex,
    role,
    ...rest
  },
  ref,
) {
  const classes = [
    'ds-card',
    `ds-card--${variant}`,
    `ds-card--padding-${padding}`,
    isInteractive && 'ds-card--interactive',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(e);
    if (isInteractive && onClick && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      onClick(e as unknown as React.MouseEvent<HTMLDivElement>);
    }
  };

  return (
    <div
      ref={ref}
      className={classes}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      role={role ?? (isInteractive ? 'button' : undefined)}
      tabIndex={tabIndex ?? (isInteractive ? 0 : undefined)}
      {...rest}
    >
      {children}
    </div>
  );
});

// ── Compound parts ──

export interface CardSectionProps extends HTMLAttributes<HTMLDivElement> {
  children?: ReactNode;
}

const Header = ({ className, children, ...rest }: CardSectionProps) => (
  <div className={['ds-card__header', className].filter(Boolean).join(' ')} {...rest}>
    {children}
  </div>
);

const Body = ({ className, children, ...rest }: CardSectionProps) => (
  <div className={['ds-card__body', className].filter(Boolean).join(' ')} {...rest}>
    {children}
  </div>
);

const Footer = ({ className, children, ...rest }: CardSectionProps) => (
  <div className={['ds-card__footer', className].filter(Boolean).join(' ')} {...rest}>
    {children}
  </div>
);

(Card as unknown as { Header: typeof Header }).Header = Header;
(Card as unknown as { Body: typeof Body }).Body = Body;
(Card as unknown as { Footer: typeof Footer }).Footer = Footer;

export type CardCompound = typeof Card & {
  Header: typeof Header;
  Body: typeof Body;
  Footer: typeof Footer;
};

const CardCompound = Card as CardCompound;
export { CardCompound };
