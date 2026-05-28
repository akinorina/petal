import { Children, useState } from 'react';
import type { HTMLAttributes, ReactElement, ReactNode } from 'react';
import './Avatar.css';

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type AvatarShape = 'circle' | 'rounded';

export interface AvatarProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'children'> {
  /** 画像 URL。読込失敗時はフォールバックに切り替わる */
  src?: string;
  /** 画像の alt。装飾なら空文字 */
  alt?: string;
  /** フォールバック表示用の名前（イニシャル算出に使う） */
  name?: string;
  /** name から自動算出する代わりに、子を直接フォールバックに使う（アイコン等） */
  fallback?: ReactNode;
  size?: AvatarSize;
  shape?: AvatarShape;
}

const getInitials = (name?: string) => {
  if (!name) return '';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return ((parts[0]![0] ?? '') + (parts[parts.length - 1]![0] ?? '')).toUpperCase();
};

/** 名前から決定的に色を選ぶ（同じ名前は同じ色になる） */
const colorFromName = (name?: string) => {
  if (!name) return 0;
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return Math.abs(hash) % 6;
};

export const Avatar = ({
  src,
  alt,
  name,
  fallback,
  size = 'md',
  shape = 'circle',
  className,
  ...rest
}: AvatarProps) => {
  const [errored, setErrored] = useState(false);
  const showImage = src && !errored;
  const initials = !showImage && !fallback ? getInitials(name) : '';
  const colorIdx = colorFromName(name);

  const classes = [
    'ds-avatar',
    `ds-avatar--${size}`,
    `ds-avatar--${shape}`,
    !showImage && `ds-avatar--tint-${colorIdx}`,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <span className={classes} {...rest}>
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className="ds-avatar__img"
          src={src}
          alt={alt ?? name ?? ''}
          onError={() => setErrored(true)}
        />
      ) : fallback ? (
        <span className="ds-avatar__fallback" aria-hidden={alt === '' || undefined}>
          {fallback}
        </span>
      ) : initials ? (
        <span className="ds-avatar__initials" aria-label={alt ?? name}>
          {initials}
        </span>
      ) : (
        <span className="ds-avatar__fallback" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 12a5 5 0 100-10 5 5 0 000 10zm0 2c-4.4 0-8 2.7-8 6v2h16v-2c0-3.3-3.6-6-8-6z" />
          </svg>
        </span>
      )}
    </span>
  );
};

// ── AvatarGroup ──

export interface AvatarGroupProps extends HTMLAttributes<HTMLSpanElement> {
  /** Avatar を子として渡す */
  children: ReactNode;
  /** 表示する最大数。超過分は "+N" で表示 */
  max?: number;
  /** 全 Avatar に適用するサイズ（子の size より優先） */
  size?: AvatarSize;
}

export const AvatarGroup = ({
  children,
  max,
  size,
  className,
  ...rest
}: AvatarGroupProps) => {
  const all = Children.toArray(children).filter(
    (c): c is ReactElement<AvatarProps> => !!c && typeof c === 'object' && 'props' in c,
  );
  const visible = max ? all.slice(0, max) : all;
  const hiddenCount = all.length - visible.length;

  const sizeClass = size ? `ds-avatar-group--${size}` : '';

  return (
    <span className={['ds-avatar-group', sizeClass, className].filter(Boolean).join(' ')} {...rest}>
      {visible.map((child, i) => {
        const props: AvatarProps = { ...child.props };
        if (size) props.size = size;
        return (
          <span key={i} className="ds-avatar-group__item">
            <Avatar {...props} />
          </span>
        );
      })}
      {hiddenCount > 0 && (
        <span className="ds-avatar-group__item">
          <Avatar
            size={size ?? visible[0]?.props.size ?? 'md'}
            shape={visible[0]?.props.shape ?? 'circle'}
            fallback={`+${hiddenCount}`}
            alt={`他 ${hiddenCount} 人`}
          />
        </span>
      )}
    </span>
  );
};
