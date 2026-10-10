import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import api from '../../../api';

const SYNC_POLL_MS = 5000;
const SYNC_MAX_POLLS = 420; // ~35 min, same window MarketplaceSettings uses for single-file syncs

// Runs the existing claims-only Meesho sync (same endpoint, queue and weekly-cycle
// rules as Settings → Sync → Claims) and polls it until it settles.
const useClaimsSync = ({ onSynced } = {}) => {
    const [progress, setProgress] = useState({}); // marketplaceId -> progress text
    const pollers = useRef({});
    const onSyncedRef = useRef(onSynced);
    onSyncedRef.current = onSynced;

    useEffect(() => () => { Object.values(pollers.current).forEach(clearInterval); }, []);

    const stop = (id) => {
        clearInterval(pollers.current[id]);
        delete pollers.current[id];
        setProgress(prev => { const next = { ...prev }; delete next[id]; return next; });
    };

    const startSync = useCallback(async (marketplaceId, accountName = 'Account') => {
        if (pollers.current[marketplaceId] || progress[marketplaceId] !== undefined) return;
        setProgress(prev => ({ ...prev, [marketplaceId]: 'Starting…' }));
        try {
            const { data } = await api.post('/meesho-sync/trigger-claims', { marketplaceId }, { skipErrorToast: true });
            if (data?.skipped) {
                stop(marketplaceId);
                toast.warning(data.message || data.reason || 'Claims sync skipped', { description: accountName });
                return;
            }
            toast.info('Claims sync started', { description: `${accountName} — statuses update when it finishes.` });
        } catch (err) {
            stop(marketplaceId);
            toast.error('Could not start claims sync', { description: err.response?.data?.message || accountName });
            return;
        }

        let polls = 0;
        pollers.current[marketplaceId] = setInterval(async () => {
            polls += 1;
            if (polls > SYNC_MAX_POLLS) {
                stop(marketplaceId);
                toast.info('Claims sync is still running in the background', { description: accountName });
                return;
            }
            try {
                const { data: prog } = await api.get('/meesho-sync/sync-progress', { params: { marketplaceId }, skipErrorToast: true });
                const ds = prog?.datasets?.claims;
                if (ds?.progressMessage || ds?.queued) {
                    setProgress(prev => ({ ...prev, [marketplaceId]: ds.progressMessage || 'Queued…' }));
                    return;
                }
                if (polls <= 3) return;
                stop(marketplaceId);
                if (ds?.status === 'failed' || ds?.status === 'validation_failed') {
                    toast.error('Claims sync failed', { description: ds.errorMessage || accountName });
                } else {
                    toast.success('Claims synced', { description: `${accountName} — latest statuses loaded.` });
                    onSyncedRef.current?.(marketplaceId);
                }
            } catch {
                stop(marketplaceId);
            }
        }, SYNC_POLL_MS);
    }, [progress]);

    return { progress, startSync, isSyncing: (id) => progress[id] !== undefined };
};

export default useClaimsSync;
