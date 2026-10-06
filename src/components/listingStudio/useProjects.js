import { useCallback, useEffect, useState } from 'react';
import { listingStudioApi } from './api';

/** Server-paginated, server-searched project list (Campaigns, My Products, Home's recent
 *  campaigns). `projects` is `null` while loading, `[]` once loaded (even on error, so pages
 *  can render an empty state); `pagination` carries `{ total, page, limit, totalPages }`.
 *  `setProjects` lets a caller patch the current page optimistically (e.g. a rename), and
 *  `reload()` refetches it when the page's contents actually shift (e.g. a delete). */
export function usePaginatedProjects({ tenantId, page, limit, q }) {
  const [state, setState] = useState({ projects: null, pagination: null, error: null });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, projects: null, error: null }));
    listingStudioApi.listProjects(tenantId, { page, limit, q }).then(
      (data) => {
        if (!cancelled) setState({ projects: data.projects, pagination: data.pagination, error: null });
      },
      (e) => {
        if (!cancelled) setState({ projects: [], pagination: null, error: e.message });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [tenantId, page, limit, q, reloadKey]);

  const setProjects = useCallback(
    (updater) => setState((s) => ({ ...s, projects: typeof updater === 'function' ? updater(s.projects) : updater })),
    [],
  );
  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  return { ...state, setProjects, reload };
}
