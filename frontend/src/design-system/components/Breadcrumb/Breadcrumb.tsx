import type { HTMLAttributes, ReactNode } from 'react';
import './Breadcrumb.css';

export interface BreadcrumbItem {
  /** 表示ラベル */
  label: ReactNode;
  /** href が無ければ非リンク表示。最終項目は href を渡さないのが慣例 */
  href?: string;
  /** 任意の onClick (SPA ルーター連携用) */
  onClick?: (event: React.MouseEvent) => void;
}

export interface BreadcrumbProps extends HTMLAttributes<HTMLElement> {
  items: BreadcrumbItem[];
  /** 区切り文字 (デフォルト: 矢印アイコン) */
  separator?: ReactNode;
  /** 表示する最大項目数。超過時は中央を "..." に折りたたむ */
  maxItems?: number;
  /** 折りたたみ時に「先頭」「末尾」に残す件数（合計でも `maxItems` を超える場合あり） */
  itemsBeforeCollapse?: number;
  itemsAfterCollapse?: number;
}

const DefaultSeparator = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const Item = ({ item, isCurrent }: { item: BreadcrumbItem; isCurrent: boolean }) => {
  if (isCurrent) {
    return (
      <span className="ds-breadcrumb__current" aria-current="page">
        {item.label}
      </span>
    );
  }
  if (item.href || item.onClick) {
    return (
      <a className="ds-breadcrumb__link" href={item.href} onClick={item.onClick}>
        {item.label}
      </a>
    );
  }
  return <span className="ds-breadcrumb__text">{item.label}</span>;
};

export const Breadcrumb = ({
  items,
  separator,
  maxItems,
  itemsBeforeCollapse = 1,
  itemsAfterCollapse = 1,
  className,
  ...rest
}: BreadcrumbProps) => {
  let displayed: (BreadcrumbItem | 'ellipsis')[] = items;

  if (maxItems && items.length > maxItems) {
    const before = items.slice(0, itemsBeforeCollapse);
    const after = items.slice(items.length - itemsAfterCollapse);
    displayed = [...before, 'ellipsis', ...after];
  }

  const lastIdx = displayed.length - 1;
  const sep = separator ?? <DefaultSeparator />;

  return (
    <nav aria-label="breadcrumb" className={['ds-breadcrumb', className].filter(Boolean).join(' ')} {...rest}>
      <ol className="ds-breadcrumb__list">
        {displayed.map((it, i) => (
          <li key={i} className="ds-breadcrumb__item">
            {it === 'ellipsis' ? (
              <span className="ds-breadcrumb__ellipsis" aria-label="省略された項目">…</span>
            ) : (
              <Item item={it} isCurrent={i === lastIdx} />
            )}
            {i < lastIdx && <span className="ds-breadcrumb__sep" aria-hidden="true">{sep}</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
};
