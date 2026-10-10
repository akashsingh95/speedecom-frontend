import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import CostSheetNotGeneratedModal from '../CostSheetNotGeneratedModal';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../../api';
import { IndianRupee, TrendingUp, TrendingDown, Loader2, CheckCircle, Store, ShoppingBag, X, AlertTriangle } from 'lucide-react';
import { getMarketplaceLogo } from '../../utils/marketplaceLogos';
import ExportButton from '../ExportButton';

import { useMarketplace } from '../../contexts/MarketplaceContext';
import AdvancedDateRangePicker from '../AdvancedDateRangePicker';
import MarketplaceAccountSelector from '../MarketplaceAccountSelector';
import { decideCalculationBeforeReport } from '../../utils/calculationGate';

const PaymentsTab = ({ viewMode = 'grid' }) => {
    const navigate = useNavigate();
    const location = useLocation();

    // Payments stays mounted (Dashboard keeps all tabs alive to skip re-fetching on tab
    // switch), so without this its cached requiresRecalculation flags would go stale the
    // moment Step 3 or Cost Sheet finishes a recalculation elsewhere in the same session.
    const { refreshTrigger, triggerRefresh } = useMarketplace();
    const view = viewMode;
    const [accountMetrics, setAccountMetrics] = useState([]);
    const [accountLoading, setAccountLoading] = useState(false);
    const [missingCostModal, setMissingCostModal] = useState({ open: false, count: 0, skus: [], reportUrl: '', targetAccount: null, requiresRecalculation: false, calculationPending: false });
    const [notGeneratedModal, setNotGeneratedModal] = useState({ open: false, targetAccount: null, reportUrl: '', requiresRecalculation: false, calculationPending: false });
    const [checkingAccount, setCheckingAccount] = useState(null);
    const [recalculatingAccount, setRecalculatingAccount] = useState(null);
    // Whether the run currently in progress for recalculatingAccount is a true admin/Amazon-
    // refund-loss Recalculate (mode: 'full') vs a routine Calculate (cost sheet was saved,
    // no mode sent) — drives the "Calculating..." vs "Recalculating..." pill text below.
    const [isFullRecalcRun, setIsFullRecalcRun] = useState(false);
    const [completedAccount, setCompletedAccount] = useState(null);
    const [isCreditCalculating, setIsCreditCalculating] = useState(false);
    // Insufficient balance — distinct from isCreditCalculating (busy processing uploads/credits).
    // Both must block a recalculation the same way requiresRecalculation does not override
    // either: an admin-flagged account still can't recalculate on a tenant that can't afford it.
    const [isCreditBalanceLow, setIsCreditBalanceLow] = useState(false);
    // Prevents duplicate clicks from kicking off two parallel flows for the same account
    // before the button disables.
    const accountClickInFlightRef = useRef(new Set());

    // Check credit status on mount and polling
    useEffect(() => {
        let isMounted = true;
        const checkCredits = async () => {
            try {
                const { data } = await api.get('/credits/can-calculate');
                if (!isMounted) return;
                const reason = data?.reason;
                const isBusy = reason === 'calculating_credits' || reason === 'processing_uploads';
                setIsCreditBalanceLow(reason === 'insufficient_balance');
                setIsCreditCalculating(isBusy);
            } catch (err) {
                console.error('Error checking credits in payments tab:', err);
            }
        };

        checkCredits();
        const interval = setInterval(checkCredits, 30000);
        return () => {
            isMounted = false;
            clearInterval(interval);
        };
    }, []);

    // Highlight account(s) only when explicitly redirected from Cost Sheet's calculation
    const incomingHighlightAccounts = useMemo(() => {
        if (location.state?.highlightAccounts && Array.isArray(location.state.highlightAccounts) && location.state.highlightAccounts.length > 0) {
            return location.state.highlightAccounts.map(id => String(id?._id || id?.id || id).trim()).filter(Boolean);
        }
        try {
            const params = new URLSearchParams(location.search);
            const hl = params.get('highlightAccounts');
            if (hl) {
                const parsed = JSON.parse(hl);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    return parsed.map(id => String(id?._id || id?.id || id).trim()).filter(Boolean);
                }
            }
        } catch (_) { }
        return [];
    }, [location.state, location.search]);

    const [highlightAccountIds, setHighlightAccountIds] = useState(() => incomingHighlightAccounts);

    // Sort highlighted accounts first
    const displayAccountMetrics = useMemo(() => {
        if (!accountMetrics || accountMetrics.length === 0) return [];
        if (!highlightAccountIds || highlightAccountIds.length === 0) return accountMetrics;

        return [...accountMetrics].sort((a, b) => {
            const aHigh = highlightAccountIds.includes(String(a.marketplaceId || a._id));
            const bHigh = highlightAccountIds.includes(String(b.marketplaceId || b._id));
            if (aHigh && !bHigh) return -1;
            if (!aHigh && bHigh) return 1;
            return 0;
        });
    }, [accountMetrics, highlightAccountIds]);

    // Shared 5s poll loop for a calculationId — used both when a click just started/attached
    // to a job, and when the mount-effect below resumes watching a job started elsewhere.
    const pollCalculationCompletion = (calcId, { onComplete, onFail } = {}) => {
        const pollInterval = setInterval(async () => {
            try {
                const statusRes = await api.get(`/payments/calculate/${calcId}`);
                const resData = statusRes.data;
                const currentStatus = resData?.data?.status || resData?.status;

                if (currentStatus === 'completed') {
                    clearInterval(pollInterval);
                    if (onComplete) onComplete();
                } else if (currentStatus === 'failed') {
                    clearInterval(pollInterval);
                    if (onFail) onFail(resData?.data?.errorMessage || resData?.errorMessage || 'Calculation failed');
                }
                // else: still processing, keep polling — loader stays visible
            } catch (err) {
                console.error('Error polling calculation status:', err);
                clearInterval(pollInterval);
                if (onFail) onFail('Unable to confirm calculation status. Please try again.');
            }
        }, 5000);
        return pollInterval;
    };

    const triggerRecalculationAndOpen = (account, reportUrl, mode) => {
        return new Promise((resolve) => {
            const accId = account?.marketplaceId || account?._id;
            setRecalculatingAccount(accId);
            setIsFullRecalcRun(mode === 'full');

            api.post('/payments/calculate', { marketplaceIds: [accId], ...(mode ? { mode } : {}) })
                .then((res) => {
                    const calcObj = res.data?.data !== undefined ? res.data.data : res.data;
                    const calcId = calcObj?.calculationId || res.data?.calculationId;

                    if (calcObj?.alreadyUpToDate) {
                        // Another entry point (Step 3 / Cost Sheet) already completed the
                        // recalculation in the meantime — don't run it again, just open the report.
                        setRecalculatingAccount(null);
                        setIsFullRecalcRun(false);
                        setListAvailableMarketplaces(prev => prev.map(mp => ({
                            ...mp,
                            accounts: (mp.accounts || []).map(acc =>
                                String(acc._id) === String(accId)
                                    ? { ...acc, requiresRecalculation: false }
                                    : acc
                            )
                        })));
                        triggerRefresh();
                        window.open(reportUrl, '_blank', 'noopener,noreferrer');
                        resolve();
                        return;
                    }

                    if (!calcId) {
                        setRecalculatingAccount(null);
                        setIsFullRecalcRun(false);
                        alert('Failed to start recalculation. Please try again.');
                        resolve();
                        return;
                    }

                    pollCalculationCompletion(calcId, {
                        onComplete: () => {
                            setRecalculatingAccount(null);
                            setIsFullRecalcRun(false);
                            setCompletedAccount(accId);

                            setTimeout(() => {
                                setCompletedAccount(null);
                                window.open(reportUrl, '_blank', 'noopener,noreferrer');
                                resolve();
                            }, 1000);

                            setListAvailableMarketplaces(prev => prev.map(mp => ({
                                ...mp,
                                accounts: (mp.accounts || []).map(acc =>
                                    String(acc._id) === String(accId)
                                        ? { ...acc, requiresRecalculation: false }
                                        : acc
                                )
                            })));
                            triggerRefresh();
                        },
                        onFail: (errMsg) => {
                            setRecalculatingAccount(null);
                            setIsFullRecalcRun(false);
                            alert(errMsg);
                            resolve();
                        }
                    });
                })
                .catch((err) => {
                    console.error('Error starting recalculation:', err);
                    setRecalculatingAccount(null);
                    setIsFullRecalcRun(false);
                    alert('Failed to start recalculation. Please try again.');
                    resolve();
                });
        });
    };

    // On mount: if a calculation is already running for this tenant (started from Cost
    // Sheet or Step 3 before this tab was even opened), show it as in-progress on the
    // matching account row instead of staying silent until the user clicks it — clicking
    // that row is already disabled while recalculatingAccount is set, so this alone also
    // prevents a duplicate POST for an account that's already mid-calculation.
    useEffect(() => {
        let cancelled = false;
        let pollId = null;
        (async () => {
            try {
                const res = await api.get('/payments/calculate/active');
                const activeCalc = res.data?.data !== undefined ? res.data.data : res.data;
                if (cancelled || !activeCalc?.calculationId || !['pending', 'processing'].includes(activeCalc.status)) return;
                const activeIds = Array.isArray(activeCalc.marketplaceIds) ? activeCalc.marketplaceIds.map(String) : [];
                if (activeIds.length === 0) return;

                // The Calculation doc's own `mode` field is only populated once the run
                // completes (see server/models/Calculation.js), so for a run already in
                // progress the only way to tell "Recalculating" from "Calculating" is the
                // account's current requiresRecalculation flag — fetch it fresh.
                let resumedIsFullRecalc = false;
                try {
                    const optionsRes = await api.get('/marketplaces/filter-options?includeInactive=true');
                    const freshList = optionsRes.data || [];
                    const matched = freshList.flatMap(mp => mp.accounts || []).find(a => activeIds.includes(String(a._id)));
                    resumedIsFullRecalc = Boolean(matched?.requiresRecalculation);
                    if (!cancelled) setListAvailableMarketplaces(freshList);
                } catch (_) { /* fall back to treating it as a routine calculate */ }
                if (cancelled) return;

                setRecalculatingAccount(activeIds[0]);
                setIsFullRecalcRun(resumedIsFullRecalc);
                pollId = pollCalculationCompletion(activeCalc.calculationId, {
                    onComplete: () => {
                        setRecalculatingAccount(null);
                        setIsFullRecalcRun(false);
                        setListAvailableMarketplaces(prev => prev.map(mp => ({
                            ...mp,
                            accounts: (mp.accounts || []).map(acc =>
                                activeIds.includes(String(acc._id)) ? { ...acc, requiresRecalculation: false } : acc
                            )
                        })));
                        triggerRefresh();
                    },
                    onFail: () => {
                        setRecalculatingAccount(null);
                        setIsFullRecalcRun(false);
                    }
                });
            } catch (_) {
                // No active calculation to resume, or the check failed transiently — nothing to do.
            }
        })();
        return () => {
            cancelled = true;
            if (pollId) clearInterval(pollId);
        };
    }, []);

    const handleAccountClick = async (account) => {
        const accId = account.marketplaceId || account._id;

        // The row's button doesn't actually disable (recalculatingAccount) until the check
        // below resolves, so a fast double-click here would open two placeholder tabs for
        // the same account — guard synchronously since React state can't react fast enough.
        if (accountClickInFlightRef.current.has(accId)) return;
        accountClickInFlightRef.current.add(accId);

        try {
            const params = new URLSearchParams();
            params.set('marketplaceIds', JSON.stringify([accId]));
            if (listStartDate) params.set('startDate', listStartDate);
            if (listEndDate) params.set('endDate', listEndDate);
            // Full path (not the react-router-relative path) — this always opens in a NEW tab via
            // window.open(), which needs a real URL from the origin root, not a router-relative one.
            const reportUrl = `/client/payments/calculations?${params.toString()}`;

            setCheckingAccount(accId);
            let checkData = null;
            let freshAccount = null;
            try {
                // Cost Sheet runs in its own browser tab (window.open), so its recalculation
                // can't push a live update into this tab's cached listAvailableMarketplaces —
                // re-fetch the flag fresh, right now, instead of trusting that cache. This is
                // what actually guarantees the recalculation only ever runs once, regardless
                // of which entry point (and which tab/window) completed it last.
                const [checkRes, freshOptionsRes] = await Promise.all([
                    api.get(`/cost-sheet/check-missing?marketplaceIds=${encodeURIComponent(JSON.stringify([accId]))}`),
                    api.get('/marketplaces/filter-options?includeInactive=true')
                ]);
                checkData = checkRes.data;
                const freshList = freshOptionsRes.data || [];
                freshAccount = freshList.flatMap(mp => mp.accounts || []).find(a => String(a._id) === String(accId)) || null;
                setListAvailableMarketplaces(freshList);
            } catch (err) {
                console.error('Error checking missing cost sheet:', err);
            } finally {
                setCheckingAccount(null);
            }

            // A deactivated account is view-only — never trigger a new calculation for it,
            // even if it's flagged as requiring one. Just open its last report.
            const isInactiveAccount = account.status === 'inactive' || freshAccount?.status === 'inactive';
            const isRecalc = !isInactiveAccount && Boolean(freshAccount?.requiresRecalculation);
            const isCalcPending = !isInactiveAccount && Boolean(checkData?.calculationPending);

            if (checkData) {
                if (checkData.isCostSheetGenerated === false) {
                    setNotGeneratedModal({ open: true, targetAccount: account, reportUrl, requiresRecalculation: isRecalc, calculationPending: isCalcPending });
                    return;
                }

                if (checkData.missingCount !== undefined && checkData.missingCount > 0) {
                    setMissingCostModal({
                        open: true,
                        count: checkData.missingCount,
                        skus: checkData.missingSkus || [],
                        reportUrl,
                        targetAccount: account,
                        requiresRecalculation: isRecalc,
                        calculationPending: isCalcPending
                    });
                    return;
                }
            }

            const { shouldCalculate, mode } = decideCalculationBeforeReport({
                requiresRecalculation: isRecalc,
                calculationPending: isCalcPending,
                isCreditBalanceLow,
                isCreditCalculating
            });
            if (shouldCalculate) {
                await triggerRecalculationAndOpen(account, reportUrl, mode);
            } else {
                window.open(reportUrl, '_blank', 'noopener,noreferrer');
            }
        } finally {
            accountClickInFlightRef.current.delete(accId);
        }
    };

    const handleOpenCostSheet = (account) => {
        setMissingCostModal({ open: false, count: 0, skus: [], reportUrl: '', targetAccount: null, requiresRecalculation: false, calculationPending: false });
        setNotGeneratedModal({ open: false, targetAccount: null, reportUrl: '', requiresRecalculation: false, calculationPending: false });
        const selectedIds = account ? [account.marketplaceId] : [];
        const names = account ? [account.accountName || account.marketplaceName] : [];
        const qs = `?marketplaceIds=${encodeURIComponent(JSON.stringify(selectedIds))}&marketplaceNames=${encodeURIComponent(JSON.stringify(names))}`;
        window.open(`/client/cost-sheet${qs}`, '_blank', 'noopener,noreferrer');
    };

    // Ads type toggle: 'sku_wise' | 'payment'
    // Only applies to Flipkart and Amazon accounts; Meesho always shows "–"
    const [adsType, setAdsType] = useState('sku_wise');

    // List view: marketplace filter state
    const [listAvailableMarketplaces, setListAvailableMarketplaces] = useState([]);
    // Selected marketplace keys (e.g., ['Amazon', 'Flipkart'])
    const [selectedMarketplaces, setSelectedMarketplaces] = useState(() => {
        try {
            const raw = localStorage.getItem('payments_tab_selected_marketplaces');
            return raw ? JSON.parse(raw) : [];
        } catch (e) {
            return [];
        }
    });

    // Selected account IDs
    const [listMktFilters, setListMktFilters] = useState(() => {
        try {
            const raw = localStorage.getItem('payments_tab_selected_accounts');
            return raw ? JSON.parse(raw) : [];
        } catch (e) {
            return [];
        }
    });

    // Save filter selections to localStorage
    useEffect(() => {
        if (Array.isArray(selectedMarketplaces) && selectedMarketplaces.length > 0) {
            localStorage.setItem('payments_tab_selected_marketplaces', JSON.stringify(selectedMarketplaces));
        }
    }, [selectedMarketplaces]);

    useEffect(() => {
        if (Array.isArray(listMktFilters) && listMktFilters.length > 0) {
            localStorage.setItem('payments_tab_selected_accounts', JSON.stringify(listMktFilters));
        }
    }, [listMktFilters]);

    // Automatically ensure incoming highlighted account(s) from Cost Sheet calculation are included in filters
    useEffect(() => {
        if (incomingHighlightAccounts.length > 0) {
            setHighlightAccountIds(incomingHighlightAccounts);

            // Ensure redirected account IDs are present in listMktFilters
            setListMktFilters(prev => {
                const existing = Array.isArray(prev) ? prev : [];
                const missing = incomingHighlightAccounts.filter(id => !existing.includes(id));
                if (missing.length === 0) return existing;
                return [...existing, ...missing];
            });

            // Ensure redirected accounts' parent marketplace keys are present in selectedMarketplaces
            if (listAvailableMarketplaces.length > 0) {
                const neededKeys = listAvailableMarketplaces
                    .filter(mp => (mp.accounts || []).some(acc => incomingHighlightAccounts.includes(String(acc._id))))
                    .map(mp => mp.key);
                if (neededKeys.length > 0) {
                    setSelectedMarketplaces(prev => {
                        const existing = Array.isArray(prev) ? prev : [];
                        const missing = neededKeys.filter(k => !existing.includes(k));
                        if (missing.length === 0) return existing;
                        return [...existing, ...missing];
                    });
                }
            }
        }
    }, [incomingHighlightAccounts, listAvailableMarketplaces]);

    // List view: date range state (AdvancedDateRangePicker)
    const [listStartDate, setListStartDate] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() - 90);
        return d.toISOString().split('T')[0];
    });
    const [listEndDate, setListEndDate] = useState(() => new Date().toISOString().split('T')[0]);

    // Fetch marketplace options for list-view filter on mount, and again whenever another
    // tab (Step 3) signals a recalculation just completed — this component stays mounted
    // across tab switches, so without this its requiresRecalculation flags go stale.
    useEffect(() => {
        fetchListMarketplaces();
    }, [refreshTrigger]);

    const fetchListMarketplaces = async () => {
        try {
            // includeInactive so deactivated accounts still appear (grayed, view-only)
            // in both the Filter Accounts dropdown and the accounts table below.
            const { data } = await api.get('/marketplaces/filter-options?includeInactive=true');
            setListAvailableMarketplaces(data || []);
            const allKeys = (data || []).map(mp => mp.key);
            const allIds = (data || []).flatMap(mp => (mp.accounts || []).map(a => a._id));

            setSelectedMarketplaces(prev => {
                let current = [];
                if (Array.isArray(prev) && prev.length > 0) {
                    const valid = prev.filter(k => allKeys.includes(k));
                    if (valid.length > 0) {
                        current = valid;
                    }
                }
                if (current.length === 0) {
                    try {
                        const raw = localStorage.getItem('payments_tab_selected_marketplaces');
                        const saved = raw ? JSON.parse(raw) : [];
                        const validSaved = (saved || []).filter(k => allKeys.includes(k));
                        if (validSaved.length > 0) {
                            current = validSaved;
                        }
                    } catch (e) { }
                }
                if (current.length === 0) current = allKeys;

                if (incomingHighlightAccounts.length > 0) {
                    const neededKeys = (data || [])
                        .filter(mp => (mp.accounts || []).some(acc => incomingHighlightAccounts.includes(String(acc._id))))
                        .map(mp => mp.key);
                    const missing = neededKeys.filter(k => !current.includes(k));
                    if (missing.length > 0) return [...current, ...missing];
                }
                return current;
            });

            setListMktFilters(prev => {
                let current = [];
                if (Array.isArray(prev) && prev.length > 0) {
                    const valid = prev.filter(id => allIds.includes(id));
                    if (valid.length > 0) {
                        current = valid;
                    }
                }
                if (current.length === 0) {
                    try {
                        const raw = localStorage.getItem('payments_tab_selected_accounts');
                        const saved = raw ? JSON.parse(raw) : [];
                        const validSaved = (saved || []).filter(id => allIds.includes(id));
                        if (validSaved.length > 0) {
                            current = validSaved;
                        }
                    } catch (e) { }
                }
                if (current.length === 0) current = allIds;

                if (incomingHighlightAccounts.length > 0) {
                    const validIncoming = incomingHighlightAccounts.filter(id => allIds.includes(id));
                    const missing = validIncoming.filter(id => !current.includes(id));
                    if (missing.length > 0) return [...current, ...missing];
                }
                return current;
            });
        } catch (err) {
            console.error('Error fetching list-view marketplace options for payments', err);
        }
    };

    // Stable filter key to avoid re-fetching when array references change but values don't
    const prevListFilterKey = useRef();

    const getListFilterKey = () => JSON.stringify({
        mKeys: selectedMarketplaces,
        mIds: listMktFilters,
        sd: listStartDate,
        ed: listEndDate,
        adsType
    });

    const fetchAccountMetrics = useCallback(async () => {
        // If all accounts are cleared (0 selected), immediately show empty state without unnecessary backend call
        if (listAvailableMarketplaces.length > 0 && listMktFilters.length === 0 && selectedMarketplaces.length === 0) {
            setAccountMetrics([]);
            setAccountLoading(false);
            return;
        }

        setAccountLoading(true);
        try {
            const params = { adsType };
            // List view uses its own date state
            if (listStartDate) params.startDate = listStartDate;
            if (listEndDate) params.endDate = listEndDate;

            // Compute effective account IDs to send to backend API
            let effectiveAccountIds = [];
            if (listMktFilters.length > 0) {
                // If specific account(s) are selected
                effectiveAccountIds = listMktFilters;
            } else if (selectedMarketplaces.length > 0) {
                // If marketplace(s) selected but no specific account selected, get all account IDs belonging to selected marketplace(s)
                effectiveAccountIds = listAvailableMarketplaces
                    .filter(mp => selectedMarketplaces.includes(mp.key))
                    .flatMap(mp => (mp.accounts || []).map(a => a._id));
            }

            if (effectiveAccountIds.length > 0) {
                params.marketplaceIds = JSON.stringify(effectiveAccountIds);
            }

            const { data } = await api.get('/payments/metrics-by-account', { params });
            const sortedData = (data || []).sort((a, b) => {
                const mktA = (a.marketplaceName || '').toLowerCase();
                const mktB = (b.marketplaceName || '').toLowerCase();
                if (mktA !== mktB) {
                    return mktA.localeCompare(mktB);
                }
                const accA = (a.accountName || a.marketplaceName || '').toLowerCase();
                const accB = (b.accountName || b.marketplaceName || '').toLowerCase();
                return accA.localeCompare(accB);
            });
            setAccountMetrics(sortedData);
        } catch (error) {
            console.error('Error fetching account metrics', error);
            setAccountMetrics([]);
        } finally {
            setAccountLoading(false);
        }
    }, [listStartDate, listEndDate, selectedMarketplaces, listMktFilters, listAvailableMarketplaces, adsType]);

    // List View: only fetch when list filter key changes (deep compare)
    useEffect(() => {
        if (view === 'list') {
            const key = getListFilterKey();
            if (key !== prevListFilterKey.current) {
                prevListFilterKey.current = key;
                fetchAccountMetrics();
            }
        }
    }, [view, listStartDate, listEndDate, selectedMarketplaces, listMktFilters, adsType]);

    // Show ads toggle only when there are Flipkart or Amazon accounts in the list
    const hasNonMeeshoAccounts = accountMetrics.some(a => a.platform !== 'meesho');

    return (
        <div className="w-full h-full flex flex-col min-h-0 relative isolate">
            {/* Filters - list view only (Sticky top bar with rounded container matching list view width) */}
            {view !== 'grid' && (
                <div className="shrink-0 mb-3 px-6 py-3 bg-white rounded-2xl border border-slate-200 shadow-md">
                    <div className="flex items-center justify-between gap-3 flex-wrap w-full">
                        {/* Advanced Date Range Picker */}
                        <div className="flex items-center gap-2">
                            <AdvancedDateRangePicker
                                startDate={listStartDate}
                                endDate={listEndDate}
                                onChange={(start, end) => {
                                    setListStartDate(start);
                                    setListEndDate(end);
                                }}
                                onApply={(start, end) => {
                                    setListStartDate(start || listStartDate);
                                    setListEndDate(end || listEndDate);
                                }}
                                maxDays={365}
                                colorTheme="brand"
                            />
                        </div>

                        {/* Marketplace Filter Popover */}
                        <MarketplaceAccountSelector
                            variant="popover"
                            selectionMode="multiple"
                            accountSelection="multiple"
                            showCheckbox={true}
                            showClearAll={true}
                            availableMarketplaces={listAvailableMarketplaces}
                            selectedMarketplaces={selectedMarketplaces}
                            selectedAccountIds={listMktFilters}
                            onApply={({ selectedMarketplaces: newMps, selectedAccountIds: newAccs }) => {
                                setSelectedMarketplaces(newMps);
                                setListMktFilters(newAccs);
                            }}
                            buttonLabel="Filter Accounts"
                            align="right"
                        />
                    </div>
                </div>
            )}

            {/* List View */}
            {view === 'list' && (
                <div className="flex-1 flex flex-col min-h-0 relative z-0 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="flex-1 flex flex-col min-h-0 bg-white rounded-2xl shadow-card border border-slate-200 overflow-hidden hover:shadow-xl transition-shadow duration-300">
                        <div className="shrink-0 px-6 py-3.5 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white flex items-center justify-between shadow-sm">
                            <h3 className="font-semibold text-slate-800 flex items-center gap-2.5">
                                <div className="p-2 bg-brand-100 rounded-lg">
                                    <Store size={18} className="text-brand-600" />
                                </div>
                                <span className="text-base">Marketplace Accounts - Payments Analysis</span>
                            </h3>
                            <div className="flex items-center gap-3">
                                {/* Ads type toggle — only shown when non-Meesho accounts exist */}
                                {hasNonMeeshoAccounts && (
                                    <div className="flex items-center bg-slate-100 rounded-lg p-0.5 border border-slate-200 shadow-inner text-xs font-semibold">
                                        <button
                                            type="button"
                                            onClick={() => setAdsType('sku_wise')}
                                            className={`px-3 py-1.5 rounded-md transition-all duration-200 ${adsType === 'sku_wise'
                                                ? 'bg-white text-brand-700 shadow-sm border border-slate-200'
                                                : 'text-slate-500 hover:text-slate-700'
                                                }`}
                                        >
                                            SKU-wise Ads
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setAdsType('payment')}
                                            className={`px-3 py-1.5 rounded-md transition-all duration-200 ${adsType === 'payment'
                                                ? 'bg-white text-brand-700 shadow-sm border border-slate-200'
                                                : 'text-slate-500 hover:text-slate-700'
                                                }`}
                                        >
                                            Payment Ads
                                        </button>
                                    </div>
                                )}
                                {accountMetrics.length > 0 && (
                                    <ExportButton
                                        exportType="payment_metrics"
                                        marketplaceId={null}
                                        marketplaceIds={listMktFilters}
                                        startDate={listStartDate}
                                        endDate={listEndDate}
                                        adsType={adsType}
                                        buttonText="Export All"
                                        buttonClassName="!px-4 !py-2 !text-sm"
                                    />
                                )}
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto overflow-x-auto min-h-0 custom-scrollbar-lg relative">
                            <table className="w-full border-separate border-spacing-0">
                                <thead className="sticky top-0 z-20 shadow-xs bg-slate-100">
                                    <tr>
                                        <th className="px-4 py-3.5 text-center text-xs font-bold text-slate-700 uppercase tracking-wider w-16 bg-slate-100 border-b border-slate-200">Marketplace</th>
                                        <th className="px-4 py-3.5 text-center text-xs font-bold text-slate-700 uppercase tracking-wider bg-slate-100 border-b border-slate-200">Account Name</th>
                                        <th className="px-4 py-3.5 text-center text-xs font-bold text-slate-700 uppercase tracking-wider bg-slate-100 border-b border-slate-200">Net Sales</th>
                                        <th className="px-4 py-3.5 text-center text-xs font-bold text-slate-700 uppercase tracking-wider bg-slate-100 border-b border-slate-200">Net Settlement</th>
                                        <th className="px-4 py-3.5 text-center text-xs font-bold text-slate-700 uppercase tracking-wider bg-slate-100 border-b border-slate-200">MP Fee &amp; Other</th>

                                        <th className="px-4 py-3.5 text-center text-xs font-bold text-slate-700 uppercase tracking-wider bg-slate-100 border-b border-slate-200">Ads Cost</th>
                                        <th className="px-4 py-3.5 text-center text-xs font-bold text-slate-700 uppercase tracking-wider bg-slate-100 border-b border-slate-200">Net Profit</th>
                                    </tr>

                                    {/* Total Row (Sticky right under table header with 0 gap) */}
                                    {accountMetrics.length > 0 && (() => {
                                        const totals = accountMetrics.reduce((acc, a) => ({
                                            totalSales: acc.totalSales + (a.totalSales || 0),
                                            totalSettlement: acc.totalSettlement + (a.totalSettlement || 0),
                                            totalMarketplaceFees: acc.totalMarketplaceFees + (a.totalMarketplaceFees || 0),
                                            adsCost: acc.adsCost + (a.adsCost || 0),
                                            netProfit: acc.netProfit + (a.netProfit || 0),
                                        }), { totalSales: 0, totalSettlement: 0, totalMarketplaceFees: 0, adsCost: 0, netProfit: 0 });
                                        const totalIsProfit = totals.netProfit >= 0;
                                        const totalProfitPct = totals.totalSales > 0 ? ((totals.netProfit / totals.totalSales) * 100) : 0;
                                        return (
                                            <tr className="text-slate-900 shadow-sm">
                                                <td className="px-4 py-3 text-center bg-slate-200 border-b-2 border-slate-300">
                                                    <span className="text-xs font-black text-slate-700 uppercase tracking-widest">∑</span>
                                                </td>
                                                <td className="px-4 py-3 text-center bg-slate-200 border-b-2 border-slate-300">
                                                    <span className="text-sm font-extrabold text-slate-900 tracking-wide uppercase">Total</span>
                                                </td>
                                                <td className="px-4 py-3 text-center bg-slate-200 border-b-2 border-slate-300">
                                                    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white text-slate-900 rounded-lg border border-slate-300/80 shadow-xs">
                                                        <IndianRupee size={14} className="text-slate-600" />
                                                        <span className="text-sm font-bold text-slate-900">{totals.totalSales.toLocaleString('en-IN')}</span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-center bg-slate-200 border-b-2 border-slate-300">
                                                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-100 text-emerald-900 rounded-lg font-bold text-sm shadow-xs border border-emerald-300/80">
                                                        <TrendingUp size={14} />
                                                        ₹{totals.totalSettlement.toLocaleString('en-IN')}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-center bg-slate-200 border-b-2 border-slate-300">
                                                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-100 text-red-900 rounded-lg font-bold text-sm shadow-xs border border-red-300/80">
                                                        <TrendingDown size={14} />
                                                        ₹{Math.abs(totals.totalMarketplaceFees).toLocaleString('en-IN')}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-center bg-slate-200 border-b-2 border-slate-300">
                                                    <div className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-violet-100 text-violet-900 rounded-lg border border-violet-300/80 shadow-xs">
                                                        <span className="text-sm font-bold">
                                                            ₹{Math.abs(totals.adsCost).toLocaleString('en-IN')}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-center bg-slate-200 border-b-2 border-slate-300">
                                                    <div className="inline-flex items-center gap-2">
                                                        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold text-sm shadow-xs border ${totalIsProfit ? 'bg-emerald-100 text-emerald-900 border-emerald-300/80' : 'bg-red-100 text-red-900 border-red-300/80'}`}>
                                                            {totalIsProfit ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                                                            ₹{totals.netProfit.toLocaleString('en-IN')}
                                                        </span>
                                                        <span className={`text-xs font-extrabold ${totalIsProfit ? 'text-emerald-800' : 'text-red-800'}`}>
                                                            ({totalProfitPct > 0 ? '+' : ''}{totalProfitPct.toFixed(1)}%)
                                                        </span>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })()}
                                </thead>
                                <tbody className={`divide-y divide-slate-100 transition-opacity duration-300 ${accountLoading ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
                                    {accountLoading && accountMetrics.length === 0 && (
                                        <tr>
                                            <td colSpan="7" className="px-6 py-16 text-center">
                                                <div className="flex flex-col items-center gap-3 animate-in fade-in zoom-in-95 duration-300">
                                                    <Loader2 className="animate-spin text-brand-600" size={40} />
                                                    <p className="text-sm text-slate-500 font-medium">Loading payment accounts...</p>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                    {!accountLoading && accountMetrics.length === 0 && (
                                        <tr>
                                            <td colSpan="7" className="px-6 py-16 text-center text-slate-500">
                                                <div className="flex flex-col items-center gap-3 animate-in fade-in zoom-in-95 duration-300">
                                                    <div className="p-4 bg-slate-100 rounded-full">
                                                        <Store size={40} className="text-slate-400" />
                                                    </div>
                                                    <p className="font-medium text-base">
                                                        {listMktFilters.length === 0 && selectedMarketplaces.length === 0
                                                            ? 'No accounts selected'
                                                            : 'No marketplace accounts found'}
                                                    </p>
                                                    <p className="text-sm text-slate-400">
                                                        {listMktFilters.length === 0 && selectedMarketplaces.length === 0
                                                            ? 'Please select one or more accounts from the filter above'
                                                            : 'Upload payment reports to see analytics here'}
                                                    </p>
                                                </div>
                                            </td>
                                        </tr>
                                    )}

                                    {/* Account Rows */}
                                    {displayAccountMetrics.map((account, idx) => {
                                        const logoUrl = getMarketplaceLogo(account.marketplaceName);
                                        const isProfit = account.netProfit >= 0;
                                        const profitPercentage = account.totalSales > 0 ? ((account.netProfit / account.totalSales) * 100) : 0;
                                        const isHighlighted = highlightAccountIds.includes(String(account.marketplaceId || account._id));

                                        return (
                                            <tr
                                                key={account.marketplaceId || idx}
                                                className={`transition-all duration-200 cursor-pointer group ${isHighlighted
                                                    ? 'bg-slate-300/90 hover:bg-slate-200/90 border-l-4 border-l-amber-600 shadow-xs'
                                                    : 'hover:bg-slate-100/90'
                                                    } ${account.status === 'inactive' ? 'opacity-60' : ''}`}
                                                style={{
                                                    animation: `fadeIn 0.3s ease-out ${idx * 0.05}s backwards`
                                                }}
                                            >
                                                <td className="px-2 py-3 text-center align-middle">
                                                    <div className="flex items-center justify-center">
                                                        <div className="flex-shrink-0 w-9 h-9 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                                                            {logoUrl ? (
                                                                <img
                                                                    src={logoUrl}
                                                                    alt={account.marketplaceName}
                                                                    className="w-9 h-9 object-contain rounded-lg border border-slate-200 bg-white p-1 shadow-sm group-hover:shadow-md group-hover:border-brand-300 transition-all duration-300"
                                                                    title={account.marketplaceName}
                                                                    onError={(e) => {
                                                                        e.target.style.display = 'none';
                                                                        e.target.nextElementSibling.style.display = 'flex';
                                                                    }}
                                                                />
                                                            ) : null}
                                                            <div
                                                                className="w-9 h-9 rounded-lg bg-gradient-to-br from-slate-100 to-slate-200 border border-slate-300 text-slate-600 items-center justify-center shadow-sm group-hover:from-brand-100 group-hover:to-brand-200 group-hover:border-brand-400 group-hover:shadow-md transition-all duration-300"
                                                                style={{ display: logoUrl ? 'none' : 'flex' }}
                                                                title={account.marketplaceName}
                                                            >
                                                                <ShoppingBag size={18} className="group-hover:text-brand-600 transition-colors" />
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-2 py-3 text-center">
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleAccountClick(account);
                                                        }}
                                                        disabled={checkingAccount === account.marketplaceId || recalculatingAccount === account.marketplaceId || completedAccount === account.marketplaceId}
                                                        className={`text-sm font-semibold hover:underline underline-offset-2 transition-colors cursor-pointer disabled:cursor-wait inline-flex items-center gap-1.5 flex-wrap justify-center ${isHighlighted ? 'text-brand-900 font-extrabold' : 'text-brand-700 hover:text-brand-900'
                                                            }`}
                                                    >
                                                        {(checkingAccount === account.marketplaceId || recalculatingAccount === account.marketplaceId) && (
                                                            <Loader2 className="animate-spin text-brand-600" size={14} />
                                                        )}
                                                        <span>{account.accountName || account.marketplaceName}</span>
                                                        {recalculatingAccount === account.marketplaceId && (
                                                            <span className="text-xs font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-300 animate-pulse flex items-center gap-1">
                                                                <Loader2 className="animate-spin text-amber-600" size={12} />
                                                                {isFullRecalcRun ? 'Recalculating...' : 'Calculating...'}
                                                            </span>
                                                        )}
                                                        {completedAccount === account.marketplaceId && (
                                                            <span className="text-xs font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-300 flex items-center gap-1">
                                                                <CheckCircle size={12} />
                                                                Complete!
                                                            </span>
                                                        )}
                                                    </button>
                                                    {account.status === 'inactive' && (
                                                        <span className="ml-2 px-2 py-0.5 bg-slate-200 text-slate-600 text-[10px] font-bold uppercase rounded-md tracking-wide">
                                                            Deactivated
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-2 py-3 text-center">
                                                    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 group-hover:bg-slate-200 rounded-lg transition-all duration-300">
                                                        <IndianRupee size={14} className="text-slate-600" />
                                                        <span className="text-sm font-bold text-slate-800">
                                                            {(account.totalSales || 0).toLocaleString('en-IN')}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-2 py-3 text-center">
                                                    <div className="flex justify-center">
                                                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg font-semibold text-sm group-hover:bg-emerald-100 group-hover:shadow-sm transition-all duration-300">
                                                            <TrendingUp size={14} />
                                                            ₹{(account.totalSettlement || 0).toLocaleString('en-IN')}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-2 py-3 text-center">
                                                    <div className="flex justify-center">
                                                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-700 rounded-lg font-semibold text-sm group-hover:bg-red-100 group-hover:shadow-sm transition-all duration-300">
                                                            <TrendingDown size={14} />
                                                            ₹{Math.abs(account.totalMarketplaceFees || 0).toLocaleString('en-IN')}
                                                        </span>
                                                    </div>
                                                </td>

                                                <td className="px-2 py-3 text-center">
                                                    <div className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-violet-50 group-hover:bg-violet-100 text-violet-700 rounded-lg border border-violet-100 transition-all duration-300">
                                                        <span className="text-sm font-medium">
                                                            ₹{Math.abs(account.adsCost || 0).toLocaleString('en-IN')}
                                                        </span>
                                                    </div>
                                                </td>

                                                <td className="px-2 py-3 text-center whitespace-nowrap">
                                                    <div className="flex justify-center">
                                                        <div className="inline-flex items-center gap-2">
                                                            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold text-sm transition-all duration-300 group-hover:shadow-sm ${isProfit
                                                                ? 'bg-emerald-50 text-emerald-700 group-hover:bg-emerald-100'
                                                                : 'bg-red-50 text-red-700 group-hover:bg-red-100'
                                                                }`}>
                                                                {isProfit ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                                                                ₹{(account.netProfit || 0).toLocaleString('en-IN')}
                                                            </span>
                                                            <span className={`text-xs font-semibold ${isProfit ? 'text-emerald-600' : 'text-red-600'}`}>
                                                                ({profitPercentage > 0 ? '+' : ''}{profitPercentage.toFixed(1)}%)
                                                            </span>
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            <CostSheetNotGeneratedModal
                isOpen={notGeneratedModal.open}
                onClose={() => setNotGeneratedModal({ open: false, targetAccount: null, reportUrl: '', requiresRecalculation: false })}
                marketplaceId={notGeneratedModal.targetAccount?.marketplaceId}
                onGenerateSuccess={async () => {
                    const url = notGeneratedModal.reportUrl;
                    const targetAcc = notGeneratedModal.targetAccount;
                    const isRecalc = notGeneratedModal.requiresRecalculation;
                    
                    if (isRecalc && targetAcc) {
                        await triggerRecalculationAndOpen(targetAcc, url);
                    } else if (url) {
                        window.open(url, '_blank');
                    }
                }}
            />

            {/* Missing Product Costs Warning Modal */}
            {missingCostModal.open && typeof document !== 'undefined' && createPortal(
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[99999] p-4 sm:p-6 overflow-y-auto animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 my-auto border border-slate-100">
                        {/* Header */}
                        <div className="bg-amber-50 p-4 sm:p-6 border-b border-amber-100 flex items-start gap-3 sm:gap-4">
                            <div className="flex items-start gap-3 sm:gap-4">
                                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                                    <AlertTriangle className="text-amber-600" size={22} />
                                </div>
                                <div>
                                    <h3 className="text-base sm:text-lg font-bold text-amber-900">Missing Product Costs</h3>
                                    <p className="text-xs sm:text-sm text-amber-700 mt-1">Action required for accurate reporting</p>
                                </div>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="p-4 sm:p-6">
                            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                                You have <span className="font-bold text-amber-700">{missingCostModal.count} SKU{missingCostModal.count !== 1 ? 's' : ''}</span> in the selected marketplace {missingCostModal.count !== 1 ? 'have' : 'has'} no product cost filled in the cost sheet.
                                Calculations will run with <span className="font-semibold">₹0 product cost</span> for these SKUs, which may affect profit/loss accuracy.
                            </p>

                            {missingCostModal.skus.length > 0 && (
                                <div className="mt-4 p-3 bg-amber-50 rounded-xl border border-amber-100">
                                    <p className="text-[11px] sm:text-xs font-semibold text-amber-700 uppercase tracking-wide mb-2">SKU Preview</p>
                                    <ul className="space-y-1 max-h-28 overflow-y-auto">
                                        {missingCostModal.skus.map((sku, i) => (
                                             <li key={i} className="text-[11px] sm:text-xs font-mono text-slate-700 truncate">{sku}</li>
                                        ))}
                                    </ul>
                                    {missingCostModal.count > missingCostModal.skus.length && (
                                        <p className="text-[11px] sm:text-xs text-amber-600 mt-2">…and {missingCostModal.count - missingCostModal.skus.length} more</p>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-3 px-4 sm:px-6 pb-4 sm:pb-6">
                            <button
                                type="button"
                                onClick={async () => {
                                    const url = missingCostModal.reportUrl;
                                    const targetAcc = missingCostModal.targetAccount;
                                    const isRecalc = missingCostModal.requiresRecalculation;
                                    const isCalcPending = missingCostModal.calculationPending;
                                    setMissingCostModal({ open: false, count: 0, skus: [], reportUrl: '', targetAccount: null, requiresRecalculation: false, calculationPending: false });
                                    const { shouldCalculate, mode } = decideCalculationBeforeReport({
                                        requiresRecalculation: isRecalc,
                                        calculationPending: isCalcPending,
                                        isCreditBalanceLow,
                                        isCreditCalculating
                                    });
                                    if (shouldCalculate && targetAcc) {
                                        await triggerRecalculationAndOpen(targetAcc, url, mode);
                                    } else if (url) {
                                        window.open(url, '_blank', 'noopener,noreferrer');
                                    }
                                }}
                                className="px-4 py-2 text-xs sm:text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-all cursor-pointer"
                            >
                                Continue to Report
                            </button>
                            <button
                                type="button"
                                onClick={() => handleOpenCostSheet(missingCostModal.targetAccount)}
                                className="px-4 py-2 text-xs sm:text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-all cursor-pointer"
                            >
                                Go to Cost Sheet
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

        </div>
    );
};

export default PaymentsTab;