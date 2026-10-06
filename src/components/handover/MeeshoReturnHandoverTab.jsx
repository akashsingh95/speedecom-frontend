import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
    Play, Square, RefreshCw, Volume2, VolumeX, ShieldCheck,
    Truck, Package, Clock, Copy, Check, ChevronDown, ChevronUp,
    Search, Sparkles, ExternalLink, Layers, Store, AlertCircle
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Combobox, ComboboxButton, ComboboxInput, ComboboxOption, ComboboxOptions } from '@headlessui/react';
import { toast } from 'sonner';
import api from '../../api';

// Where sellers connect / update Meesho accounts (Connected Accounts modal).
const CONNECTED_MARKETPLACES_PATH = '/settings/marketplace';
const BILLING_PATH = '/subscription';

const HANDOVER_ERROR_MESSAGES = {
    UPSTREAM_BLOCKED:    'Fetching OTP — showing last known code',
    CIRCUIT_OPEN:        'Temporarily paused — showing last known OTP',
    UPSTREAM_UNAVAILABLE:'Unable to reach Meesho — showing last known OTP',
    UPSTREAM_BUSY:       'Loading OTP…',
    RATE_LIMITED:        'Too many requests — showing last known OTP',
    UPSTREAM_ERROR:      'Meesho returned an error — showing last known OTP',
    INVALID_RESPONSE:    'Unexpected response from Meesho — showing last known OTP',
};
const friendlyHandoverError = (errorCode) =>
    HANDOVER_ERROR_MESSAGES[errorCode] || 'Could not fetch OTP — showing last known code';

// Web Audio API Dual-Tone Chime for new OTPs (pleasant soft chime)
const playChime = () => {
    try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        const now = ctx.currentTime;

        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();

        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(587.33, now); // D5
        osc1.frequency.exponentialRampToValueAtTime(880, now + 0.15); // A5

        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(880, now + 0.15); // A5
        osc2.frequency.exponentialRampToValueAtTime(1174.66, now + 0.35); // D6

        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);

        osc1.start(now);
        osc2.start(now + 0.15);
        osc1.stop(now + 0.4);
        osc2.stop(now + 0.6);
        setTimeout(() => ctx.close().catch(() => {}), 800);
    } catch (e) {
        console.warn('Audio chime failed', e);
    }
};

// Courier Brand Colors & Fallback Icons
const COURIER_META = {
    shadowfax: { bg: 'bg-orange-500/10', text: 'text-orange-600', border: 'border-orange-200', tag: 'Shadowfax' },
    valmo: { bg: 'bg-blue-500/10', text: 'text-blue-600', border: 'border-blue-200', tag: 'Valmo' },
    delhivery: { bg: 'bg-rose-500/10', text: 'text-rose-600', border: 'border-rose-200', tag: 'Delhivery' },
    xpressbees: { bg: 'bg-amber-500/10', text: 'text-amber-600', border: 'border-amber-200', tag: 'XpressBees' },
    'ecom express': { bg: 'bg-emerald-500/10', text: 'text-emerald-600', border: 'border-emerald-200', tag: 'Ecom Express' },
};

const WATCH_DURATION_SECONDS = 10 * 60; // 10 minutes
const POLL_INTERVAL_MS = 4000; // 4 seconds
// +/- jitter on every poll so the request cadence isn't machine-perfect —
// a fixed interval is one of the strongest signals Akamai's bot detection
// looks for, independent of proxy IP quality.
const POLL_JITTER_MS = 700;

const copyToClipboard = async (text) => {
    if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return;
    }

    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand('copy');
    textarea.remove();
    if (!copied) throw new Error('Copy command was rejected');
};

const formatRemainingTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

// One row per SKU in a rider's bag: total quantity, how many parcels (AWBs)
// carry it and the sizes seen. Parcels whose returns are not synced yet have
// no SKU and are grouped into a single "not synced" row, listed last.
const summariseBySku = (items = []) => {
    const groups = new Map();
    items.forEach((item) => {
        const pending = !item.matched;
        const key = pending ? '__pending__' : (item.sku || 'Unknown SKU');
        if (!groups.has(key)) {
            groups.set(key, {
                key,
                sku: pending ? 'Not synced yet' : (item.sku || 'Unknown SKU'),
                variations: new Set(),
                qty: 0,
                awbs: new Set(),
                pending,
            });
        }
        const group = groups.get(key);
        group.qty += Math.max(1, Number(item.qty) || 1);
        if (item.variation) group.variations.add(item.variation);
        if (item.awb) group.awbs.add(item.awb);
    });
    return [...groups.values()].sort((a, b) =>
        Number(a.pending) - Number(b.pending) || b.qty - a.qty || a.sku.localeCompare(b.sku));
};

const formatExpiryCountdown = (isoString, nowMs = Date.now()) => {
    if (!isoString) return null;
    const expiry = new Date(isoString);
    if (Number.isNaN(expiry.getTime())) return null;
    const diffMs = expiry.getTime() - nowMs;
    if (diffMs <= 0) return 'Expired';

    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    const timeStr = expiry.toLocaleTimeString('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
    });
    if (diffHours > 0) {
        return `Valid for ${diffHours}h ${diffMins}m (until ${timeStr})`;
    }
    return `Valid for ${diffMins}m (until ${timeStr})`;
};

const expirySortValue = (otp) => {
    const time = otp.expiryTimestamp ? Date.parse(otp.expiryTimestamp) : NaN;
    return Number.isNaN(time) ? Number.POSITIVE_INFINITY : time;
};

export default function MeeshoReturnHandoverTab({ accounts: connectedAccounts = [], onLiveStatsChange }) {
    const [isWatching, setIsWatching] = useState(false);
    const [timeLeft, setTimeLeft] = useState(WATCH_DURATION_SECONDS);
    const [soundEnabled, setSoundEnabled] = useState(() => {
        if (typeof window === 'undefined') return true;
        try {
            return window.localStorage.getItem('meesho-handover-sound') !== 'off';
        } catch {
            return true;
        }
    });
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    // Last result per account: { name, otps, fetchedAt, error, errorCode, stale }.
    // Switching the dropdown reads from here and never calls the API — only
    // Refresh and the watcher fetch.
    const [accountData, setAccountData] = useState({});
    // Accounts with their connection state (ready / no_password /
    // wrong_password) from /handover-accounts — no Meesho call.
    const [accountList, setAccountList] = useState(null);
    // Tenant-level (not per-account) block: null unless the server reports a
    // zero/negative balance — set from whichever of /handover-accounts or
    // /handover-otps answers first, and never cleared by a stale response.
    const [billingBlockedMessage, setBillingBlockedMessage] = useState(null);
    const [responseMeta, setResponseMeta] = useState(null);
    const [connectionError, setConnectionError] = useState('');
    const [selectedCourier, setSelectedCourier] = useState('all');
    const [selectedAccount, setSelectedAccount] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedCards, setExpandedCards] = useState({});
    const [copiedOtpId, setCopiedOtpId] = useState(null);
    const [clockNow, setClockNow] = useState(Date.now());

    // Refs keep polling callbacks stable and prevent overlapping requests when
    // a warehouse connection is slower than the four-second interval.
    const accountDataRef = useRef({});
    const inFlightRef = useRef(false);
    const soundEnabledRef = useRef(soundEnabled);
    const selectedAccountRef = useRef('all');
    const watchEndsAtRef = useRef(null);
    // Whether the dropdown's current scope has any account that can be fetched.
    const canFetchRef = useRef(true);
    selectedAccountRef.current = selectedAccount;

    useEffect(() => {
        soundEnabledRef.current = soundEnabled;
    }, [soundEnabled]);

    useEffect(() => {
        try {
            window.localStorage.setItem('meesho-handover-sound', soundEnabled ? 'on' : 'off');
        } catch {
            // Preference persistence is optional.
        }
    }, [soundEnabled]);

    useEffect(() => {
        const clockTimer = setInterval(() => setClockNow(Date.now()), 1000);
        return () => clearInterval(clockTimer);
    }, []);

    // Account list with connection state. Reads Mongo/Redis only — this is not
    // an OTP fetch and never reaches Meesho.
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await api.get('/meesho-sync/handover-accounts', { skipErrorToast: true });
                const payload = res.data?.success && res.data?.data ? res.data.data : res.data;
                if (cancelled) return;
                if (payload?.billingBlocked) setBillingBlockedMessage(payload.billingBlockedMessage || 'This feature is currently unavailable.');
                if (Array.isArray(payload?.accounts)) setAccountList(payload.accounts);
            } catch (err) {
                console.error('[MeeshoHandover] Failed to load handover accounts:', err);
            }
        })();
        return () => { cancelled = true; };
    }, []);

    // Fetch live handover OTPs for the dropdown's current scope — the server
    // calls Meesho for each ready account. Called only by the Refresh button
    // and the watcher. One request at a time: a watcher tick that lands while
    // one is in flight is skipped, not queued.
    // sendResponse() sends the payload directly, but accept the legacy
    // { success, data } shape too during rolling deployments.
    const fetchOtps = useCallback(async (isSilent = false) => {
        // Nothing in scope can be fetched (no password / rejected password):
        // never call the API for it.
        if (inFlightRef.current || !canFetchRef.current) return;

        const requestAccount = selectedAccountRef.current;
        inFlightRef.current = true;
        if (!isSilent) setLoading(true);
        else setRefreshing(true);

        try {
            const res = await api.get('/meesho-sync/handover-otps', {
                params: requestAccount === 'all' ? undefined : { marketplaceId: requestAccount },
                skipErrorToast: true,
            });
            const payload = res.data?.success && res.data?.data ? res.data.data : res.data;
            if (!payload || !Array.isArray(payload.otps)) {
                throw new Error('Invalid live handover response');
            }
            if (payload.billingBlocked) setBillingBlockedMessage(payload.billingBlockedMessage || 'This feature is currently unavailable.');

            const responseAccounts = Array.isArray(payload.accounts) ? payload.accounts : [];
            const previous = accountDataRef.current;
            const updates = {};
            const connectionUpdates = {};
            let hasNew = false;
            responseAccounts.forEach(account => {
                if (account.errorCode === 'NOT_CONFIGURED' || account.errorCode === 'WRONG_PASSWORD') {
                    connectionUpdates[account.id] = account.errorCode === 'NOT_CONFIGURED' ? 'no_password' : 'wrong_password';
                    return;
                }
                if (account.connection) connectionUpdates[account.id] = account.connection;
                const otps = payload.otps.filter(otp => otp.marketplaceId === account.id);
                // An account fetched before (even with zero OTPs) is a known
                // baseline, so its first new OTP chimes. A never-fetched
                // account only records what it sees.
                const known = previous[account.id];
                if (known) {
                    const knownIds = new Set(known.otps.map(otp => otp.id));
                    if (otps.some(otp => otp.id && !knownIds.has(otp.id))) hasNew = true;
                }
                updates[account.id] = {
                    name: account.name,
                    otps,
                    fetchedAt: account.fetchedAt || payload.timestamp || new Date().toISOString(),
                    error: account.error || null,
                    errorCode: account.errorCode || null,
                    stale: Boolean(account.stale),
                    notice: account.notice || null,
                };
            });

            // Results are stored per account, so a response that lands after
            // the dropdown moved is still correct for the accounts it covers.
            accountDataRef.current = { ...previous, ...updates };
            setAccountData(accountDataRef.current);
            if (Object.keys(connectionUpdates).length) {
                setAccountList(list => (list || []).map(account => (
                    connectionUpdates[account.id] ? { ...account, connection: connectionUpdates[account.id] } : account
                )));
            }
            setResponseMeta({
                scope: requestAccount,
                stale: Boolean(payload.stale),
                staleReason: payload.staleReason || '',
            });
            setConnectionError('');

            if (hasNew && soundEnabledRef.current) {
                playChime();
                toast.success('New Return Handover OTP received!');
            }
        } catch (err) {
            const message = err.response?.data?.message || err.message || 'Failed to fetch live handover OTPs';
            setConnectionError(message);
            if (!isSilent) {
                console.error('[MeeshoHandover] Failed to fetch live OTPs:', err);
                toast.error(message);
            }
        } finally {
            inFlightRef.current = false;
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    // Watcher: an immediate fetch on start, then one every four seconds for
    // the dropdown's scope at each tick. Browser timers can be throttled in a
    // background tab, so expiry uses an absolute deadline. A hidden browser
    // tab pauses polling; the next tick after it becomes visible resumes it.
    useEffect(() => {
        if (!isWatching) return undefined;

        const updateRemaining = () => {
            const endsAt = watchEndsAtRef.current;
            if (!endsAt) return;

            const remainingMs = Math.max(0, endsAt - Date.now());
            setTimeLeft(Math.max(0, Math.ceil(remainingMs / 1000)));
            if (remainingMs <= 0) {
                watchEndsAtRef.current = null;
                setIsWatching(false);
                setTimeLeft(WATCH_DURATION_SECONDS);
                toast.info('Watch timer ended (10 mins). Click Go Live to resume.');
            }
        };

        const onVisibilityChange = () => {
            if (document.visibilityState === 'visible') updateRemaining();
        };

        updateRemaining();

        let pollTimeoutId = null;
        const scheduleNextPoll = () => {
            const jitter = (Math.random() * 2 - 1) * POLL_JITTER_MS;
            const delay = Math.max(1000, POLL_INTERVAL_MS + jitter);
            pollTimeoutId = setTimeout(() => {
                if (document.visibilityState === 'visible' && watchEndsAtRef.current) fetchOtps(true);
                scheduleNextPoll();
            }, delay);
        };
        scheduleNextPoll();

        const countdownTimer = setInterval(updateRemaining, 250);
        document.addEventListener('visibilitychange', onVisibilityChange);

        return () => {
            clearTimeout(pollTimeoutId);
            clearInterval(countdownTimer);
            document.removeEventListener('visibilitychange', onVisibilityChange);
        };
    }, [isWatching, fetchOtps]);

    const handleToggleWatch = () => {
        if (isWatching) {
            watchEndsAtRef.current = null;
            setIsWatching(false);
            setTimeLeft(WATCH_DURATION_SECONDS);
        } else {
            watchEndsAtRef.current = Date.now() + (WATCH_DURATION_SECONDS * 1000);
            setIsWatching(true);
            setTimeLeft(WATCH_DURATION_SECONDS);
            fetchOtps(false);
            toast.success('Live Watcher Started (4s real-time check)');
        }
    };

    // No fetch here: the next Refresh or watcher tick uses the new scope.
    const handleAccountChange = (accountId) => {
        if (accountId === selectedAccount) return;
        setSelectedAccount(accountId);
    };

    const toggleCardExpansion = (id) => {
        setExpandedCards(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const handleCopy = async (text, id) => {
        try {
            await copyToClipboard(text);
            setCopiedOtpId(id);
            toast.success(`Copied OTP: ${text}`);
            setTimeout(() => setCopiedOtpId(null), 2000);
        } catch {
            toast.error('Could not copy to the clipboard');
        }
    };

    // Dropdown options: /handover-accounts (with connection state) once loaded,
    // else the page's account list; plus any account a response returned.
    const accountOptions = useMemo(() => {
        const options = new Map();
        const source = accountList || connectedAccounts || [];
        source.forEach(account => {
            const id = account._id || account.id;
            if (id) {
                options.set(String(id), {
                    id: String(id),
                    name: account.name || 'Meesho account',
                    // Unknown until /handover-accounts answers; the server
                    // still refuses to fetch an account without a password.
                    connection: account.connection || 'ready',
                });
            }
        });
        Object.entries(accountData).forEach(([id, entry]) => {
            if (!options.has(id)) options.set(id, { id, name: entry.name || 'Meesho account', connection: 'ready' });
        });
        return [...options.values()];
    }, [accountList, connectedAccounts, accountData]);

    const readyOptions = useMemo(
        () => accountOptions.filter(account => account.connection === 'ready'),
        [accountOptions],
    );
    // Searchable account picker: "All" first, then every account with its
    // connection state; the query matches account names.
    const [accountQuery, setAccountQuery] = useState('');
    const pickerOptions = useMemo(() => [
        { id: 'all', name: `All Connected Accounts (${readyOptions.length})`, connection: 'ready', suffix: '' },
        ...accountOptions.map(account => ({
            ...account,
            suffix: account.connection === 'no_password'
                ? 'password needed'
                : account.connection === 'wrong_password'
                    ? 'password rejected'
                    : accountData[account.id] ? `${accountData[account.id].otps.length} live` : '',
        })),
    ], [accountOptions, readyOptions.length, accountData]);
    const filteredAccountOptions = useMemo(() => {
        const q = accountQuery.trim().toLowerCase();
        if (!q) return pickerOptions;
        return pickerOptions.filter(option => option.name.toLowerCase().includes(q));
    }, [pickerOptions, accountQuery]);
    const accountDisplayValue = useCallback(
        id => pickerOptions.find(option => option.id === id)?.name || '',
        [pickerOptions],
    );
    const selectedOption = selectedAccount === 'all'
        ? null
        : accountOptions.find(account => account.id === selectedAccount) || null;
    const selectedNotReady = Boolean(selectedOption && selectedOption.connection !== 'ready');
    const noReadyAccounts = selectedAccount === 'all' && accountList !== null && readyOptions.length === 0;
    const canFetch = !selectedNotReady && !noReadyAccounts && !billingBlockedMessage;
    canFetchRef.current = canFetch;

    // "All" means every account that can be fetched; accounts without a usable
    // password are never counted, fetched or listed as errors there.
    const scopeIds = useMemo(() => {
        if (selectedAccount === 'all') return readyOptions.map(account => account.id);
        return selectedNotReady ? [] : [selectedAccount];
    }, [readyOptions, selectedAccount, selectedNotReady]);

    const fetchedIds = useMemo(
        () => scopeIds.filter(id => accountData[id]),
        [scopeIds, accountData],
    );
    const notFetchedCount = scopeIds.length - fetchedIds.length;

    // Keep every summary number in the same scope as the dropdown.
    const accountOtps = useMemo(() => fetchedIds
        .flatMap(id => accountData[id].otps || [])
        .sort((left, right) => {
            const diff = expirySortValue(left) - expirySortValue(right);
            if (diff !== 0) return diff;
            return (left.marketplaceName || '').localeCompare(right.marketplaceName || '');
        }), [fetchedIds, accountData]);

    // Accounts whose Meesho login failed after the server's retries: shown in
    // their own banner with a link to log in again, not as a status chip.
    // Each account keeps its own message — the server tells apart "Akamai/proxy
    // blocked every attempt" from "Meesho's app answered but we don't recognise
    // the failure", and a single combined sentence can't say both accurately
    // when several accounts fail for different reasons.
    const loginRequiredAccounts = useMemo(() => fetchedIds
        .filter(id => accountData[id].errorCode === 'LOGIN_REQUIRED')
        .map(id => ({
            id,
            name: accountOptions.find(account => account.id === id)?.name || accountData[id].name || 'Meesho account',
            error: accountData[id].error,
        })),
    [fetchedIds, accountData, accountOptions]);

    const scopeAccountErrors = useMemo(() => {
        const errors = fetchedIds
            .filter(id => accountData[id].errorCode !== 'LOGIN_REQUIRED')
            .filter(id => accountData[id].error || accountData[id].notice)
            .map(id => ({
                id,
                name: accountOptions.find(account => account.id === id)?.name || accountData[id].name,
                error: accountData[id].error,
                errorCode: accountData[id].errorCode,
                notice: accountData[id].notice,
                stale: accountData[id].stale,
            }));
        if (errors.length > 0) {
            console.group('[MeeshoHandover] Account errors');
            errors.forEach(a => console.log(`${a.name} | code: ${a.errorCode} | raw: ${a.error}`));
            console.groupEnd();
        }
        return errors;
    }, [fetchedIds, accountData, accountOptions]);

    // Oldest fetch in scope — the honest "updated at" for a combined view.
    const lastSyncTime = useMemo(() => {
        const times = fetchedIds
            .map(id => Date.parse(accountData[id].fetchedAt))
            .filter(time => !Number.isNaN(time));
        return times.length ? new Date(Math.min(...times)) : null;
    }, [fetchedIds, accountData]);

    const showStaleBanner = Boolean(responseMeta?.stale) &&
        (responseMeta.scope === selectedAccount || responseMeta.scope === 'all');

    const displayStats = useMemo(() => {
        const totalParcels = accountOtps.reduce(
            (sum, otp) => sum + (Number.isFinite(Number(otp.parcelCount)) ? Number(otp.parcelCount) : 0),
            0,
        );
        return {
            totalAccounts: scopeIds.length,
            totalOtps: accountOtps.length,
            totalParcels,
        };
    }, [accountOtps, scopeIds]);

    useEffect(() => {
        if (!onLiveStatsChange) return;
        onLiveStatsChange({
            totalAccounts: displayStats.totalAccounts,
            totalOtps: displayStats.totalOtps,
            totalParcels: displayStats.totalParcels,
            isWatching,
        });
    }, [
        displayStats.totalAccounts,
        displayStats.totalOtps,
        displayStats.totalParcels,
        isWatching,
        onLiveStatsChange,
    ]);

    useEffect(() => () => {
        onLiveStatsChange?.({
            totalAccounts: 0,
            totalOtps: 0,
            totalParcels: 0,
            isWatching: false,
        });
    }, [onLiveStatsChange]);

    const displayCouriers = useMemo(() => {
        const courierMap = new Map();
        accountOtps.forEach(otp => {
            const key = (otp.carrierName || 'Other').toLowerCase();
            if (!courierMap.has(key)) {
                courierMap.set(key, {
                    carrierKey: key,
                    name: otp.carrierDisplayName || otp.carrierName || 'Courier',
                    icon: otp.carrierIcon || null,
                    codeCount: 0,
                    parcelCount: 0,
                });
            }
            const courier = courierMap.get(key);
            courier.codeCount += 1;
            courier.parcelCount += Number.isFinite(Number(otp.parcelCount)) ? Number(otp.parcelCount) : 0;
        });
        return [...courierMap.values()].sort((a, b) => b.parcelCount - a.parcelCount);
    }, [accountOtps]);

    useEffect(() => {
        if (
            selectedCourier !== 'all' &&
            !displayCouriers.some(courier => courier.carrierKey === selectedCourier)
        ) {
            setSelectedCourier('all');
        }
    }, [displayCouriers, selectedCourier]);

    // Filtered OTP List
    const filteredOtps = useMemo(() => {
        return accountOtps.filter(otp => {
            // Courier filter
            if (selectedCourier !== 'all' && (otp.carrierName || '').toLowerCase() !== selectedCourier.toLowerCase()) {
                return false;
            }
            // Search query (OTP, AWB, SKU, Product Title)
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase().trim();
                const matchOtp = (otp.otp || '').toLowerCase().includes(q);
                const matchCourier = (otp.carrierDisplayName || '').toLowerCase().includes(q);
                const matchStore = (otp.marketplaceName || '').toLowerCase().includes(q);
                const matchAwbs = (otp.awbs || []).some(a => (a || '').toLowerCase().includes(q));
                const matchItems = (otp.items || []).some(it =>
                    (it.sku || '').toLowerCase().includes(q) ||
                    (it.productName || '').toLowerCase().includes(q) ||
                    (it.suborderNumber || '').toLowerCase().includes(q)
                );
                return matchOtp || matchCourier || matchStore || matchAwbs || matchItems;
            }
            return true;
        });
    }, [accountOtps, selectedCourier, searchQuery]);

    const courierMeta = (name = '') => {
        const key = name.toLowerCase();
        for (const k of Object.keys(COURIER_META)) {
            if (key.includes(k)) return COURIER_META[k];
        }
        return { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-200', tag: name || 'Courier' };
    };

    return (
        <div className="space-y-6">
            {/* Top Control & Live Watcher Bar */}
            <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white rounded-2xl p-4 sm:p-5 shadow-xl border border-slate-700/60 relative overflow-hidden">
                {/* Background ambient lighting */}
                <div className="absolute -right-16 -top-16 w-64 h-64 bg-brand-500/10 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute -left-16 -bottom-16 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 relative z-10">
                    <div className="space-y-1.5">
                        <div className="flex items-center gap-2.5 flex-wrap">
                            <span className="inline-flex items-center gap-1.5 bg-brand-500/20 text-brand-300 border border-brand-500/30 text-xs font-semibold px-2.5 py-0.5 rounded-full">
                                <Sparkles size={12} className="text-brand-400" />
                                Meesho Dock Handover
                            </span>
                            {isWatching ? (
                                <span role="status" aria-live="polite" className="inline-flex items-center gap-1.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-semibold px-2.5 py-0.5 rounded-full animate-pulse">
                                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                                    Live · {displayStats.totalAccounts} {displayStats.totalAccounts === 1 ? 'account' : 'accounts'} · {displayStats.totalOtps} live {displayStats.totalOtps === 1 ? 'OTP' : 'OTPs'}
                                </span>
                            ) : (
                                <span className="inline-flex items-center gap-1.5 bg-slate-700/60 text-slate-300 text-xs font-medium px-2.5 py-0.5 rounded-full">
                                    Idle • Click Go Live when rider arrives
                                </span>
                            )}
                        </div>
                        <h2 className="text-lg sm:text-xl font-bold tracking-tight text-white flex items-center gap-2">
                            Return Handover Live OTPs
                        </h2>
                        <p className="text-xs text-slate-400 max-w-xl">
                            Real-time OTPs for courier riders standing at your dock. Aggregates all connected Meesho stores in one screen with instant parcel verification.
                        </p>
                    </div>

                    {/* Action Buttons & Timer */}
                    <div className="flex items-center gap-2.5 flex-wrap">
                        {/* Audio Chime Toggle */}
                        <button
                            type="button"
                            aria-label={soundEnabled ? 'Mute new OTP sounds' : 'Enable new OTP sounds'}
                            onClick={() => setSoundEnabled(v => !v)}
                            className={`p-2.5 rounded-xl border transition-all ${
                                soundEnabled
                                    ? 'bg-slate-800/80 border-slate-600 text-brand-400 hover:bg-slate-700'
                                    : 'bg-slate-800/40 border-slate-700/50 text-slate-500 hover:text-slate-300'
                            }`}
                            title={soundEnabled ? 'Sound alert enabled on new OTP' : 'Sound alert muted'}
                        >
                            {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
                        </button>

                        {/* Manual Refresh */}
                        <button
                            type="button"
                            aria-label="Refresh live handover OTPs"
                            onClick={() => fetchOtps(false)}
                            disabled={loading || refreshing || isWatching || !canFetch}
                            className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-600 text-slate-200 hover:bg-slate-700 transition-all disabled:opacity-50"
                            title={billingBlockedMessage
                                ? billingBlockedMessage
                                : !canFetch
                                    ? 'Connect this account with its Meesho password first'
                                    : isWatching ? 'Auto-refreshing every 4s while watching' : 'Refresh now'}
                        >
                            <RefreshCw size={16} className={refreshing || loading ? 'animate-spin text-brand-400' : ''} />
                        </button>

                        {/* Go Live / End Live Button */}
                        <button
                            type="button"
                            aria-label={isWatching ? 'End live handover watch' : 'Go live with handover watch'}
                            onClick={handleToggleWatch}
                            disabled={!isWatching && !canFetch}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-xs tracking-wide transition-all shadow-lg active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${
                                isWatching
                                    ? 'bg-rose-500 hover:bg-rose-600 text-white shadow-rose-500/20'
                                    : 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-500/25 ring-2 ring-emerald-400/20'
                            }`}
                        >
                            {isWatching ? (
                                <>
                                    <Square size={14} className="fill-current" />
                                    <span>End Live</span>
                                    <span className="ml-1 bg-black/30 px-2 py-0.5 rounded-md font-mono text-[11px]">
                                        {formatRemainingTime(timeLeft)}
                                    </span>
                                </>
                            ) : (
                                <>
                                    <Play size={14} className="fill-current" />
                                    <span>Go Live</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {/* Courier Summary Quick-Filter Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {/* All Couriers Filter */}
                <button
                    type="button"
                    onClick={() => setSelectedCourier('all')}
                    className={`p-3.5 rounded-xl border text-left transition-all ${
                        selectedCourier === 'all'
                            ? 'bg-brand-50 border-brand-500 ring-2 ring-brand-500/20 shadow-sm'
                            : 'bg-white border-slate-200 hover:bg-slate-50'
                    }`}
                >
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">All Couriers</span>
                        <Layers size={14} className={selectedCourier === 'all' ? 'text-brand-600' : 'text-slate-400'} />
                    </div>
                    <div className="mt-2 flex items-baseline gap-2">
                        <span className="text-xl font-extrabold text-slate-800">{displayStats.totalOtps}</span>
                        <span className="text-xs text-slate-500 font-medium">OTPs</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                        {displayStats.totalParcels} Total Parcels
                    </p>
                </button>

                {/* Individual Couriers */}
                {displayCouriers.map((courier) => {
                    const meta = courierMeta(courier.name);
                    const isSelected = selectedCourier === courier.carrierKey;
                    return (
                        <button
                            key={courier.carrierKey}
                            type="button"
                            onClick={() => setSelectedCourier(isSelected ? 'all' : courier.carrierKey)}
                            className={`p-3.5 rounded-xl border text-left transition-all relative ${
                                isSelected
                                    ? 'bg-white border-brand-500 ring-2 ring-brand-500/20 shadow-sm'
                                    : 'bg-white border-slate-200 hover:bg-slate-50'
                            }`}
                        >
                            <div className="flex items-center justify-between">
                                <span className={`text-[11px] font-bold uppercase tracking-wider truncate max-w-[100px] ${meta.text}`}>
                                    {courier.name}
                                </span>
                                {courier.icon ? (
                                    <img src={courier.icon} alt={courier.name} className="w-4 h-4 object-contain" />
                                ) : (
                                    <Truck size={14} className={meta.text} />
                                )}
                            </div>
                            <div className="mt-2 flex items-baseline gap-2">
                                <span className="text-xl font-extrabold text-slate-800">{courier.codeCount}</span>
                                <span className="text-xs text-slate-500 font-medium">Codes</span>
                            </div>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                                {courier.parcelCount} {courier.parcelCount === 1 ? 'Parcel' : 'Parcels'}
                            </p>
                        </button>
                    );
                })}
            </div>

            {/* Filter & Search Bar */}
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="relative w-full sm:w-80">
                    <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search OTP, AWB, SKU, or Courier..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-full text-xs bg-slate-50 border border-slate-200 focus:bg-white focus:border-brand-500 focus:ring-2 focus:ring-brand-500/10 pl-9 pr-3.5 py-2 rounded-lg outline-none transition-all"
                    />
                    {searchQuery && (
                        <button
                            type="button"
                            onClick={() => setSearchQuery('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                        >
                            ✕
                        </button>
                    )}
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                    {/* Account Selector (searchable) */}
                    <div className="relative flex min-w-0 items-center gap-1.5 text-xs text-slate-500">
                        <Store size={14} className="shrink-0 text-slate-400" />
                        <Combobox
                            value={selectedAccount}
                            onChange={(id) => { if (id) handleAccountChange(id); }}
                            onClose={() => setAccountQuery('')}
                            immediate
                        >
                            <div className="relative">
                                <ComboboxInput
                                    aria-label="Select Meesho account"
                                    placeholder="Search accounts…"
                                    displayValue={accountDisplayValue}
                                    onChange={e => setAccountQuery(e.target.value)}
                                    onFocus={e => e.target.select()}
                                    className="w-[190px] max-w-[48vw] truncate rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-2.5 pr-8 text-xs font-medium text-slate-700 outline-none transition-colors hover:bg-white focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-500/10 sm:w-[235px]"
                                />
                                <ComboboxButton className="absolute inset-y-0 right-0 flex items-center pr-2.5" aria-label="Show accounts">
                                    <ChevronDown size={13} className="text-slate-400" />
                                </ComboboxButton>
                            </div>
                            <ComboboxOptions
                                anchor="bottom end"
                                className="z-50 max-h-72 w-[var(--input-width)] min-w-[235px] overflow-y-auto rounded-lg border border-slate-200 bg-white p-1 text-xs shadow-lg [--anchor-gap:4px] empty:invisible"
                            >
                                {filteredAccountOptions.map(option => (
                                    <ComboboxOption
                                        key={option.id}
                                        value={option.id}
                                        className="group flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-1.5 text-slate-700 data-[focus]:bg-brand-50 data-[focus]:text-brand-700"
                                    >
                                        <Check size={12} className="shrink-0 text-brand-600 invisible group-data-[selected]:visible" />
                                        <span className="truncate font-medium">{option.name}</span>
                                        {option.suffix && (
                                            <span className={`ml-auto shrink-0 text-[10px] ${option.connection === 'ready' ? 'text-slate-400' : 'text-amber-600'}`}>
                                                {option.suffix}
                                            </span>
                                        )}
                                    </ComboboxOption>
                                ))}
                                {filteredAccountOptions.length === 0 && (
                                    <div className="px-2.5 py-2 text-slate-400">No account matches "{accountQuery}"</div>
                                )}
                            </ComboboxOptions>
                        </Combobox>
                    </div>

                    {lastSyncTime && (
                        <span className="text-[11px] text-slate-400 font-mono hidden md:inline">
                            Updated {lastSyncTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                    )}
                </div>
            </div>

            {billingBlockedMessage && (
                <div className="flex items-start gap-2.5 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-xs text-red-900" role="alert">
                    <AlertCircle size={15} className="mt-0.5 shrink-0 text-red-600" />
                    <div>
                        <p className="font-semibold">Live handover is unavailable</p>
                        <p className="mt-0.5 text-red-800">{billingBlockedMessage}</p>
                        <Link to={BILLING_PATH} className="mt-1.5 inline-flex font-semibold text-red-900 underline underline-offset-2 hover:text-red-700">
                            Go to Billing
                        </Link>
                    </div>
                </div>
            )}

            {!billingBlockedMessage && (selectedNotReady || noReadyAccounts) && (
                <div className="flex items-start gap-2.5 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs text-amber-900" role="alert">
                    <AlertCircle size={15} className="mt-0.5 shrink-0 text-amber-600" />
                    <div>
                        <p className="font-semibold">
                            {noReadyAccounts
                                ? 'No Meesho account is connected for live handover yet'
                                : selectedOption.connection === 'wrong_password'
                                    ? `Meesho rejected the saved password for ${selectedOption.name}`
                                    : `Please first enter the Meesho seller password for ${selectedOption.name} to connect`}
                        </p>
                        <p className="mt-0.5 text-amber-800">
                            {noReadyAccounts
                                ? 'Enter the Meesho seller email and password on an account (Marketplace → Connected Accounts → edit) to fetch live handover OTPs.'
                                : selectedOption.connection === 'wrong_password'
                                    ? 'Update the password on this account (Marketplace → Connected Accounts → edit). Live OTPs are not fetched until Meesho accepts it.'
                                    : 'Open Marketplace → Connected Accounts, edit this account and save its Meesho seller password. Live OTPs are not fetched until it is connected.'}
                        </p>
                        <Link to={CONNECTED_MARKETPLACES_PATH} className="mt-1.5 inline-flex font-semibold text-amber-900 underline underline-offset-2 hover:text-amber-700">
                            Open Connected Marketplaces
                        </Link>
                    </div>
                </div>
            )}

            {canFetch && loginRequiredAccounts.length > 0 && (
                <div className="flex items-start gap-2.5 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs text-amber-900" role="alert">
                    <AlertCircle size={15} className="mt-0.5 shrink-0 text-amber-600" />
                    <div>
                        <p className="font-semibold">
                            Meesho login failed for {loginRequiredAccounts.map(account => account.name).join(', ')}
                        </p>
                        <div className="mt-0.5 space-y-0.5 text-amber-800">
                            {loginRequiredAccounts.map(account => (
                                <p key={account.id}>
                                    {loginRequiredAccounts.length > 1 && <span className="font-medium">{account.name}: </span>}
                                    {'Login failed for this account. Please reconnect it from Connected Accounts.'}
                                </p>
                            ))}
                        </div>
                        <Link to={CONNECTED_MARKETPLACES_PATH} className="mt-1.5 inline-flex font-semibold text-amber-900 underline underline-offset-2 hover:text-amber-700">
                            Open Connected Marketplaces
                        </Link>
                    </div>
                </div>
            )}

            {showStaleBanner && (
                <div className="flex items-start gap-2.5 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-xs text-blue-800" role="status">
                    <AlertCircle size={15} className="mt-0.5 shrink-0 text-blue-600" />
                    <div>
                        <p className="font-semibold">Showing the last successful live snapshot</p>
                        <p className="mt-0.5 text-blue-700">{responseMeta.staleReason || 'Meesho is refreshing; the displayed OTPs may be slightly old.'}</p>
                    </div>
                </div>
            )}

            {connectionError && (
                <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
                    <AlertCircle size={15} className="mt-0.5 shrink-0 text-amber-600" />
                    <div>
                        <p className="font-semibold">Live refresh needs attention</p>
                        <p className="mt-0.5 text-amber-700">{connectionError}. Existing results are kept while the connection recovers.</p>
                    </div>
                </div>
            )}

            {fetchedIds.length > 0 && notFetchedCount > 0 && (
                <div className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600" role="status">
                    <AlertCircle size={15} className="mt-0.5 shrink-0 text-slate-400" />
                    <p>
                        {notFetchedCount} of {scopeIds.length} accounts not fetched yet. Press Refresh or Go Live to include them.
                    </p>
                </div>
            )}

            {scopeAccountErrors.length > 0 && (
                <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Account status</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                        {scopeAccountErrors
                            .map(account => (
                                <React.Fragment key={account.id}>
                                    {account.error && (
                                        <span
                                            className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] font-medium text-amber-800"
                                        >
                                            <AlertCircle size={12} />
                                            {account.name}: {friendlyHandoverError(account.errorCode)}
                                        </span>
                                    )}
                                    {account.notice && (
                                        <span
                                            className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-[11px] font-medium text-blue-800"
                                            title={account.notice}
                                        >
                                            <AlertCircle size={12} />
                                            {account.name}: {account.notice}
                                        </span>
                                    )}
                                </React.Fragment>
                            ))}
                    </div>
                </div>
            )}

            {/* OTP Cards Feed */}
            {!canFetch ? null : loading && fetchedIds.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center flex flex-col items-center justify-center gap-3">
                    <RefreshCw size={28} className="animate-spin text-brand-600" />
                    <p className="text-sm font-semibold text-slate-700">Connecting to Meesho supplier accounts...</p>
                    <p className="text-xs text-slate-400">Fetching live courier handover codes</p>
                </div>
            ) : fetchedIds.length === 0 && scopeIds.length > 0 ? (
                <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-12 text-center flex flex-col items-center justify-center gap-3">
                    <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-1">
                        <RefreshCw size={24} />
                    </div>
                    <h3 className="text-sm font-bold text-slate-700">Not fetched yet</h3>
                    <p className="text-xs text-slate-500 max-w-md leading-relaxed">
                        Live OTPs are fetched only when you ask. Press <strong className="text-brand-600">Refresh</strong> for a one-time check,
                        or <strong className="text-brand-600">Go Live</strong> when a rider arrives to check every 4 seconds for 10 minutes.
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => fetchOtps(false)}
                            disabled={loading || refreshing || isWatching}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold shadow-sm transition-all disabled:opacity-50"
                        >
                            <RefreshCw size={13} />
                            Refresh
                        </button>
                        {!isWatching && (
                            <button
                                type="button"
                                onClick={handleToggleWatch}
                                className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-all"
                            >
                                <Play size={13} className="fill-current" />
                                Go Live
                            </button>
                        )}
                    </div>
                </div>
            ) : filteredOtps.length === 0 ? (
                <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-12 text-center flex flex-col items-center justify-center gap-3">
                    <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-1">
                        <Truck size={24} />
                    </div>
                    <h3 className="text-sm font-bold text-slate-700">
                        {displayStats.totalAccounts === 0 ? 'No Meesho accounts connected' : 'No Handover OTPs Active Right Now'}
                    </h3>
                    <p className="text-xs text-slate-500 max-w-md leading-relaxed">
                        {displayStats.totalAccounts === 0
                            ? 'Connect a Meesho supplier account with auto-sync credentials to start receiving live handover OTPs.'
                            : <>When a delivery rider arrives at your gate to hand over returns, Meesho issues an OTP. Click <strong className="text-brand-600">Go Live</strong> to automatically detect and display the OTP the second it is generated.</>}
                    </p>
                    {!isWatching && displayStats.totalAccounts > 0 && (
                        <button
                            type="button"
                            onClick={handleToggleWatch}
                            className="mt-2 inline-flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-all"
                        >
                            <Play size={13} className="fill-current" />
                            Go Live
                        </button>
                    )}
                </div>
            ) : (
                <div className="space-y-4">
                    {filteredOtps.map((otp) => {
                        const meta = courierMeta(otp.carrierDisplayName);
                        const isExpanded = !!expandedCards[otp.id];
                        const skuSummary = summariseBySku(otp.items);
                        const skuCount = skuSummary.filter(group => !group.pending).length;
                        const skuTotalQty = skuSummary.reduce((sum, group) => sum + group.qty, 0);
                        const expiryText = formatExpiryCountdown(otp.expiryTimestamp, clockNow);

                        return (
                            <div
                                key={otp.id}
                                className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all overflow-hidden"
                            >
                                {/* Card Main Header & Large OTP Display */}
                                <div className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                    {/* Left: Store, Courier, Expiry, Parcel badges */}
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            {/* Store Account Badge */}
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 border border-slate-200 text-slate-700 font-bold text-xs">
                                                <Store size={12} className="text-slate-500" />
                                                {otp.marketplaceName}
                                            </span>

                                            {/* Courier Badge */}
                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border font-bold text-xs ${meta.bg} ${meta.text} ${meta.border}`}>
                                                {otp.carrierIcon ? (
                                                    <img src={otp.carrierIcon} alt={otp.carrierDisplayName} className="w-3.5 h-3.5 object-contain" />
                                                ) : (
                                                    <Truck size={12} />
                                                )}
                                                {otp.carrierDisplayName}
                                            </span>

                                            {/* Parcel Count Badge */}
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold text-xs">
                                                <Package size={12} />
                                                {otp.parcelCount} {otp.parcelCount === 1 ? 'Parcel' : 'Parcels'}
                                            </span>
                                        </div>

                                        {/* Expiry / Time Information */}
                                        {expiryText && (
                                            <div className="flex items-center gap-1.5 text-xs text-amber-700 font-medium bg-amber-50 border border-amber-200/80 px-2.5 py-1 rounded-md w-fit">
                                                <Clock size={12} className="text-amber-600 shrink-0" />
                                                <span>{expiryText}</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Right: GIANT HIGH-VISIBILITY OTP CODE */}
                                    <div className="flex items-center gap-3 self-end md:self-center">
                                        <div
                                            onClick={() => handleCopy(otp.otp, otp.id)}
                                            className="group cursor-pointer flex items-center gap-3 px-5 py-3 rounded-2xl bg-slate-900 text-white hover:bg-slate-800 transition-all shadow-md active:scale-95 select-all"
                                            title="Click to copy OTP"
                                        >
                                            <div className="flex flex-col text-right">
                                                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Handover OTP</span>
                                                <span className="text-2xl sm:text-3xl font-black font-mono tracking-widest text-emerald-400">
                                                    {otp.otp}
                                                </span>
                                            </div>
                                            <button
                                                type="button"
                                                className="p-2 rounded-xl bg-slate-800 group-hover:bg-slate-700 text-slate-300 transition-colors"
                                            >
                                                {copiedOtpId === otp.id ? (
                                                    <Check size={16} className="text-emerald-400" />
                                                ) : (
                                                    <Copy size={16} />
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Toggle "In the Rider's Bag" Drawer Button */}
                                <div className="border-t border-slate-100 bg-slate-50/60 px-4 py-2.5 flex items-center justify-between text-xs">
                                    <button
                                        type="button"
                                        onClick={() => toggleCardExpansion(otp.id)}
                                        className="flex items-center gap-1.5 font-semibold text-slate-600 hover:text-brand-600 transition-colors"
                                    >
                                        <Package size={13} className="text-slate-400" />
                                        <span>
                                            {isExpanded ? 'Hide Bag Details' : `View ${otp.parcelCount} Parcels in Rider's Bag`}
                                        </span>
                                        {skuCount > 0 && (
                                            <span className="rounded-full bg-slate-200/70 px-1.5 py-0.5 text-[10px] font-bold text-slate-600">
                                                {skuCount} {skuCount === 1 ? 'SKU' : 'SKUs'}
                                            </span>
                                        )}
                                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                    </button>

                                    <div className="flex items-center gap-3 text-slate-400 text-[11px]">
                                        <span>Matched {otp.matchedCount || 0} of {otp.awbs?.length || 0} AWBs</span>
                                        {otp.awbDownloadUrl && (
                                            <a
                                                href={otp.awbDownloadUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-brand-600 hover:underline flex items-center gap-1"
                                            >
                                                Download Manifest <ExternalLink size={10} />
                                            </a>
                                        )}
                                    </div>
                                </div>

                                {/* Expanded Bag Items */}
                                {isExpanded && (
                                    <div className="p-4 sm:p-5 bg-slate-50/40 border-t border-slate-100 space-y-3 animate-fadeIn">
                                        {skuSummary.length > 0 && (
                                            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                                                <div className="flex items-center justify-between px-3.5 py-2 border-b border-slate-100 bg-slate-50">
                                                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                                                        <Layers size={13} className="text-brand-500" />
                                                        SKU summary
                                                    </h4>
                                                    <span className="text-[11px] text-slate-500">
                                                        {skuCount} {skuCount === 1 ? 'SKU' : 'SKUs'} · {skuTotalQty} {skuTotalQty === 1 ? 'unit' : 'units'} · {otp.parcelCount} {otp.parcelCount === 1 ? 'parcel' : 'parcels'}
                                                    </span>
                                                </div>
                                                <div className="overflow-x-auto">
                                                    <table className="w-full text-xs">
                                                        <thead>
                                                            <tr className="text-left text-[10px] uppercase tracking-wider text-slate-400">
                                                                <th className="px-3.5 py-2 font-semibold">SKU</th>
                                                                <th className="px-3.5 py-2 font-semibold">Sizes</th>
                                                                <th className="px-3.5 py-2 font-semibold text-right">Qty</th>
                                                                <th className="px-3.5 py-2 font-semibold text-right">Parcels</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-slate-100">
                                                            {skuSummary.map(group => (
                                                                <tr key={group.key} className={group.pending ? 'text-slate-400 italic' : 'text-slate-700'}>
                                                                    <td className="px-3.5 py-2 font-mono font-semibold whitespace-nowrap">{group.sku}</td>
                                                                    <td className="px-3.5 py-2 whitespace-nowrap">{[...group.variations].join(', ') || '—'}</td>
                                                                    <td className="px-3.5 py-2 text-right font-bold tabular-nums">{group.qty}</td>
                                                                    <td className="px-3.5 py-2 text-right tabular-nums">{group.awbs.size}</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                        {skuSummary.length > 1 && (
                                                            <tfoot>
                                                                <tr className="border-t border-slate-200 bg-slate-50 text-slate-700">
                                                                    <td className="px-3.5 py-2 font-bold" colSpan={2}>Total</td>
                                                                    <td className="px-3.5 py-2 text-right font-bold tabular-nums">{skuTotalQty}</td>
                                                                    <td className="px-3.5 py-2 text-right font-bold tabular-nums">{otp.awbs?.length || 0}</td>
                                                                </tr>
                                                            </tfoot>
                                                        )}
                                                    </table>
                                                </div>
                                            </div>
                                        )}

                                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                                            <ShieldCheck size={14} className="text-emerald-500" />
                                            Parcels Assigned to this OTP:
                                        </h4>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            {(otp.items || []).map((item, idx) => (
                                                <div
                                                    key={`${item.awb || 'awb'}-${item.suborderNumber || 'suborder'}-${item.sku || 'sku'}-${idx}`}
                                                    className="p-3 bg-white rounded-xl border border-slate-200 shadow-sm flex items-start gap-3"
                                                >
                                                    <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 text-slate-400 overflow-hidden">
                                                        {item.imageUrl ? (
                                                            <img
                                                                src={item.imageUrl}
                                                                alt=""
                                                                className="w-full h-full object-cover"
                                                                loading="lazy"
                                                                onError={e => { e.currentTarget.style.display = 'none'; }}
                                                            />
                                                        ) : (
                                                            <Package size={18} />
                                                        )}
                                                    </div>

                                                    <div className="flex-1 min-w-0 space-y-1">
                                                        <div className="flex items-center justify-between gap-2">
                                                            <span className="text-xs font-bold text-slate-800 truncate" title={item.productName}>
                                                                {item.productName}
                                                            </span>
                                                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 shrink-0">
                                                                Qty: {item.qty}
                                                            </span>
                                                        </div>

                                                        <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono">
                                                            <span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-700 font-semibold truncate max-w-[140px]">
                                                                SKU: {item.sku}
                                                            </span>
                                                            {item.variation && (
                                                                <span className="text-slate-400">({item.variation})</span>
                                                            )}
                                                        </div>

                                                        <div className="flex items-center justify-between gap-2 pt-1">
                                                            <span className="text-[11px] text-slate-600 font-mono flex items-center gap-1">
                                                                AWB: <strong className="text-slate-900">{item.awb}</strong>
                                                                <button
                                                                    type="button"
                                                                    aria-label={`Copy AWB ${item.awb}`}
                                                                    onClick={() => handleCopy(item.awb, `awb-${item.awb}-${idx}`)}
                                                                    className="ml-0.5 rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-brand-600"
                                                                >
                                                                    {copiedOtpId === `awb-${item.awb}-${idx}`
                                                                        ? <Check size={11} className="text-emerald-500" />
                                                                        : <Copy size={11} />}
                                                                </button>
                                                            </span>
                                                            {item.returnReason && (
                                                                <span className="text-[10px] bg-rose-50 text-rose-600 border border-rose-100 px-1.5 py-0.5 rounded truncate max-w-[120px]" title={item.returnReason}>
                                                                    {item.returnReason}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
