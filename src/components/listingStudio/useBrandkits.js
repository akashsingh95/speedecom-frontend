import { useCallback, useEffect, useState } from 'react';
import { brandkitApi } from './brandkitApi';

/**
 * Fetch-all Brandkit list, mirroring usePaginatedProjects()'s loading convention — `null` while loading, `[]` once
 * loaded (even on error, so callers can render an empty state). Unlike the paginated project
 * hooks, this never pages: Brandkit counts per tenant are expected to be small. Exposes
 * `setBrandkits` so callers (BrandkitsPage, BrandkitSelect's quick-create) can optimistically
 * patch the list after a create/update/delete instead of refetching, and `refresh()` for the
 * rare case that isn't enough.
 */
export function useBrandkits() {
  const [brandkits, setBrandkits] = useState(null);

  const refresh = useCallback(
    () =>
      brandkitApi.listBrandkits().then(
        (data) => setBrandkits(data.brandkits),
        () => setBrandkits([]),
      ),
    [],
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { brandkits, setBrandkits, refresh };
}
