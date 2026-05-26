import { createElement } from 'react';
import type { CSSProperties, HTMLAttributes, ReactNode } from 'react';
import './Text.css';

export type TextVariant =
  | 'display-lg'
  | 'display-md'
  | 'heading-lg'
  | 'heading-md'
  | 'heading-sm'
  | 'body-lg'
  | 'body-md'
  | 'body-sm'
  | 'label'
  | 'caption'
  | 'overline';

export type TextColor = 'primary' | 'secondary' | 'tertiary' | 'inverse';

export type TextAs = 'p' | 'span' | 'div' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';

export interface TextProps extends Omit<HTMLAttributes<HTMLElement>, 'color'> {
  as?: TextAs;
  variant?: TextVariant;
  color?: TextColor;
  align?: 'left' | 'center' | 'right';
  truncate?: boolean;
  lineClamp?: number;
  children?: ReactNode;
}

export const Text = ({
  as = 'p',
  variant = 'body-md',
  color = 'primary',
  align,
  truncate = false,
  lineClamp,
  className,
  style,
  children,
  ...rest
}: TextProps) => {
  const classes = [
    'ds-text',
    `ds-text--${variant}`,
    `ds-text--color-${color}`,
    align && `ds-text--align-${align}`,
    truncate && 'ds-text--truncate',
    lineClamp != null && 'ds-text--line-clamp',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const finalStyle: CSSProperties =
    lineClamp != null
      ? { ...style, WebkitLineClamp: lineClamp }
      : (style ?? {});

  return createElement(
    as,
    {
      className: classes,
      style: finalStyle,
      ...rest,
    },
    children,
  );
};
