import { forwardRef } from 'react';
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react';
import './ListItem.css';

export type ListItemSize = 'sm' | 'md';

type CommonProps = {
  leading?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  trailing?: ReactNode;
  size?: ListItemSize;
  isSelected?: boolean;
  /** 区切り線を下に表示 */
  hasDivider?: boolean;
};

type StaticListItemProps = CommonProps & HTMLAttributes<HTMLDivElement> & {
  as?: 'div';
  href?: never;
  onClick?: never;
  disabled?: never;
};
type ButtonListItemProps = CommonProps & ButtonHTMLAttributes<HTMLButtonElement> & {
  as: 'button';
  href?: never;
};
type LinkListItemProps = CommonProps & AnchorHTMLAttributes<HTMLAnchorElement> & {
  as: 'a';
  href: string;
};

export type ListItemProps = StaticListItemProps | ButtonListItemProps | LinkListItemProps;

const renderInner = ({
  leading,
  title,
  subtitle,
  trailing,
}: Pick<CommonProps, 'leading' | 'title' | 'subtitle' | 'trailing'>) => (
  <>
    {leading && <span className="ds-listitem__leading">{leading}</span>}
    <span className="ds-listitem__content">
      <span className="ds-listitem__title">{title}</span>
      {subtitle && <span className="ds-listitem__subtitle">{subtitle}</span>}
    </span>
    {trailing && <span className="ds-listitem__trailing">{trailing}</span>}
  </>
);

const baseClasses = (
  size: ListItemSize,
  isSelected: boolean,
  hasDivider: boolean,
  interactive: boolean,
  className?: string,
) =>
  [
    'ds-listitem',
    `ds-listitem--${size}`,
    isSelected && 'ds-listitem--selected',
    hasDivider && 'ds-listitem--divider',
    interactive && 'ds-listitem--interactive',
    className,
  ]
    .filter(Boolean)
    .join(' ');

export const ListItem = forwardRef<HTMLElement, ListItemProps>(function ListItem(props, ref) {
  const {
    as = 'div',
    leading,
    title,
    subtitle,
    trailing,
    size = 'md',
    isSelected = false,
    hasDivider = false,
    className,
  } = props;
  const interactive = as !== 'div';
  const cls = baseClasses(size, isSelected, hasDivider, interactive, className);
  const inner = renderInner({ leading, title, subtitle, trailing });

  if (as === 'a') {
    const { as: _ignored, ...rest } = props;
    void _ignored;
    return (
      <a
        ref={ref as React.Ref<HTMLAnchorElement>}
        className={cls}
        aria-current={isSelected ? 'true' : undefined}
        {...(rest as AnchorHTMLAttributes<HTMLAnchorElement>)}
      >
        {inner}
      </a>
    );
  }
  if (as === 'button') {
    const { as: _ignored, ...rest } = props;
    void _ignored;
    return (
      <button
        ref={ref as React.Ref<HTMLButtonElement>}
        type="button"
        className={cls}
        aria-pressed={isSelected || undefined}
        {...(rest as ButtonHTMLAttributes<HTMLButtonElement>)}
      >
        {inner}
      </button>
    );
  }
  const { as: _ignored, ...rest } = props;
  void _ignored;
  return (
    <div
      ref={ref as React.Ref<HTMLDivElement>}
      className={cls}
      {...(rest as HTMLAttributes<HTMLDivElement>)}
    >
      {inner}
    </div>
  );
});
