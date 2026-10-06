
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import CostSheetNotGeneratedModal from '../CostSheetNotGeneratedModal';
import { useNavigate, Link } from 'react-router-dom';
import api from '../../api';
import { Loader2, FileSpreadsheet, CheckCircle, Calculator, Upload, AlertTriangle, Store, Lock, Check, XCircle, X } from 'lucide-react';
import ExportButton from '../ExportButton';
import Tooltip from '../Tooltip';
import { useAuth } from '../../AuthContext';
import { useMarketplace } from '../../contexts/MarketplaceContext';
import { toast } from 'sonner';
import { decideCalculationBeforeReport } from '../../utils/calculationGate';

// Static step config — hoisted so it isn't recreated every render.
const WIZARD_STEPS = [
    {
        index: 1,
        title: "Upload Reports",
        description: "Ensure all reports (Sales report, settlement sheets, return lists) are uploaded to sync order numbers and sku payouts.",
        icon: Upload
    },
    {
        index: 2,
        title: "Update SKU Costs",
        description: "Open your cost sheet spreadsheet, fill in product cost, packaging cost, tax details, and return parameters.",
        icon: FileSpreadsheet
    },
    {
        index: 3,
        title: "View Reports",
        description: "View your final payout reconciliation, ads margins, and profit/loss reports.",
        icon: Calculator
    }
];

// Skeleton shown only until workflow state for current marketplace has loaded.
const WorkflowSkeleton = () => (
    <div className="relative space-y-6 animate-pulse" aria-hidden="true">
        <div className="absolute left-6 sm:left-7 top-7 bottom-7 w-0.5 bg-slate-200 z-0" />
        {[1, 2, 3].map((i) => (
            <div key={i} className="relative flex items-center gap-4 sm:gap-6">
                <div className="relative flex-shrink-0 z-10 flex items-center justify-center w-12 sm:w-14">
                    <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-slate-200" />
                </div>
                <div className="flex-1 bg-white rounded-2xl border border-slate-200/80 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.05)] p-5 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex-1 space-y-3 w-full">
                        <div className="h-4 w-40 bg-slate-200 rounded" />
                        <div className="h-3 w-full max-w-md bg-slate-100 rounded" />
                        <div className="h-3 w-3/4 max-w-sm bg-slate-100 rounded" />
                    </div>
                    <div className="h-11 w-full md:w-[180px] bg-slate-200 rounded-xl flex-shrink-0" />
                </div>
            </div>
        ))}
    </div>
);

const CalculationsTab = ({ viewMode = 'grid', filterData, handleFilterChange }) => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { triggerRefresh } = useMarketplace();

    // Credit calculation status polling
    const [processingInfo, setProcessingInfo] = useState({ uploadCount: 0 });
    const [isCreditCalculating, setIsCreditCalculating] = useState(false);
    const [showCreditCompleteBanner, setShowCreditCompleteBanner] = useState(false);
    const [isCreditBalanceLow, setIsCreditBalanceLow] = useState(false);
    const [creditBalance, setCreditBalance] = useState(null);
    const wasCreditCalculatingRef = useRef(false);
    const creditCompleteTimeoutRef = useRef(null);
    const canCalculatePollingRef = useRef(null);

    // Calculation State
    const [calculating, setCalculating] = useState(false);
    const [calculationStatus, setCalculationStatus] = useState(null);
    const [error, setError] = useState('');
    const [progress, setProgress] = useState(0);
    const [processedRows, setProcessedRows] = useState(0);
    const [totalSpineRows, setTotalSpineRows] = useState(null);
    const [showCompletedBanner, setShowCompletedBanner] = useState(false);
    const calculationPollingIntervalRef = useRef(null);
    const currentCalculationIdRef = useRef(null);
    const requestTokenRef = useRef(0);
    const step3ClickInFlightRef = useRef(false);

    // Cost sheet warning modals
    const [missingCostModal, setMissingCostModal] = useState({ open: false, count: 0, skus: [] });
    const [notGeneratedModal, setNotGeneratedModal] = useState(false);


    // Wizard workflow state
    const [hasMarketplaces, setHasMarketplaces] = useState(false);
    const [hasUploads, setHasUploads] = useState(false);
    const [isCostSheetGenerated, setIsCostSheetGenerated] = useState(false);
    const [missingCostCount, setMissingCostCount] = useState(0);
    const [costSheetBypassed, setCostSheetBypassed] = useState(false);
    const [hasGeneratedThisSession, setHasGeneratedThisSession] = useState(false);

    // Gates first paint of the wizard per marketplace so we show a skeleton
    // instead of stale/default step state while data loads.
    const [workflowReady, setWorkflowReady] = useState(false);

    // Value-based key for selected marketplace(s), so effects don't re-fire
    // just because the parent passed a new array/object reference.
    const marketplaceIdsKey = useMemo(() => {
        const ids = Array.isArray(filterData.marketplaceIds)
            ? filterData.marketplaceIds
            : (filterData.marketplaceIds ? [filterData.marketplaceIds] : []);
        return JSON.stringify(ids);
    }, [filterData.marketplaceIds]);


    const handleOpenReport = () => {
        const selectedIds = Array.isArray(filterData.marketplaceIds)
            ? filterData.marketplaceIds
            : (filterData.marketplaceIds ? [filterData.marketplaceIds] : []);

        const params = new URLSearchParams();

        if (selectedIds.length > 0) {
            params.set('marketplaceIds', JSON.stringify(selectedIds));
        }

        if (filterData.startDate) {
            params.set('startDate', filterData.startDate);
        }

        if (filterData.endDate) {
            params.set('endDate', filterData.endDate);
        }

        const qs = params.toString();
        const routePath = `/client/payments/calculations${qs ? `?${qs}` : ''}`;

        window.open(routePath, '_blank', 'noopener,noreferrer');
    };


    // Reset wizard state (and re-show skeleton) when the selected marketplace changes.
    useEffect(() => {
        setWorkflowReady(false);
        setCostSheetBypassed(false);
        setHasGeneratedThisSession(false);
        setMissingCostCount(0);
        setIsCostSheetGenerated(false);
        setError('');
    }, [marketplaceIdsKey]);

    const checkWorkflowState = async () => {
        if (!user) return;

        const myToken = ++requestTokenRef.current;

        try {
            const selectedIds = Array.isArray(filterData.marketplaceIds)
                ? filterData.marketplaceIds
                : (filterData.marketplaceIds ? [filterData.marketplaceIds] : []);
            const hasExactlyOne = selectedIds.length === 1;
            const selectedAccountId = hasExactlyOne ? selectedIds[0] : null;

            // Fetch everything in parallel instead of one-by-one
            const [marketplacesRes, uploadRes, calcRes, activeCalcRes, costSheetRes] = await Promise.allSettled([
                api.get('/marketplaces/filter-options?includeInactive=true'),
                selectedAccountId ? api.get(`/upload?accountId=${selectedAccountId}&limit=10`) : Promise.resolve({ data: { uploads: [] } }),
                selectedAccountId ? api.get('/payments/calculations', { params: { limit: 1, marketplaceIds: JSON.stringify([selectedAccountId]) } }) : Promise.resolve({ data: [] }),
                api.get('/payments/calculate/active'),
                selectedAccountId ? api.get(`/cost-sheet/check-missing?marketplaceIds=${encodeURIComponent(JSON.stringify([selectedAccountId]))}`) : Promise.resolve({ data: {} })
            ]);

            if (requestTokenRef.current !== myToken) return; // stale response, a newer call is in flight

            const marketplaceOptions = marketplacesRes.status === 'fulfilled' ? marketplacesRes.value.data : [];
            const hasConnected = marketplaceOptions && marketplaceOptions.length > 0 && marketplaceOptions.some(m => m.accounts && m.accounts.length > 0);

            if (!hasConnected || !hasExactlyOne) {
                setHasMarketplaces(hasConnected);
                return;
            }

            const uploadData = uploadRes.status === 'fulfilled' ? uploadRes.value.data : {};
            const uploadsList = uploadData?.uploads || [];
            const nonCostSheetUploads = uploadsList.filter(u => u.uploadType !== 'costsheet' && ['completed', 'processing', 'queued_for_processing', 'validating', 'validation_warning'].includes(u.status));
            const hasUploaded = nonCostSheetUploads.length > 0;

            if (!hasUploaded) {
                setHasMarketplaces(hasConnected);
                setHasUploads(false);
                setCalculationStatus(null);
                setMissingCostCount(0);
                setIsCostSheetGenerated(false);
                try { localStorage.removeItem('last_calculation_status'); } catch (_) { }
                return;
            }

            let newCalcStatus = null;
            if (calcRes.status === 'fulfilled') {
                const calcData = calcRes.value.data;
                const fetchedRows = calcData?.data || calcData?.rows || (Array.isArray(calcData) ? calcData : []);
                const totalCount = calcData?.pagination?.total ?? calcData?.totalCount ?? calcData?.total ?? (Array.isArray(fetchedRows) ? fetchedRows.length : 0);
                if ((totalCount > 0 || hasGeneratedThisSession) && (!filterData.requiresRecalculation || hasGeneratedThisSession)) {
                    newCalcStatus = 'completed';
                    try { localStorage.setItem('last_calculation_status', 'completed'); } catch (_) { }
                } else if (filterData.requiresRecalculation && !hasGeneratedThisSession) {
                    try { localStorage.removeItem('last_calculation_status'); } catch (_) { }
                }
            }

            if (activeCalcRes.status === 'fulfilled') {
                const activeRes = activeCalcRes.value;
                const activeCalc = activeRes.data?.data !== undefined ? activeRes.data.data : activeRes.data;
                if (activeCalc && activeCalc.calculationId && ["pending", "processing"].includes(activeCalc.status)) {
                    setHasMarketplaces(hasConnected);
                    setHasUploads(true);
                    setCalculating(true);
                    setCalculationStatus(activeCalc.status);
                    setProgress(activeCalc.progress || 0);
                    if (activeCalc.processedRows !== undefined) setProcessedRows(activeCalc.processedRows);
                    if (activeCalc.totalSpineRows !== undefined) setTotalSpineRows(activeCalc.totalSpineRows);
                    currentCalculationIdRef.current = activeCalc.calculationId;
                    if (!calculationPollingIntervalRef.current) {
                        // Passive sync (periodic workflow check, not a click) — never auto-open a tab.
                        startCalculationPolling(activeCalc.calculationId, { navigateOnComplete: false });
                    }
                    return;
                }
            }

            const costData = costSheetRes.status === 'fulfilled' ? costSheetRes.value.data : {};
            const generated = costData?.isCostSheetGenerated || false;
            const missingCount = costData?.missingCount || 0;

            setHasMarketplaces(hasConnected);
            setHasUploads(true);
            setCalculationStatus(newCalcStatus);
            setIsCostSheetGenerated(generated);
            setMissingCostCount(missingCount);
        } catch (err) {
            console.error('Error checking workflow state:', err);
        } finally {
            if (requestTokenRef.current === myToken) {
                setWorkflowReady(true);
            }
        }
    };

    // Re-runs only on an actual marketplace change (via marketplaceIdsKey), on user change,
    // on tab focus, and when the cost-sheet bypass flag flips.
    useEffect(() => {
        checkWorkflowState();

        const handleFocus = () => {
            checkWorkflowState();
        };

        window.addEventListener('focus', handleFocus);
        return () => {
            window.removeEventListener('focus', handleFocus);
        };
    }, [marketplaceIdsKey, user, costSheetBypassed]);

    useEffect(() => {
        if (user) {
            checkCanCalculate();
            startCanCalculatePolling();
        }
    }, [user]);

    // On mount: attach polling if a calculation is already in-progress.
    useEffect(() => {
        const checkActiveCalc = async () => {
            // Guard: if calculation polling is already running, skip this check
            if (calculationPollingIntervalRef.current) return;

            try {
                const response = await api.get('/payments/calculate/active');
                const activeCalc = response.data?.data !== undefined ? response.data.data : response.data;
                const calcId = activeCalc?.calculationId || activeCalc?._id;
                if (activeCalc && calcId && ['pending', 'processing'].includes(activeCalc.status)) {
                    if (currentCalculationIdRef.current !== calcId || !calculating) {
                        currentCalculationIdRef.current = calcId;
                        setCalculating(true);
                        setCalculationStatus(activeCalc.status);
                        if (activeCalc.progress !== undefined) setProgress(activeCalc.progress);
                        if (activeCalc.processedRows !== undefined) setProcessedRows(activeCalc.processedRows);
                        if (activeCalc.totalSpineRows !== undefined) setTotalSpineRows(activeCalc.totalSpineRows);

                        // Passive resume on mount (not a click) — never auto-open a tab.
                        startCalculationPolling(calcId, { navigateOnComplete: false });
                    }
                }
            } catch (_) {
                // No active calculation to resume, or the check failed transiently — nothing to do.
            }
        };

        checkActiveCalc();

        // Cross-tab sync: pick up calculation-start / new-upload events from other tabs.
        const handleStorageChange = (e) => {
            if (e.key === 'active_calculation_event' && e.newValue) {
                try {
                    const parsed = JSON.parse(e.newValue);
                    const calcId = parsed.calculationId || parsed._id;
                    if (calcId) {
                        currentCalculationIdRef.current = calcId;
                        setCalculating(true);
                        setCalculationStatus('processing');
                        setProgress(5);
                        // Started in a different browser tab (not a click here) — never auto-open a tab.
                        startCalculationPolling(calcId, { navigateOnComplete: false });
                    }
                } catch (_) { }
            }

            if (e.key === 'new_upload_event' && e.newValue) {
                setCalculationStatus(null);
                setCalculating(false);
                if (calculationPollingIntervalRef.current) {
                    clearInterval(calculationPollingIntervalRef.current);
                    calculationPollingIntervalRef.current = null;
                }
                try { localStorage.removeItem('last_calculation_status'); } catch (_) { }
                checkWorkflowState();
                checkCanCalculate();
                startCanCalculatePolling();
            }
        };

        window.addEventListener('storage', handleStorageChange);

        return () => {
            window.removeEventListener('storage', handleStorageChange);
        };
    }, []);

    useEffect(() => {
        return () => {
            if (calculationPollingIntervalRef.current) clearInterval(calculationPollingIntervalRef.current);
            if (canCalculatePollingRef.current) clearInterval(canCalculatePollingRef.current);
            if (creditCompleteTimeoutRef.current) clearTimeout(creditCompleteTimeoutRef.current);
        };
    }, []);

    const checkCanCalculate = async () => {
        try {
            const { data } = await api.get('/credits/can-calculate', { params: {} });
            const canCalc = data?.canCalculate;
            const reason = data?.reason;
            setProcessingInfo({
                uploadCount: data?.processingStatus?.uploadCount || 0
            });

            const isBusy = reason === 'calculating_credits' || reason === 'processing_uploads';
            setIsCreditBalanceLow(reason === 'insufficient_balance');
            setCreditBalance(data?.balance !== undefined ? data.balance : null);

            if (isBusy) {
                setIsCreditCalculating(true);
                wasCreditCalculatingRef.current = true;
                setShowCreditCompleteBanner(false);
                if (!canCalculatePollingRef.current) {
                    startCanCalculatePolling();
                }
            } else {
                setIsCreditCalculating(false);
                if (wasCreditCalculatingRef.current) {
                    wasCreditCalculatingRef.current = false;
                    setShowCreditCompleteBanner(true);
                    if (creditCompleteTimeoutRef.current) clearTimeout(creditCompleteTimeoutRef.current);
                    creditCompleteTimeoutRef.current = setTimeout(() => {
                        setShowCreditCompleteBanner(false);
                    }, 4000);
                }
                if (canCalc && canCalculatePollingRef.current) {
                    clearInterval(canCalculatePollingRef.current);
                    canCalculatePollingRef.current = null;
                }
            }
        } catch (error) {
            console.error('Error checking calculation status:', error);
            setIsCreditCalculating(false);
        }
    };

    const startCanCalculatePolling = () => {
        if (canCalculatePollingRef.current) clearInterval(canCalculatePollingRef.current);
        canCalculatePollingRef.current = setInterval(checkCanCalculate, 30000);
    };

    // navigateOnComplete=false is used when this tab merely detected an already-running
    // calculation (mount check, cross-tab storage signal, or the periodic workflow-state
    // check) rather than something the user just clicked here — we still want the progress
    // UI to track it and flip back to idle when done, but only the entry point the user
    // actually clicked should pop the report tab open. Without this gate, Payments and Step 3
    // both passively watching the same tenant-wide calculation would each try to open a tab.
    const startCalculationPolling = (calculationId, { navigateOnComplete = true } = {}) => {
        if (calculationPollingIntervalRef.current) {
            clearInterval(calculationPollingIntervalRef.current);
            calculationPollingIntervalRef.current = null;
        }
        checkCalculationStatus(calculationId, navigateOnComplete);
        calculationPollingIntervalRef.current = setInterval(() => checkCalculationStatus(calculationId, navigateOnComplete), 5000);
    };

    const checkCalculationStatus = async (calculationId, navigateOnComplete = true) => {
        try {
            const response = await api.get(`/payments/calculate/${calculationId}`);
            const calcData = response.data?.data !== undefined ? response.data.data : response.data;
            const status = calcData?.status;

            if (calcData?.processedRows !== undefined) setProcessedRows(calcData.processedRows);
            if (calcData?.totalSpineRows !== undefined) setTotalSpineRows(calcData.totalSpineRows);
            if (calcData?.progress !== undefined) setProgress(calcData.progress);

            if (status === 'completed') {
                if (calculationPollingIntervalRef.current) {
                    clearInterval(calculationPollingIntervalRef.current);
                    calculationPollingIntervalRef.current = null;
                }

                setProgress(100);
                setCalculationStatus('completed');
                setCalculating(false);
                setHasGeneratedThisSession(true);
                setShowCompletedBanner(true);

                toast.success('Calculation completed successfully!');

                setTimeout(() => {
                    setShowCompletedBanner(false);
                    if (navigateOnComplete) {
                        handleOpenReport();
                    }
                }, 1000);

                try {
                    localStorage.setItem('last_calculation_status', 'completed');
                } catch (_) { }

                if (handleFilterChange) {
                    handleFilterChange(prev => ({
                        ...(prev && typeof prev === 'object' ? prev : filterData),
                        requiresRecalculation: false
                    }));
                }

                // Refresh the marketplace filter options so account state (e.g. requiresRecalculation
                // flags) reflects the just-completed recalculation instead of staying stale.
                triggerRefresh();
            } else if (status === 'failed') {
                if (calculationPollingIntervalRef.current) {
                    clearInterval(calculationPollingIntervalRef.current);
                    calculationPollingIntervalRef.current = null;
                }
                setCalculationStatus('failed');
                setCalculating(false);
                if (navigateOnComplete) {
                    setError(calcData?.errorMessage || 'Calculation failed');
                }
            } else {
                setCalculationStatus(status);
            }
        } catch (err) {
            if (err.response?.status === 404 || err.response?.status === 403) {
                if (calculationPollingIntervalRef.current) {
                    clearInterval(calculationPollingIntervalRef.current);
                    calculationPollingIntervalRef.current = null;
                }
                setCalculationStatus(null);
                setCalculating(false);
                if (err.response?.status === 404) setError('Calculation not found or expired');
            }
        }
    };

    const handleStartRecalculate = async (mode) => {
        const selectedIds = Array.isArray(filterData.marketplaceIds)
            ? filterData.marketplaceIds
            : (filterData.marketplaceIds ? [filterData.marketplaceIds] : []);

        if (selectedIds.length === 0) return;

        setCalculating(true);
        setCalculationStatus('processing');
        setProgress(0);
        setProcessedRows(0);
        setError('');

        try {
            const res = await api.post('/payments/calculate', {
                marketplaceIds: selectedIds,
                ...(mode ? { mode } : {})
            });
            const calcObj = res.data?.data !== undefined ? res.data.data : res.data;
            const calcId = calcObj?.calculationId || calcObj?._id || res.data?.calculationId;

            if (calcObj?.alreadyUpToDate) {
                // Another entry point (Cost Sheet / Payments) already completed the
                // recalculation in the meantime — don't run it again, just open the report.
                setCalculating(false);
                setCalculationStatus(null);
                setHasGeneratedThisSession(true);
                if (handleFilterChange) {
                    handleFilterChange(prev => ({
                        ...(prev && typeof prev === 'object' ? prev : filterData),
                        requiresRecalculation: false
                    }));
                }
                triggerRefresh();
                handleOpenReport();
                return;
            }

            if (calcId) {
                currentCalculationIdRef.current = calcId;
                try {
                    localStorage.setItem('active_calculation_event', JSON.stringify({
                        calculationId: calcId,
                        timestamp: Date.now()
                    }));
                } catch (_) { }
                startCalculationPolling(calcId, { navigateOnComplete: true });
            } else {
                setError('Failed to start calculation');
                setCalculating(false);
                setCalculationStatus(null);
            }
        } catch (err) {
            console.error('Error starting recalculation:', err);
            setError(err.response?.data?.message || err.response?.data?.error || 'Failed to start calculation');
            setCalculating(false);
            setCalculationStatus(null);
        }
    };

    const handleStep3Click = async () => {
        if (step3ClickInFlightRef.current) return;
        step3ClickInFlightRef.current = true;

        try {
            const marketplaceIds = Array.isArray(filterData.marketplaceIds)
                ? filterData.marketplaceIds
                : (filterData.marketplaceIds ? [filterData.marketplaceIds] : []);

            const qs = marketplaceIds.length > 0 ? `?marketplaceIds=${encodeURIComponent(JSON.stringify(marketplaceIds))}` : '';

            let freshCalculationPending = false;
            try {
                const checkRes = await api.get(`/cost-sheet/check-missing${qs}`);
                if (checkRes.data) {
                    freshCalculationPending = Boolean(checkRes.data.calculationPending);
                    if (checkRes.data.isCostSheetGenerated === false) {
                        setNotGeneratedModal(true);
                        return;
                    }
                    if (checkRes.data.missingCount !== undefined && checkRes.data.missingCount > 0 && !costSheetBypassed) {
                        setMissingCostModal({
                            open: true,
                            count: checkRes.data.missingCount,
                            skus: checkRes.data.missingSkus || [],
                            calculationPending: freshCalculationPending
                        });
                        return;
                    }
                }
            } catch (err) {
                console.error('Error checking missing cost sheet:', err);
            }

            const { shouldCalculate, mode } = decideCalculationBeforeReport({
                requiresRecalculation: filterData?.requiresRecalculation && !hasGeneratedThisSession,
                calculationPending: freshCalculationPending,
                isCreditBalanceLow,
                isCreditCalculating
            });
            if (shouldCalculate) {
                handleStartRecalculate(mode);
            } else {
                handleOpenReport();
            }
        } catch (e) {
            console.error(e);
        } finally {
            step3ClickInFlightRef.current = false;
        }
    };

    const handleOpenCostSheet = () => {
        setMissingCostModal({ open: false, count: 0, skus: [] });
        const selectedIds = Array.isArray(filterData.marketplaceIds)
            ? filterData.marketplaceIds
            : (filterData.marketplaceIds ? [filterData.marketplaceIds] : []);

        const names = Array.isArray(filterData.marketplaceNames) ? filterData.marketplaceNames : [];

        // Query params (not navigate state) so it survives opening in a new tab.
        const qs = `?marketplaceIds=${encodeURIComponent(JSON.stringify(selectedIds))}&marketplaceNames=${encodeURIComponent(JSON.stringify(names))}`;
        window.open(`/client/cost-sheet${qs}`, '_blank', 'noopener,noreferrer');
    };


    if (viewMode === 'list') {
        return (
            <div className="bg-white rounded-2xl shadow-card border border-slate-200 p-8 text-center text-slate-500 animate-in fade-in">
                Calculations are managed in Grid View. Please switch the view mode at the top right to access these features.
            </div>
        );
    }


    return (
        <div className="w-full animate-in fade-in duration-300">
            {/* Workflow Visualizer */}
            <div>
                <h3 className="font-heading font-bold text-slate-800 text-lg mb-4">Calculation Workflow</h3>

                {!workflowReady ? (
                    <WorkflowSkeleton />
                ) : (
                    <div className="relative space-y-6">
                        {/* Vertical Connector Line */}
                        <div className="absolute left-6 sm:left-7 top-7 bottom-7 w-0.5 bg-slate-200 z-0" />

                        {WIZARD_STEPS.map((step) => {
                            let isCompleted = false;
                            let isActive = false;
                            let isDisabled = false;

                            if (step.index === 1) {
                                isCompleted = hasUploads;
                                isActive = !hasUploads;
                                isDisabled = false;
                            } else if (step.index === 2) {
                                isDisabled = !hasUploads;
                                isCompleted = hasUploads && (calculationStatus === 'completed' || (isCostSheetGenerated && missingCostCount === 0));
                                isActive = hasUploads && calculationStatus !== 'completed' && (!isCostSheetGenerated || missingCostCount > 0);
                            } else if (step.index === 3) {
                                isDisabled = !hasUploads;
                                isCompleted = calculationStatus === 'completed';
                                isActive = hasUploads && calculationStatus !== 'completed';
                            }

                            const StepIcon = step.icon;

                            return (
                                <div key={step.index} className={`relative flex items-center gap-4 sm:gap-6 group ${isDisabled ? 'opacity-70' : ''}`}>
                                    {/* Step icon node */}
                                    <div className="relative flex-shrink-0 z-10 flex items-center justify-center w-12 sm:w-14">
                                        {isCompleted ? (
                                            // Completed: green ring + check + top-right dot
                                            <div className="relative w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-emerald-100/60 border-2 border-emerald-500 flex items-center justify-center shadow-xs transition-transform duration-300 group-hover:scale-105">
                                                <Check className="w-6 h-6 sm:w-7 sm:h-7 text-emerald-600 stroke-[2.5]" />
                                                <span className="absolute top-0 right-0 w-3.5 h-3.5 bg-emerald-500 border-2 border-white rounded-full shadow-xs" />
                                            </div>
                                        ) : isActive ? (
                                            // Active: double ring + icon box
                                            <div className="relative p-1 sm:p-1.5 rounded-full border-2 border-indigo-400/40 bg-indigo-50/30 shadow-md transition-transform duration-300 group-hover:scale-105">
                                                <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full border-2 border-indigo-600 bg-white flex items-center justify-center shadow-xs">
                                                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-xs">
                                                        <StepIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            // Locked: gray circle + lock badge
                                            <div className="relative w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-slate-50 border border-slate-200/90 flex items-center justify-center transition-transform duration-300">
                                                <StepIcon className="w-6 h-6 text-slate-300" />
                                                <div className="absolute top-0 right-0 w-5 h-5 rounded-full bg-white border border-slate-200 flex items-center justify-center shadow-xs text-slate-400">
                                                    <Lock className="w-2.5 h-2.5" />
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Card content */}
                                    <div className={`flex-1 bg-white rounded-2xl border border-slate-200/80 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.05)] ${isDisabled ? '' : 'hover:shadow-[0_6px_16px_-4px_rgba(0,0,0,0.08)] hover:border-slate-300'} transition-all duration-300 p-5 flex flex-col md:flex-row md:items-center justify-between gap-6`}>
                                        <div className="flex-1 space-y-3">
                                            <div>
                                                <div className="flex items-center gap-2.5 mb-1">
                                                    <h4 className="font-bold text-sm sm:text-base text-slate-800 tracking-tight">{step.title}</h4>
                                                </div>
                                                <p className="text-xs text-slate-500 leading-relaxed max-w-2xl">
                                                    {step.description}
                                                </p>
                                            </div>

                                            {/* Step 2 status widgets */}
                                            {step.index === 2 && !isDisabled && (
                                                <div className="space-y-2">
                                                    {(isCreditCalculating || showCreditCompleteBanner) && (
                                                        <div className={`mt-2.5 p-3.5 rounded-xl border space-y-2 animate-in fade-in duration-300 ${showCreditCompleteBanner && !isCreditCalculating
                                                            ? 'bg-emerald-50/90 border-emerald-200'
                                                            : 'bg-indigo-50/90 border-indigo-200'
                                                            }`}>
                                                            <div className="flex items-center justify-between text-xs">
                                                                <div className="flex items-center gap-2">
                                                                    {showCreditCompleteBanner && !isCreditCalculating ? (
                                                                        <CheckCircle className="text-emerald-600 flex-shrink-0" size={16} />
                                                                    ) : (
                                                                        <Loader2 className="animate-spin text-indigo-600 flex-shrink-0" size={16} />
                                                                    )}
                                                                    <div>
                                                                        <span className={`font-bold ${showCreditCompleteBanner && !isCreditCalculating ? 'text-emerald-900' : 'text-indigo-900'}`}>
                                                                            {showCreditCompleteBanner && !isCreditCalculating
                                                                                ? 'Credit Calculation Complete!'
                                                                                : 'Calculating Credits for Uploaded Reports...'}
                                                                        </span>
                                                                        {isCreditCalculating && processingInfo?.uploadCount > 0 && (
                                                                            <span className="text-[11px] font-medium text-indigo-600 ml-1.5">
                                                                                ({processingInfo.uploadCount} file{processingInfo.uploadCount !== 1 ? 's' : ''} processing)
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                                {isCreditCalculating ? (
                                                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-700">
                                                                        Processing
                                                                    </span>
                                                                ) : (
                                                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">
                                                                        Done
                                                                    </span>
                                                                )}
                                                            </div>
                                                            {isCreditCalculating && (
                                                                <div className="w-full h-1.5 bg-indigo-100 rounded-full overflow-hidden">
                                                                    <div className="h-full bg-indigo-600 rounded-full animate-pulse w-full" />
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}

                                                    {creditBalance !== null && !isCreditCalculating && (
                                                        <div className={`mt-2.5 flex items-center gap-2 text-xs font-semibold animate-in fade-in duration-200 ${isCreditBalanceLow ? 'text-red-600' : 'text-emerald-600'}`}>
                                                            {isCreditBalanceLow ? (
                                                                <XCircle size={16} className="flex-shrink-0 text-red-600" />
                                                            ) : (
                                                                <CheckCircle size={16} className="flex-shrink-0 text-emerald-600" />
                                                            )}
                                                            <span>
                                                                {isCreditBalanceLow ? 'Insufficient balance' : 'Available balance'} (₹{Number(Number(creditBalance).toFixed(2)).toLocaleString('en-IN')})
                                                            </span>
                                                        </div>
                                                    )}

                                                    {missingCostCount > 0 && !calculating && !isCreditCalculating && !['pending', 'processing'].includes(calculationStatus) && (
                                                        <div className="mt-2.5 p-3 bg-amber-50 rounded-xl border border-amber-200/80 text-xs text-amber-900 shadow-sm space-y-1.5">
                                                            <div className="flex items-center justify-between font-bold">
                                                                <span className="text-amber-800">{missingCostCount} SKUs missing cost data</span>
                                                                <span className="text-amber-700 text-[11px]">Action required</span>
                                                            </div>
                                                            <div className="w-full h-2 bg-amber-100 rounded-full overflow-hidden">
                                                                <div
                                                                    className="h-full bg-amber-500 rounded-full transition-all duration-500"
                                                                    style={{ width: `${Math.min(100, Math.max(10, Math.round((missingCostCount / 50) * 100)))}%` }}
                                                                />
                                                            </div>
                                                        </div>
                                                    )}

                                                    {(calculating || ['pending', 'processing'].includes(calculationStatus) || showCompletedBanner) && (
                                                        <div className={`mt-2.5 p-3.5 rounded-xl border space-y-2 animate-in fade-in duration-300 ${showCompletedBanner && !calculating
                                                            ? 'bg-emerald-50/90 border-emerald-200'
                                                            : 'bg-blue-50/90 border-blue-200'
                                                            }`}>
                                                            <div className="flex items-center justify-between text-xs">
                                                                <div className="flex items-center gap-2">
                                                                    {showCompletedBanner && !calculating ? (
                                                                        <CheckCircle className="text-emerald-600" size={16} />
                                                                    ) : (
                                                                        <Loader2 className="animate-spin text-blue-600" size={16} />
                                                                    )}
                                                                    <span className={`font-bold ${showCompletedBanner && !calculating ? 'text-emerald-900' : 'text-blue-900'}`}>
                                                                        {showCompletedBanner && !calculating ? 'Calculation Complete!' : 'Calculating...'}
                                                                    </span>
                                                                    {processedRows > 0 && (
                                                                        <span className={`text-[11px] font-medium ${showCompletedBanner && !calculating ? 'text-emerald-600' : 'text-blue-600'}`}>
                                                                            ({processedRows.toLocaleString()}{totalSpineRows ? ` / ${totalSpineRows.toLocaleString()}` : ''} rows)
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <span className={`font-extrabold ${showCompletedBanner && !calculating ? 'text-emerald-700' : 'text-blue-700'}`}>
                                                                    {Math.min(100, Math.max(0, Math.round(progress)))}%
                                                                </span>
                                                            </div>
                                                            <div className={`w-full h-2.5 rounded-full overflow-hidden p-0.5 shadow-inner ${showCompletedBanner && !calculating ? 'bg-emerald-100' : 'bg-blue-100'
                                                                }`}>
                                                                <div
                                                                    style={{
                                                                        width: `${Math.min(100, Math.max(progress, 0))}%`,
                                                                        height: '100%',
                                                                        background: showCompletedBanner && !calculating
                                                                            ? 'linear-gradient(90deg, #059669, #10b981, #34d399)'
                                                                            : 'linear-gradient(90deg, #2563eb, #3b82f6, #60a5fa)',
                                                                        borderRadius: '9999px',
                                                                        transition: 'width 0.6s ease-out, background 0.4s ease',
                                                                    }}
                                                                />
                                                            </div>
                                                        </div>
                                                    )}

                                                    {error && (
                                                        <div className="mt-2 p-3 bg-red-50 text-red-600 rounded-xl border border-red-100 text-xs font-semibold">
                                                            {error}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        {/* Action button */}
                                        {(() => {
                                            let btnText = "";
                                            let BtnIcon = step.icon;
                                            let isBtnDisabled = false;
                                            let disabledReason = null;

                                            // A deactivated account is read-only: no new uploads, no cost
                                            // sheet edits, no recalculation — only its last report can be viewed.
                                            const isInactiveAccount = !!filterData?.hasInactiveAccountSelected;

                                            if (step.index === 1) {
                                                if (!hasMarketplaces) {
                                                    btnText = "Connect Marketplace";
                                                    BtnIcon = Store;
                                                } else {
                                                    btnText = "Upload Reports";
                                                    BtnIcon = Upload;
                                                }
                                                isBtnDisabled = isInactiveAccount;
                                                if (isInactiveAccount) disabledReason = 'Account is deactivated — uploads are disabled. You can still view the last report.';
                                            } else if (step.index === 2) {
                                                btnText = "Open Cost Sheet";
                                                BtnIcon = FileSpreadsheet;
                                                // Cost Sheet page handles its own Calculate gating.
                                                isBtnDisabled = !hasUploads || isInactiveAccount;
                                                if (isInactiveAccount) disabledReason = 'Account is deactivated — cost sheet updates are disabled. You can still view the last report.';
                                            } else if (step.index === 3) {
                                                if (calculating || ['pending', 'processing'].includes(calculationStatus)) {
                                                    btnText = "Calculating...";
                                                    BtnIcon = Loader2;
                                                    isBtnDisabled = true;
                                                } else if (filterData?.requiresRecalculation && !hasGeneratedThisSession && !isCreditBalanceLow && !isCreditCalculating && !isInactiveAccount) {
                                                    btnText = "Recalculate & View Report";
                                                    BtnIcon = Calculator;
                                                    isBtnDisabled = !hasUploads;
                                                } else {
                                                    // Deactivated account, insufficient balance, or nothing pending — view only.
                                                    btnText = "View Report";
                                                    BtnIcon = FileSpreadsheet;
                                                    isBtnDisabled = !hasUploads;
                                                    if (isInactiveAccount) disabledReason = 'Account is deactivated — recalculation is disabled. Showing the last report only.';
                                                    else if (isCreditBalanceLow && !isCreditCalculating) {
                                                        disabledReason = creditBalance !== null
                                                            ? `Insufficient credit balance (${Number(creditBalance).toLocaleString('en-IN')}). Showing report view only.`
                                                            : 'Insufficient credit balance. Showing report view only.';
                                                    }
                                                }
                                            }

                                            // Recalculate & View Report means new data is waiting to be
                                            // reprocessed — make it visually distinct (amber) so it draws
                                            // the user's eye instead of blending in with the other steps'
                                            // default action buttons.
                                            const isRecalculateState = step.index === 3 && btnText === "Recalculate & View Report";
                                            return (
                                                <Tooltip text={disabledReason || step.title}>
                                                    <button
                                                        onClick={() => {
                                                            if (step.index === 1) {
                                                                if (hasMarketplaces) {
                                                                    navigate('/uploads');
                                                                } else {
                                                                    navigate('/settings/marketplace');
                                                                }
                                                            } else if (step.index === 2) {
                                                                handleOpenCostSheet();
                                                            } else if (step.index === 3) {
                                                                handleStep3Click();
                                                            }
                                                        }}
                                                        disabled={isBtnDisabled}
                                                        className={`flex items-center justify-center gap-2 px-6 py-3 min-w-[180px] font-bold text-sm rounded-xl transition-all duration-300 border-0 w-full md:w-auto ${isBtnDisabled
                                                            ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed shadow-none'
                                                            : isRecalculateState
                                                                ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-md hover:scale-105 active:scale-95 cursor-pointer'
                                                                : 'bg-brand-600 hover:bg-brand-700 text-white shadow-md hover:scale-105 active:scale-95 cursor-pointer'
                                                            }`}
                                                    >
                                                        {BtnIcon === Loader2 ? <BtnIcon size={16} className="animate-spin" /> : <BtnIcon size={16} />}
                                                        <span>{btnText}</span>
                                                    </button>
                                                </Tooltip>
                                            );
                                        })()}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            <CostSheetNotGeneratedModal
                isOpen={notGeneratedModal}
                onClose={() => setNotGeneratedModal(false)}
                marketplaceId={
                    filterData.marketplaceIds && Array.isArray(filterData.marketplaceIds) && filterData.marketplaceIds.length === 1
                        ? filterData.marketplaceIds[0]
                        : null
                }
                onGenerateSuccess={() => {
                    setHasGeneratedThisSession(true);
                }}
            />

            {/* Missing product costs — warning modal */}
            {missingCostModal.open && typeof document !== 'undefined' && createPortal(
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[99999] p-4 sm:p-6 overflow-y-auto animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 my-auto border border-slate-100">
                        <div className="bg-amber-50 p-4 sm:p-6 border-b border-amber-100 flex items-start gap-3 sm:gap-4">
                            <div className="flex items-start gap-3 sm:gap-4">
                                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                                    <AlertTriangle className="text-amber-600" size={22} />
                                </div>
                                <div>
                                    <h3 className="text-base sm:text-lg font-bold text-amber-900">Missing Product Costs</h3>
                                    <p className="text-xs sm:text-sm text-amber-700 mt-1">Action required before calculating</p>
                                </div>
                            </div>
                        </div>

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

                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-3 px-4 sm:px-6 pb-4 sm:pb-6">
                            <button
                                type="button"
                                onClick={() => {
                                    const modalCalculationPending = missingCostModal.calculationPending;
                                    setMissingCostModal({ open: false, count: 0, skus: [] });
                                    setCostSheetBypassed(true);
                                    const { shouldCalculate, mode } = decideCalculationBeforeReport({
                                        requiresRecalculation: filterData?.requiresRecalculation && !hasGeneratedThisSession,
                                        calculationPending: modalCalculationPending,
                                        isCreditBalanceLow,
                                        isCreditCalculating
                                    });
                                    if (shouldCalculate) {
                                        handleStartRecalculate(mode);
                                    } else {
                                        handleOpenReport();
                                    }
                                }}
                                className="px-4 py-2 text-xs sm:text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-all cursor-pointer"
                            >
                                Continue to Report
                            </button>
                            <button
                                onClick={() => {
                                    setMissingCostModal({ open: false, count: 0, skus: [] });
                                    handleOpenCostSheet();
                                }}
                                className="px-4 py-2 text-xs sm:text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-all cursor-pointer font-semibold shadow-xs"
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

export default CalculationsTab;