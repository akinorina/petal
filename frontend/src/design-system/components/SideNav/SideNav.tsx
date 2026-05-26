import { createContext, useContext } from 'react';
import type {
  AnchorHTMLAttributes,
  ButtonHTMLAttributes,
  HTMLAttributes,
  ReactNode,
} from 'react';
import './SideNav.css';

export type SideNavVariant = 'full' | 'compact' | 'icon-only';

interface SideNavContextValue {
  variant: SideNavVariant;
}
const SideNavContext = createContext<SideNavContextValue>({ variant: 'full' });
const useSideNavContext = () => useContext(SideNavContext);

export interface SideNavProps extends HTMLAttributes<HTMLElement> {
  variant?: SideNavVariant;
  /** nav landmark の aria-label */
  ariaLabel?: string;
  /** ヘッダー (上端固定: logo 等) */
  header?: ReactNode;
  /** フッター (下端固定: profile / settings 等) */
  footer?: ReactNode;
  children?: ReactNode;
}

export const SideNav = ({
  variant = 'full',
  ariaLabel = 'sidebar navigation',
  header,
  footer,
  className,
  children,
  ...rest
}: SideNavProps) => {
  const classes = ['ds-sidenav', `ds-sidenav--${variant}`, className].filter(Boolean).join(' ');
  return (
    <SideNavContext.Provider value={{ variant }}>
      <nav aria-label={ariaLabel} className={classes} {...rest}>
        {header && <div className="ds-sidenav__header">{header}</div>}
        <div className="ds-sidenav__body">{children}</div>
        {footer && <div className="ds-sidenav__footer">{footer}</div>}
      </nav>
    </SideNavContext.Provider>
  );
};

// ── Section (グループ見出し) ──
export interface SideNavSectionProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  title?: ReactNode;
  children?: ReactNode;
}
const Section = ({ title, className, children, ...rest }: SideNavSectionProps) => {
  const ctx = useSideNavContext();
  return (
    <div className={['ds-sidenav__section', className].filter(Boolean).join(' ')} {...rest}>
      {title && ctx.variant !== 'icon-only' && (
        <div className="ds-sidenav__section-title">{title}</div>
      )}
      {children}
    </div>
  );
};

// ── Item ──
type ItemBase = {
  icon?: ReactNode;
  label: ReactNode;
  isActive?: boolean;
  /** 右側のメタ (Badge 等)。icon-only では非表示 */
  trailing?: ReactNode;
};

type LinkItemProps = ItemBase &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'children'> & {
    as?: 'a';
    href: string;
  };

type ButtonItemProps = ItemBase &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
    as: 'button';
    href?: never;
  };

export type SideNavItemProps = LinkItemProps | ButtonItemProps;

const Item = (props: SideNavItemProps) => {
  const ctx = useSideNavContext();
  const { icon, label, isActive, trailing, className, ...rest } = props;
  const isCompactish = ctx.variant === 'icon-only';

  const classes = [
    'ds-sidenav__item',
    isActive && 'ds-sidenav__item--active',
    isCompactish && 'ds-sidenav__item--icon-only',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const inner = (
    <>
      {icon && <span className="ds-sidenav__item-icon">{icon}</span>}
      {!isCompactish && <span className="ds-sidenav__item-label">{label}</span>}
      {!isCompactish && trailing && <span className="ds-sidenav__item-trailing">{trailing}</span>}
    </>
  );

  if (props.as === 'button') {
    const { as: _ignored, ...buttonRest } = rest as ButtonHTMLAttributes<HTMLButtonElement> & { as?: 'button' };
    void _ignored;
    return (
      <button
        type="button"
        className={classes}
        aria-pressed={isActive || undefined}
        aria-label={isCompactish ? (typeof label === 'string' ? label : undefined) : undefined}
        {...buttonRest}
      >
        {inner}
      </button>
    );
  }
  const { as: _ignored, ...linkRest } = rest as AnchorHTMLAttributes<HTMLAnchorElement> & { as?: 'a' };
  void _ignored;
  return (
    <a
      className={classes}
      aria-current={isActive ? 'page' : undefined}
      aria-label={isCompactish ? (typeof label === 'string' ? label : undefined) : undefined}
      {...linkRest}
    >
      {inner}
    </a>
  );
};

(SideNav as unknown as Record<string, unknown>).Section = Section;
(SideNav as unknown as Record<string, unknown>).Item = Item;

export type SideNavCompound = typeof SideNav & {
  Section: typeof Section;
  Item: typeof Item;
};
const SideNavCompound = SideNav as SideNavCompound;
export { SideNavCompound };
