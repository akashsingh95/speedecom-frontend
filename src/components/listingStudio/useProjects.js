import { useCallback, useEffect, useState } from 'react';
import { listingStudioApi } from './api';

/** `null` while loading, `[]` once loaded (even on error, so pages can render an empty
 *  state). Fetches every project, unpaginated — used by project pickers and the home
 *  page, which all need the full set rather than one page of it. */
export function useProjects() {
  const [projects, setProjects] = useState(null);
  useEffect(() => {
    listingStudioApi.listProjects().then(
      (data) => setProjects(data.projects),
      () => setProjects([]),
    );
  }, []);
  return projects;
}

/** Server-paginated, server-searched project list for MyProductsPage. `projects` is
 *  `null` while loading; `pagination` carries `{ total, page, limit, totalPages }`. */
export function usePaginatedProjects({ page, limit, q }) {
  const [state, setState] = useState({ projects: null, pagination: null });
  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, projects: null }));
    listingStudioApi.listProjects(undefined, { page, limit, q }).then(
      (data) => {
        if (!cancelled) setState(data);
      },
      () => {
        if (!cancelled) setState({ projects: [], pagination: null });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [page, limit, q]);
  return state;
}

/** Server-paginated, server-searched project list that accumulates pages instead of
 *  replacing them — page 1 loads like usePaginatedProjects, then loadMore() appends
 *  page 2, 3, ... onto `projects` for infinite-scroll consumers (ProjectsPage). Resets
 *  back to page 1 whenever `tenantId`/`limit`/`q` changes identity. */
export function useInfiniteProjects({ tenantId, limit = 20, q } = {}) {
  const [projects, setProjects] = useState(null);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setProjects(null);
    setPagination(null);
    setPage(1);
    setError(null);
    listingStudioApi.listProjects(tenantId, { page: 1, limit, q }).then(
      (data) => {
        if (cancelled) return;
        setProjects(data.projects);
        setPagination(data.pagination);
      },
      (e) => {
        if (cancelled) return;
        setProjects([]);
        setError(e.message);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [tenantId, limit, q]);

  const hasMore = !!pagination && page < pagination.totalPages;

  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore) return;
    const nextPage = page + 1;
    setLoadingMore(true);
    listingStudioApi.listProjects(tenantId, { page: nextPage, limit, q }).then(
      (data) => {
        setProjects((prev) => [...(prev ?? []), ...data.projects]);
        setPagination(data.pagination);
        setPage(nextPage);
        setLoadingMore(false);
      },
      (e) => {
        setError(e.message);
        setLoadingMore(false);
      },
    );
  }, [tenantId, limit, q, page, hasMore, loadingMore]);

  return { projects, setProjects, pagination, hasMore, loadingMore, loadMore, error };
}
