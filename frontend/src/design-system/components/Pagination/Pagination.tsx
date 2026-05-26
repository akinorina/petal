import type { HTMLAttributes, ReactNode } from 'react';
import './Pagination.css';

export type PaginationVariant = 'numbered' | 'simple' | 'load-more';
export type PaginationSize = 'sm' | 'md';

export interface PaginationProps extends Omit<HTMLAttributes<HTMLElement>, 'onChange'> {
  variant?: PaginationVariant;
  size?: PaginationSize;
  /** 1-indexed の現在ページ */
  page: number;
  /** 総ページ数（load-more では未使用、simple では prev/next の有効化に使う） */
  totalPages?: number;
  /** ページ変更時 */
  onChange?: (page: number) => void;
  /** load-more 用ボタンラベル / ハンドラ */
  loadMoreLabel?: ReactNode;
  onLoadMore?: () => void;
  /** load-more: 残データがあるか */
  hasMore?: boolean;
  /** ナビ aria-label */
  ariaLabel?: string;
}

// numbered 用: 表示するページ番号の配列を算出 (省略 "..." を含む)
const buildPageList = (page: number, total: number, sibling = 1): (number | 'dots')[] => {
  const range = (start: number, end: number) =>
    Array.from({ length: end - start + 1 }, (_, i) => start + i);

  // 表示数 = first + last + current + sibling*2 + dots * 2 ≒ 7 以下なら全表示
  const totalShown = sibling * 2 + 5;
  if (total <= totalShown) return range(1, total);

  const leftSibling = Math.max(page - sibling, 1);
  const rightSibling = Math.min(page + sibling, total);

  const showLeftDots = leftSibling > 2;
  const showRightDots = rightSibling < total - 1;

  if (!showLeftDots && showRightDots) {
    return [...range(1, 3 + sibling * 2), 'dots', total];
  }
  if (showLeftDots && !showRightDots) {
    return [1, 'dots', ...range(total - (2 + sibling * 2), total)];
  }
  return [1, 'dots', ...range(leftSibling, rightSibling), 'dots', total];
};

const ChevronLeft = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const ChevronRight = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const Pagination = ({
  variant = 'numbered',
  size = 'md',
  page,
  totalPages,
  onChange,
  loadMoreLabel = 'さらに表示',
  onLoadMore,
  hasMore = true,
  ariaLabel = 'pagination',
  className,
  ...rest
}: PaginationProps) => {
  const classes = ['ds-pagination', `ds-pagination--${size}`, className].filter(Boolean).join(' ');

  if (variant === 'load-more') {
    return (
      <nav aria-label={ariaLabel} className={classes} {...rest}>
        <button
          type="button"
          className="ds-pagination__load-more"
          onClick={onLoadMore}
          disabled={!hasMore}
        >
          {loadMoreLabel}
        </button>
      </nav>
    );
  }

  const total = totalPages ?? 1;
  const canPrev = page > 1;
  const canNext = page < total;
  const go = (p: number) => {
    if (p < 1 || p > total || p === page) return;
    onChange?.(p);
  };

  if (variant === 'simple') {
    return (
      <nav aria-label={ariaLabel} className={classes} {...rest}>
        <button
          type="button"
          className="ds-pagination__btn ds-pagination__btn--prev"
          onClick={() => go(page - 1)}
          disabled={!canPrev}
          aria-label="前のページ"
        >
          <ChevronLeft />
        </button>
        <span className="ds-pagination__status" aria-live="polite">
          {page} / {total}
        </span>
        <button
          type="button"
          className="ds-pagination__btn ds-pagination__btn--next"
          onClick={() => go(page + 1)}
          disabled={!canNext}
          aria-label="次のページ"
        >
          <ChevronRight />
        </button>
      </nav>
    );
  }

  // numbered
  const pages = buildPageList(page, total);
  return (
    <nav aria-label={ariaLabel} className={classes} {...rest}>
      <ul className="ds-pagination__list">
        <li>
          <button
            type="button"
            className="ds-pagination__btn"
            onClick={() => go(page - 1)}
            disabled={!canPrev}
            aria-label="前のページ"
          >
            <ChevronLeft />
          </button>
        </li>
        {pages.map((p, i) =>
          p === 'dots' ? (
            <li key={`dots-${i}`} className="ds-pagination__dots" aria-hidden="true">…</li>
          ) : (
            <li key={p}>
              <button
                type="button"
                className={['ds-pagination__btn', p === page && 'ds-pagination__btn--current'].filter(Boolean).join(' ')}
                aria-current={p === page ? 'page' : undefined}
                aria-label={`${p} ページ目${p === page ? ' (現在のページ)' : ''}`}
                onClick={() => go(p)}
              >
                {p}
              </button>
            </li>
          ),
        )}
        <li>
          <button
            type="button"
            className="ds-pagination__btn"
            onClick={() => go(page + 1)}
            disabled={!canNext}
            aria-label="次のページ"
          >
            <ChevronRight />
          </button>
        </li>
      </ul>
    </nav>
  );
};
