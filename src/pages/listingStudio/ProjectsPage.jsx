import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronDown, Check, ExternalLink, History, Inbox, Palette, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { useAuth } from '../../AuthContext';
import { listingStudioApi } from '../../components/listingStudio/api';
import { amazonUrl, campaignStatus, formatRelativeTime, marketplaceCode } from '../../components/listingStudio/helpers';
import { useTenantOptions } from '../../components/listingStudio/useTenantOptions';
import { usePaginatedProjects } from '../../components/listingStudio/useProjects';
import { Modal } from '../../components/listingStudio/ui/Modal';
import { StatTile } from '../../components/listingStudio/ui/StatTile';
import { Pagination } from '../../components/listingStudio/ui/Pagination';
import {
  BTN_PRIMARY,
  BTN,
  BTN_DANGER,
  PAGE_HEAD,
  PAGE_TITLE,
  CARD_TITLE,
  MUTED,
  GRID_CARDS,
  PROJECT_CARD,
  THUMB_LG,
  THUMB_LG_PLACEHOLDER,
  SKELETON_BLOCK,
  EMPTY_STATE,
  FIELD_INPUT,
  BADGE,
  STAT_TILES_GRID,
} from '../../components/listingStudio/ui/classNames';

const PAGE_SIZE = 20;

/**
 * The one campaigns list, for every role. Admin/RM see their own tenant's campaigns and can
 * create/rename/delete them. SuperAdmin/SBM (no tenant of their own — see
 * CROSS_TENANT_LISTING_STUDIO_ROLES in App.jsx) see the same list across every tenant, but
 * read-only: no create/rename/delete, a tenant badge on each card, and a total-count tile.
 * There used to be a second, near-identical "Campaign History" page just for that read-only
 * view — merged in here instead, since splitting one list into two pages showing the same
 * data was the actual bug users were hitting, not anything about which page loaded when.
 */
export default function ProjectsPage() {
  const { user, isImpersonating } = useAuth();
  const isCrossTenant = (user?.role === 'SuperAdmin' || user?.role === 'SBM') && !isImpersonating;
  const [error, setError] = useState('');
  const [tenantIdSearch, setTenantIdSearch] = useState('');
  const [showTenantDropdown, setShowTenantDropdown] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [deletingId, setDeletingId] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [nameSearch, setNameSearch] = useState('');
  const [debouncedNameSearch, setDebouncedNameSearch] = useState('');
  const optionRefs = useRef([]);
  const [page, setPage] = useState(1);
  const navigate = useNavigate();

  // Only tenants with a numeric tenantId assigned can be searched by it.
  const tenantOptionsRaw = useTenantOptions();
  const tenantOptions = tenantOptionsRaw.filter((t) => t.tenantId != null);
  const tenantById = new Map(tenantOptionsRaw.map((t) => [t.id, t]));
  const matchedTenant = tenantOptions.find((t) => String(t.tenantId) === tenantIdSearch.trim());
  const query = tenantIdSearch.trim().toLowerCase();
  const filteredTenantOptions = query
    ? tenantOptions.filter((t) => String(t.tenantId).includes(query) || t.name.toLowerCase().includes(query))
    : tenantOptions;

  useEffect(() => {
    const t = setTimeout(() => setDebouncedNameSearch(nameSearch.trim()), 300);
    return () => clearTimeout(t);
  }, [nameSearch]);

  // Back to page 1 whenever the filters change — adjusted during render (not in an effect)
  // so the hook never fires a wasted fetch for "new filters, old page" first.
  const filterKey = `${matchedTenant?.id ?? ''}|${debouncedNameSearch}`;
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey);
  if (filterKey !== prevFilterKey) {
    setPrevFilterKey(filterKey);
    setPage(1);
  }

  const {
    projects,
    setProjects,
    pagination,
    reload,
    error: fetchError,
  } = usePaginatedProjects({ tenantId: matchedTenant?.id, page, limit: PAGE_SIZE, q: debouncedNameSearch || undefined });
  const searchActive = debouncedNameSearch.length > 0;

  useEffect(() => {
    if (fetchError) setError(fetchError);
  }, [fetchError]);

  useEffect(() => {
    setHighlightedIndex(-1);
  }, [tenantIdSearch, showTenantDropdown]);

  useEffect(() => {
    optionRefs.current[highlightedIndex]?.scrollIntoView({ block: 'nearest' });
  }, [highlightedIndex]);

  const requestDelete = (e, project) => {
    e.preventDefault();
    e.stopPropagation();
    setConfirmDelete(project);
  };

  const deleteProject = async () => {
    const project = confirmDelete;
    setConfirmDelete(null);
    setDeletingId(project.id);
    try {
      await listingStudioApi.deleteProject(project.id);
      // Refetch rather than filter locally, so the next page's first card slides up into
      // the gap; stepping back a page when this was the last card on the last page.
      if (projects.length === 1 && page > 1) setPage(page - 1);
      else reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingId(null);
    }
  };

  const startRename = (e, project) => {
    e.preventDefault();
    e.stopPropagation();
    setEditingId(project.id);
    setEditName(project.input.name);
  };

  const cancelRename = () => {
    setEditingId(null);
    setEditName('');
  };

  const commitRename = async (project) => {
    const name = editName.trim();
    if (!name || name === project.input.name) {
      cancelRename();
      return;
    }
    try {
      await listingStudioApi.renameProject(project.id, name);
      setProjects((prev) => prev.map((p) => (p.id === project.id ? { ...p, input: { ...p.input, name } } : p)));
    } catch (err) {
      setError(err.message);
    } finally {
      cancelRename();
    }
  };

  const selectTenant = (t) => {
    setTenantIdSearch(String(t.tenantId));
    setShowTenantDropdown(false);
  };

  const onTenantSearchKeyDown = (e) => {
    if (!showTenantDropdown || filteredTenantOptions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((i) => (i + 1) % filteredTenantOptions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((i) => (i <= 0 ? filteredTenantOptions.length - 1 : i - 1));
    } else if (e.key === 'Enter' && highlightedIndex >= 0) {
      e.preventDefault();
      selectTenant(filteredTenantOptions[highlightedIndex]);
    } else if (e.key === 'Escape') {
      setShowTenantDropdown(false);
    }
  };

  return (
    <div>
      <div className={PAGE_HEAD}>
        <div className="flex items-center gap-2">
          {isCrossTenant && (
            <span className="w-8 h-8 rounded-lg bg-brand-100 text-brand-600 grid place-items-center flex-shrink-0">
              <History size={16} />
            </span>
          )}
          <div>
            <h1 className={PAGE_TITLE}>Campaigns</h1>
            <p className={MUTED}>
              {isCrossTenant
                ? 'Every campaign run through the studio, across every tenant — read-only.'
                : "Every listing you've run through the studio."}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="relative w-[240px]">
            <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by name or ASIN…"
              value={nameSearch}
              onChange={(e) => setNameSearch(e.target.value)}
              className={`${FIELD_INPUT} w-full pl-8`}
            />
          </div>
          {!isCrossTenant && (
            <button className={`${BTN} gap-1.5`} onClick={() => navigate('/listing-studio/brandkits')}>
              <Palette size={16} /> Brandkits
            </button>
          )}
          {!isCrossTenant && (
            <button className={`${BTN_PRIMARY} gap-1.5`} onClick={() => navigate('/listing-studio/new')}>
              <Plus size={16} /> New campaign
            </button>
          )}
        </div>
      </div>

      {isCrossTenant && pagination && (
        <div className={`${STAT_TILES_GRID} mb-4`}>
          <StatTile tone="blue" value={pagination.total} label={searchActive || matchedTenant ? 'Matching campaigns' : 'Total campaigns'} />
        </div>
      )}

      {tenantOptions.length > 0 && (
        <div className="flex items-center gap-2.5 -mt-2 mb-4">
          <div className="relative w-[260px]">
            <input
              type="text"
              placeholder="Search by tenant ID…"
              value={tenantIdSearch}
              className={`${FIELD_INPUT} w-full pr-8`}
              onChange={(e) => {
                setTenantIdSearch(e.target.value);
                setShowTenantDropdown(true);
              }}
              onFocus={() => setShowTenantDropdown(true)}
              onBlur={() => setTimeout(() => setShowTenantDropdown(false), 120)}
              onKeyDown={onTenantSearchKeyDown}
            />
            <ChevronDown size={16} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
            {showTenantDropdown && filteredTenantOptions.length > 0 && (
              <div
                className="absolute top-[calc(100%+4px)] left-0 right-0 z-30 bg-white border border-slate-200 rounded-lg shadow-md max-h-[280px] overflow-y-auto p-1"
                onMouseDown={(e) => e.preventDefault()}
              >
                {filteredTenantOptions.map((t, i) => (
                  <button
                    key={t.id}
                    ref={(el) => (optionRefs.current[i] = el)}
                    type="button"
                    className={`flex items-baseline gap-2 w-full text-left px-2.5 py-2 rounded-md text-[13px] text-slate-900 ${
                      i === highlightedIndex ? 'bg-brand-50' : 'hover:bg-brand-50'
                    }`}
                    onMouseEnter={() => setHighlightedIndex(i)}
                    onClick={() => selectTenant(t)}
                  >
                    <span className="font-semibold text-brand-600 flex-shrink-0">#{t.tenantId}</span>
                    <span className="text-slate-500 overflow-hidden text-ellipsis whitespace-nowrap">{t.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          {tenantIdSearch && !matchedTenant && <p className="text-slate-500 text-xs">No tenant with that ID — showing all tenants.</p>}
          {matchedTenant && (
            <button type="button" className={BTN} onClick={() => setTenantIdSearch('')}>
              Clear ({matchedTenant.name})
            </button>
          )}
        </div>
      )}

      {error && <p className="text-red-600">{error}</p>}

      {!projects && !error && (
        <div className={GRID_CARDS}>
          {[0, 1, 2].map((i) => (
            <div key={i} className={SKELETON_BLOCK} />
          ))}
        </div>
      )}

      {projects?.length === 0 &&
        !searchActive &&
        (isCrossTenant ? (
          <div className={`${EMPTY_STATE} flex flex-col items-center gap-2`}>
            <Inbox size={28} className="text-slate-300" />
            <p>No campaigns yet across any tenant.</p>
          </div>
        ) : (
          <div className={EMPTY_STATE}>
            <h2 className="text-lg font-medium mb-2">Welcome</h2>
            <p>Start a campaign from an ASIN or your product details to get market research, A+ content, listing copy, and images.</p>
            <button className={BTN_PRIMARY} onClick={() => navigate('/listing-studio/new')}>
              Create your first campaign
            </button>
          </div>
        ))}

      {projects?.length === 0 && searchActive && (
        <div className={EMPTY_STATE}>
          <p>No campaigns match "{debouncedNameSearch}".</p>
        </div>
      )}

      <div className={GRID_CARDS}>
        {projects?.map((p) => {
          const tenant = isCrossTenant ? tenantById.get(p.tenantId) : null;
          return (
            <Link key={p.id} to={`/listing-studio/p/${p.id}`} className={`${PROJECT_CARD} group relative`}>
              {p.images[0] ? <img src={p.images[0]} alt="" className={THUMB_LG} /> : <div className={THUMB_LG_PLACEHOLDER} />}
              <div className="min-w-0 flex-1">
                {tenant && (
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className={`${BADGE} !mr-0`}>
                      #{tenant.tenantId} · {tenant.name}
                    </span>
                    {p.campaignNumber != null && <span className="text-xs font-semibold text-slate-700">Campaign #{p.campaignNumber}</span>}
                  </div>
                )}
                {editingId === p.id ? (
                  <input
                    autoFocus
                    value={editName}
                    maxLength={200}
                    className={`${FIELD_INPUT} text-sm py-1 w-full`}
                    onChange={(e) => setEditName(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => {
                      e.stopPropagation();
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        commitRename(p);
                      } else if (e.key === 'Escape') {
                        e.preventDefault();
                        cancelRename();
                      }
                    }}
                  />
                ) : (
                  <strong className="block truncate text-slate-900">{p.input.name}</strong>
                )}
                <div className="text-slate-500 text-xs flex items-center gap-1 flex-wrap mt-0.5">
                  {p.campaignNumber != null && !tenant && (
                    <>
                      <span className="font-semibold text-slate-700">#{p.campaignNumber}</span>
                      <span>·</span>
                    </>
                  )}
                  {p.sourceAsin && (
                    <>
                      <a
                        href={amazonUrl(p.sourceAsin, p.marketplace)}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 text-brand-600 hover:underline"
                      >
                        {p.sourceAsin} <ExternalLink size={11} />
                      </a>
                      <span>·</span>
                    </>
                  )}
                  {p.marketplace && (
                    <>
                      <span>{marketplaceCode(p.marketplace)}</span>
                      <span>·</span>
                    </>
                  )}
                  <span>{formatRelativeTime(p.createdAt)}</span>
                </div>
                <div className={`mt-2 text-sm font-medium ${campaignStatus(p).className}`}>{campaignStatus(p).label}</div>
              </div>
              {!isCrossTenant && (
                <div
                  className={`absolute bottom-3 right-3 flex gap-1.5 transition-opacity ${
                    editingId === p.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                  }`}
                >
                  {editingId === p.id ? (
                    <button
                      type="button"
                      title="Save name"
                      aria-label="Save name"
                      className="w-8 h-8 rounded-lg grid place-items-center text-slate-400 bg-white border border-slate-200 hover:text-emerald-600 hover:border-emerald-200 hover:bg-emerald-50"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        commitRename(p);
                      }}
                    >
                      <Check size={15} />
                    </button>
                  ) : (
                    <button
                      type="button"
                      title="Rename campaign"
                      aria-label="Rename campaign"
                      className="w-8 h-8 rounded-lg grid place-items-center text-slate-400 bg-white border border-slate-200 hover:text-brand-600 hover:border-brand-200 hover:bg-brand-50"
                      onClick={(e) => startRename(e, p)}
                    >
                      <Pencil size={15} />
                    </button>
                  )}
                  <button
                    type="button"
                    title="Delete campaign"
                    aria-label="Delete campaign"
                    className="w-8 h-8 rounded-lg grid place-items-center text-slate-400 bg-white border border-slate-200 hover:text-red-600 hover:border-red-200 hover:bg-red-50 disabled:opacity-50"
                    disabled={deletingId === p.id}
                    onClick={(e) => requestDelete(e, p)}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              )}
            </Link>
          );
        })}
      </div>

      <Pagination page={page} totalPages={pagination?.totalPages} onChange={setPage} />

      {confirmDelete && (
        <Modal onClose={() => setConfirmDelete(null)}>
          <h2 className={`${CARD_TITLE} mb-2`}>Delete campaign?</h2>
          <p className={`${MUTED} mb-4`}>
            &quot;{confirmDelete.input.name}&quot; and everything generated for it will be permanently deleted. This
            can&apos;t be undone.
          </p>
          <div className="flex justify-end gap-2">
            <button type="button" className={BTN} onClick={() => setConfirmDelete(null)}>
              Cancel
            </button>
            <button type="button" className={BTN_DANGER} onClick={deleteProject}>
              Delete
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
