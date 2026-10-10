import React, { useState, useEffect, useCallback, useRef } from 'react';
import { RefreshCw, PackageCheck, Truck, Clock, Ban, CheckCircle2, Loader2, Search, X, Zap, AlertTriangle, Download, Check, Copy, ClipboardCheck, XCircle, History, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import api from '../api';
import DashboardLayout from '../components/DashboardLayout';
import MarketplaceAccountSelector from '../components/MarketplaceAccountSelector';
import DateRangePicker from '../components/DateRangePicker';

// Mirrors Meesho's own Orders tabs into our own table via a dedicated sync
// worker, plus real Accept/Cancel/Label actions against Meesho's live
// endpoints (see docs/meesho-manage-orders/PLAN.md §1.3 for the confirmed
// request shapes and their caveats — label download only supports 'forward'
// shipments without an existing label; the server enforces this, not just
// this page). Meesho-only for now.

const TABS = [
    { key: 'hold', label: 'On Hold', icon: Clock },
    { key: 'pending', label: 'Pending', icon: PackageCheck },
    { key: 'ready_to_ship', label: 'Ready to Ship', icon: Truck },
    { key: 'shipped', label: 'Shipped', icon: CheckCircle2 },
    { key: 'cancelled', label: 'Cancelled', icon: Ban },
];

const SLA_OPTIONS = [
    { value: '', label: 'All SLA' },
    { value: 'breached', label: 'Breached' },
    { value: 'breaching_soon', label: 'Breaching Soon' },
    { value: 'sla_others', label: 'On Track' },
];

const LABEL_POLL_MS = 3000;
const MAX_LABEL_POLL_ATTEMPTS = 20; // ~60s at LABEL_POLL_MS — real generations observed taking 30-40s
const SEARCH_DEBOUNCE_MS = 400;

const emptyFilters = { search: '', dateFrom: '', dateTo: '', isExpress: false, sellerDelay: false, slaStatus: '', labelDownloaded: '' };

// Meesho's own SLA pill colours — matches the panel exactly rather than
// showing sla_status as plain text.
const SLA_PILL_STYLES = {
    breached: 'bg-rose-50 text-rose-700 border-rose-200',
    breaching_soon: 'bg-amber-50 text-amber-700 border-amber-200',
    sla_others: 'bg-slate-100 text-slate-600 border-slate-200',
};
const SLA_PILL_LABELS = {
    breached: 'Breached',
    breaching_soon: 'Breaching Soon',
    sla_others: 'On Track',
};

const COURIER_STYLES = {
    'meesho logistics': 'bg-rose-50 text-rose-700 border-rose-200',
    'xpress bees':      'bg-orange-50 text-orange-700 border-orange-200',
    'shadowfax':        'bg-purple-50 text-purple-700 border-purple-200',
    'ecom express':     'bg-sky-50 text-sky-700 border-sky-200',
    'valmo':            'bg-teal-50 text-teal-700 border-teal-200',
    'ekart':            'bg-blue-50 text-blue-700 border-blue-200',
};
const getCourierStyle = (name) =>
    COURIER_STYLES[(name || '').toLowerCase()] || 'bg-slate-100 text-slate-600 border-slate-200';

const TAB_EMPTY = {
    hold:          { icon: Clock,        msg: 'No orders on hold right now.' },
    pending:       { icon: PackageCheck, msg: 'No pending orders — all caught up!' },
    ready_to_ship: { icon: Truck,        msg: 'No orders ready to ship yet.' },
    shipped:       { icon: CheckCircle2, msg: 'No shipped orders found.' },
    cancelled:     { icon: Ban,          msg: 'No cancelled orders.' },
};

const formatRelativeTime = (date) => {
    if (!date) return null;
    const diff = Math.floor((Date.now() - date.getTime()) / 1000);
    if (diff < 10) return 'just now';
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const ManageOrders = () => {
    const [marketplaces, setMarketplaces] = useState([]);
    const [selectedAccountId, setSelectedAccountId] = useState('');
    const [activeTab, setActiveTab] = useState('pending');
    const [orders, setOrders] = useState([]);
    const [counts, setCounts] = useState({ hold: 0, pending: 0, ready_to_ship: 0, shipped: 0, cancelled: 0 });
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const pageSize = 50;

    const [searchInput, setSearchInput] = useState('');
    const [filters, setFilters] = useState(emptyFilters);

    const [syncing, setSyncing] = useState(false);
    const [lastSyncedAt, setLastSyncedAt] = useState(null);
    const labelPollRef = useRef(null);

    // Accept/Cancel apply to the Pending tab, Label to Ready to Ship — one
    // selection set, scoped to whichever actionable tab is active.
    const [selectedSubOrders, setSelectedSubOrders] = useState(new Set());
    const [selectAllMode, setSelectAllMode] = useState(false); // true = all pages selected, not just current 50
    const [actionLoading, setActionLoading] = useState(false);

    const [bulkJob, setBulkJob] = useState(null); // { jobId, status, current, total, accepted, failed, action }
    const bulkPollRef = useRef(null);

    const isActionableTab = activeTab === 'pending' || activeTab === 'ready_to_ship';
    // Matches Meesho's own per-tab column set exactly (verified against the
    // real panel) — On Hold/Cancelled show neither of these, Shipped shows
    // only Delivery Partner, Pending/Ready to Ship show only Dispatch/SLA.
    const showDispatchSla = isActionableTab;
    const showDeliveryPartner = activeTab === 'shipped';

    const [confirmCancel, setConfirmCancel] = useState(null);
    const [copiedId, setCopiedId] = useState(null);
    const copyToClipboard = (text) => {
        if (navigator.clipboard) {
            navigator.clipboard.writeText(text).catch(() => legacyCopy(text));
        } else {
            legacyCopy(text);
        }
        setCopiedId(text);
        setTimeout(() => setCopiedId(null), 1500);
    };
    const legacyCopy = (text) => {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        try { document.execCommand('copy'); } catch { /* best-effort */ }
        document.body.removeChild(ta);
    };

    // Relative time ticker — re-renders the "last synced X ago" label every 30s.
    const [, setTick] = useState(0);
    useEffect(() => {
        const id = setInterval(() => setTick(t => t + 1), 30000);
        return () => clearInterval(id);
    }, []);

    // Hover-to-zoom preview for the product thumbnail — position:fixed so it
    // escapes the orders table's own overflow-auto clipping. Opens downward
    // by default, but flips above the row when there isn't enough viewport
    // space below (e.g. the last few rows of a long table).
    const HOVER_PREVIEW_HEIGHT = 300; // w-56 image (224px) + name/SKU text block, approx
    const [hoverPreview, setHoverPreview] = useState(null);
    const showHoverPreview = (e, order) => {
        if (!order.image) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const fitsBelow = window.innerHeight - rect.top - 40 >= HOVER_PREVIEW_HEIGHT + 12;
        const top = fitsBelow ? rect.top - 40 : rect.bottom + 40 - HOVER_PREVIEW_HEIGHT;
        setHoverPreview({
            image: order.image,
            name: order.product_name,
            sku: order.sku,
            top: Math.max(12, top),
            left: rect.right + 12,
        });
    };
    const hideHoverPreview = () => setHoverPreview(null);

    // Dispatch date filter — same dropdown-calendar picker as the Support
    // portal's Created At/Closed At filter, flipping above the button when
    // there isn't enough space below. Matches Support's own edge-case rule
    // too (verified live, not assumed): closing with an incomplete range
    // (no start, or a start with no end) defaults the whole range to
    // today-today rather than keeping a lone start date.
    const [dispatchDropdownOpen, setDispatchDropdownOpen] = useState(false);
    const dispatchFilterRef = useRef(null);
    const dispatchDropPosRef = useRef({ top: 0, left: 0 });
    const filtersRef = useRef(filters);
    useEffect(() => { filtersRef.current = filters; }, [filters]);
    useEffect(() => {
        const handleClick = (e) => {
            if (dispatchFilterRef.current && !dispatchFilterRef.current.contains(e.target)) {
                setDispatchDropdownOpen(false);
                const f = filtersRef.current;
                if (!f.dateFrom || !f.dateTo) {
                    const now = new Date();
                    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
                    setFilters((prev) => ({ ...prev, dateFrom: today, dateTo: today }));
                }
            }
        };
        if (dispatchDropdownOpen) document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [dispatchDropdownOpen]);

    // Manual label download history — last 10 seller-triggered label requests.
    // No popup: label is auto-ACK'd on the server when ready. Seller downloads
    // from this history panel whenever they choose.
    const [manualLabelHistory, setManualLabelHistory] = useState([]);
    const [manualLabelHistoryOpen, setManualLabelHistoryOpen] = useState(false);
    const [manualLabelHistoryLoading, setManualLabelHistoryLoading] = useState(false);

    const fetchManualLabelHistory = useCallback(async () => {
        if (!selectedAccountId) return;
        setManualLabelHistoryLoading(true);
        try {
            const { data } = await api.get('/meesho-sync/orders/manual-label-history', {
                params: { marketplaceId: selectedAccountId },
            });
            setManualLabelHistory(data?.history || []);
        } catch (err) {
            console.error('[ManageOrders] Failed to load manual label history:', err);
        } finally {
            setManualLabelHistoryLoading(false);
        }
    }, [selectedAccountId]);

    useEffect(() => { fetchManualLabelHistory(); }, [fetchManualLabelHistory]);

    // On mount/account change, resume any in-progress label poll that was interrupted
    // by navigation. Server auto-ACKs Meesho when it resolves — no popup shown.
    const resumePendingLabelPolls = useCallback(async () => {
        if (!selectedAccountId) return;
        try {
            const { data } = await api.get('/meesho-sync/orders/pending-label-downloads', {
                params: { marketplaceId: selectedAccountId },
            });
            const inProgress = (data?.downloads || []).filter(d => !d.label_url);
            if (inProgress.length > 0) {
                const newest = inProgress[inProgress.length - 1];
                pollLabelStatus(newest.request_id);
            }
        } catch (err) {
            console.error('[ManageOrders] Failed to check in-progress label polls:', err);
        }
    }, [selectedAccountId]);
    useEffect(() => { resumePendingLabelPolls(); }, [resumePendingLabelPolls]);

    // Nightly label gen — history panel + enable/disable toggle.
    const [labelGenRuns, setLabelGenRuns] = useState([]);
    const [autoLabelGenEnabled, setAutoLabelGenEnabled] = useState(false);
    const [labelGenLoading, setLabelGenLoading] = useState(false);
    const [labelGenToggling, setLabelGenToggling] = useState(false);
    const [labelGenModalOpen, setLabelGenModalOpen] = useState(false);

    const fetchLabelGenHistory = useCallback(async () => {
        if (!selectedAccountId) return;
        setLabelGenLoading(true);
        try {
            const { data } = await api.get('/meesho-sync/orders/label-gen-history', {
                params: { marketplaceId: selectedAccountId },
                skipErrorToast: true,
            });
            setLabelGenRuns(data?.runs || []);
        } catch (err) {
            console.error('[ManageOrders] Failed to load label gen history:', err);
        } finally {
            setLabelGenLoading(false);
        }
    }, [selectedAccountId]);

    // Fetch account's autoLabelGenEnabled state and history when account changes.
    useEffect(() => {
        if (!selectedAccountId) return;
        // Find autoLabelGenEnabled from the loaded marketplace list
        const meesho = marketplaces.find(m => m.key === 'Meesho');
        const acct = meesho?.accounts?.find(a => a._id === selectedAccountId);
        setAutoLabelGenEnabled(acct?.autoLabelGenEnabled ?? false);
        fetchLabelGenHistory();
    }, [selectedAccountId, marketplaces, fetchLabelGenHistory]);

    const handleToggleLabelGen = async () => {
        const next = !autoLabelGenEnabled;
        setLabelGenToggling(true);
        try {
            await api.patch(`/meesho-sync/accounts/${selectedAccountId}/label-gen`, { enabled: next });
            setAutoLabelGenEnabled(next);
            // Keep the in-memory marketplaces list in sync so switching accounts
            // and coming back doesn't revert the toggle from the stale cached value.
            setMarketplaces(prev => prev.map(m => ({
                ...m,
                accounts: m.accounts?.map(a =>
                    a._id === selectedAccountId ? { ...a, autoLabelGenEnabled: next } : a
                ),
            })));
            toast.success(`Nightly label generation ${next ? 'enabled' : 'disabled'}`);
        } catch (err) {
            console.error('[ManageOrders] Failed to toggle label gen:', err);
            toast.error('Could not update setting — please try again');
        } finally {
            setLabelGenToggling(false);
        }
    };

    // Meesho accounts only — this feature doesn't exist for the other three yet.
    useEffect(() => {
        (async () => {
            try {
                const { data } = await api.get('/marketplaces/filter-options?includeInactive=false');
                const meesho = (Array.isArray(data) ? data : []).find(m => m.key === 'Meesho');
                setMarketplaces(meesho ? [meesho] : []);
                if (meesho?.accounts?.length === 1) setSelectedAccountId(meesho.accounts[0]._id);
            } catch (err) {
                console.error('[ManageOrders] Failed to load marketplaces:', err);
                toast.error('Could not load connected Meesho accounts');
            }
        })();
    }, []);

    // Debounce the search box so we don't fire a request per keystroke.
    useEffect(() => {
        const timer = setTimeout(() => {
            setFilters(f => (f.search === searchInput ? f : { ...f, search: searchInput }));
        }, SEARCH_DEBOUNCE_MS);
        return () => clearTimeout(timer);
    }, [searchInput]);

    const fetchOrders = useCallback(async () => {
        if (!selectedAccountId) return;
        setLoading(true);
        try {
            const { data } = await api.get('/meesho-sync/orders', {
                params: {
                    marketplaceId: selectedAccountId,
                    status: activeTab,
                    page,
                    pageSize,
                    search: filters.search || undefined,
                    dateFrom: filters.dateFrom || undefined,
                    dateTo: filters.dateTo || undefined,
                    isExpress: filters.isExpress || undefined,
                    sellerDelay: filters.sellerDelay || undefined,
                    slaStatus: filters.slaStatus || undefined,
                    labelDownloaded: filters.labelDownloaded === '' ? undefined : filters.labelDownloaded === 'true',
                },
            });
            setOrders(data?.orders || []);
            setTotal(data?.total || 0);
            setCounts(data?.counts || counts);
        } catch (err) {
            console.error('[ManageOrders] Failed to load orders:', err);
            toast.error('Could not load orders');
        } finally {
            setLoading(false);
        }
    }, [selectedAccountId, activeTab, page, filters]);

    useEffect(() => { fetchOrders(); }, [fetchOrders]);
    useEffect(() => {
        setPage(1);
        setSelectedSubOrders(new Set());
        setSelectAllMode(false);
    }, [activeTab, selectedAccountId, filters]);

    const toggleSubOrder = (subOrderNum) => {
        setSelectedSubOrders(prev => {
            const next = new Set(prev);
            if (next.has(subOrderNum)) next.delete(subOrderNum); else next.add(subOrderNum);
            return next;
        });
    };
    const toggleSelectAllVisible = () => {
        const allSelected = orders.length > 0 && orders.every(o => selectedSubOrders.has(o.sub_order_num));
        if (allSelected) {
            setSelectedSubOrders(new Set());
            setSelectAllMode(false);
        } else {
            setSelectedSubOrders(new Set(orders.map(o => o.sub_order_num)));
            setSelectAllMode(false); // reset — user re-selects page manually, cross-page banner reappears
        }
    };

    /** Sends a real Accept/Cancel/Label request for one or more sub-orders.
     * Updates the visible rows immediately (optimistic) so bulk actions feel
     * instant, then reconciles with fetchOrders() either way — success picks
     * up the server's own re-read of Meesho's real state, failure rolls the
     * optimistic change back to whatever's actually true. Never trusts the
     * action call's own response body for state, only for success/failure. */
    const performAction = async (action, subOrderNums) => {
        if (!subOrderNums.length || actionLoading) return;
        setActionLoading(true);

        if (action === 'label') {
            setOrders(prev => prev.map(o => (subOrderNums.includes(o.sub_order_num) ? { ...o, label_downloaded: true } : o)));
        } else {
            setOrders(prev => prev.filter(o => !subOrderNums.includes(o.sub_order_num)));
        }

        try {
            const { data } = await api.post('/meesho-sync/orders/action', { marketplaceId: selectedAccountId, action, subOrderNums });
            const verb = action === 'accept' ? 'Accepted' : action === 'cancel' ? 'Cancelled' : 'Label requested for';
            toast.success(`${verb} ${subOrderNums.length} order${subOrderNums.length > 1 ? 's' : ''}`);
            if (action === 'label' && data?.requestId) {
                pollLabelStatus(data.requestId);
            }
            setSelectedSubOrders(new Set());
            fetchOrders();
        } catch (err) {
            console.error(`[ManageOrders] ${action} failed:`, err);
            toast.error(err.response?.data?.message || `Could not ${action} the selected order(s)`);
            fetchOrders(); // roll back the optimistic change to whatever's actually true
        } finally {
            setActionLoading(false);
        }
    };

    /** Completes the label flow our own action call only starts (see
     * PLAN.md §1.3): requestId in hand, poll our own /label-status endpoint —
     * which itself checks fetchLabelDownloadHistory then exchanges the
     * finished request for the real signed PDF URL via
     * updateGroupDownloadBackendFlag — until ready, then hand the seller a
     * real download link instead of leaving them to find it on Meesho's own
     * panel. */
    const stopLabelPolling = () => {
        if (labelPollRef.current) {
            clearInterval(labelPollRef.current);
            labelPollRef.current = null;
        }
    };
    const pollLabelStatus = (requestId) => {
        stopLabelPolling();
        let attempts = 0;
        labelPollRef.current = setInterval(async () => {
            attempts += 1;
            try {
                const { data } = await api.get('/meesho-sync/orders/label-status', {
                    params: { marketplaceId: selectedAccountId, requestId },
                });
                if (data?.status === 'ready' && data?.url) {
                    stopLabelPolling();
                    // Server auto-ACKs Meesho's popup when label is ready.
                    // Refresh history so the download link appears immediately.
                    fetchManualLabelHistory();
                    toast.success('Label ready — click Label History to download');
                } else if (data?.status === 'failed') {
                    stopLabelPolling();
                    // Meesho's own error_message is real but oddly worded out of
                    // context (e.g. "No penalty will be charged. Please try again
                    // later." reads like a billing warning — it's actually just
                    // reassurance that the failed attempt won't cost the seller a
                    // late-dispatch penalty). Wrap it with our own context instead
                    // of showing it bare, same treatment as the HTTP 423 message.
                    toast.error(
                        data.message
                            ? `Meesho couldn't generate this label right now (their message: "${data.message}"). Try clicking Label again.`
                            : "Meesho couldn't generate this label right now — try clicking Label again."
                    );
                } else if (attempts >= MAX_LABEL_POLL_ATTEMPTS) {
                    // Meesho's own label-history only ever showed us the single
                    // most recent request — if this one hasn't resolved by now,
                    // waiting longer risks it aging out of that window before we
                    // ever see it complete. Point the seller at Meesho directly
                    // rather than polling forever.
                    stopLabelPolling();
                    toast.error('Label is taking longer than expected — check the Ready to Ship tab on Meesho’s own panel directly.');
                }
                // else 'processing' — keep polling
            } catch (err) {
                console.error('[ManageOrders] Label status poll failed:', err);
            }
        }, LABEL_POLL_MS);
    };

    useEffect(() => () => { stopLabelPolling(); }, []);

    const stopBulkPoll = () => {
        if (bulkPollRef.current) { clearInterval(bulkPollRef.current); bulkPollRef.current = null; }
    };
    useEffect(() => () => stopBulkPoll(), []);

    const startBulkPoll = (jobId, action) => {
        stopBulkPoll();
        bulkPollRef.current = setInterval(async () => {
            try {
                const { data } = await api.get('/meesho-sync/orders/bulk-action-status', { params: { jobId } });
                setBulkJob(prev => ({ ...prev, ...data }));
                if (data.status === 'done' || data.status === 'error') {
                    stopBulkPoll();
                    setSelectedSubOrders(new Set());
                    setSelectAllMode(false);
                    if (data.status === 'done') {
                        const verb = action === 'accept' ? 'Accepted' : 'Cancelled';
                        toast.success(`${verb} ${data.accepted} order${data.accepted !== 1 ? 's' : ''}${data.failed > 0 ? ` · ${data.failed} failed` : ''}`);
                    } else {
                        toast.error(data.error || 'Bulk action failed — check logs');
                    }
                    fetchOrders();
                    setTimeout(() => setBulkJob(null), 3000);
                }
            } catch (err) {
                console.error('[ManageOrders] Bulk poll failed:', err);
            }
        }, 2000);
    };

    const performBulkAction = async (action) => {
        if (!selectedAccountId || bulkJob) return;
        try {
            const { data } = await api.post('/meesho-sync/orders/bulk-action', { marketplaceId: selectedAccountId, action });
            setBulkJob({ jobId: data.jobId, action, status: 'running', current: 0, total: data.total, accepted: 0, failed: 0 });
            startBulkPoll(data.jobId, action);
        } catch (err) {
            toast.error(err.response?.data?.message || `Could not start bulk ${action}`);
        }
    };

    // Fetches all actionable sub_order_nums for the given status and loads them
    // into selectedSubOrders — used by "Select all N" on Ready to Ship so the
    // existing performAction('label', ...) can send them all in one Meesho call.
    const [fetchingAllIds, setFetchingAllIds] = useState(false);
    const handleSelectAllIds = async (status) => {
        if (!selectedAccountId || fetchingAllIds) return;
        setFetchingAllIds(true);
        try {
            const params = { marketplaceId: selectedAccountId, status };
            // Pass the active label filter so the server returns only the IDs
            // actually visible to the seller, not the full unfiltered set.
            if (filters.labelDownloaded !== '') params.labelDownloaded = filters.labelDownloaded === 'true';
            const { data } = await api.get('/meesho-sync/orders/ids', { params });
            setSelectedSubOrders(new Set(data.subOrderNums));
            setSelectAllMode(true);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Could not load all order IDs — try again');
        } finally {
            setFetchingAllIds(false);
        }
    };

    const handleSync = async () => {
        if (!selectedAccountId || syncing) return;
        setSyncing(true);
        try {
            const { data } = await api.post('/meesho-sync/orders/sync', { marketplaceId: selectedAccountId }, { skipErrorToast: true });
            setLastSyncedAt(new Date());
            toast.success(data?.message || `Synced ${data?.rowCount || 0} orders`);
        } catch (err) {
            console.error('[ManageOrders] Sync failed:', err);
            toast.error(err.response?.data?.message || 'Could not sync orders');
        } finally {
            fetchOrders();
            setSyncing(false);
        }
    };

    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const hasActiveFilters = filters.search || filters.dateFrom || filters.dateTo
        || filters.isExpress || filters.sellerDelay || filters.slaStatus || filters.labelDownloaded;

    const clearFilters = () => {
        setSearchInput('');
        setFilters(emptyFilters);
    };

    return (
        <>
        <DashboardLayout>
            <div className="w-full flex flex-col h-full overflow-hidden bg-slate-50">
                <header className="bg-slate-50 backdrop-blur-md sticky top-0 z-10 px-8 py-3 flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-heading font-bold text-slate-800">Manage Orders</h2>
                        <p className="text-xs text-slate-500 mt-0.5">
                            {lastSyncedAt
                                ? <span>Last synced <span className="font-medium text-slate-700">{formatRelativeTime(lastSyncedAt)}</span></span>
                                : 'Mirrors your Meesho Orders tabs — click Sync to pull the latest'}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={handleSync}
                        disabled={!selectedAccountId || syncing}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-xs bg-brand-600 hover:bg-brand-700 text-white shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {syncing ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                        {syncing ? 'Syncing…' : 'Sync'}
                    </button>
                </header>

                <main className="flex-1 w-full flex flex-col overflow-hidden relative px-4 md:px-8 pb-6">
                    <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm mb-4 flex flex-wrap items-center gap-4">
                        <MarketplaceAccountSelector
                            marketplaces={marketplaces}
                            selectedMarketplaceKey="Meesho"
                            selectedAccountId={selectedAccountId}
                            onSelect={({ accountId }) => setSelectedAccountId(accountId)}
                        />
                    </div>

                    {!selectedAccountId ? (
                        <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-12 text-center text-sm text-slate-500">
                            Connect and select a Meesho account to see its orders.
                        </div>
                    ) : (
                        <>
                            <div className="flex gap-2 mb-4 overflow-x-auto">
                                {TABS.map(tab => (
                                    <button
                                        key={tab.key}
                                        type="button"
                                        onClick={() => setActiveTab(tab.key)}
                                        className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                                            activeTab === tab.key
                                                ? 'bg-brand-600 text-white shadow-sm'
                                                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                                        }`}
                                    >
                                        <tab.icon size={14} />
                                        {tab.label}
                                        <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] ${activeTab === tab.key ? 'bg-white/20' : 'bg-slate-100'}`}>
                                            {counts[tab.key] ?? 0}
                                        </span>
                                    </button>
                                ))}
                            </div>

                            <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm mb-4 flex flex-wrap items-center gap-3">
                                <div className="relative w-56 shrink-0">
                                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input
                                        type="text"
                                        value={searchInput}
                                        onChange={(e) => setSearchInput(e.target.value)}
                                        placeholder="Search order, sub-order, SKU or product name"
                                        className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                                    />
                                </div>

                                {/* Meesho's own filter bar varies per tab too — SLA/Dispatch/Express/
                                    Delayed only make sense where that column exists (Pending, Ready to
                                    Ship). On Hold/Shipped/Cancelled show none of these on the real
                                    panel (On Hold instead has an "Order Date" filter we don't capture
                                    yet — a separate gap, not silently built here). */}
                                {showDispatchSla && (
                                    <>
                                        <div className="relative" ref={dispatchFilterRef}>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    if (!dispatchDropdownOpen) {
                                                        const btn = dispatchFilterRef.current?.querySelector('button');
                                                        if (btn) {
                                                            const rect = btn.getBoundingClientRect();
                                                            const spaceBelow = window.innerHeight - rect.bottom;
                                                            const up = spaceBelow < 350;
                                                            dispatchDropPosRef.current = {
                                                                top: up ? rect.top - 8 : rect.bottom + 4,
                                                                left: rect.left,
                                                            };
                                                        }
                                                    }
                                                    setDispatchDropdownOpen(o => !o);
                                                }}
                                                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-semibold transition-colors ${
                                                    filters.dateFrom && filters.dateTo
                                                        ? 'bg-brand-50 text-brand-700 border-brand-200'
                                                        : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                                                }`}
                                            >
                                                <span className="whitespace-nowrap">
                                                    {filters.dateFrom && filters.dateTo
                                                        ? `Dispatch: ${filters.dateFrom} – ${filters.dateTo}`
                                                        : 'Dispatch'}
                                                </span>
                                                {filters.dateFrom && filters.dateTo ? (
                                                    <span
                                                        onClick={(e) => { e.stopPropagation(); setFilters(f => ({ ...f, dateFrom: '', dateTo: '' })); setDispatchDropdownOpen(false); }}
                                                        className="p-0.5 rounded hover:bg-brand-100 text-brand-400 hover:text-brand-600 shrink-0"
                                                    >✕</span>
                                                ) : null}
                                            </button>
                                            {dispatchDropdownOpen && (
                                                <div
                                                    className="bg-white border border-slate-200 rounded-lg shadow-lg p-2 min-w-[280px]"
                                                    style={{ position: 'fixed', top: dispatchDropPosRef.current.top, left: dispatchDropPosRef.current.left, zIndex: 9999 }}
                                                >
                                                    <DateRangePicker
                                                        startDate={filters.dateFrom}
                                                        endDate={filters.dateTo}
                                                        onChange={(v) => {
                                                            setFilters(f => ({ ...f, dateFrom: v.min, dateTo: v.max }));
                                                            if (v.max) setDispatchDropdownOpen(false);
                                                        }}
                                                        hideDisplayChip
                                                        maxDays={365}
                                                        allowFuture
                                                    />
                                                </div>
                                            )}
                                        </div>

                                        <select
                                            value={filters.slaStatus}
                                            onChange={(e) => setFilters(f => ({ ...f, slaStatus: e.target.value }))}
                                            className="px-2 py-2 rounded-lg border border-slate-200 text-xs text-slate-600"
                                        >
                                            {SLA_OPTIONS.map(opt => (
                                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                                            ))}
                                        </select>
                                    </>
                                )}

                                {activeTab === 'ready_to_ship' && (
                                    <select
                                        value={filters.labelDownloaded}
                                        onChange={(e) => setFilters(f => ({ ...f, labelDownloaded: e.target.value }))}
                                        className="px-2 py-2 rounded-lg border border-slate-200 text-xs text-slate-600"
                                    >
                                        <option value="">Label: All</option>
                                        <option value="true">Label: Downloaded</option>
                                        <option value="false">Label: Not Downloaded</option>
                                    </select>
                                )}

                                {showDispatchSla && (
                                    <>
                                        <button
                                            type="button"
                                            onClick={() => setFilters(f => ({ ...f, isExpress: !f.isExpress }))}
                                            className={`flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-semibold border transition-all ${
                                                filters.isExpress
                                                    ? 'bg-amber-50 border-amber-300 text-amber-700'
                                                    : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                                            }`}
                                        >
                                            <Zap size={13} /> Express
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => setFilters(f => ({ ...f, sellerDelay: !f.sellerDelay }))}
                                            className={`flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-semibold border transition-all ${
                                                filters.sellerDelay
                                                    ? 'bg-rose-50 border-rose-300 text-rose-700'
                                                    : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                                            }`}
                                        >
                                            <AlertTriangle size={13} /> Delayed
                                        </button>
                                    </>
                                )}

                                {hasActiveFilters && (
                                    <button
                                        type="button"
                                        onClick={clearFilters}
                                        className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-semibold text-slate-400 hover:text-slate-600"
                                    >
                                        <X size={13} /> Clear
                                    </button>
                                )}
                            </div>

                            {activeTab === 'ready_to_ship' && (
                                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between gap-4 px-4 py-2.5">
                                    {/* Left: feature identity */}
                                    <div className="flex items-center gap-2.5">
                                        <div className={`p-1.5 rounded-lg transition-colors ${autoLabelGenEnabled ? 'bg-brand-50' : 'bg-slate-100'}`}>
                                            <Zap size={13} className={autoLabelGenEnabled ? 'text-brand-600' : 'text-slate-400'} />
                                        </div>
                                        <div>
                                            <p className="text-xs font-semibold text-slate-700 leading-tight">Auto-generate Shipping Labels</p>
                                            <p className="text-[10px] text-slate-400 leading-tight mt-0.5">Runs every night at 2 AM IST for this account</p>
                                        </div>
                                    </div>

                                    {/* Right: history + toggle */}
                                    <div className="flex items-center gap-3">
                                        <button
                                            type="button"
                                            onClick={() => { setManualLabelHistoryOpen(true); fetchManualLabelHistory(); }}
                                            disabled={!selectedAccountId}
                                            className="flex items-center gap-1 text-[11px] font-medium text-slate-400 hover:text-brand-600 disabled:opacity-40 focus:outline-none transition-colors"
                                        >
                                            <Download size={12} />
                                            Label History
                                            {manualLabelHistory.filter(d => d.label_url && !d.in_progress).length > 0 && (
                                                <span className="px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[10px] font-medium">{manualLabelHistory.filter(d => d.label_url).length}</span>
                                            )}
                                        </button>

                                        <div className="w-px h-4 bg-slate-200" />

                                        <button
                                            type="button"
                                            onClick={() => setLabelGenModalOpen(true)}
                                            disabled={!selectedAccountId}
                                            className="flex items-center gap-1 text-[11px] font-medium text-slate-400 hover:text-brand-600 disabled:opacity-40 focus:outline-none transition-colors"
                                        >
                                            <History size={12} />
                                            Nightly History
                                            {labelGenRuns.length > 0 && (
                                                <span className="px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[10px] font-medium">{labelGenRuns.length}</span>
                                            )}
                                        </button>

                                        <div className="w-px h-4 bg-slate-200" />

                                        <div className="flex items-center gap-1.5">
                                            <span className={`text-[10px] font-bold tracking-wide transition-colors ${autoLabelGenEnabled ? 'text-brand-600' : 'text-slate-400'}`}>
                                                {autoLabelGenEnabled ? 'ON' : 'OFF'}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={handleToggleLabelGen}
                                                disabled={labelGenToggling || !selectedAccountId}
                                                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50 ${autoLabelGenEnabled ? 'bg-brand-600' : 'bg-slate-300'}`}
                                                title={autoLabelGenEnabled ? 'Turn off nightly label generation' : 'Turn on nightly label generation — runs at 2 AM IST'}
                                            >
                                                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${autoLabelGenEnabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Cross-page select-all banner — appears when all visible orders on current
                                page are checked but there are more pages. Matches Meesho's own two-level
                                selection (page → all).
                                Pending: selectAllMode flag → background job (performBulkAction)
                                Ready to Ship: fetches all IDs into selectedSubOrders → existing label flow */}
                            {isActionableTab && !bulkJob && orders.length > 0 && orders.every(o => selectedSubOrders.has(o.sub_order_num)) && total > pageSize && (
                                <div className="bg-brand-50 border border-brand-200 rounded-xl px-4 py-2.5 mb-3 flex items-center justify-between gap-4">
                                    {selectAllMode ? (
                                        <>
                                            <span className="text-xs text-brand-700 font-medium">
                                                All <strong>{selectedSubOrders.size}</strong> {activeTab === 'pending' ? 'pending' : 'ready-to-ship'} orders selected.
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => { setSelectAllMode(false); setSelectedSubOrders(new Set()); }}
                                                className="text-xs font-semibold text-brand-600 hover:text-brand-800 underline underline-offset-2"
                                            >Clear selection</button>
                                        </>
                                    ) : (
                                        <>
                                            <span className="text-xs text-brand-700">All <strong>{pageSize}</strong> orders on this page selected.</span>
                                            <button
                                                type="button"
                                                disabled={fetchingAllIds}
                                                onClick={() => {
                                                    if (activeTab === 'pending') {
                                                        setSelectAllMode(true);
                                                    } else {
                                                        handleSelectAllIds('ready_to_ship');
                                                    }
                                                }}
                                                className="flex items-center gap-1.5 text-xs font-semibold text-brand-600 hover:text-brand-800 underline underline-offset-2 whitespace-nowrap disabled:opacity-50"
                                            >
                                                {fetchingAllIds && <Loader2 size={11} className="animate-spin" />}
                                                Select all {total} {activeTab === 'pending' ? 'pending' : 'ready-to-ship'} orders
                                            </button>
                                        </>
                                    )}
                                </div>
                            )}

                            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex-1 overflow-auto">
                                {loading ? (
                                    <div className="flex items-center justify-center h-40 text-slate-400">
                                        <Loader2 size={20} className="animate-spin mr-2" /> Loading orders…
                                    </div>
                                ) : orders.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-40 text-slate-400 gap-2">
                                        {React.createElement(TAB_EMPTY[activeTab]?.icon || PackageCheck, { size: 28 })}
                                        <p className="text-sm">{hasActiveFilters ? 'No orders match these filters.' : (TAB_EMPTY[activeTab]?.msg || 'No orders in this tab yet — try Sync.')}</p>
                                    </div>
                                ) : (
                                    <table className="w-full text-sm">
                                        <thead className="bg-slate-50 text-slate-500 text-xs uppercase sticky top-0">
                                            <tr>
                                                {isActionableTab && (
                                                    <th className="text-left px-4 py-3 w-8">
                                                        <input
                                                            type="checkbox"
                                                            checked={orders.length > 0 && orders.every(o => selectedSubOrders.has(o.sub_order_num))}
                                                            onChange={toggleSelectAllVisible}
                                                            className="rounded border-slate-300"
                                                        />
                                                    </th>
                                                )}
                                                <th className="text-left px-4 py-3">Product</th>
                                                <th className="text-left px-4 py-3">Sub-order ID</th>
                                                <th className="text-left px-4 py-3">SKU ID</th>
                                                <th className="text-left px-4 py-3">Meesho ID</th>
                                                <th className="text-left px-4 py-3">Qty</th>
                                                <th className="text-left px-4 py-3">Size</th>
                                                {showDispatchSla && <th className="text-left px-4 py-3">Dispatch Date/SLA</th>}
                                                {showDeliveryPartner && <th className="text-left px-4 py-3">Delivery Partner</th>}
                                                {isActionableTab && <th className="text-left px-4 py-3">Action</th>}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {orders.map(order => (
                                                <tr key={order.sub_order_num} className="hover:bg-slate-50/60">
                                                    {isActionableTab && (
                                                        <td className="px-4 py-3">
                                                            <input
                                                                type="checkbox"
                                                                checked={selectedSubOrders.has(order.sub_order_num)}
                                                                onChange={() => toggleSubOrder(order.sub_order_num)}
                                                                className="rounded border-slate-300"
                                                            />
                                                        </td>
                                                    )}
                                                    <td className="px-4 py-3">
                                                        <div className="flex items-center gap-3">
                                                            {order.image ? (
                                                                <img
                                                                    src={order.image}
                                                                    alt={order.product_name || 'Product'}
                                                                    className="w-10 h-10 rounded-lg object-cover border border-slate-200 shrink-0 cursor-zoom-in"
                                                                    loading="lazy"
                                                                    onMouseEnter={(e) => showHoverPreview(e, order)}
                                                                    onMouseLeave={hideHoverPreview}
                                                                    onError={(e) => { e.target.style.visibility = 'hidden'; }}
                                                                />
                                                            ) : (
                                                                <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 shrink-0" />
                                                            )}
                                                            <div className="flex flex-col gap-0.5">
                                                                <span className="text-slate-700 font-medium leading-snug">{order.product_name || '—'}</span>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => copyToClipboard(order.order_num)}
                                                                    className="group flex items-center gap-1 text-[11px] text-slate-400 hover:text-brand-600 w-fit"
                                                                    title="Copy Order ID"
                                                                >
                                                                    Order ID: {order.order_num}
                                                                    <span className="opacity-0 group-hover:opacity-100">
                                                                        {copiedId === order.order_num
                                                                            ? <ClipboardCheck size={10} className="text-emerald-500" />
                                                                            : <Copy size={10} className="text-slate-400" />}
                                                                    </span>
                                                                </button>
                                                                {order.packet_id && (
                                                                    <span className="text-[11px] text-slate-400">Packet QR: {order.packet_id}</span>
                                                                )}
                                                                <div className="flex gap-1 mt-0.5">
                                                                    {order.is_express && (
                                                                        <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                                                                            <Zap size={9} /> Express
                                                                        </span>
                                                                    )}
                                                                    {order.seller_delay && !showDispatchSla && (
                                                                        <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                                                                            <AlertTriangle size={9} /> Delayed
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <button
                                                            type="button"
                                                            onClick={() => copyToClipboard(order.sub_order_num)}
                                                            className="group flex items-center gap-1.5 font-mono text-xs text-slate-700 hover:text-brand-600 transition-colors"
                                                            title="Copy sub-order ID"
                                                        >
                                                            {order.sub_order_num}
                                                            <span className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                                                {copiedId === order.sub_order_num
                                                                    ? <ClipboardCheck size={12} className="text-emerald-500" />
                                                                    : <Copy size={12} className="text-slate-400" />}
                                                            </span>
                                                        </button>
                                                    </td>
                                                    <td className="px-4 py-3 text-slate-500 text-xs">{order.sku || '—'}</td>
                                                    <td className="px-4 py-3 text-slate-500 text-xs">{order.meesho_id || '—'}</td>
                                                    <td className="px-4 py-3 text-slate-700">{order.quantity ?? '—'}</td>
                                                    <td className="px-4 py-3 text-slate-500 text-xs">{order.variation || '—'}</td>
                                                    {/* Meesho's own panel only shows this column on Pending and Ready to
                                                        Ship — the dispatch-deadline concept is moot once an order has
                                                        shipped or been cancelled (confirmed live: those rows still carry
                                                        a stale sla_status value, so this is a deliberate scoping, not an
                                                        oversight). Date and pill stacked in one cell, matching Meesho's
                                                        own combined "Dispatch Date/SLA" column exactly. */}
                                                    {showDispatchSla && (
                                                        <td className="px-4 py-3 text-xs">
                                                            <div className="flex flex-col items-start gap-1">
                                                                <span className="text-slate-500">{order.expected_dispatch_date || '—'}</span>
                                                                {order.auto_retrying_label ? (
                                                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-500">Auto-retrying label</span>
                                                                ) : (
                                                                    <>
                                                                        {order.seller_delay && (
                                                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold border bg-rose-50 text-rose-700 border-rose-200">Delayed</span>
                                                                        )}
                                                                        {order.sla_status && (
                                                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${SLA_PILL_STYLES[order.sla_status] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                                                                                {SLA_PILL_LABELS[order.sla_status] || order.sla_status}
                                                                            </span>
                                                                        )}
                                                                    </>
                                                                )}
                                                            </div>
                                                        </td>
                                                    )}
                                                    {showDeliveryPartner && (
                                                        <td className="px-4 py-3 text-xs">
                                                            {order.courier_name ? (
                                                                <span className={`flex items-center gap-1.5 w-fit px-2.5 py-1 rounded-full text-[11px] font-semibold border ${getCourierStyle(order.courier_name)}`}>
                                                                    <Truck size={11} />
                                                                    {order.courier_name}
                                                                </span>
                                                            ) : <span className="text-slate-400">—</span>}
                                                        </td>
                                                    )}
                                                    {activeTab === 'pending' && (
                                                        <td className="px-4 py-3">
                                                            <div className="flex gap-1.5">
                                                                <button
                                                                    type="button"
                                                                    disabled={actionLoading}
                                                                    onClick={() => performAction('accept', [order.sub_order_num])}
                                                                    className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-brand-600 hover:bg-brand-700 text-white disabled:opacity-50"
                                                                >
                                                                    {order.accept_cta_title || 'Accept'}
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    disabled={actionLoading}
                                                                    onClick={() => setConfirmCancel({ subOrderNums: [order.sub_order_num] })}
                                                                    className="px-2.5 py-1 rounded-lg text-[11px] font-semibold border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                                                                >
                                                                    {order.cancel_cta_title || 'Cancel'}
                                                                </button>
                                                            </div>
                                                        </td>
                                                    )}
                                                    {activeTab === 'ready_to_ship' && (
                                                        <td className="px-4 py-3">
                                                            <div className="flex flex-col items-start gap-1">
                                                                <button
                                                                    type="button"
                                                                    disabled={actionLoading}
                                                                    onClick={() => performAction('label', [order.sub_order_num])}
                                                                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-brand-600 hover:bg-brand-700 text-white disabled:opacity-50"
                                                                >
                                                                    <Download size={12} /> Label
                                                                </button>
                                                                {order.label_downloaded && (
                                                                    <>
                                                                        <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
                                                                            <Check size={13} /> Downloaded
                                                                        </span>
                                                                        {order.courier_name && (
                                                                            <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${getCourierStyle(order.courier_name)}`}>
                                                                                <Truck size={10} />{order.courier_name}
                                                                            </span>
                                                                        )}
                                                                    </>
                                                                )}
                                                            </div>
                                                        </td>
                                                    )}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>

                            {hoverPreview && (
                                <div
                                    className="fixed z-50 w-56 bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden pointer-events-none"
                                    style={{ top: hoverPreview.top, left: hoverPreview.left }}
                                >
                                    <img src={hoverPreview.image} alt={hoverPreview.name || 'Product'} className="w-full h-56 object-cover" />
                                    <div className="px-3 py-2 border-t border-slate-100">
                                        <p className="text-xs font-semibold text-slate-700 line-clamp-2">{hoverPreview.name || 'Product'}</p>
                                        {hoverPreview.sku && <p className="text-[10px] text-slate-400 mt-0.5">{hoverPreview.sku}</p>}
                                    </div>
                                </div>
                            )}

                            {/* Manual label history modal — replaces the old blocking popup.
                                Server auto-ACKs Meesho's own popup on label ready, so the
                                seller is never blocked from navigating while waiting. */}
                            {manualLabelHistoryOpen && (
                                <div
                                    className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200"
                                    onClick={() => setManualLabelHistoryOpen(false)}
                                >
                                    <div
                                        className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in slide-in-from-bottom-4 duration-300"
                                        onClick={e => e.stopPropagation()}
                                    >
                                        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/50">
                                            <div>
                                                <h3 className="text-lg font-bold text-slate-800">Manual Label History</h3>
                                                <span className="text-[11px] text-slate-400 mt-0.5 block">Seller-triggered downloads · last 10</span>
                                            </div>
                                            <button onClick={() => setManualLabelHistoryOpen(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-500">
                                                <XCircle size={22} />
                                            </button>
                                        </div>
                                        <div className="p-5 overflow-y-auto space-y-2">
                                            {manualLabelHistoryLoading && (
                                                <div className="flex items-center justify-center py-12 text-slate-400">
                                                    <Loader2 size={20} className="animate-spin mr-2" /> Loading…
                                                </div>
                                            )}
                                            {!manualLabelHistoryLoading && manualLabelHistory.length === 0 && (
                                                <div className="text-center py-12 text-slate-400">
                                                    <Download size={28} className="mx-auto mb-2 opacity-50" />
                                                    <p className="text-sm font-medium">No label downloads yet</p>
                                                    <p className="text-xs mt-1">Select orders on the Ready to Ship tab and click Download Labels.</p>
                                                </div>
                                            )}
                                            {!manualLabelHistoryLoading && manualLabelHistory.map((d, idx) => {
                                                const subOrders = Array.isArray(d.sub_order_nums) ? d.sub_order_nums : JSON.parse(d.sub_order_nums || '[]');
                                                const requestedAt = new Date(d.created_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
                                                return (
                                                    <div key={d.request_id} className={`p-3 border rounded-xl flex items-start gap-3 animate-in fade-in slide-in-from-left-2 ${d.in_progress ? 'border-blue-200' : d.label_url ? 'border-slate-200' : 'border-rose-200'}`} style={{ animationDelay: `${idx * 30}ms` }}>
                                                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${d.in_progress ? 'bg-blue-50 text-blue-500' : d.label_url ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                                                            {d.in_progress ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                <span className="text-xs font-semibold text-slate-700">{subOrders.length} order{subOrders.length !== 1 ? 's' : ''}</span>
                                                                <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-full ${d.in_progress ? 'bg-blue-100 text-blue-700' : d.label_url ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                                                                    {d.in_progress ? 'Generating…' : d.label_url ? 'Ready' : 'Failed'}
                                                                </span>
                                                            </div>
                                                            <p className="text-[11px] text-slate-400 mt-0.5">{requestedAt}</p>
                                                        </div>
                                                        {d.label_url && (
                                                            <a href={d.label_url} target="_blank" rel="noopener noreferrer" className="shrink-0 self-center flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold rounded-md border border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-colors">
                                                                <Download size={12} /> Download
                                                            </a>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {confirmCancel && (
                                <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
                                    <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6">
                                        <h3 className="text-base font-bold text-slate-800 mb-2">
                                            {confirmCancel.bulkAll
                                                ? `Cancel all ${total} pending orders?`
                                                : `Cancel ${confirmCancel.subOrderNums.length > 1 ? `${confirmCancel.subOrderNums.length} orders` : 'order'}?`}
                                        </h3>
                                        <p className="text-xs text-slate-500 mb-5">
                                            You cannot reverse a cancelled order — this may mean a penalty charge for you.
                                        </p>
                                        <div className="flex justify-end gap-2">
                                            <button
                                                type="button"
                                                onClick={() => setConfirmCancel(null)}
                                                className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-500 hover:bg-slate-50"
                                            >
                                                Close
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const isBulk = confirmCancel.bulkAll;
                                                    setConfirmCancel(null);
                                                    if (isBulk) {
                                                        performBulkAction('cancel');
                                                    } else {
                                                        performAction('cancel', confirmCancel.subOrderNums);
                                                    }
                                                }}
                                                className="px-4 py-2 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white"
                                            >
                                                Cancel {confirmCancel.bulkAll ? 'All Orders' : `Order${confirmCancel.subOrderNums?.length > 1 ? 's' : ''}`}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Floating action bar — three states:
                                1. Bulk job running: progress bar, no action buttons
                                2. selectAllMode: shows "all N orders" + bulk Accept/Cancel
                                3. Normal selection: existing per-page accept/cancel/label */}
                            {bulkJob && (
                                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-slate-900 text-white rounded-xl shadow-2xl px-5 py-3 flex items-center gap-4 min-w-[320px]">
                                    <Loader2 size={15} className="animate-spin shrink-0 text-brand-400" />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-semibold leading-none mb-1.5">
                                            {bulkJob.status === 'done'
                                                ? `Done — ${bulkJob.accepted} ${bulkJob.action === 'accept' ? 'accepted' : 'cancelled'}${bulkJob.failed > 0 ? `, ${bulkJob.failed} failed` : ''}`
                                                : `${bulkJob.action === 'accept' ? 'Accepting' : 'Cancelling'} ${bulkJob.current}/${bulkJob.total} orders…`}
                                        </p>
                                        <div className="w-full bg-white/10 rounded-full h-1">
                                            <div
                                                className="bg-brand-400 h-1 rounded-full transition-all duration-500"
                                                style={{ width: `${bulkJob.total > 0 ? Math.round((bulkJob.current / bulkJob.total) * 100) : 0}%` }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {!bulkJob && isActionableTab && (selectedSubOrders.size > 0 || selectAllMode) && (
                                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-slate-900 text-white rounded-xl shadow-2xl px-5 py-3 flex items-center gap-4">
                                    <span className="text-xs font-semibold whitespace-nowrap">
                                        {selectedSubOrders.size} order{selectedSubOrders.size > 1 ? 's' : ''} selected
                                        {selectAllMode && activeTab === 'pending' && <span className="text-white/60 font-normal"> (all)</span>}
                                    </span>
                                    {activeTab === 'pending' ? (
                                        <>
                                            <button
                                                type="button"
                                                disabled={actionLoading}
                                                onClick={() => selectAllMode
                                                    ? performBulkAction('accept')
                                                    : performAction('accept', [...selectedSubOrders])
                                                }
                                                className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-brand-600 hover:bg-brand-700 disabled:opacity-50"
                                            >
                                                Accept {selectAllMode ? 'All' : 'Selected'}
                                            </button>
                                            <button
                                                type="button"
                                                disabled={actionLoading}
                                                onClick={() => selectAllMode
                                                    ? setConfirmCancel({ bulkAll: true })
                                                    : setConfirmCancel({ subOrderNums: [...selectedSubOrders] })
                                                }
                                                className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-white/10 hover:bg-white/20 disabled:opacity-50"
                                            >
                                                Cancel {selectAllMode ? 'All' : 'Selected'}
                                            </button>
                                        </>
                                    ) : (
                                        <button
                                            type="button"
                                            disabled={actionLoading}
                                            onClick={() => performAction('label', [...selectedSubOrders])}
                                            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold bg-brand-600 hover:bg-brand-700 disabled:opacity-50"
                                        >
                                            <Download size={13} /> Download Labels
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => { setSelectedSubOrders(new Set()); setSelectAllMode(false); }}
                                        className="text-white/60 hover:text-white text-xs"
                                    >
                                        <X size={16} />
                                    </button>
                                </div>
                            )}

                            {totalPages > 1 && (
                                <div className="flex items-center justify-between mt-3 text-xs text-slate-500">
                                    <span>Page {page} of {totalPages} · {total} total</span>
                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            disabled={page <= 1}
                                            onClick={() => setPage(p => Math.max(1, p - 1))}
                                            className="px-3 py-1.5 rounded-lg border border-slate-200 disabled:opacity-40"
                                        >
                                            Prev
                                        </button>
                                        <button
                                            type="button"
                                            disabled={page >= totalPages}
                                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                            className="px-3 py-1.5 rounded-lg border border-slate-200 disabled:opacity-40"
                                        >
                                            Next
                                        </button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </main>
            </div>
        </DashboardLayout>

        {/* Nightly Label Gen History Modal */}
        {labelGenModalOpen && (() => {
            const selectedAccount = marketplaces.find(m => m._id === selectedAccountId);
            const totalRuns = labelGenRuns.length;
            const completedRuns = labelGenRuns.filter(r => r.status === 'completed' && r.order_count > 0).length;
            const failedRuns = labelGenRuns.filter(r => r.status === 'failed').length;
            return (
                <div
                    className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200"
                    onClick={() => setLabelGenModalOpen(false)}
                >
                    <div
                        className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in slide-in-from-bottom-4 duration-300"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/50">
                            <div className="flex flex-col">
                                <h3 className="text-lg font-bold text-slate-800">Nightly Label History</h3>
                                {selectedAccount && (
                                    <span className="text-xs text-brand-600 font-medium mt-0.5">{selectedAccount.name}</span>
                                )}
                                <span className="text-[11px] text-slate-400 mt-0.5">Auto-generated at 2 AM IST · last 10 nights</span>
                            </div>
                            <button
                                onClick={() => setLabelGenModalOpen(false)}
                                className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-500"
                            >
                                <XCircle size={22} />
                            </button>
                        </div>

                        {/* Stats bar */}
                        {!labelGenLoading && labelGenRuns.length > 0 && (
                            <div className="grid grid-cols-3 divide-x divide-slate-100 border-b border-slate-100 bg-white">
                                <div className="flex flex-col items-center justify-center py-3">
                                    <span className="text-2xl font-bold text-slate-800 leading-none">{totalRuns}</span>
                                    <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mt-1">Total Nights</span>
                                </div>
                                <div className="flex flex-col items-center justify-center py-3">
                                    <span className="text-2xl font-bold text-emerald-600 leading-none">{completedRuns}</span>
                                    <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mt-1">Labels Ready</span>
                                </div>
                                <div className="flex flex-col items-center justify-center py-3">
                                    <span className={`text-2xl font-bold leading-none ${failedRuns > 0 ? 'text-rose-600' : 'text-slate-400'}`}>{failedRuns}</span>
                                    <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mt-1">Failed</span>
                                </div>
                            </div>
                        )}

                        {/* Run list */}
                        <div className="p-5 overflow-y-auto space-y-2">
                            {labelGenLoading && (
                                <div className="flex items-center justify-center py-12 text-slate-400">
                                    <Loader2 size={20} className="animate-spin mr-2" />
                                    Loading history…
                                </div>
                            )}

                            {!labelGenLoading && labelGenRuns.length === 0 && (
                                <div className="text-center py-12 text-slate-400">
                                    <History size={28} className="mx-auto mb-2 opacity-50" />
                                    <p className="text-sm font-medium">No nightly runs yet</p>
                                    <p className="text-xs mt-1">Enable the toggle and sync your orders before 2 PM IST for the first run tonight.</p>
                                </div>
                            )}

                            {!labelGenLoading && labelGenRuns.map((run, idx) => {
                                const isReady = run.status === 'completed' && run.order_count > 0;
                                const isNone = run.status === 'completed' && run.order_count === 0;
                                const isFailed = run.status === 'failed';
                                const isSkipped = run.status === 'skipped';
                                const isRunning = run.status === 'running' || run.status === 'queued';
                                const dateLabel = new Date(run.run_date + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
                                return (
                                    <div
                                        key={run.run_date}
                                        className={`p-3 bg-white border rounded-xl transition-colors animate-in fade-in slide-in-from-left-2 ${
                                            isFailed ? 'border-rose-200 hover:border-rose-300' :
                                            isRunning ? 'border-blue-200 hover:border-blue-300' :
                                            'border-slate-200 hover:border-slate-300'
                                        }`}
                                        style={{ animationDelay: `${idx * 30}ms` }}
                                    >
                                        <div className="flex items-start gap-3">
                                            <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                                                isFailed ? 'bg-rose-50 text-rose-600' :
                                                isReady ? 'bg-emerald-50 text-emerald-600' :
                                                isRunning ? 'bg-blue-50 text-blue-600' :
                                                isSkipped ? 'bg-amber-50 text-amber-600' :
                                                'bg-slate-50 text-slate-400'
                                            }`}>
                                                <Download size={16} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="font-semibold text-sm text-slate-800">{dateLabel}</span>
                                                    <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-full tracking-wide inline-flex items-center gap-1 ${
                                                        isFailed ? 'bg-rose-100 text-rose-700' :
                                                        isReady ? 'bg-emerald-100 text-emerald-700' :
                                                        isRunning ? 'bg-blue-100 text-blue-700' :
                                                        isSkipped ? 'bg-amber-100 text-amber-700' :
                                                        'bg-slate-100 text-slate-500'
                                                    }`}>
                                                        {isFailed && <XCircle size={10} />}
                                                        {isReady && <Check size={10} />}
                                                        {isRunning && <Loader2 size={10} className="animate-spin" />}
                                                        {isSkipped && <AlertCircle size={10} />}
                                                        {isNone && <Check size={10} />}
                                                        {isFailed ? 'Failed' : isReady ? 'Ready' : isRunning ? (run.status === 'queued' ? 'Queued' : 'Running') : isSkipped ? 'Skipped' : 'No Orders'}
                                                    </span>
                                                </div>
                                                {isReady && (
                                                    <p className="text-[11px] text-slate-500 mt-0.5">{run.order_count} order{run.order_count !== 1 ? 's' : ''} labeled</p>
                                                )}
                                                {run.completed_at && (
                                                    <p className="text-[11px] text-slate-400 mt-0.5">
                                                        {new Date(run.completed_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}
                                                    </p>
                                                )}
                                                {(isFailed || isSkipped) && run.error_message && (
                                                    <p className="text-[11px] text-rose-600 mt-1 leading-relaxed">{run.error_message}</p>
                                                )}
                                            </div>
                                            {run.label_url && (
                                                <a
                                                    href={run.label_url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="shrink-0 self-center inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold rounded-md border border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-colors"
                                                >
                                                    <Download size={12} /> Download
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            );
        })()}
        </>
    );
};

export default ManageOrders;
