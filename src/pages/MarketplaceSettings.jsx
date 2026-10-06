import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { Loader2, X, CheckCircle, XCircle, ShoppingBag, Plus, Eye as EyeIcon, Trash2, Edit, Mail, Smartphone, Link as LinkIcon, Eye, EyeOff, ShieldCheck, RefreshCw, ArrowLeft, Package, CreditCard, RotateCcw, Shield, History, AlertCircle, Clock, CalendarClock } from 'lucide-react';
import { toast } from 'sonner';
import api from '../api';
import { useAuth } from '../AuthContext';
import ConnectMarketplaceModal from '../components/ConnectMarketplaceModal';
import ChangeAnalysisDateModal from '../components/ChangeAnalysisDateModal';
import Tooltip from '../components/Tooltip';
import SuccessToast from '../components/SuccessToast';
import DateRangePicker from '../components/DateRangePicker';
import forge from 'node-forge';
import { getFriendlySyncErrorMessage } from '../utils/meeshoSyncErrorMessages';
const base = import.meta.env.BASE_URL;

// Must match server/utils/meeshoSyncPlanner.js's MEESHO_SYNC_LAG_DAYS (default 2).
const SYNC_LAG_DAYS = 2;

// Mirrors MeeshoSyncIndicator.jsx's monthLabel().
const SYNC_MONTH_FMT = new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' });
const syncMonthLabel = (dateMin, dateMax) => {
    if (!dateMin && !dateMax) return null;
    const min = dateMin ? new Date(`${dateMin}T00:00:00Z`) : null;
    const max = dateMax ? new Date(`${dateMax}T00:00:00Z`) : min;
    const from = min || max;
    const to = max || min;
    if (!from || Number.isNaN(from.getTime())) return null;
    const a = SYNC_MONTH_FMT.format(from);
    const b = SYNC_MONTH_FMT.format(to);
    return a === b ? a : `${a} – ${b}`;
};

// --- STATIC ASSETS ---
const LOGOS = {
    'Flipkart Ads': `${base}assets/flipkart_ads.jpeg`,
    'Amazon': `${base}assets/amazonsmall.svg`,
    'Flipkart': `${base}assets/flipkart.svg`,
    'Myntra': `${base}assets/myntra.png`,
    'Meesho': `${base}assets/meesho.png`,
    'JioMart': `${base}assets/JioMart.png`,
    'Ajio': `${base}assets/ajio.png`,
    'Tata': `${base}assets/Tata_Cliq.png`,
    'Nykaa': `${base}assets/NykaaLarge.svg`,
    'Snapdeal': `${base}assets/snapdeal.png`,
    'Cred': `${base}assets/cred.png`,
    'FirstCry': `${base}assets/firstcry.svg`,
    'Shopify': `${base}assets/shopify.svg`,
    'Pepperfry': `${base}assets/pepprfry.png`,
    'Easycom': `${base}assets/easycom.png`
};

// Helper: Get Logo URL (A helper function that tries to find the correct logo)
const getLogoUrl = (name) => {
    if (LOGOS[name]) return LOGOS[name];
    const key = Object.keys(LOGOS)
        .sort((a, b) => b.length - a.length)
        .find(k => name.toLowerCase().includes(k.toLowerCase()));

    return key ? LOGOS[key] : null;
};

// --- SUB-COMPONENTS ---

const MarketplaceLogo = React.memo(({ name }) => {
    const [imgError, setImgError] = useState(false);
    const logoUrl = useMemo(() => getLogoUrl(name), [name]);

    if (!logoUrl || imgError) {
        return (
            <div className="w-24 h-16 flex items-center justify-center mb-4">
                <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center">
                    <ShoppingBag className="text-slate-600" size={24} />
                </div>
            </div>
        );
    }

    return (
        <div className="w-24 h-16 flex items-center justify-center mb-4 p-2">
            <img
                src={logoUrl}
                alt={name}
                className="w-full h-full object-contain"
                onError={() => setImgError(true)}
            />
        </div>
    );
});

const MarketplaceCard = React.memo(({ m, onConnect, onSeeAccounts, isImpersonating }) => {
    const activeAccounts = m.accounts ? m.accounts.filter(a => a.status !== 'inactive' && a.authStatus !== 'invalid') : [];
    const accountCount = activeAccounts.length;
    const isConnected = m.status === 'active' && accountCount > 0;
    const isUpcoming = m.upcoming;

    return (
        <div className={`bg-white rounded-2xl border border-slate-200 p-6 flex flex-col items-center text-center transition-all duration-300 relative group ${isUpcoming ? 'opacity-70' : 'hover:shadow-card-hover hover:scale-105'}`}>
            <MarketplaceLogo name={m.name} />
            <h3 className="font-bold text-slate-800 mb-1">{m.name}</h3>

            <div className="mb-5 h-5">
                {isUpcoming ? (
                    <span className="text-xs font-bold text-brand-600 bg-brand-50 px-3 py-1 rounded-full">Coming Soon</span>
                ) : isConnected ? (
                    <div className="flex items-center gap-1.5 justify-center bg-emerald-50 px-3 py-1 rounded-full animate-in fade-in duration-300">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                        <span className="text-xs font-bold text-emerald-700">{accountCount} Connected</span>
                    </div>
                ) : (
                    <span className="text-xs text-slate-400">Not Connected</span>
                )}
            </div>

            <div className="w-full space-y-2">
                {isUpcoming ? (
                    <button
                        disabled
                        className="w-full py-2.5 bg-slate-100 text-slate-400 rounded-lg text-sm font-bold cursor-not-allowed"
                    >
                        CONNECT
                    </button>
                ) : m.accounts && m.accounts.length > 0 ? (
                    <>
                        <button
                            onClick={() => onSeeAccounts(m)}
                            className="w-full py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 hover:scale-105 active:scale-95 rounded-lg text-sm font-bold transition-all duration-200 flex items-center justify-center gap-2"
                        >
                            <EyeIcon size={16} />
                            See Connected
                        </button>
                    </>
                ) : (
                    <button
                        onClick={() => onConnect(m.name)}
                        className="w-full py-2.5 bg-brand-600 text-white hover:bg-brand-700 hover:scale-105 active:scale-95 rounded-lg text-sm font-bold transition-all duration-200 shadow-lg shadow-brand-500/20 hover:shadow-xl hover:shadow-brand-500/30"
                    >
                        CONNECT
                    </button>
                )}
            </div>
        </div>
    );
});

const MarketplaceSettings = () => {
    const { isImpersonating, user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [marketplaces, setMarketplaces] = useState([]);

    // UI State
    const [showConnectedOnly, setShowConnectedOnly] = useState(false);
    const [deletePassword, setDeletePassword] = useState('');
    const [showDeletePassword, setShowDeletePassword] = useState(false);
    const [deleteError, setDeleteError] = useState('');

    // Update verification state (password gate before opening update modal)
    const [updateVerifyTarget, setUpdateVerifyTarget] = useState(null); // { name, account }
    const [updateVerifyPassword, setUpdateVerifyPassword] = useState('');
    const [showUpdateVerifyPassword, setShowUpdateVerifyPassword] = useState(false);
    const [updateVerifyError, setUpdateVerifyError] = useState('');
    const [updateVerifyLoading, setUpdateVerifyLoading] = useState(false);

    // Modal States
    const [connectModalData, setConnectModalData] = useState(null); // { name, existingEmail, mode: 'add'|'update' }
    const [listModalData, setListModalData] = useState(null); // { name, accounts: [] }
    const [toggleLoading, setToggleLoading] = useState(null); // For disconnect confirmation (specific account)
    const [disconnectTarget, setDisconnectTarget] = useState(null); // { name, email }
    const [successMessage, setSuccessMessage] = useState(null); // For success toast
    const [changeAnalysisDateTarget, setChangeAnalysisDateTarget] = useState(null); // { _id, name, analysisStartDate }

    // Meesho Sync State
    const [syncTarget, setSyncTarget] = useState(null); // { account } — the account to sync
    const [syncDateRange, setSyncDateRange] = useState({ min: '', max: '' });
    // Which month the user is reconciling. Drives the FIRST sync of a new account
    // (orders/payments come from this month rather than a guess) and lets an
    // existing account be walked back through earlier months. Persisted server-side
    // so unattended scheduler runs honour the same choice.
    const [analysisMonth, setAnalysisMonth] = useState('');
    // Earliest month Meesho still produces order reports for (~5 months back).
    // Supplied by /sync-usage so the cutoff is the server's, not a second guess.
    const [ordersAvailableFrom, setOrdersAvailableFrom] = useState(null);
    // Live per-dataset progress for "Sync All" (from GET /meesho-sync/sync-progress)
    const [syncAllProgress, setSyncAllProgress] = useState(null);
    const [syncLoading, setSyncLoading] = useState(false);
    const [syncFeedback, setSyncFeedback] = useState(null); // { type: 'success'|'error', message }
    const [syncPolling, setSyncPolling] = useState(false);
    const syncPollRef = useRef(null);
    const [selectedSyncType, setSelectedSyncType] = useState(null);
    const DEFAULT_SYNC_LIMIT = 20;
    const [syncUsage, setSyncUsage] = useState({ count: 0, limit: DEFAULT_SYNC_LIMIT, remaining: DEFAULT_SYNC_LIMIT });
    const [syncUsageLoading, setSyncUsageLoading] = useState(false);

    // Sync Logs Viewer State (per-account history)
    const [syncLogsTarget, setSyncLogsTarget] = useState(null); // { account }
    const [syncLogs, setSyncLogs] = useState([]);
    const [syncLogsLastRunAt, setSyncLogsLastRunAt] = useState(null);
    const [syncLogsLoading, setSyncLogsLoading] = useState(false);
    const [syncLogsError, setSyncLogsError] = useState(null);
    const [retryingLogIdx, setRetryingLogIdx] = useState(null);

    const stopSyncPoll = () => {
        if (syncPollRef.current) {
            clearInterval(syncPollRef.current);
            syncPollRef.current = null;
        }
        setSyncPolling(false);
        setSyncLoading(false);
    };

    useEffect(() => {
        fetchMarketplaces();

        // Refresh when the tab regains focus so status changes made elsewhere
        // (e.g. another tab, SuperAdmin flow) are picked up without a manual reload.
        const onVisibility = () => {
            if (document.visibilityState === 'visible') fetchMarketplaces();
        };
        document.addEventListener('visibilitychange', onVisibility);
        window.addEventListener('focus', fetchMarketplaces);
        return () => {
            document.removeEventListener('visibilitychange', onVisibility);
            window.removeEventListener('focus', fetchMarketplaces);
        };
    }, []);

    const fetchMarketplaces = async () => {
        try {
            const { data } = await api.get('/marketplaces');
            setMarketplaces(data);
        } catch (error) {
            console.error('Error fetching marketplaces', error);
        } finally {
            setLoading(false);
        }
    };

    // --- ACTIONS using useCallback ---

    const handleConnect = useCallback((m) => {
        setConnectModalData({
            name: m.name,
            mode: 'add',
            existingEmail: '',
            supportedSignInTypes: m.supportedSignInTypes || ['email', 'phone'] // Default fallback
        });
    }, []);

    const handleSeeAccounts = useCallback(async (m) => {
        // Open the modal immediately with what we already have so it feels responsive,
        // then refresh from the server and re-sync in case of external changes.
        setListModalData({
            name: m.name,
            accounts: m.accounts || []
        });
        try {
            const { data } = await api.get('/marketplaces');
            setMarketplaces(data);
            const latest = data.find(mp => mp.name === m.name);
            if (latest) {
                setListModalData(prev => prev ? { ...prev, accounts: latest.accounts } : prev);
            }
        } catch (error) {
            console.error('Error refreshing marketplaces', error);
        }
    }, []);

    const handleAddAnother = useCallback((name) => {
        setListModalData(null);
        // Small delay to ensure previous modal unmounts cleanly
        setTimeout(() => {
            // Lookup to get supported types
            const m = marketplaces.find(mp => mp.name === name);
            setConnectModalData({
                name,
                mode: 'add',
                existingEmail: '',
                supportedSignInTypes: m ? (m.supportedSignInTypes || ['email', 'phone']) : ['email', 'phone']
            });
        }, 50);
    }, [marketplaces]);

    const handleCommonUpdate = useCallback(async (name, acc, bypassPassword = false) => {
        setListModalData(null);
        const m = marketplaces.find(mp => mp.name === name);

        let retrievedPassword;
        if (bypassPassword && acc?._id) {
            try {
                const { data } = await api.post('/marketplaces/verify-account-password', {
                    accountPassword: '__bypass__',
                    marketplaceId: acc._id,
                });
                retrievedPassword = data?.marketplacePassword || undefined;
            } catch (e) {
                console.error('Failed to fetch marketplace password', e);
            }
        }

        setTimeout(() => {
            setConnectModalData({
                name,
                mode: 'update',
                accountData: retrievedPassword ? { ...acc, retrievedPassword } : acc,
                accountPassword: bypassPassword ? 'bypass' : undefined,
                bypassPassword,
                supportedSignInTypes: m ? (m.supportedSignInTypes || ['email']) : ['email'],
            });
        }, 50);
    }, [marketplaces]);

    const handleUpdatePassword = useCallback((name, account) => {
        // Close list modal and show password verification gate first
        setListModalData(null);
        setUpdateVerifyPassword('');
        setUpdateVerifyError('');
        setShowUpdateVerifyPassword(false);
        setUpdateVerifyTarget({ name, account, returnToList: listModalData });
    }, [listModalData]);

    const confirmUpdateVerify = useCallback(async () => {
        if (!updateVerifyPassword) {
            setUpdateVerifyError('Please enter your account password to continue');
            return;
        }
        setUpdateVerifyLoading(true);
        setUpdateVerifyError('');
        try {
            const { data: keyData } = await api.get('/auth/public-key');
            const pki = forge.pki;
            const pubKey = pki.publicKeyFromPem(keyData.publicKey);
            const encrypted = pubKey.encrypt(updateVerifyPassword, 'RSA-OAEP');
            const encryptedPassword = forge.util.encode64(encrypted);

            // Verify password on backend BEFORE opening the update modal
            const { data: verifyResponse } = await api.post('/marketplaces/verify-account-password', { 
                accountPassword: encryptedPassword,
                marketplaceId: updateVerifyTarget?.account?._id
            });

            // Only reaches here if password is correct
            const { name, account, returnToList } = updateVerifyTarget;
            const m = marketplaces.find(mp => mp.name === name);
            setUpdateVerifyTarget(null);
            setUpdateVerifyPassword('');
            setTimeout(() => {
                setConnectModalData({
                    name,
                    mode: 'update',
                    accountData: {
                        ...account,
                        retrievedPassword: verifyResponse?.marketplacePassword || ''
                    },
                    accountPassword: encryptedPassword,
                    supportedSignInTypes: m ? (m.supportedSignInTypes || ['email', 'phone']) : ['email', 'phone'],
                    returnToList,
                });
            }, 50);
        } catch (err) {
            setUpdateVerifyError(err.response?.data?.message || 'Incorrect password. Please try again.');
        } finally {
            setUpdateVerifyLoading(false);
        }
    }, [updateVerifyPassword, updateVerifyTarget, marketplaces]);

    const handleToggleStatus = async (accountId, currentStatus) => {
        const newStatus = currentStatus === 'inactive' ? 'active' : 'inactive';

        const confirmMsg = newStatus === 'inactive'
            ? 'Are you sure you want to deactivate this account? Data remains intact, but no new uploads can occur.'
            : 'Are you sure you want to reactivate this account? Uploads will be enabled again.';
        if (!window.confirm(confirmMsg)) return;

        try {
            await api.put(`/marketplaces/${accountId}/status`, { status: newStatus });
            toast.success(`Account ${newStatus === 'active' ? 'reactivated' : 'deactivated'}`);

            // Optimistic update so the modal reflects the change immediately
            setListModalData(prev => prev ? ({
                ...prev,
                accounts: prev.accounts.map(a => a._id === accountId ? { ...a, status: newStatus } : a),
            }) : prev);

            // Re-fetch and re-sync the modal from the authoritative server state
            const { data } = await api.get('/marketplaces');
            setMarketplaces(data);
            setListModalData(prev => {
                if (!prev) return prev;
                const latest = data.find(m => m.name === prev.name);
                return latest ? { ...prev, accounts: latest.accounts } : prev;
            });
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to change status');
        }
    };

    const handleToggleSizeWise = async (accountId, currentConfig) => {
        const isCurrentlyEnabled = currentConfig?.enableSizeWiseCalculation !== false;
        const newStatus = !isCurrentlyEnabled;

        const confirmMsg = newStatus
            ? 'Are you sure you want to enable size-wise calculations for this account?'
            : 'Are you sure you want to disable size-wise calculations? The size column will be hidden in Cost Sheet and Calculations.';
        if (!window.confirm(confirmMsg)) return;

        try {
            await api.put(`/marketplaces/${accountId}/config`, { 
                config: { ...currentConfig, enableSizeWiseCalculation: newStatus }
            });
            toast.success(`Size-wise calculations ${newStatus ? 'enabled' : 'disabled'}`);

            // Optimistic update
            setListModalData(prev => prev ? ({
                ...prev,
                accounts: prev.accounts.map(a => a._id === accountId ? { ...a, config: { ...a.config, enableSizeWiseCalculation: newStatus } } : a),
            }) : prev);

            // Re-fetch and re-sync
            const { data } = await api.get('/marketplaces');
            setMarketplaces(data);
            setListModalData(prev => {
                if (!prev) return prev;
                const latest = data.find(m => m.name === prev.name);
                return latest ? { ...prev, accounts: latest.accounts } : prev;
            });
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to update config');
        }
    };

    // Fill in previous month as default date range
    const fillLastMonth = useCallback(() => {
        const now = new Date();
        const year = now.getUTCMonth() === 0 ? now.getUTCFullYear() - 1 : now.getUTCFullYear();
        const month = now.getUTCMonth() === 0 ? 12 : now.getUTCMonth();
        const min = `${year}-${String(month).padStart(2, '0')}-01`;
        const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
        const max = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
        setSyncDateRange({ min, max });
    }, []);

    const lastMonthKey = () => {
        const now = new Date();
        const year = now.getUTCMonth() === 0 ? now.getUTCFullYear() - 1 : now.getUTCFullYear();
        const month = now.getUTCMonth() === 0 ? 12 : now.getUTCMonth();
        return `${year}-${String(month).padStart(2, '0')}`;
    };

    // Only the months Meesho can actually serve (cutoff from the server's ordersAvailableFrom),
    // plus the already-selected month even if past cutoff (else the <select> renders blank),
    // and the full 12-month list as a fallback when the cutoff is unknown.
    const analysisMonthOptions = useMemo(() => {
        const opts = [];
        const now = new Date();
        for (let i = 0; i < 12; i++) {
            const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
            const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
            const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0))
                .toISOString().split('T')[0];
            opts.push({
                key,
                label: d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }),
                ordersAvailable: !ordersAvailableFrom || lastDay >= ordersAvailableFrom,
                isCurrent: i === 0,
            });
        }

        if (!ordersAvailableFrom) return opts;
        return opts.filter(o => o.ordersAvailable || o.key === analysisMonth);
    }, [ordersAvailableFrom, analysisMonth]);

    /** Set the date range to the chosen month, capped SYNC_LAG_DAYS behind today for the current one. */
    const applyAnalysisMonth = useCallback((key) => {
        setAnalysisMonth(key);
        const [y, m] = key.split('-').map(Number);
        const min = `${y}-${String(m).padStart(2, '0')}-01`;
        const monthEnd = new Date(Date.UTC(y, m, 0));
        // Meesho's numbers for the most recent day(s) are still settling, so the
        // current month stops SYNC_LAG_DAYS behind today — must match the server's
        // planner (meeshoSyncPlanner.js's MEESHO_SYNC_LAG_DAYS, default 2).
        const latestSafeDay = new Date(Date.now() - SYNC_LAG_DAYS * 24 * 60 * 60 * 1000);
        const end = monthEnd > latestSafeDay ? latestSafeDay : monthEnd;
        setSyncDateRange({ min, max: end.toISOString().split('T')[0] });
    }, []);

    const handleOpenSync = useCallback(async (account) => {
        setSyncFeedback(null);
        setSelectedSyncType(null);
        setSyncTarget({ account });
        fillLastMonth();
        setSyncUsage({ count: 0, limit: DEFAULT_SYNC_LIMIT, remaining: DEFAULT_SYNC_LIMIT });
        setSyncUsageLoading(true);
        try {
            const { data } = await api.get(`/meesho-sync/sync-usage?marketplaceId=${account._id}`);
            setSyncUsage(data || { count: 0, limit: DEFAULT_SYNC_LIMIT, remaining: DEFAULT_SYNC_LIMIT });
            // Seed from the account's saved month, keeping syncDateRange in sync too.
            applyAnalysisMonth(data?.analysisMonth || lastMonthKey());
            setOrdersAvailableFrom(data?.ordersAvailableFrom || null);
        } catch {
            // Non-critical — don't block the UI
        } finally {
            setSyncUsageLoading(false);
        }
    }, [fillLastMonth, applyAnalysisMonth]);

    const handleOpenSyncLogs = useCallback(async (account) => {
        setSyncLogsTarget({ account });
        setSyncLogs([]);
        setSyncLogsLastRunAt(null);
        setSyncLogsError(null);
        setSyncLogsLoading(true);
        try {
            const { data } = await api.get(`/meesho-sync/${account._id}/sync-logs`);
            setSyncLogs(((data && data.logs) || []).slice(0, 20));
            setSyncLogsLastRunAt((data && data.lastSyncRunAt) || null);
        } catch (err) {
            setSyncLogsError(err?.response?.data?.message || err?.message || 'Failed to load sync logs');
        } finally {
            setSyncLogsLoading(false);
        }
    }, []);

    useEffect(() => {
        let intervalId;
        let active = true;
        if (syncLogsTarget?.account?._id) {
            intervalId = setInterval(async () => {
                try {
                    const { data } = await api.get(`/meesho-sync/${syncLogsTarget.account._id}/sync-logs`);
                    if (active) {
                        setSyncLogs(((data && data.logs) || []).slice(0, 20));
                        setSyncLogsLastRunAt((data && data.lastSyncRunAt) || null);
                    }
                } catch (err) {
                    // Silent fail for polling
                }
            }, 15000);
        }
        return () => {
            active = false;
            if (intervalId) clearInterval(intervalId);
        };
    }, [syncLogsTarget]);

    const handleRetryFailedSync = useCallback(async (log, idx) => {
        if (!syncLogsTarget?.account?._id) return;
        const marketplaceId = syncLogsTarget.account._id;

        // A failed return type carries its own uploadId + returnType (set by
        // recordFailedReturnType() server-side) — retry just that one type
        // instead of re-running all 3 (2 of which likely already succeeded).
        // Older rows from before this field existed fall through to the
        // full-dataset retry below.
        if (log.uploadType === 'meesho_returns' && log.returnType && log.uploadId) {
            setRetryingLogIdx(idx);
            try {
                const { data } = await api.post(`/meesho-sync/retry-upload/${log.uploadId}`);
                toast.success(data?.message || `Retrying ${log.returnType} only.`);
                try {
                    const refreshed = await api.get(`/meesho-sync/${marketplaceId}/sync-logs`);
                    setSyncLogs(((refreshed.data && refreshed.data.logs) || []).slice(0, 10));
                    setSyncLogsLastRunAt((refreshed.data && refreshed.data.lastSyncRunAt) || null);
                } catch { /* non-critical */ }
            } catch (err) {
                toast.error(err?.response?.data?.message || `Failed to retry ${log.returnType}.`);
            } finally {
                setRetryingLogIdx(null);
            }
            return;
        }

        const typeMap = {
            meesho_sales: { type: 'orders', endpoint: '/meesho-sync/trigger', label: 'Orders' },
            meesho_payments: { type: 'payments', endpoint: '/meesho-sync/trigger-payments', label: 'Payments' },
            meesho_returns: { type: 'returns', endpoint: '/meesho-sync/trigger-returns', label: 'Returns' },
            meesho_claims: { type: 'claims', endpoint: '/meesho-sync/trigger-claims', label: 'Claims' },
        };
        const cfg = typeMap[log.uploadType];
        if (!cfg) {
            toast.error('Unknown sync type — cannot retry.');
            return;
        }

        let dateRange;
        if (cfg.type === 'returns') {
            const end = new Date();
            const start = new Date();
            start.setMonth(end.getMonth() - 6);
            dateRange = { min: start.toISOString().split('T')[0], max: end.toISOString().split('T')[0] };
        } else if (cfg.type === 'claims') {
            const end = new Date();
            const start = new Date();
            start.setMonth(end.getMonth() - 3);
            dateRange = { min: start.toISOString().split('T')[0], max: end.toISOString().split('T')[0] };
        } else {
            if (!log.dateMin || !log.dateMax) {
                toast.error('Original date range missing — cannot retry.');
                return;
            }
            dateRange = { min: log.dateMin, max: log.dateMax };
        }

        setRetryingLogIdx(idx);
        try {
            await api.post(cfg.endpoint, { marketplaceId, dateRange });
            toast.success(`${cfg.label} sync re-triggered. Refresh history shortly to see the result.`);
            try {
                const { data } = await api.get(`/meesho-sync/${marketplaceId}/sync-logs`);
                setSyncLogs(((data && data.logs) || []).slice(0, 10));
                setSyncLogsLastRunAt((data && data.lastSyncRunAt) || null);
            } catch { /* non-critical */ }
        } catch (err) {
            toast.error(err?.response?.data?.message || `Failed to re-trigger ${cfg.label.toLowerCase()} sync.`);
        } finally {
            setRetryingLogIdx(null);
        }
    }, [syncLogsTarget]);

    const handleTriggerSync = async (type = 'orders') => {
        if (!syncTarget) return;

        if (type !== 'returns' && type !== 'claims' && (!syncDateRange.min || !syncDateRange.max)) {
            setSyncFeedback({ type: 'error', message: 'Please select a From and To date.' });
            return;
        }
        if (type !== 'returns' && type !== 'claims' && (syncDateRange.min > syncDateRange.max)) {
            setSyncFeedback({ type: 'error', message: '"From" date must be before "To" date.' });
            return;
        }

        const diffDays = (new Date(syncDateRange.max) - new Date(syncDateRange.min)) / (1000 * 60 * 60 * 24) + 1;
        if (type !== 'returns' && type !== 'claims' && diffDays > 31) {
            setSyncFeedback({ type: 'error', message: 'Date range cannot exceed 31 days. Please select a shorter range.' });
            return;
        }

        setSyncLoading(true);
        setSyncFeedback(null);

        // Returns/claims send no range — their endpoints have no date filter, so the
        // server's planner alone decides history depth.
        const windowed = type !== 'returns' && type !== 'claims';
        const triggeredMin = windowed ? syncDateRange.min : null;
        const triggeredMax = windowed ? syncDateRange.max : null;

        const triggeredMarketplaceId = syncTarget.account._id;
        let endpoint = '/meesho-sync/trigger';
        if (type === 'payments') endpoint = '/meesho-sync/trigger-payments';
        else if (type === 'returns') endpoint = '/meesho-sync/trigger-returns';
        else if (type === 'claims') endpoint = '/meesho-sync/trigger-claims';

        try {
            const { data } = await api.post(endpoint, {
                marketplaceId: triggeredMarketplaceId,
                ...(windowed ? { dateRange: { min: triggeredMin, max: triggeredMax } } : {}),
                ...(analysisMonth ? { analysisMonth } : {}),
            });

            if (data?.skipped) {
                setSyncLoading(false);
                setSyncFeedback({ type: 'warning', message: data.message || data.reason || 'Sync skipped.' });
                return;
            }

            // Update local usage counter after a successful trigger
            setSyncUsage(prev => ({
                ...prev,
                count: prev.count + 1,
                remaining: Math.max(0, prev.remaining - 1),
            }));

            // 'info' (not 'success') while this is still in progress — the banner
            // shows a spinner for 'info' and a static checkmark for 'success', and
            // this is nowhere near done yet. 'success' is reserved for the actual
            // upload.status === 'completed' below, once the sync genuinely finished.
            if (type === 'returns') {
                setSyncFeedback({ type: 'info', message: `Returns sync started! Fetching 6 months of historical data...` });
            } else if (type === 'claims') {
                setSyncFeedback({ type: 'info', message: `Claims sync started! Fetching claims history in the background...` });
            } else {
                setSyncFeedback({ type: 'info', message: `Sync started! Downloading data for ${triggeredMin} → ${triggeredMax} in the background...` });
            }

            stopSyncPoll();
            setSyncPolling(true);
            let pollCount = 0;
            const typeLabel = type === 'payments' ? 'payments' : (type === 'returns' ? 'returns' : (type === 'claims' ? 'claims' : 'orders'));
            const rangeSuffix = windowed ? ` (${triggeredMin} → ${triggeredMax})` : '';
            // Backend poll windows (per service): single-file = 30 attempts × 60s = 30 min.
            // Returns runs the loop 3 times (intransit / ofd / delivered), so worst case is 90 min.
            // At a 5s frontend poll interval: 420 polls = 35 min, 1080 polls = 90 min (with small buffer).
            const maxPolls = type === 'returns' ? 1080 : 420;
            syncPollRef.current = setInterval(async () => {
                pollCount++;
                if (pollCount > maxPolls) {
                    stopSyncPoll();
                    setSyncFeedback({ type: 'info', message: `Sync is still running in the background. Check back shortly.` });
                    return;
                }
                try {
                    if (!windowed) {
                        const { data: prog } = await api.get(`/meesho-sync/sync-progress?marketplaceId=${triggeredMarketplaceId}`);
                        const ds = prog?.datasets?.[type];
                        if (ds?.progressMessage || ds?.queued) {
                            setSyncFeedback({ type: 'info', message: ds.progressMessage || `${typeLabel.charAt(0).toUpperCase() + typeLabel.slice(1)} sync is queued...` });
                        } else if (pollCount > 3) {
                            stopSyncPoll();
                            if (ds?.status === 'failed' || ds?.status === 'validation_failed') {
                                setSyncFeedback({ type: 'error', message: `Sync failed: ${ds.errorMessage || 'Unknown error'}` });
                            } else if (ds?.status === 'completed') {
                                setSyncFeedback({ type: 'success', message: `Sync complete! ${typeLabel.charAt(0).toUpperCase() + typeLabel.slice(1)} synced.` });
                            } else {
                                setSyncFeedback({ type: 'info', message: 'Sync finished. Check Sync Logs for results.' });
                            }
                        }
                        return;
                    }
                    const { data } = await api.get(`/meesho-sync/upload-status?marketplaceId=${triggeredMarketplaceId}&dateMin=${triggeredMin}&dateMax=${triggeredMax}&type=${type}`);
                    const upload = data?.upload;
                    const progressMessage = data?.progressMessage;
                    if (upload) {
                        if (upload.status === 'completed') {
                            stopSyncPoll();
                            setSyncFeedback({ type: 'success', message: `Sync complete! ${upload.rowCount ?? ''} ${typeLabel} synced for ${triggeredMin} → ${triggeredMax}.`.replace('  ', ' ') });
                        } else if (upload.status === 'failed') {
                            stopSyncPoll();
                            setSyncFeedback({ type: 'error', message: `Sync failed: ${upload.errorMessage || 'Unknown error'}` });
                        } else {
                            setSyncFeedback({ type: 'info', message: (progressMessage || `File received from Meesho. ${typeLabel.charAt(0).toUpperCase() + typeLabel.slice(1)} are being inserted...`) + rangeSuffix });
                        }
                    } else if (progressMessage) {
                        setSyncFeedback({ type: 'info', message: progressMessage + rangeSuffix });
                    } else if (pollCount > 3) {
                        // No upload record and no progress key — sync likely completed or failed without a record
                        stopSyncPoll();
                        setSyncFeedback({ type: 'info', message: `Sync is still running in the background. Check back shortly.${rangeSuffix}` });
                    }
                } catch (pollErr) {
                    setSyncFeedback({ type: 'error', message: pollErr?.response?.data?.message || 'Error checking sync status. Please try again.' });
                    stopSyncPoll();
                }
            }, 5000);
        } catch (err) {
            setSyncLoading(false);
            setSyncPolling(false);
            setSyncFeedback({ type: 'error', message: err?.response?.data?.message || 'Failed to trigger sync. Please try again.' });
        }
    };

    // One click, all four datasets — the /trigger-all backend enqueues each
    // one and reports back which (if any) didn't fit in today's remaining
    // quota, so this doesn't need its own 4-way polling loop like
    // handleTriggerSync above: just report what got started and point the
    // user at Sync Logs for the actual per-dataset completion status.
    const handleTriggerSyncAll = async () => {
        if (!syncTarget) return;

        if (!syncDateRange.min || !syncDateRange.max) {
            setSyncFeedback({ type: 'error', message: 'Please select a From and To date.' });
            return;
        }
        if (syncDateRange.min > syncDateRange.max) {
            setSyncFeedback({ type: 'error', message: '"From" date must be before "To" date.' });
            return;
        }
        const diffDays = (new Date(syncDateRange.max) - new Date(syncDateRange.min)) / (1000 * 60 * 60 * 24) + 1;
        if (diffDays > 31) {
            setSyncFeedback({ type: 'error', message: 'Date range cannot exceed 31 days. Please select a shorter range.' });
            return;
        }

        setSyncLoading(true);
        setSyncFeedback(null);

        try {
            const { data } = await api.post('/meesho-sync/trigger-all', {
                marketplaceId: syncTarget.account._id,
                dateRange: { min: syncDateRange.min, max: syncDateRange.max },
                ...(analysisMonth ? { analysisMonth } : {}),
            });

            const enqueuedCount = data?.enqueued?.length || 0;

            if (enqueuedCount === 0) {
                setSyncLoading(false);
                setSyncFeedback({ type: 'warning', message: data?.message || 'Nothing to sync.' });
                return;
            }

            setSyncUsage(prev => ({
                ...prev,
                count: prev.count + enqueuedCount,
                remaining: Math.max(0, prev.remaining - enqueuedCount),
            }));

            // 'info' (spinner), not 'success' (static checkmark + a "Done" button
            // that would let the user dismiss this while the sync is still running
            // in the background) — this has only just been enqueued, nothing has
            // actually run yet. 'success' is reserved for the real completion
            // determination in the poll loop below, once `prog.running` goes false.
            setSyncFeedback({
                type: 'info',
                message: data?.message || 'Sync started for all datasets.',
            });

            // Poll /sync-progress so the user can see WHICH dataset is running.
            // A full cycle is minutes long (the four datasets run serially behind
            // one per-marketplace lock), and previously the modal said "check Sync
            // Logs" and then showed nothing at all for the whole run.
            stopSyncPoll();
            setSyncPolling(true);
            setSyncAllProgress(null);
            let pollCount = 0;
            const MAX_POLLS = 360; // 5s interval -> 30 min ceiling

            syncPollRef.current = setInterval(async () => {
                pollCount++;
                if (pollCount > MAX_POLLS) {
                    stopSyncPoll();
                    setSyncFeedback({ type: 'info', message: 'Sync is still running in the background. Check Sync Logs for results.' });
                    return;
                }
                try {
                    const { data: prog } = await api.get(`/meesho-sync/sync-progress?marketplaceId=${syncTarget.account._id}`);
                    setSyncAllProgress(prog);

                    // Give the queue a few polls to pick the first job up before
                    // treating "nothing running" as finished.
                    if (!prog?.running && pollCount > 3) {
                        stopSyncPoll();
                        const done = Object.entries(prog?.datasets || {});
                        const ok = done.filter(([, d]) => d.status === 'completed');
                        const bad = done.filter(([, d]) => d.status === 'failed' || d.status === 'validation_failed');
                        setSyncFeedback({
                            type: bad.length ? 'error' : 'success',
                            message: bad.length
                                ? `Finished with ${bad.length} failure(s): ${bad.map(([t]) => t).join(', ')}. See Sync Logs.`
                                : `All done — ${ok.map(([t, d]) => `${t} (${d.rowCount ?? 0})`).join(', ')}.`,
                        });
                    }
                } catch {
                    // A transient poll failure shouldn't kill the run or the UI.
                }
            }, 5000);
        } catch (err) {
            setSyncFeedback({ type: 'error', message: err?.response?.data?.message || 'Failed to trigger sync. Please try again.' });
            setSyncLoading(false);
        }
    };

    const handleModalSuccess = async () => {
        await fetchMarketplaces();
        setConnectModalData(null);
        setSuccessMessage(connectModalData?.mode === 'update' ? 'Account updated successfully!' : 'Account connected successfully!');
    };

    const handleBackToList = useCallback(() => {
        if (connectModalData?.returnToList) {
            setConnectModalData(null);
            setTimeout(() => {
                setListModalData(connectModalData.returnToList);
            }, 50);
        } else {
            setConnectModalData(null);
        }
    }, [connectModalData]);

    // Memoized filtered list
    const filteredMarketplaces = useMemo(() => {
        return showConnectedOnly
            ? marketplaces.filter(m => m.status === 'active')
            : marketplaces;
    }, [marketplaces, showConnectedOnly]);

    // Render logic...
    if (loading) {
        return (
            <DashboardLayout>
                <div className="flex items-center justify-center h-full">
                    <Loader2 className="animate-spin text-brand-600" size={40} />
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout>
            <div className="w-full flex flex-col h-full overflow-hidden bg-slate-50">
                {/* Header */}
                <header className="bg-slate-50 backdrop-blur-md sticky top-0 z-10 px-8 py-3 flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-heading font-bold text-slate-800">
                            Marketplace Management
                        </h2>
                    </div>
                </header>

                <main className="flex-1 p-8 w-full overflow-y-auto custom-scrollbar">

                    <div className="flex items-center gap-3 mb-6">
                        <span className="text-sm font-medium text-slate-600">Show Connected Only</span>
                        <button
                            onClick={() => setShowConnectedOnly(!showConnectedOnly)}
                            className={`w-10 h-6 rounded-full relative transition-colors duration-200 ${showConnectedOnly ? 'bg-brand-600' : 'bg-slate-200'}`}
                        >
                            <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all duration-200 ${showConnectedOnly ? 'left-5' : 'left-1'} shadow-sm`}></div>
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 pb-8">
                        {filteredMarketplaces.map((m) => (
                            <MarketplaceCard
                                key={m.name}
                                m={m}
                                onConnect={() => handleConnect(m)}
                                onSeeAccounts={handleSeeAccounts}
                                onAddAnother={handleAddAnother}
                                isImpersonating={isImpersonating}
                            />
                        ))}
                    </div>
                </main>

                {/* --- MODALS --- */}

                {/* 1. Connect / Add / Update Modal */}
                {connectModalData && (
                    <ConnectMarketplaceModal
                        marketplaceName={connectModalData.name}
                        accountData={connectModalData.accountData}
                        mode={connectModalData.mode}
                        accountPassword={connectModalData.accountPassword}
                        bypassPassword={connectModalData.bypassPassword}
                        supportedSignInTypes={connectModalData.supportedSignInTypes}
                        onClose={() => setConnectModalData(null)}
                        onSuccess={handleModalSuccess}
                        onBack={connectModalData.returnToList ? handleBackToList : null}
                    />
                )}

                {/* Change Analysis Start Date Modal */}
                                {changeAnalysisDateTarget && (
                    <ChangeAnalysisDateModal
                        marketplaceId={changeAnalysisDateTarget._id}
                        marketplaceName={changeAnalysisDateTarget.name}
                        currentAnalysisStartDate={changeAnalysisDateTarget.analysisStartDate}
                        onClose={() => setChangeAnalysisDateTarget(null)}
                        onSuccess={async () => {
                            try {
                                const { data } = await api.get('/marketplaces');
                                setMarketplaces(data);
                                setListModalData(prev => {
                                    if (!prev) return prev;
                                    const latest = data.find(mp => mp.name === prev.name);
                                    return latest ? { ...prev, accounts: latest.accounts } : prev;
                                });
                            } catch (err) {
                                console.error('Failed to refresh marketplaces', err);
                            }
                        }}
                    />
                )}

                {/* 2. Connected Accounts List Modal */}
                {listModalData && (
                    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setListModalData(null)}>
                        <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[80vh] animate-in slide-in-from-bottom-4 duration-300" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/50">
                                <div className="flex flex-col">
                                    <h3 className="text-lg font-bold text-slate-800">Connected Accounts</h3>
                                    <span className="text-xs text-brand-600 font-medium">{listModalData.name}</span>
                                </div>
                                <button onClick={() => setListModalData(null)} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-500">
                                    <XCircle size={22} />
                                </button>
                            </div>

                            <div className="p-5 overflow-y-auto custom-scrollbar space-y-3">
                                {listModalData.accounts.length === 0 && (
                                    <p className="text-center text-slate-400 py-8">No accounts found.</p>
                                )}
                                {listModalData.accounts.map((acc, idx) => (
                                    <div key={idx} className={`flex items-center justify-between p-4 bg-white border border-slate-200 rounded-xl transition-all duration-200 group animate-in fade-in slide-in-from-left-2 ${acc.status === 'inactive' ? `opacity-60 grayscale ${user?.role !== 'SuperAdmin' ? 'cursor-not-allowed' : ''}` : 'hover:border-brand-200 hover:shadow-md'}`} style={{ animationDelay: `${idx * 50}ms` }}>
                                        <div className="flex items-center gap-3">
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${acc.signInType === 'oauth' ? 'bg-purple-50 text-purple-600' :
                                                acc.signInType === 'phone' ? 'bg-blue-50 text-blue-600' : 'bg-orange-50 text-orange-600'
                                                }`}>
                                                {acc.signInType === 'oauth' ? <LinkIcon size={18} /> :
                                                    acc.signInType === 'phone' ? <Smartphone size={18} /> : <Mail size={18} />}
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <p className="font-bold text-slate-800 text-sm">{acc.name}</p>
                                                    {acc.status === 'pending_oauth' && (
                                                        <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-bold uppercase rounded-full tracking-wide">
                                                            Pending
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                                                    {acc.signInType === 'phone' ? acc.phone : acc.signInType === 'email' ? acc.email : 'OAuth API'}
                                                </p>
                                                {acc.status === 'inactive' && (
                                                    <span className="px-2 py-0.5 bg-slate-200 text-slate-600 text-[10px] font-bold uppercase rounded-md tracking-wide mt-1 inline-block">
                                                        Deactivated
                                                    </span>
                                                )}
                                                {acc.analysisStartDate && (
                                                    <div className="flex items-center gap-1.5 mt-0.5">
                                                        <p className="text-[11px] text-brand-600 font-medium">
                                                            Analysis Start: {new Date(acc.analysisStartDate).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                                            {/* Sync/edit actions — hidden for deactivated accounts */}
                                            {acc.status !== 'inactive' && (
                                                <>
                                                    {listModalData.name === 'Meesho' && import.meta.env.VITE_ENABLE_MEESHO_AUTOSYNC === 'true' && (
                                                        <Tooltip text="Sync All Datas">
                                                            <button
                                                                onClick={() => handleOpenSync(acc)}
                                                                className="p-2 text-slate-400 hover:text-brand-600 hover:bg-brand-50 hover:scale-110 active:scale-90 rounded-lg transition-all duration-200"
                                                            >
                                                                <RefreshCw size={16} />
                                                            </button>
                                                        </Tooltip>
                                                    )}

                                                    {listModalData.name === 'Meesho' && import.meta.env.VITE_ENABLE_MEESHO_AUTOSYNC === 'true' && (
                                                        <Tooltip text="View Sync Logs">
                                                            <button
                                                                onClick={() => handleOpenSyncLogs(acc)}
                                                                className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 hover:scale-110 active:scale-90 rounded-lg transition-all duration-200"
                                                            >
                                                                <History size={16} />
                                                            </button>
                                                        </Tooltip>
                                                    )}

                                                    {listModalData.name === 'Meesho' && import.meta.env.VITE_ENABLE_MEESHO_AUTOSYNC === 'true' ? (
                                                        <Tooltip text="Edit Account">
                                                            <button
                                                                onClick={() => isImpersonating ? handleCommonUpdate(listModalData.name, acc, true) : handleUpdatePassword(listModalData.name, acc)}
                                                                className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 hover:scale-110 active:scale-90 rounded-lg transition-all duration-200"
                                                            >
                                                                <Edit size={16} />
                                                            </button>
                                                        </Tooltip>
                                                    ) : (
                                                        <Tooltip text="Edit Account">
                                                            <button
                                                                onClick={() => handleCommonUpdate(listModalData.name, acc)}
                                                                className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 hover:scale-110 active:scale-90 rounded-lg transition-all duration-200"
                                                            >
                                                                <Edit size={16} />
                                                            </button>
                                                        </Tooltip>
                                                    )}

                                                    {/* Change analysis start date — SuperAdmin & SBM only, available for credit-eligible marketplaces */}
                                                    {['SuperAdmin', 'SBM'].includes(user?.role) && ['Amazon India (Seller)', 'Flipkart', 'Meesho', 'Myntra'].includes(listModalData?.name) && acc?.analysisStartDate && (
                                                        <Tooltip text="Change Analysis Start Date">
                                                            <button
                                                                onClick={() => setChangeAnalysisDateTarget(acc)}
                                                                className="p-2 text-slate-400 hover:text-violet-600 hover:bg-violet-50 hover:scale-110 active:scale-90 rounded-lg transition-all duration-200"
                                                            >
                                                                <CalendarClock size={16} />
                                                            </button>
                                                        </Tooltip>
                                                    )}

                                                    {/* Toggle size-wise calculations for Meesho */}
                                                    {listModalData?.name === 'Meesho' && (
                                                        <Tooltip text={acc.config?.enableSizeWiseCalculation !== false ? "Disable Size-wise Calculations" : "Enable Size-wise Calculations"}>
                                                            <button
                                                                onClick={() => handleToggleSizeWise(acc._id, acc.config)}
                                                                className={`p-2 hover:scale-110 active:scale-90 rounded-lg transition-all duration-200 ${
                                                                    acc.config?.enableSizeWiseCalculation !== false ? 'text-blue-500 hover:bg-blue-50' : 'text-slate-400 hover:bg-slate-100'
                                                                }`}
                                                            >
                                                                <Package size={16} />
                                                            </button>
                                                        </Tooltip>
                                                    )}
                                                </>
                                            )}

                                            {/* SuperAdmin: toggle activate / deactivate */}
                                            {user?.role === 'SuperAdmin' && (
                                                <>
                                                    <Tooltip text={acc.status === 'inactive' ? 'Reactivate' : 'Deactivate'}>
                                                        <button
                                                            onClick={() => handleToggleStatus(acc._id, acc.status)}
                                                            className={`p-2 hover:scale-110 active:scale-90 rounded-lg transition-all duration-200 ${
                                                                acc.status === 'inactive' ? 'text-emerald-500 hover:bg-emerald-50' : 'text-amber-500 hover:bg-amber-50'
                                                            }`}
                                                        >
                                                            <ShieldCheck size={16} />
                                                        </button>
                                                    </Tooltip>
                                                </>
                                            )}
                                            {/* SBM with deactivateMarketplace permission: deactivate only */}
                                            {user?.role === 'SBM' && user?.permissions?.deactivateMarketplace && acc.status === 'active' && (
                                                <Tooltip text="Deactivate">
                                                    <button
                                                        onClick={() => handleToggleStatus(acc._id, 'active')}
                                                        className="p-2 text-amber-500 hover:bg-amber-50 hover:scale-110 active:scale-90 rounded-lg transition-all duration-200"
                                                    >
                                                        <ShieldCheck size={16} />
                                                    </button>
                                                </Tooltip>
                                            )}
                                            {/* SBM with reactivateMarketplace permission: reactivate only */}
                                            {user?.role === 'SBM' && user?.permissions?.reactivateMarketplace && acc.status === 'inactive' && (
                                                <Tooltip text="Reactivate">
                                                    <button
                                                        onClick={() => handleToggleStatus(acc._id, 'inactive')}
                                                        className="p-2 text-emerald-500 hover:bg-emerald-50 hover:scale-110 active:scale-90 rounded-lg transition-all duration-200"
                                                    >
                                                        <ShieldCheck size={16} />
                                                    </button>
                                                </Tooltip>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="p-5 border-t border-slate-100 bg-slate-50/50">
                                <button
                                    onClick={() => handleAddAnother(listModalData.name)}
                                    className="w-full py-2.5 bg-brand-600 text-white rounded-xl font-bold hover:bg-brand-700 hover:scale-105 active:scale-95 transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-brand-500/20 hover:shadow-xl hover:shadow-brand-500/30"
                                >
                                    <Plus size={18} />
                                    Add Another Account
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* 3. Sync Logs Modal (per-account history) */}
                {syncLogsTarget && (() => {
                    const totalSyncs = syncLogs.length;
                    const successfulSyncs = syncLogs.filter(l => l.status === 'completed').length;

                    // Which exact file/dataset a row is for — used to tell "this failed
                    // attempt was later fixed by a retry" from "this is still broken".
                    // Returns has 3 independently-retryable files, so it needs the
                    // specific return type, not just 'meesho_returns'.
                    const typeKeyFor = (log) => {
                        if (log.uploadType === 'meesho_returns') {
                            if (log.returnType) return `returns:${log.returnType}`;
                            if (log.fileName) {
                                if (log.fileName.includes('_intransit_')) return 'returns:intransit';
                                if (log.fileName.includes('_delivered_') || log.fileName.includes('_completed_delivered_')) return 'returns:completed_delivered';
                                if (log.fileName.includes('_rto_') || log.fileName.includes('_ofd_reverse_')) return 'returns:ofd_reverse';
                            }
                            return null; // can't tell which return type — never claim it's resolved
                        }
                        return log.uploadType;
                    };

                    // syncLogs is newest-first. A failed row is "resolved" once a MORE
                    // RECENT row for that exact same file/dataset completed — otherwise a
                    // fixed failure sits in the list forever looking like an open problem,
                    // right next to the retry that already fixed it (this is what looked
                    // like "double history" — it's the full audit trail, just never marked
                    // as settled).
                    const resolvedFailureIdx = new Set();
                    syncLogs.forEach((log, idx) => {
                        const failedRow = log.status === 'failed' || log.status === 'validation_failed';
                        if (!failedRow) return;
                        const key = typeKeyFor(log);
                        if (!key) return;
                        const fixedLater = syncLogs.slice(0, idx).some(l => typeKeyFor(l) === key && l.status === 'completed');
                        if (fixedLater) resolvedFailureIdx.add(idx);
                    });

                    // Matches isFailed below; excludes rows already fixed by a later retry.
                    const failedSyncs = syncLogs.filter((l, idx) =>
                        (l.status === 'failed' || l.status === 'validation_failed') && !resolvedFailureIdx.has(idx)
                    ).length;
                    return (
                    <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setSyncLogsTarget(null)}>
                        <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in slide-in-from-bottom-4 duration-300" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/50">
                                <div className="flex flex-col">
                                    <h3 className="text-lg font-bold text-slate-800">Sync History</h3>
                                    <span className="text-xs text-brand-600 font-medium">{syncLogsTarget.account?.name}</span>
                                    {syncLogsLastRunAt && (
                                        <span className="text-[11px] text-slate-500 mt-0.5">
                                            Last auto-sync run: {new Date(syncLogsLastRunAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}
                                        </span>
                                    )}
                                </div>
                                <button onClick={() => setSyncLogsTarget(null)} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-500">
                                    <XCircle size={22} />
                                </button>
                            </div>

                            {!syncLogsLoading && !syncLogsError && syncLogs.length > 0 && (
                                <div className="grid grid-cols-3 divide-x divide-slate-100 border-b border-slate-100 bg-white">
                                    <div className="flex flex-col items-center justify-center py-3">
                                        <span className="text-2xl font-bold text-slate-800 leading-none">{totalSyncs}</span>
                                        <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mt-1">Total Syncs</span>
                                    </div>
                                    <div className="flex flex-col items-center justify-center py-3">
                                        <span className="text-2xl font-bold text-emerald-600 leading-none">{successfulSyncs}</span>
                                        <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mt-1">Successful</span>
                                    </div>
                                    <div className="flex flex-col items-center justify-center py-3">
                                        <span className={`text-2xl font-bold leading-none ${failedSyncs > 0 ? 'text-red-600' : 'text-slate-400'}`}>{failedSyncs}</span>
                                        <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mt-1">Failed</span>
                                    </div>
                                </div>
                            )}

                            <div className="p-5 overflow-y-auto custom-scrollbar space-y-2">
                                {syncLogsLoading && (
                                    <div className="flex items-center justify-center py-12 text-slate-400">
                                        <Loader2 size={20} className="animate-spin mr-2" />
                                        Loading sync logs…
                                    </div>
                                )}

                                {!syncLogsLoading && syncLogsError && (
                                    <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                                        <AlertCircle size={18} className="shrink-0 mt-0.5" />
                                        <div>
                                            <p className="font-semibold">Couldn't load sync logs</p>
                                            <p className="text-xs mt-0.5">{syncLogsError}</p>
                                        </div>
                                    </div>
                                )}

                                {!syncLogsLoading && !syncLogsError && syncLogs.length === 0 && (
                                    <div className="text-center py-12 text-slate-400">
                                        <History size={28} className="mx-auto mb-2 opacity-50" />
                                        <p className="text-sm">No sync runs yet for this account.</p>
                                    </div>
                                )}

                                {!syncLogsLoading && !syncLogsError && syncLogs.length > 0 && (
                                    <p className="text-[11px] text-slate-400 font-medium px-1 pb-1">
                                        Showing your most recent {syncLogs.length} sync {syncLogs.length === 1 ? 'run' : 'runs'}
                                    </p>
                                )}

                                {!syncLogsLoading && !syncLogsError && syncLogs.map((log, idx) => {
                                    let typeLabel = ({
                                        meesho_sales: 'Orders',
                                        meesho_payments: 'Payments',
                                        meesho_returns: 'Returns',
                                        meesho_claims: 'Claims',
                                    })[log.uploadType] || log.uploadType;

                                    const RETURN_TYPE_LABELS = {
                                        intransit: 'Returns (Intransit)',
                                        completed_delivered: 'Returns (Delivered)',
                                        ofd_reverse: 'Returns (RTO)',
                                    };
                                    if (log.uploadType === 'meesho_returns' && log.returnType && RETURN_TYPE_LABELS[log.returnType]) {
                                        // Prefer the structured field — reliable for every row, unlike
                                        // guessing from fileName (which older rows may not carry).
                                        typeLabel = RETURN_TYPE_LABELS[log.returnType];
                                    } else if (log.uploadType === 'meesho_returns' && log.fileName) {
                                        if (log.fileName.includes('_intransit_')) typeLabel = 'Returns (Intransit)';
                                        else if (log.fileName.includes('_delivered_') || log.fileName.includes('_completed_delivered_')) typeLabel = 'Returns (Delivered)';
                                        else if (log.fileName.includes('_rto_') || log.fileName.includes('_ofd_reverse_')) typeLabel = 'Returns (RTO)';
                                    }

                                    const TypeIcon = ({
                                        meesho_sales: Package,
                                        meesho_payments: CreditCard,
                                        meesho_returns: RotateCcw,
                                        meesho_claims: Shield,
                                    })[log.uploadType] || Package;
                                    const isCompleted = log.status === 'completed';
                                    const isProcessing = ['processing', 'validating'].includes(log.status);
                                    const isQueued = ['pending', 'pending_upload', 'queued_for_processing'].includes(log.status);
                                    // A failed row a later retry already fixed — still kept for the
                                    // audit trail, but must never read as an open problem or offer a
                                    // now-pointless retry button. Displayed identically to a normal
                                    // completed row (green "completed", no red/grey treatment) — the
                                    // user only cares that it's done, not that this specific attempt failed.
                                    const isResolved = (log.status === 'failed' || log.status === 'validation_failed') && resolvedFailureIdx.has(idx);
                                    const isFailed = (log.status === 'failed' || log.status === 'validation_failed') && !isResolved;
                                    const showAsCompleted = isCompleted || isResolved;

                                    return (
                                        <div key={idx} className={`p-3 bg-white border rounded-xl transition-colors animate-in fade-in slide-in-from-left-2 ${
                                            isFailed ? 'border-red-200 hover:border-red-300' : (isProcessing || isQueued) ? 'border-blue-200 hover:border-blue-300' : 'border-slate-200 hover:border-slate-300'
                                        }`} style={{ animationDelay: `${idx * 30}ms` }}>
                                            <div className="flex items-start gap-3">
                                                <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                                                    isFailed ? 'bg-red-50 text-red-600' : showAsCompleted ? 'bg-emerald-50 text-emerald-600' : (isProcessing || isQueued) ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600'
                                                }`}>
                                                    <TypeIcon size={16} />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span className="font-semibold text-sm text-slate-800">{typeLabel}</span>
                                                        <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-full tracking-wide inline-flex items-center gap-1 ${
                                                            isFailed ? 'bg-red-100 text-red-700' : showAsCompleted ? 'bg-emerald-100 text-emerald-700' : (isProcessing || isQueued) ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'
                                                        }`}>
                                                            {isFailed ? <XCircle size={10} /> : showAsCompleted ? <CheckCircle size={10} /> : isProcessing ? <Loader2 size={10} className="animate-spin" /> : <Clock size={10} />}
                                                            {showAsCompleted ? 'completed' : (isQueued && !log.status) ? 'queued' : (log.status || 'unknown').replace(/_/g, ' ')}
                                                        </span>
                                                    </div>
                                                    {log.uploadType === 'meesho_returns' ? (
                                                        <p className="text-[11px] text-slate-500 mt-0.5">Last 6 months</p>
                                                    ) : log.uploadType === 'meesho_claims' ? (
                                                        <p className="text-[11px] text-slate-500 mt-0.5">Last 3 months</p>
                                                    ) : (log.dateMin || log.dateMax) ? (
                                                        <p className="text-[11px] text-slate-500 mt-0.5">
                                                            Range: {log.dateMin || '—'} → {log.dateMax || '—'}
                                                        </p>
                                                    ) : null}
                                                    {log.createdAt && (
                                                        <p className="text-[11px] text-slate-400 mt-0.5">
                                                            {new Date(log.createdAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}
                                                        </p>
                                                    )}
                                                    {isFailed && (
                                                        <p className="text-[11px] text-red-600 mt-1.5 leading-relaxed">
                                                            {getFriendlySyncErrorMessage(log.errorMessage)}
                                                        </p>
                                                    )}
                                                </div>
                                                {isFailed && (
                                                    <button
                                                        onClick={() => handleRetryFailedSync(log, idx)}
                                                        disabled={retryingLogIdx === idx}
                                                        className="shrink-0 self-center inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold rounded-md border border-red-200 text-red-700 bg-red-50 hover:bg-red-100 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                                                    >
                                                        {retryingLogIdx === idx ? (
                                                            <Loader2 size={12} className="animate-spin" />
                                                        ) : (
                                                            <RefreshCw size={12} />
                                                        )}
                                                        {retryingLogIdx === idx
                                                            ? 'Re-triggering…'
                                                            : (log.uploadType === 'meesho_returns' && log.returnType)
                                                                ? `Retry this file only`
                                                                : 'Sync again'}
                                                    </button>
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

                {/* 4. Update Verification Modal */}
                {updateVerifyTarget && (
                    <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4 backdrop-blur-md animate-fadeIn">
                        <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6 animate-in zoom-in-95 duration-300">
                            <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4 text-amber-600">
                                <ShieldCheck size={24} className="animate-in zoom-in-50 duration-500" />
                            </div>
                            <h3 className="text-lg font-bold text-slate-800 mb-2 text-center">Verify Your Identity</h3>
                            <p className="text-slate-500 mb-6 text-sm text-center">
                                You are about to securely update credentials for <strong>{updateVerifyTarget.account?.email || updateVerifyTarget.account?.name}</strong>.
                                <br />Please verify your identity to continue.
                            </p>

                            <div className="bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-200 rounded-xl p-4 mb-6 space-y-3">
                                <div className="flex items-start gap-3">
                                    <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center shrink-0">
                                        <Shield className="text-amber-600" size={20} />
                                    </div>
                                    <div className="flex-1">
                                        <h4 className="text-sm font-bold text-amber-900 mb-1">Security Verification Required</h4>
                                        <p className="text-xs text-amber-700 leading-relaxed">
                                            To protect your account, please verify your Speedecom account password before making changes.
                                        </p>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-amber-900 mb-2">
                                        Your Account Password
                                    </label>
                                    <div className="relative">
                                        <input
                                            type={showUpdateVerifyPassword ? 'text' : 'password'}
                                            value={updateVerifyPassword}
                                            onChange={(e) => { setUpdateVerifyPassword(e.target.value); setUpdateVerifyError(''); }}
                                            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); confirmUpdateVerify(); } }}
                                            placeholder="Enter your Speedecom password"
                                            className="w-full px-4 py-2.5 rounded-xl border-2 border-amber-200 focus:border-amber-400 focus:ring-4 focus:ring-amber-400/20 outline-none transition-all placeholder:text-amber-400 pr-10 bg-white"
                                            disabled={updateVerifyLoading}
                                            autoFocus
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowUpdateVerifyPassword(v => !v)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-amber-500 hover:text-amber-700"
                                            disabled={updateVerifyLoading}
                                        >
                                            {showUpdateVerifyPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {updateVerifyError && (
                                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600 flex items-start gap-2">
                                    <XCircle size={16} className="mt-0.5 shrink-0" />
                                    <span>{updateVerifyError}</span>
                                </div>
                            )}

                            <div className="flex gap-3 justify-center">
                                <button
                                    onClick={() => { setUpdateVerifyTarget(null); setUpdateVerifyPassword(''); setUpdateVerifyError(''); }}
                                    disabled={updateVerifyLoading}
                                    className="px-5 py-2.5 text-slate-600 font-medium hover:bg-slate-50 hover:scale-105 active:scale-95 rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={confirmUpdateVerify}
                                    disabled={updateVerifyLoading}
                                    className="px-5 py-2.5 bg-amber-600 text-white font-medium hover:bg-amber-700 hover:scale-105 active:scale-95 rounded-xl transition-all duration-200 shadow-lg shadow-amber-500/20 flex items-center gap-2 disabled:hover:scale-100 disabled:opacity-70 disabled:cursor-not-allowed"
                                >
                                    {updateVerifyLoading ? <Loader2 className="animate-spin" size={16} /> : 'Continue'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* 5. Meesho Sync Modal */}
                {syncTarget && (
                    <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4 backdrop-blur-md animate-fadeIn" onClick={() => { stopSyncPoll(); setSyncTarget(null); setSyncFeedback(null); setSelectedSyncType(null); }}>
                        <div className="bg-white rounded-3xl w-full max-w-[440px] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.3)] overflow-hidden animate-zoomIn" onClick={(e) => e.stopPropagation()}>

                            {/* ── HEADER ── */}
                            <div className="relative overflow-hidden">
                                <div className="absolute inset-0 bg-gradient-to-r from-brand-600 via-brand-500 to-sky-500"></div>
                                <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-3xl"></div>
                                <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-white/5 rounded-full blur-2xl"></div>

                                <div className="relative z-10 px-6 py-5 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        {selectedSyncType && !syncFeedback?.type && (
                                            <button onClick={() => { setSelectedSyncType(null); setSyncFeedback(null); }} className="p-1.5 -ml-1 hover:bg-white/15 rounded-lg text-white/70 hover:text-white transition-all duration-200">
                                                <ArrowLeft size={18} />
                                            </button>
                                        )}
                                        <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-lg shadow-brand-700/20 border border-white/20">
                                            <RefreshCw size={16} className="text-white" />
                                        </div>
                                        <div>
                                            <h3 className="text-[15px] font-heading font-bold text-white leading-tight tracking-tight">Meesho AutoSync</h3>
                                            <p className="text-[11px] text-white/70 font-medium">{syncTarget.account?.name || syncTarget.account?.providerId}</p>
                                        </div>
                                    </div>
                                    <button onClick={() => { stopSyncPoll(); setSyncTarget(null); setSyncFeedback(null); setSelectedSyncType(null); }} className="p-1.5 hover:bg-white/20 rounded-lg text-white/60 hover:text-white transition-all duration-200">
                                        <X size={18} />
                                    </button>
                                </div>
                            </div>

                            <div className="p-5">
                                {/* Daily sync usage bar */}
                                <div className="mb-4 flex items-center justify-between">
                                    <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">Syncs Today</span>
                                    <div className="flex items-center gap-2">
                                        {syncUsageLoading ? (
                                            <Loader2 size={12} className="animate-spin text-slate-300" />
                                        ) : (
                                            <>
                                                <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                    <div
                                                        className={`h-full rounded-full transition-all duration-500 ${syncUsage.remaining === 0 ? 'bg-red-400' : syncUsage.remaining <= 5 ? 'bg-amber-400' : 'bg-brand-400'}`}
                                                        style={{ width: `${Math.min(100, (syncUsage.count / syncUsage.limit) * 100)}%` }}
                                                    />
                                                </div>
                                                <span className={`text-[11px] font-bold tabular-nums ${syncUsage.remaining === 0 ? 'text-red-500' : syncUsage.remaining <= 5 ? 'text-amber-500' : 'text-slate-500'}`}>
                                                    {syncUsage.count}/{syncUsage.limit}
                                                </span>
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* Feedback banner */}
                                {syncFeedback && (
                                    <div className={`mb-4 p-3.5 rounded-2xl text-[13px] flex items-start gap-2.5 border ${syncFeedback.type === 'success' ? 'bg-emerald-50 border-emerald-200/80 text-emerald-800' : syncFeedback.type === 'info' ? 'bg-brand-50 border-brand-200/80 text-brand-800' : syncFeedback.type === 'warning' ? 'bg-amber-50 border-amber-200/80 text-amber-800' : 'bg-red-50 border-red-200/80 text-red-800'}`}>
                                        {syncFeedback.type === 'success' ? <CheckCircle size={18} className="mt-0.5 shrink-0 text-emerald-500" /> : syncFeedback.type === 'info' ? <Loader2 size={18} className="mt-0.5 shrink-0 text-brand-500 animate-spin" /> : syncFeedback.type === 'warning' ? <AlertCircle size={18} className="mt-0.5 shrink-0 text-amber-500" /> : <XCircle size={18} className="mt-0.5 shrink-0 text-red-500" />}
                                        <span className="font-medium leading-snug">{syncFeedback.message}</span>
                                    </div>
                                )}

                                {/* Live per-dataset progress for "Sync All".
                                    The four datasets run SERIALLY behind one
                                    per-marketplace lock, so exactly one shows a
                                    spinner at a time and the rest are queued or
                                    finished. Without this the modal was blank
                                    for the whole multi-minute run. */}
                                {syncAllProgress?.datasets && (
                                    <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
                                        <div className="flex items-center justify-between mb-2.5">
                                            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Sync progress</span>
                                            {syncAllProgress.running && <Loader2 size={13} className="text-brand-500 animate-spin" />}
                                        </div>
                                        <div className="space-y-1.5">
                                            {['orders', 'payments', 'claims', 'returns'].map((t) => {
                                                const d = syncAllProgress.datasets[t] || {};
                                                const isActive = syncAllProgress.activeType === t;
                                                const failed = d.status === 'failed' || d.status === 'validation_failed';
                                                const done = d.status === 'completed' && !isActive;
                                                const month = syncMonthLabel(d.dateMin, d.dateMax);
                                                return (
                                                    <div key={t} className="flex items-start gap-2 text-[12px]">
                                                        <span className="shrink-0 mt-0.5">
                                                            {isActive ? <Loader2 size={13} className="text-brand-500 animate-spin" />
                                                                : failed ? <XCircle size={13} className="text-red-500" />
                                                                : done ? <CheckCircle size={13} className="text-emerald-500" />
                                                                : <span className="inline-block w-[13px] h-[13px] rounded-full border border-slate-300" />}
                                                        </span>
                                                        <span className="w-[68px] shrink-0 font-semibold text-slate-700 capitalize">{t}</span>
                                                        <span className={`leading-snug ${failed ? 'text-red-600' : isActive ? 'text-brand-700' : 'text-slate-500'}`}>
                                                            {isActive && d.progressMessage ? d.progressMessage
                                                                : failed ? (d.errorMessage || 'failed').slice(0, 70)
                                                                : done ? `${d.rowCount ?? 0} rows`
                                                                : d.queued ? 'queued…'
                                                                : '—'}
                                                            {month && (isActive || failed || done || d.queued) && (
                                                                <span className="text-slate-400"> · {month}</span>
                                                            )}
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        <p className="mt-2.5 text-[10px] text-slate-400 leading-snug">
                                            Datasets run one at a time — they share a single Meesho session, so they cannot be parallelised.
                                        </p>
                                    </div>
                                )}

                                {/* SUCCESS → Done */}
                                {syncFeedback?.type === 'success' && (
                                    <button onClick={() => { stopSyncPoll(); setSyncFeedback(null); setSyncAllProgress(null); }} className="w-full py-3 bg-gradient-to-r from-slate-800 to-slate-900 text-white hover:from-slate-700 hover:to-slate-800 font-bold rounded-2xl transition-all duration-200 shadow-lg shadow-slate-900/20 text-sm">Done</button>
                                )}

                                {/* ── CARD SELECTION ── */}
                                {!selectedSyncType && (!syncFeedback || syncFeedback.type === 'error') && (
                                    <div className="space-y-2.5">
                                        <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-widest mb-2">Select Sync Type</p>
                                        {/* ── Analysis month ──
                                            Drives everything downstream: on a new
                                            account this is where orders/payments
                                            start from, and on an existing one it is
                                            how you walk back through earlier months.
                                            Persisted server-side so the unattended
                                            scheduler honours the same choice. */}
                                        <div className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50/70 mb-1">
                                            <div className="flex items-center justify-between mb-2">
                                                <p className="text-[11px] text-slate-500 font-bold uppercase tracking-widest">Analysis month</p>
                                                {analysisMonth && (
                                                    <span className="text-[10px] font-bold text-brand-600">{analysisMonth}</span>
                                                )}
                                            </div>

                                            <select
                                                value={analysisMonth}
                                                onChange={(e) => applyAnalysisMonth(e.target.value)}
                                                disabled={syncLoading || syncPolling}
                                                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[13px] font-semibold text-slate-700 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100 disabled:opacity-50"
                                            >
                                                {analysisMonthOptions.map((o) => (
                                                    <option key={o.key} value={o.key}>
                                                        {o.label}
                                                        {o.isCurrent ? ' (current)' : ''}
                                                        {o.ordersAvailable ? '' : ' — orders unavailable'}
                                                    </option>
                                                ))}
                                            </select>

                                            <p className="mt-2 text-[10.5px] text-slate-400 leading-snug">
                                                Orders and payments come from this month. Returns and claims always
                                                cover their own history window, so the month does not restrict them.
                                                {ordersAvailableFrom && (
                                                    <>
                                                        {' '}Only months Meesho still has order reports for are listed
                                                        (from {ordersAvailableFrom}).
                                                    </>
                                                )}
                                            </p>

                                            {analysisMonth
                                                && !analysisMonthOptions.find(o => o.key === analysisMonth)?.ordersAvailable && (
                                                <p className="mt-2 text-[10.5px] text-amber-700 leading-snug font-medium">
                                                    Meesho only keeps order reports for about the last 5 months
                                                    {ordersAvailableFrom ? ` (back to ${ordersAvailableFrom})` : ''}.
                                                    Orders and payments will be skipped for this month — returns and
                                                    claims will still sync.
                                                </p>
                                            )}
                                        </div>


                                        {/* Limit reached warning */}
                                        {syncUsage.remaining === 0 && !syncUsageLoading && (
                                            <div className="p-3.5 rounded-2xl text-[13px] flex items-start gap-2.5 border bg-red-50 border-red-200/80 text-red-800 mb-1">
                                                <XCircle size={18} className="mt-0.5 shrink-0 text-red-500" />
                                                <span className="font-medium leading-snug">Daily limit reached ({syncUsage.count}/{syncUsage.limit}). Resets at 00:01 AM IST.</span>
                                            </div>
                                        )}

                                        {/* Sync All — recommended one-click option */}
                                        <button
                                            onClick={handleTriggerSyncAll}
                                            disabled={syncLoading || syncPolling || syncUsage.remaining === 0}
                                            className="w-full text-left p-4 bg-gradient-to-r from-brand-600 to-sky-500 rounded-2xl shadow-card hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-300 group disabled:opacity-50 disabled:pointer-events-none"
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className="w-11 h-11 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center shrink-0">
                                                    {syncLoading
                                                        ? <Loader2 size={20} className="text-white animate-spin" />
                                                        : <RefreshCw size={20} className="text-white" />}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center justify-between mb-0.5">
                                                        <h4 className="font-bold text-white text-[13px]">{syncLoading ? 'Starting…' : 'Sync All'}</h4>
                                                        <span className="text-[9px] font-bold text-white bg-white/20 border border-white/25 px-2 py-0.5 rounded-md uppercase tracking-wider">Recommended</span>
                                                    </div>
                                                    <p className="text-[11.5px] text-white/80 leading-relaxed">Orders, Payments, Returns &amp; Claims in one click</p>
                                                </div>
                                                <ArrowLeft size={14} className="text-white/70 rotate-180 transition-all duration-300 group-hover:translate-x-0.5 shrink-0" />
                                            </div>
                                        </button>

                                        <p className="text-[10px] text-slate-300 font-semibold uppercase tracking-widest text-center py-1">or sync individually</p>

                                        {/* Orders */}
                                        <button
                                            onClick={() => { setSelectedSyncType('orders'); setSyncFeedback(null); }}
                                            disabled={syncLoading || syncPolling || syncUsage.remaining === 0}
                                            className="w-full text-left p-4 bg-white rounded-2xl border border-slate-200/80 hover:border-brand-300 shadow-card hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-300 group disabled:opacity-50 disabled:pointer-events-none"
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className="w-11 h-11 rounded-xl bg-brand-50 group-hover:bg-brand-100 border border-brand-100/60 group-hover:border-brand-200 flex items-center justify-center transition-all duration-300 shrink-0 group-hover:shadow-[0_0_16px_rgba(14,165,233,0.15)]">
                                                    <Package size={20} className="text-brand-500 group-hover:text-brand-600 transition-colors" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center justify-between mb-0.5">
                                                        <h4 className="font-bold text-slate-800 text-[13px] group-hover:text-brand-800 transition-colors">Orders</h4>
                                                        <span className="text-[9px] font-bold text-slate-400 bg-slate-50 border border-slate-100 px-2 py-0.5 rounded-md uppercase tracking-wider">Date Range</span>
                                                    </div>
                                                    <p className="text-[11.5px] text-slate-400 leading-relaxed">Fetch order fulfillment data</p>
                                                </div>
                                                <ArrowLeft size={14} className="text-slate-300 group-hover:text-brand-400 rotate-180 transition-all duration-300 group-hover:translate-x-0.5 shrink-0" />
                                            </div>
                                        </button>

                                        {/* Payments */}
                                        <button
                                            onClick={() => { setSelectedSyncType('payments'); setSyncFeedback(null); }}
                                            disabled={syncLoading || syncPolling || syncUsage.remaining === 0}
                                            className="w-full text-left p-4 bg-white rounded-2xl border border-slate-200/80 hover:border-emerald-300 shadow-card hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-300 group disabled:opacity-50 disabled:pointer-events-none"
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className="w-11 h-11 rounded-xl bg-emerald-50 group-hover:bg-emerald-100 border border-emerald-100/60 group-hover:border-emerald-200 flex items-center justify-center transition-all duration-300 shrink-0 group-hover:shadow-[0_0_16px_rgba(16,185,129,0.15)]">
                                                    <CreditCard size={20} className="text-emerald-500 group-hover:text-emerald-600 transition-colors" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center justify-between mb-0.5">
                                                        <h4 className="font-bold text-slate-800 text-[13px] group-hover:text-emerald-800 transition-colors">Payments</h4>
                                                        <span className="text-[9px] font-bold text-slate-400 bg-slate-50 border border-slate-100 px-2 py-0.5 rounded-md uppercase tracking-wider">Date Range</span>
                                                    </div>
                                                    <p className="text-[11.5px] text-slate-400 leading-relaxed">Fetch settlement & payout data</p>
                                                </div>
                                                <ArrowLeft size={14} className="text-slate-300 group-hover:text-emerald-400 rotate-180 transition-all duration-300 group-hover:translate-x-0.5 shrink-0" />
                                            </div>
                                        </button>

                                        {/* Returns */}
                                        <button
                                            onClick={() => { setSelectedSyncType('returns'); setSyncFeedback(null); }}
                                            disabled={syncLoading || syncPolling || syncUsage.remaining === 0}
                                            className="w-full text-left p-4 bg-white rounded-2xl border border-slate-200/80 hover:border-amber-300 shadow-card hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-300 group disabled:opacity-50 disabled:pointer-events-none"
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className="w-11 h-11 rounded-xl bg-amber-50 group-hover:bg-amber-100 border border-amber-100/60 group-hover:border-amber-200 flex items-center justify-center transition-all duration-300 shrink-0 group-hover:shadow-[0_0_16px_rgba(245,158,11,0.15)]">
                                                    <RotateCcw size={20} className="text-amber-500 group-hover:text-amber-600 transition-colors" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center justify-between mb-0.5">
                                                        <h4 className="font-bold text-slate-800 text-[13px] group-hover:text-amber-800 transition-colors">Returns</h4>
                                                        <span className="text-[9px] font-bold text-amber-600 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-md uppercase tracking-wider">Auto · 6mo</span>
                                                    </div>
                                                    <p className="text-[11.5px] text-slate-400 leading-relaxed">Fetch in-transit, RTO & delivered data</p>
                                                </div>
                                                <ArrowLeft size={14} className="text-slate-300 group-hover:text-amber-400 rotate-180 transition-all duration-300 group-hover:translate-x-0.5 shrink-0" />
                                            </div>
                                        </button>

                                        {/* Claims */}
                                        <button
                                            onClick={() => { setSelectedSyncType('claims'); setSyncFeedback(null); }}
                                            disabled={syncLoading || syncPolling || syncUsage.remaining === 0}
                                            className="w-full text-left p-4 bg-white rounded-2xl border border-slate-200/80 hover:border-violet-300 shadow-card hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-300 group disabled:opacity-50 disabled:pointer-events-none"
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className="w-11 h-11 rounded-xl bg-violet-50 group-hover:bg-violet-100 border border-violet-100/60 group-hover:border-violet-200 flex items-center justify-center transition-all duration-300 shrink-0 group-hover:shadow-[0_0_16px_rgba(139,92,246,0.15)]">
                                                    <Shield size={20} className="text-violet-500 group-hover:text-violet-600 transition-colors" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center justify-between mb-0.5">
                                                        <h4 className="font-bold text-slate-800 text-[13px] group-hover:text-violet-800 transition-colors">Claims</h4>
                                                        <span className="text-[9px] font-bold text-violet-600 bg-violet-50 border border-violet-100 px-2 py-0.5 rounded-md uppercase tracking-wider">Auto · 3mo</span>
                                                    </div>
                                                    <p className="text-[11.5px] text-slate-400 leading-relaxed">Fetch return & RTO claim tickets</p>
                                                </div>
                                                <ArrowLeft size={14} className="text-slate-300 group-hover:text-violet-400 rotate-180 transition-all duration-300 group-hover:translate-x-0.5 shrink-0" />
                                            </div>
                                        </button>

                                        <button onClick={() => { stopSyncPoll(); setSyncTarget(null); setSyncFeedback(null); setSelectedSyncType(null); }} className="w-full py-2.5 text-red-400 text-[12px] font-medium hover:text-red-500 hover:bg-red-50 rounded-xl transition-all duration-200 mt-1 flex items-center justify-center gap-1.5">
                                            <X size={14} />
                                            Cancel
                                        </button>
                                    </div>
                                )}

                                {/* ── EXPANDED: Orders / Payments ── */}
                                {(selectedSyncType === 'orders' || selectedSyncType === 'payments') && (!syncFeedback || syncFeedback.type === 'error') && (
                                    <div className="space-y-3 animate-slideInRight">
                                        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-card">
                                            <div className="flex items-center justify-between mb-5">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${selectedSyncType === 'orders' ? 'bg-brand-50 border-brand-100 text-brand-500' : 'bg-emerald-50 border-emerald-100 text-emerald-500'}`}>
                                                        {selectedSyncType === 'orders' ? <Package size={18} /> : <CreditCard size={18} />}
                                                    </div>
                                                    <div>
                                                        <h4 className="font-bold text-slate-800 text-sm">{selectedSyncType === 'orders' ? 'Orders' : 'Payments'}</h4>
                                                        <p className="text-[11px] text-slate-400">Select date range</p>
                                                    </div>
                                                </div>
                                                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider border ${selectedSyncType === 'orders' ? 'bg-brand-50 text-brand-600 border-brand-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}>Max 31 Days</span>
                                            </div>

                                            <DateRangePicker
                                                startDate={syncDateRange.min}
                                                endDate={syncDateRange.max}
                                                onChange={(range) => setSyncDateRange(range)}
                                                accentColor={selectedSyncType === 'orders' ? 'brand' : 'emerald'}
                                                maxDays={31}
                                            />

                                            <div className="flex items-center justify-between mt-1 mb-3">
                                                <span className="text-[10px] text-slate-300 font-medium">Max range: 31 days</span>
                                                <button type="button" onClick={fillLastMonth} disabled={syncLoading} className={`text-[10px] font-bold disabled:opacity-50 transition-colors ${selectedSyncType === 'orders' ? 'text-brand-500 hover:text-brand-600' : 'text-emerald-500 hover:text-emerald-600'}`}>Auto-fill last month →</button>
                                            </div>

                                            <button
                                                onClick={() => handleTriggerSync(selectedSyncType)}
                                                disabled={syncLoading || syncPolling || syncUsage.remaining === 0}
                                                className={`w-full py-3 text-white font-bold rounded-xl transition-all duration-200 flex items-center justify-center gap-2 text-sm shadow-lg hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:pointer-events-none ${selectedSyncType === 'orders' ? 'bg-gradient-to-r from-brand-500 to-brand-600 hover:from-brand-600 hover:to-brand-700 shadow-brand-500/25' : 'bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 shadow-emerald-500/25'}`}
                                            >
                                                {(syncLoading || syncPolling) ? <Loader2 className="animate-spin" size={16} /> : <RefreshCw size={16} />}
                                                {selectedSyncType === 'orders' ? 'Start Orders Sync' : 'Start Payments Sync'}
                                            </button>
                                        </div>
                                        <button onClick={() => setSelectedSyncType(null)} disabled={syncLoading} className="w-full py-2 text-slate-400 text-[12px] font-medium hover:text-slate-600 transition-colors disabled:opacity-50">← Back</button>
                                    </div>
                                )}

                                {/* ── EXPANDED: Returns ── */}
                                {selectedSyncType === 'returns' && (!syncFeedback || syncFeedback.type === 'error') && (
                                    <div className="space-y-3 animate-slideInRight">
                                        <div className="relative p-5 rounded-2xl border border-amber-200/50 shadow-card overflow-hidden">
                                            <div className="absolute inset-0 bg-gradient-to-br from-amber-50/90 via-white to-orange-50/60"></div>
                                            <div className="absolute -top-6 -right-6 w-32 h-32 bg-amber-300/10 rounded-full blur-3xl"></div>

                                            <div className="flex items-center justify-between mb-5 relative z-10">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-400/25">
                                                        <RotateCcw size={18} className="text-white" />
                                                    </div>
                                                    <div>
                                                        <h4 className="font-bold text-slate-800 text-sm">Returns Pipeline</h4>
                                                        <p className="text-[11px] text-slate-400">Fully automated</p>
                                                    </div>
                                                </div>
                                                <span className="text-[9px] font-bold text-amber-700 bg-white border border-amber-200/60 px-2 py-0.5 rounded-md uppercase tracking-wider shadow-sm">6 Months</span>
                                            </div>

                                            <div className="mb-5 p-3.5 bg-white/70 backdrop-blur-sm rounded-xl border border-amber-100/60 relative z-10">
                                                <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider mb-3">Downloads data for</p>
                                                <div className="space-y-2.5">
                                                    <div className="flex items-center gap-3 text-[12px] text-slate-600">
                                                        <div className="w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.5)]"></div>
                                                        <span><span className="font-semibold text-slate-700">In-Transit</span> — returning to origin</span>
                                                    </div>
                                                    <div className="flex items-center gap-3 text-[12px] text-slate-600">
                                                        <div className="w-2 h-2 rounded-full bg-orange-400 shadow-[0_0_8px_rgba(251,146,60,0.5)]"></div>
                                                        <span><span className="font-semibold text-slate-700">Out for Delivery</span> — reverse pickups</span>
                                                    </div>
                                                    <div className="flex items-center gap-3 text-[12px] text-slate-600">
                                                        <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]"></div>
                                                        <span><span className="font-semibold text-slate-700">Delivered</span> — completed returns</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <button
                                                onClick={() => handleTriggerSync('returns')}
                                                disabled={syncLoading || syncPolling || syncUsage.remaining === 0}
                                                className="w-full py-3 bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 text-white font-bold rounded-xl transition-all duration-200 shadow-lg shadow-amber-500/25 hover:shadow-amber-500/40 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-60 disabled:pointer-events-none flex items-center justify-center gap-2 text-sm relative z-10"
                                            >
                                                {(syncLoading || syncPolling) ? <Loader2 className="animate-spin" size={16} /> : <RotateCcw size={16} />}
                                                Start Returns Sync
                                            </button>
                                        </div>
                                        <button onClick={() => setSelectedSyncType(null)} disabled={syncLoading} className="w-full py-2 text-slate-400 text-[12px] font-medium hover:text-slate-600 transition-colors disabled:opacity-50">← Back</button>
                                    </div>
                                )}

                                {/* ── EXPANDED: Claims ── */}
                                {selectedSyncType === 'claims' && (!syncFeedback || syncFeedback.type === 'error') && (
                                    <div className="space-y-3 animate-slideInRight">
                                        <div className="relative p-5 rounded-2xl border border-violet-200/50 shadow-card overflow-hidden">
                                            <div className="absolute inset-0 bg-gradient-to-br from-violet-50/90 via-white to-purple-50/60"></div>
                                            <div className="absolute -top-6 -right-6 w-32 h-32 bg-violet-300/10 rounded-full blur-3xl"></div>

                                            <div className="flex items-center justify-between mb-5 relative z-10">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-400 to-purple-500 flex items-center justify-center shadow-lg shadow-violet-400/25">
                                                        <Shield size={18} className="text-white" />
                                                    </div>
                                                    <div>
                                                        <h4 className="font-bold text-slate-800 text-sm">Claims Pipeline</h4>
                                                        <p className="text-[11px] text-slate-400">Fully automated</p>
                                                    </div>
                                                </div>
                                                <span className="text-[9px] font-bold text-violet-700 bg-white border border-violet-200/60 px-2 py-0.5 rounded-md uppercase tracking-wider shadow-sm">3 Months</span>
                                            </div>

                                            <div className="mb-5 p-3.5 bg-white/70 backdrop-blur-sm rounded-xl border border-violet-100/60 relative z-10">
                                                <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider mb-3">Downloads data for</p>
                                                <div className="space-y-2.5">
                                                    <div className="flex items-center gap-3 text-[12px] text-slate-600">
                                                        <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]"></div>
                                                        <span><span className="font-semibold text-slate-700">Approved</span> — compensated claims</span>
                                                    </div>
                                                    <div className="flex items-center gap-3 text-[12px] text-slate-600">
                                                        <div className="w-2 h-2 rounded-full bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.5)]"></div>
                                                        <span><span className="font-semibold text-slate-700">Rejected</span> — denied claims</span>
                                                    </div>
                                                    <div className="flex items-center gap-3 text-[12px] text-slate-600">
                                                        <div className="w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.5)]"></div>
                                                        <span><span className="font-semibold text-slate-700">Open</span> — pending review</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <button
                                                onClick={() => handleTriggerSync('claims')}
                                                disabled={syncLoading || syncPolling || syncUsage.remaining === 0}
                                                className="w-full py-3 bg-gradient-to-r from-violet-400 to-purple-500 hover:from-violet-500 hover:to-purple-600 text-white font-bold rounded-xl transition-all duration-200 shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-60 disabled:pointer-events-none flex items-center justify-center gap-2 text-sm relative z-10"
                                            >
                                                {(syncLoading || syncPolling) ? <Loader2 className="animate-spin" size={16} /> : <Shield size={16} />}
                                                Start Claims Sync
                                            </button>
                                        </div>
                                        <button onClick={() => setSelectedSyncType(null)} disabled={syncLoading} className="w-full py-2 text-slate-400 text-[12px] font-medium hover:text-slate-600 transition-colors disabled:opacity-50">← Back</button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Success Toast */}
                {successMessage && (
                    <SuccessToast
                        message={successMessage}
                        onClose={() => setSuccessMessage(null)}
                    />
                )}
            </div>
        </DashboardLayout>
    );
};

export default MarketplaceSettings;

