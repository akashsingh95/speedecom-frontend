import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import api from '../../../api';

const POLL_MS = 5000;
const MAX_POLLS = 72; // 6 minutes max (background sync usually finishes in <30s)

// Calls POST /returns/claims/sync (per-ticket API sync, 202 fire-and-forget) then
// polls GET /returns/claims until last_synced_at advances, signalling completion.
const useClaimsSync = ({ onSynced } = {}) => {
    const [progress, setProgress] = useState({}); // marketplaceId → progress text
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

        let snapshotSyncedAt = null;
        try {
            // Capture current last_synced_at so we know when the sync completes
            const { data: before } = await api.get('/returns/claims', {
                params: { marketplaceIds: JSON.stringify([marketplaceId]), page: 1, limit: 1 },
                skipErrorToast: true,
            });
            snapshotSyncedAt = before?.stats?.last_synced_at ?? null;
        } catch {
            // proceed without snapshot — we'll just poll a fixed number of times
        }

        try {
            const { data } = await api.post('/returns/claims/sync', { marketplaceId }, { skipErrorToast: true });
            if (data?.synced === 0) {
                stop(marketplaceId);
                toast.info('No open claims to sync', { description: accountName });
                return;
            }
            toast.info('Sync started', { description: `${accountName} — statuses will update shortly.` });
            setProgress(prev => ({ ...prev, [marketplaceId]: 'Syncing…' }));
        } catch (err) {
            stop(marketplaceId);
            toast.error('Could not start sync', { description: err.response?.data?.message || accountName });
            return;
        }

        let polls = 0;
        pollers.current[marketplaceId] = setInterval(async () => {
            polls += 1;
            if (polls > MAX_POLLS) {
                stop(marketplaceId);
                toast.info('Sync is still running in the background', { description: accountName });
                return;
            }
            try {
                const { data: after } = await api.get('/returns/claims', {
                    params: { marketplaceIds: JSON.stringify([marketplaceId]), page: 1, limit: 1 },
                    skipErrorToast: true,
                });
                const newSyncedAt = after?.stats?.last_synced_at ?? null;
                const done = newSyncedAt && newSyncedAt !== snapshotSyncedAt;
                if (!done && polls <= 3) return; // give it a few polls before declaring done
                if (!done) return;

                stop(marketplaceId);
                toast.success('Claims synced', { description: `${accountName} — latest statuses loaded.` });
                onSyncedRef.current?.(marketplaceId);
            } catch {
                if (polls > MAX_POLLS) stop(marketplaceId);
            }
        }, POLL_MS);
    }, [progress]);

    return { progress, startSync, isSyncing: (id) => progress[id] !== undefined };
};

export default useClaimsSync;
