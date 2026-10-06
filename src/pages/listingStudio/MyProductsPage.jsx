import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search } from 'lucide-react';
import { usePaginatedProjects } from '../../components/listingStudio/useProjects';
import { Pagination } from '../../components/listingStudio/ui/Pagination';
import {
  BTN_PRIMARY,
  PAGE_HEAD,
  PAGE_TITLE,
  MUTED,
  GRID_CARDS,
  PROJECT_CARD,
  THUMB,
  THUMB_PLACEHOLDER,
  BADGE,
  SKELETON_BLOCK,
  EMPTY_STATE,
  FIELD_INPUT,
} from '../../components/listingStudio/ui/classNames';

const PAGE_SIZE = 20;

/** Every project's product, viewed as a catalog rather than a campaign-progress list —
 *  there's no separate product model in the backend, so this reads the same
 *  GET /api/listing-studio/projects data as the Campaigns page but surfaces product
 *  facts (brand, category, price) instead of pipeline status. */
export default function MyProductsPage() {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedQuery(query.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  const { projects, pagination } = usePaginatedProjects({ page, limit: PAGE_SIZE, q: debouncedQuery || undefined });

  return (
    <div>
      <div className={PAGE_HEAD}>
        <div>
          <h1 className={PAGE_TITLE}>My Products</h1>
          <p className={MUTED}>Every product you've brought into the studio, across all campaigns.</p>
        </div>
      </div>

      <div className="relative w-80 mb-4.5">
        <input
          type="text"
          placeholder="Search by name, brand, or category…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className={`${FIELD_INPUT} w-full pr-8`}
        />
        <Search size={15} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
      </div>

      {projects === null && (
        <div className={GRID_CARDS}>
          {[0, 1, 2].map((i) => (
            <div key={i} className={SKELETON_BLOCK} />
          ))}
        </div>
      )}

      {projects?.length === 0 && !debouncedQuery && (
        <div className={EMPTY_STATE}>
          <p>No products yet — create a campaign to bring one in.</p>
          <Link to="/listing-studio/new" className={BTN_PRIMARY}>
            New campaign
          </Link>
        </div>
      )}

      {projects?.length === 0 && debouncedQuery && <p className={MUTED}>No products match "{debouncedQuery}".</p>}

      {projects && projects.length > 0 && (
        <div className={GRID_CARDS}>
          {projects.map((p) => (
            <Link key={p.id} to={`/listing-studio/p/${p.id}`} className={PROJECT_CARD}>
              {p.images[0] ? <img src={p.images[0]} alt="" className={THUMB} /> : <div className={THUMB_PLACEHOLDER} />}
              <div>
                <strong className="text-slate-900">{p.input.name}</strong>
                <div className="text-slate-500 text-xs">{p.input.brand}</div>
                <div className="text-slate-500 text-xs">{p.input.category}</div>
                <div className="mt-1.5">
                  {p.input.price && <span className={BADGE}>{p.input.price}</span>}
                  {p.sourceAsin && <span className={BADGE}>{p.sourceAsin}</span>}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      <Pagination page={page} totalPages={pagination?.totalPages} onChange={setPage} />
    </div>
  );
}
