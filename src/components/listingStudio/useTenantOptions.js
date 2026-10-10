import { useEffect, useState } from 'react';
import api from '../../api';
import { useAuth } from '../../AuthContext';

// Replaces speed-listing's own auth.ts (postMessage-relayed tenant list). speedecom's
// AuthContext doesn't cache this list itself, so this mirrors exactly what the old
// ListingStudio.jsx iframe wrapper used to do: fetch it directly for cross-tenant roles.
const CROSS_TENANT_ROLES = ['SuperAdmin', 'SBM', 'RM'];

/** Populated only for SuperAdmin/SBM/RM — the tenants they can flip between; empty for a regular tenant user. */
export function useTenantOptions() {
  const { user } = useAuth();
  const [tenantOptions, setTenantOptions] = useState([]);

  useEffect(() => {
    if (!CROSS_TENANT_ROLES.includes(user?.role)) {
      setTenantOptions([]);
      return undefined;
    }
    let cancelled = false;
    api
      .get('/auth/tenants/picker')
      .then((res) => {
        if (!cancelled) setTenantOptions(res.data || []);
      })
      .catch(() => {
        if (!cancelled) setTenantOptions([]);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.role]);

  return tenantOptions;
}
