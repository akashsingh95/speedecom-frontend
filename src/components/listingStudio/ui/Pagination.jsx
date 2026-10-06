import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const PAGE_BTN =
  'min-w-8 h-8 px-2 rounded-lg text-sm grid place-items-center border transition-colors disabled:opacity-40 disabled:cursor-not-allowed';
const PAGE_BTN_IDLE = 'border-slate-200 bg-white text-slate-600 hover:border-brand-200 hover:bg-brand-50 hover:text-brand-600';
const PAGE_BTN_ACTIVE = 'border-brand-600 bg-brand-600 text-white';

/** First, last, and the current page's neighbours, with an ellipsis for each gap — e.g.
 *  page 8 of 20 -> [1, '…', 7, 8, 9, '…', 20]. A gap of exactly one page shows that page
 *  instead of an ellipsis, since "…" standing in for a single number saves nothing. */
function pageItems(page, totalPages) {
  const pages = [...new Set([1, page - 1, page, page + 1, totalPages])]
    .filter((p) => p >= 1 && p <= totalPages)
    .sort((a, b) => a - b);
  const items = [];
  let prev = 0;
  for (const p of pages) {
    if (p - prev === 2) items.push(prev + 1);
    else if (p - prev > 2) items.push(`gap-${p}`);
    items.push(p);
    prev = p;
  }
  return items;
}

/** Numbered page controls for a server-paginated list. Renders nothing for a single page. */
export function Pagination({ page, totalPages, onChange, className = '' }) {
  if (!totalPages || totalPages <= 1) return null;
  return (
    <nav aria-label="Pagination" className={`flex items-center justify-center gap-1.5 mt-6 ${className}`}>
      <button
        type="button"
        aria-label="Previous page"
        className={`${PAGE_BTN} ${PAGE_BTN_IDLE}`}
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
      >
        <ChevronLeft size={15} />
      </button>
      {pageItems(page, totalPages).map((item) =>
        typeof item === 'string' ? (
          <span key={item} className="px-1 text-slate-400 text-sm">
            …
          </span>
        ) : (
          <button
            key={item}
            type="button"
            aria-current={item === page ? 'page' : undefined}
            className={`${PAGE_BTN} ${item === page ? PAGE_BTN_ACTIVE : PAGE_BTN_IDLE}`}
            onClick={() => item !== page && onChange(item)}
          >
            {item}
          </button>
        ),
      )}
      <button
        type="button"
        aria-label="Next page"
        className={`${PAGE_BTN} ${PAGE_BTN_IDLE}`}
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
      >
        <ChevronRight size={15} />
      </button>
    </nav>
  );
}
