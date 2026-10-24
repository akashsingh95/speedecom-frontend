import { useEffect, useState } from 'react';
import api from '../../api';
import { useAuth } from '../../AuthContext';

// Replaces speed-listing's own auth.ts (postMessage-relayed tenant list). speedecom's
// AuthContext doesn't cache this list itself, so this mirrors exactly what the old
// ListingStudio.jsx iframe wrapper used to do: fetch it directly for cross-tenant roles.
const CROSS_TENANT_ROLES = ['SuperAdmin', 'SBM', 'RM'];

// Module-level cache so revisiting the page doesn't re-fetch every approved tenant.
// Keyed by user — an RM's list is only their assigned tenants, so it can't be shared
// across a logout/login. A new tenant shows up after CACHE_TTL_MS at the latest.
const CACHE_TTL_MS = 5 * 60 * 1000;
let cache = null; // { key, fetchedAt, promise }

function fetchTenantOptions(key) {
  if (cache && cache.key === key && Date.now() - cache.fetchedAt < CACHE_TTL_MS) return cache.promise;
  const promise = api.get('/auth/tenants/picker').then((res) => res.data || []);
  cache = { key, fetchedAt: Date.now(), promise };
  // Don't keep a failed request around — the next mount should retry.
  promise.catch(() => {
    if (cache?.promise === promise) cache = null;
  });
  return promise;
}

/** Populated only for SuperAdmin/SBM/RM — the tenants they can flip between; empty for a regular tenant user. */
export function useTenantOptions() {
  const { user } = useAuth();
  const [tenantOptions, setTenantOptions] = useState([]);
  const cacheKey = CROSS_TENANT_ROLES.includes(user?.role) ? `${user?._id}:${user.role}` : null;

  useEffect(() => {
    if (!cacheKey) {
      setTenantOptions([]);
      return undefined;
    }
    let cancelled = false;
    fetchTenantOptions(cacheKey)
      .then((options) => {
        if (!cancelled) setTenantOptions(options);
      })
      .catch(() => {
        if (!cancelled) setTenantOptions([]);
      });
    return () => {
      cancelled = true;
    };
  }, [cacheKey]);

  return tenantOptions;
}
