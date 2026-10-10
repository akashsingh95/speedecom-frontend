import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../../api';
import { Loader2, FileSpreadsheet, CheckCircle, XCircle, Clock, Calculator, Upload, Download, ArrowRight, Play, ExternalLink, AlertTriangle } from 'lucide-react';
import ExportButton from '../ExportButton';
import { useAuth } from '../../AuthContext';
import { useMarketplace } from '../../contexts/MarketplaceContext';

const CalculationsTab = ({ viewMode = 'grid', filterData, hasMarketplacesSelected, handleFilterChange }) => {
    const navigate = useNavigate();
    const { user, isImpersonating } = useAuth();
    const { triggerRefresh } = useMarketplace();
    const isElevatedUser = ['SuperAdmin', 'SBM', 'RM'].includes(user?.role);
    
    // Credit calculation status polling
    const [canCalculate, setCanCalculate] = useState(user?.role === 'SuperAdmin');
    const [calculationBlockReason, setCalculationBlockReason] = useState(null);
    const [processingInfo, setProcessingInfo] = useState({ uploadCount: 0, balance: null });
    const canCalculatePollingRef = useRef(null);

    // Calculation State
    const [calculating, setCalculating] = useState(false);
    const [calculationStatus, setCalculationStatus] = useState(null);
    const [error, setError] = useState('');
    const [progress, setProgress] = useState(0);
    const [processedRows, setProcessedRows] = useState(0);
    const [totalSpineRows, setTotalSpineRows] = useState(null);
    const calculationPollingIntervalRef = useRef(null);
    const currentCalculationIdRef = useRef(null);

    // State for Missing Cost Sheet Warning
    const [missingCostModal, setMissingCostModal] = useState({ open: false, count: 0, skus: [] });
    const [notGeneratedModal, setNotGeneratedModal] = useState(false);

    useEffect(() => {
        if (user?.role !== 'SuperAdmin') {
            checkCanCalculate();
            startCanCalculatePolling();
        }
    }, [user?.role]);

    // On mount: restore polling state if a calculation was in-progress before page refresh
    useEffect(() => {
        const restorePolling = async () => {
            try {
                // sendResponse sends data directly (not wrapped), so axios .data IS the calc doc
                const response = await api.get('/payments/calculate/active');
                const activeCalc = response.data;
                if (activeCalc && activeCalc.calculationId && ['pending', 'processing'].includes(activeCalc.status)) {
                    currentCalculationIdRef.current = activeCalc.calculationId;
                    setCalculating(true);
                    setCalculationStatus(activeCalc.status);
                    setProgress(activeCalc.progress || 0);
                    setProcessedRows(activeCalc.processedRows || 0);
                    setTotalSpineRows(activeCalc.totalSpineRows || null);
                    startCalculationPolling(activeCalc.calculationId);
                }
            } catch (_) {
                // Non-fatal — user just won't see restored spinner
            }
        };
        restorePolling();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        return () => {
            if (calculationPollingIntervalRef.current) clearInterval(calculationPollingIntervalRef.current);
            if (canCalculatePollingRef.current) clearInterval(canCalculatePollingRef.current);
        };
    }, []);

    const checkCanCalculate = async () => {
        try {
            const { data } = await api.get('/credits/can-calculate', { params: {} });
            setCanCalculate(data.canCalculate);
            setCalculationBlockReason(data.reason);
            setProcessingInfo({
                uploadCount: data.processingStatus?.uploadCount || 0,
                balance: data.balance,
                files: data.processingStatus?.files || []
            });
            if (data.canCalculate && canCalculatePollingRef.current) {
                clearInterval(canCalculatePollingRef.current);
                canCalculatePollingRef.current = null;
            }
        } catch (error) {
            console.error('Error checking calculation status:', error);
            setCanCalculate(false);
            setCalculationBlockReason(null);
        }
    };

    const startCanCalculatePolling = () => {
        if (canCalculatePollingRef.current) clearInterval(canCalculatePollingRef.current);
        canCalculatePollingRef.current = setInterval(checkCanCalculate, 5000);
    };

    const handleCalculate = async (mode = 'incremental') => {
        setCalculating(true);
        setCalculationStatus('pending');
        setError('');
        try {
            const marketplaceIds = Array.isArray(filterData.marketplaceIds)
                ? filterData.marketplaceIds
                : (filterData.marketplaceIds ? [filterData.marketplaceIds] : []);

            // Check for missing product costs first
            const qs = marketplaceIds.length > 0 ? `?marketplaceIds=${encodeURIComponent(JSON.stringify(marketplaceIds))}` : '';
            const checkRes = await api.get(`/cost-sheet/check-missing${qs}`);
            
            if (checkRes.data) {
                if (checkRes.data.isCostSheetGenerated === false) {
                    setNotGeneratedModal(true);
                    setCalculating(false);
                    setCalculationStatus(null);
                    return;
                }

                if (checkRes.data.missingCount !== undefined && checkRes.data.missingCount > 0) {
                    setMissingCostModal({
                        open: true,
                        count: checkRes.data.missingCount,
                        skus: checkRes.data.missingSkus || []
                    });
                    setCalculating(false);
                    setCalculationStatus(null);
                    return;
                }
            }

            await doCalculate(marketplaceIds, mode);
        } catch (err) {
            setError(err.response?.data?.error || err.response?.data?.message || 'Something went wrong');
            setCalculationStatus(null);
            setCalculating(false);
        }
    };

    const doCalculate = async (providedMarketplaceIds, mode = 'incremental') => {
        setMissingCostModal({ open: false, count: 0, skus: [] });
        setNotGeneratedModal(false);
        setCalculating(true);
        setCalculationStatus('pending');
        setProgress(0);
        setProcessedRows(0);
        setTotalSpineRows(null);
        setError('');
        
        try {
            const marketplaceIds = providedMarketplaceIds || (Array.isArray(filterData.marketplaceIds)
                ? filterData.marketplaceIds
                : (filterData.marketplaceIds ? [filterData.marketplaceIds] : []));

            // NOTE: startDate / endDate are intentionally not sent — calculations always
            // process the full dataset (no date restriction applied by the worker).
            const payload = { marketplaceIds };
            if (mode === 'full') {
                payload.mode = 'full';
            }

            const { data } = await api.post('/payments/calculate', payload);
            if (data && data.calculationId) {
                currentCalculationIdRef.current = data.calculationId;
                startCalculationPolling(data.calculationId, mode);
            } else {
                setError('Failed to initiate calculations');
                setCalculationStatus(null);
                setCalculating(false);
            }
        } catch (err) {
            setError(err.response?.data?.error || err.response?.data?.message || 'Something went wrong');
            setCalculationStatus(null);
            setCalculating(false);
        }
    };

    const startCalculationPolling = (calculationId, mode) => {
        if (calculationPollingIntervalRef.current) clearInterval(calculationPollingIntervalRef.current);
        checkCalculationStatus(calculationId, mode);
        calculationPollingIntervalRef.current = setInterval(() => checkCalculationStatus(calculationId, mode), 2000);
    };

    const checkCalculationStatus = async (calculationId, mode) => {
        try {
            const response = await api.get(`/payments/calculate/${calculationId}`);
            // sendResponse sends the calc doc directly — it IS response.data
            const calcData = response.data;
            const status = calcData?.status;

            // Update progress state from Mongo response
            if (calcData?.progress !== undefined) setProgress(calcData.progress);
            if (calcData?.processedRows !== undefined) setProcessedRows(calcData.processedRows);
            if (calcData?.totalSpineRows !== undefined) setTotalSpineRows(calcData.totalSpineRows);

            if (status === 'completed') {
                if (calculationPollingIntervalRef.current) clearInterval(calculationPollingIntervalRef.current);
                setCalculationStatus('completed');
                setCalculating(false);
                setProgress(100);
                
                if (mode === 'full') {
                    // Refresh the marketplace options to clear the 'requiresRecalculation' flag gracefully
                    triggerRefresh();
                }
                
                if (user?.role !== 'SuperAdmin') checkCanCalculate();
            } else if (status === 'failed') {
                if (calculationPollingIntervalRef.current) clearInterval(calculationPollingIntervalRef.current);
                setCalculationStatus('failed');
                setCalculating(false);
                setError(calcData?.errorMessage || 'Calculation failed');
            } else {
                setCalculationStatus(status);
            }
        } catch (err) {
            if (err.response?.status === 404 || err.response?.status === 403) {
                if (calculationPollingIntervalRef.current) clearInterval(calculationPollingIntervalRef.current);
                setCalculationStatus(null);
                setCalculating(false);
                if (err.response?.status === 404) setError('Calculation not found or expired');
            }
        }
    };

    const handleOpenCostSheet = () => {
        const selectedIds = Array.isArray(filterData.marketplaceIds)
            ? filterData.marketplaceIds
            : (filterData.marketplaceIds ? [filterData.marketplaceIds] : []);
            
        const names = Array.isArray(filterData.marketplaceNames) ? filterData.marketplaceNames : [];
        
        // We use query params instead of navigate() state because state gets lost in new tabs
        const qs = `?marketplaceIds=${encodeURIComponent(JSON.stringify(selectedIds))}&marketplaceNames=${encodeURIComponent(JSON.stringify(names))}`;
        window.open(`/client/cost-sheet${qs}`, '_blank', 'noopener,noreferrer');
    };

    // UI configuration for our visual flow
    const flowSteps = [
        {
            title: "Upload Reports",
            description: "Go to the Upload page, select your marketplace account, drag & drop your files, and then return here.",
            icon: Upload,
            color: "text-blue-600",
            bg: "bg-blue-100",
            badge: "from-blue-500 to-blue-600",
            action: { label: "Go to Uploads", path: "/uploads" }
        },
        {
            title: "Generate Cost Sheet",
            description: "Generate your cost sheet using the 'Generate Costsheet' button given below, download it from 'Downloads Page' or open it Using the 'Open Cost Sheet' button given below, fill in the costs.",
            icon: Download,
            color: "text-brand-600",
            bg: "bg-brand-100",
            badge: "from-brand-500 to-brand-600",
        },
        {
            title: "Upload Cost Sheet",
            description: "If you had downloaded the cost sheet, go to the Upload page again, select the same account, upload your filled cost sheet, and return here.",
            icon: FileSpreadsheet,
            color: "text-purple-600",
            bg: "bg-purple-100",
            badge: "from-purple-500 to-purple-600",
            action: { label: "Go to Uploads", path: "/uploads" }
        },
        {
            title: "Calculate & Verify",
            description: "Press 'Calculate' button given below, wait for processing to finish, and click 'Show Calculations' to get your Profit/Loss analysis report.",
            icon: Calculator,
            color: "text-emerald-600",
            bg: "bg-emerald-100",
            badge: "from-emerald-500 to-emerald-600",
        }
    ];

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
            <div className="mb-8">
                <h3 className="font-heading font-bold text-slate-800 text-lg mb-4">Calculation Workflow</h3>
                <div className="flex flex-col lg:flex-row rounded-2xl border border-slate-200/80 bg-white shadow-[0_2px_8px_-2px_rgba(0,0,0,0.05)] overflow-hidden">
                    {flowSteps.map((step, idx) => (
                        <div key={idx} className={`relative flex flex-col flex-1 p-6 hover:bg-slate-50/50 transition-colors ${idx !== flowSteps.length - 1 ? 'border-b lg:border-b-0 lg:border-r border-slate-100' : ''}`}>
                            <div className="flex items-center gap-3 mb-4">
                                <div className={`w-6 h-6 rounded-full flex flex-shrink-0 items-center justify-center bg-gradient-to-br ${step.badge} text-white font-bold text-xs shadow-sm`}>
                                    {idx + 1}
                                </div>
                                <h4 className="font-bold text-sm text-slate-800 tracking-tight">{step.title}</h4>
                            </div>
                            <p className="text-xs text-slate-500 leading-relaxed flex-1 mb-5">
                                {step.description}
                            </p>
                            {step.action && (
                                <Link
                                    to={step.action.path}
                                    className="text-xs font-semibold text-brand-600 hover:text-brand-800 flex items-center justify-center gap-1.5 transition-colors mt-auto w-max cursor-pointer bg-brand-50 px-3 py-1.5 rounded-lg border border-transparent hover:border-brand-200"
                                >
                                    {step.action.label} <ArrowRight size={14} />
                                </Link>
                            )}
                            
                            {/* Chevron connector for large screens instead of plain arrow */}
                            {idx < flowSteps.length - 1 && (
                                <div className="hidden lg:flex absolute top-1/2 -right-3.5 -translate-y-1/2 w-7 h-7 bg-white border border-slate-100 rounded-full items-center justify-center z-10 shadow-sm text-slate-300">
                                    <ArrowRight size={14} />
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-4">
                {/* Calculate Button Widget */}
                <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl shadow-card border border-green-200 p-6 flex flex-col justify-between">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm">
                                <Calculator className="text-green-600" size={24} />
                            </div>
                            <div>
                                <h3 className="font-heading font-bold text-slate-800">Calculations Management</h3>
                                <p className="text-sm text-slate-600">Trigger calculations to populate the table</p>
                            </div>
                        </div>
                        
                        {/* Status Message */}
                        <div className="mb-6 h-12 flex items-center">
                            {!canCalculate && calculationBlockReason ? (
                                <div className="flex items-center gap-2">
                                    {calculationBlockReason === 'processing_uploads' && (
                                        <>
                                            <Clock className="text-amber-600" size={16} />
                                            <span className="text-sm text-amber-700 font-medium">
                                                Processing {processingInfo.uploadCount} file{processingInfo.uploadCount !== 1 ? 's' : ''}...
                                            </span>
                                        </>
                                    )}
                                    {calculationBlockReason === 'calculating_credits' && (
                                        <>
                                            <Loader2 className="text-blue-600 animate-spin" size={16} />
                                            <span className="text-sm text-blue-700 font-medium">
                                                Calculating credits for {processingInfo.uploadCount} upload{processingInfo.uploadCount !== 1 ? 's' : ''}...
                                            </span>
                                        </>
                                    )}
                                    {calculationBlockReason === 'insufficient_balance' && (
                                        <>
                                            <XCircle className="text-red-600" size={16} />
                                            <span className="text-sm text-red-700 font-medium">
                                                Insufficient balance (₹{processingInfo.balance || 0})
                                            </span>
                                        </>
                                    )}
                                </div>
                            ) : canCalculate && processingInfo.balance !== null ? (
                                <div className="flex items-center gap-2">
                                    <CheckCircle className="text-green-600" size={16} />
                                    <span className="text-sm text-green-700 font-medium">
                                        Ready (Balance: ₹{processingInfo.balance})
                                    </span>
                                </div>
                            ) : null}
                            {error && (
                                <div className="ml-2 text-sm text-red-600">
                                    {error}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Button row */}
                    <div className="flex items-center gap-3">
                        <div className="relative group flex-1 flex">
                            {isElevatedUser && filterData?.requiresRecalculation ? (
                                <button
                                    onClick={() => handleCalculate('full')}
                                    disabled={filterData?.hasInactiveAccountSelected || !canCalculate || calculating || calculationStatus === 'processing' || calculationStatus === 'pending'}
                                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                                >
                                    {(calculating || calculationStatus === 'processing' || calculationStatus === 'pending') ? (
                                        <>
                                            <Loader2 className="animate-spin" size={18} />
                                            <span>Recalculating...</span>
                                        </>
                                    ) : (
                                        <>
                                            <AlertTriangle size={18} />
                                            <span>Recalculate</span>
                                        </>
                                    )}
                                </button>
                            ) : (
                                <button
                                    onClick={() => handleCalculate('incremental')}
                                    disabled={filterData.hasInactiveAccountSelected || !canCalculate || calculating || calculationStatus === 'processing' || calculationStatus === 'pending'}
                                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                                >
                                    {(calculating || calculationStatus === 'processing' || calculationStatus === 'pending') ? (
                                        <>
                                            <Loader2 className="animate-spin" size={18} />
                                            <span>Calculating...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Play size={18} />
                                            <span>Calculate</span>
                                        </>
                                    )}
                                </button>
                            )}
                            {filterData.hasInactiveAccountSelected && (
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-slate-800 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                                    Cannot perform operations on deactivated accounts
                                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
                                </div>
                            )}
                        </div>

                        {(() => {
                            const selectedMarketplaceIds = Array.isArray(filterData.marketplaceIds)
                                ? filterData.marketplaceIds
                                : (filterData.marketplaceIds ? [filterData.marketplaceIds] : []);
                            const names = Array.isArray(filterData.marketplaceNames) ? filterData.marketplaceNames : [];
                            const hasMarketplaceSelected = selectedMarketplaceIds.length > 0;

                            const params = new URLSearchParams();
                            params.set('marketplaceIds', JSON.stringify(selectedMarketplaceIds));
                            params.set('marketplaceNames', JSON.stringify(names));
                            if (filterData.startDate) params.set('startDate', filterData.startDate);
                            if (filterData.endDate) params.set('endDate', filterData.endDate);

                            return (
                                <div className="relative group flex-1">
                                    <button
                                        onClick={() => window.open(`/client/payments/calculations?${params.toString()}`, '_blank', 'noopener,noreferrer')}
                                        disabled={!hasMarketplaceSelected}
                                        className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all shadow-sm hover:shadow-md font-medium disabled:opacity-50 disabled:cursor-not-allowed`}
                                    >
                                        <FileSpreadsheet size={18} />
                                        <span>Show Calculations</span>
                                    </button>
                                    {!hasMarketplaceSelected && (
                                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-slate-800 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                                            Select a marketplace first
                                            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
                                        </div>
                                    )}
                                </div>
                            );
                        })()}
                    </div>

                    {/* Progress bar — sits below both buttons, only shown while calculating */}
                    {calculating && (
                        <div className="mt-3">
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-medium text-slate-500">
                                    {calculationStatus === 'pending' ? 'Queued…' : 'Processing…'}
                                </span>
                                <span className="text-xs font-semibold text-green-700">{progress}%</span>
                            </div>
                            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                {calculationStatus === 'pending' ? (
                                    <div
                                        style={{
                                            width: '40%',
                                            height: '100%',
                                            background: 'linear-gradient(90deg, #16a34a, #22c55e)',
                                            borderRadius: '9999px',
                                            animation: 'shimmer-progress 1.4s ease-in-out infinite',
                                        }}
                                    />
                                ) : (
                                    <div
                                        style={{
                                            width: `${Math.max(progress, 2)}%`,
                                            height: '100%',
                                            background: 'linear-gradient(90deg, #16a34a, #22c55e)',
                                            borderRadius: '9999px',
                                            transition: 'width 0.7s ease-out',
                                        }}
                                    />
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Cost Sheet Widget */}
                <div className="bg-gradient-to-br from-brand-50 to-blue-50 rounded-2xl shadow-card border border-brand-200 p-6 flex flex-col justify-between">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm">
                                <FileSpreadsheet className="text-brand-600" size={24} />
                            </div>
                            <div>
                                <h3 className="font-heading font-bold text-slate-800">Cost Sheet Management</h3>
                                <p className="text-sm text-slate-600">
                                    Generate, download, or manage your cost sheet
                                </p>
                            </div>
                        </div>
                        <div className="mb-6 h-12 flex items-center text-sm">
                            {filterData.marketplaceIds && Array.isArray(filterData.marketplaceIds) && filterData.marketplaceIds.length > 1 ? (
                                <span className="text-amber-600 font-medium">
                                    Please select only ONE marketplace account to generate a cost sheet.
                                </span>
                            ) : (
                                <span className="text-slate-500">
                                    Cost sheets are generated per marketplace account.
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {(() => {
                            const hasExactlyOne = filterData.marketplaceIds && Array.isArray(filterData.marketplaceIds) && filterData.marketplaceIds.length === 1;
                            
                            return (
                                <div className="relative group flex-1 flex">
                                    <ExportButton
                                        exportType="cost_sheet"
                                        marketplaceId={hasExactlyOne ? filterData.marketplaceIds[0] : null}
                                        startDate={null}
                                        endDate={null}
                                        buttonText="Generate Cost Sheet"
                                        disabled={filterData.hasInactiveAccountSelected || !hasExactlyOne}
                                        buttonClassName="flex-1 !px-4 !py-2.5 justify-center"
                                    />
                                    {filterData.hasInactiveAccountSelected ? (
                                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-slate-800 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                                            Cannot perform operations on deactivated accounts
                                            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
                                        </div>
                                    ) : !hasExactlyOne ? (
                                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-slate-800 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 w-64 text-center text-wrap">
                                            Cost sheet requires exactly ONE marketplace.
                                            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
                                        </div>
                                    ) : null}
                                </div>
                            );
                        })()}

                        <div className="relative group flex-1 flex">
                            <button
                                onClick={handleOpenCostSheet}
                                disabled={filterData.hasInactiveAccountSelected}
                                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-all shadow-sm hover:shadow-md font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <ExternalLink size={18} />
                                <span>Open Cost Sheet</span>
                            </button>
                            {filterData.hasInactiveAccountSelected && (
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-slate-800 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                                    Cannot perform operations on deactivated accounts
                                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Missing Cost Sheet Warning Modal */}
            {notGeneratedModal && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="bg-red-50 p-6 border-b border-red-100 flex items-start gap-4">
                            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                                <AlertTriangle className="text-red-600" size={24} />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-red-900">Cost Sheet Not Generated</h3>
                                <p className="text-sm text-red-700 mt-1">Action required before calculating</p>
                            </div>
                        </div>
                        <div className="p-6">
                            <p className="text-sm text-slate-600 leading-relaxed">
                                The cost sheet has not been generated for the selected marketplace(s). Please generate the cost sheet first before running calculations.
                            </p>
                        </div>
                        <div className="flex items-center justify-end gap-3 px-6 pb-6">
                            <button
                                onClick={() => setNotGeneratedModal(false)}
                                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-all"
                            >
                                Close
                            </button>
                            {(() => {
                                const hasExactlyOne = filterData.marketplaceIds && Array.isArray(filterData.marketplaceIds) && filterData.marketplaceIds.length === 1;
                                return (
                                    <div className="relative group">
                                        <ExportButton
                                            exportType="cost_sheet"
                                            marketplaceId={hasExactlyOne ? filterData.marketplaceIds[0] : null}
                                            startDate={null}
                                            endDate={null}
                                            buttonText="Generate Cost Sheet"
                                            disabled={!hasExactlyOne}
                                            buttonClassName="!px-4 !py-2 text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-all"
                                            onExportStart={() => setNotGeneratedModal(false)}
                                        />
                                        {!hasExactlyOne && (
                                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-slate-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 w-48 text-center text-wrap shadow-xl">
                                                Please select ONE marketplace to generate.
                                                <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
                                            </div>
                                        )}
                                    </div>
                                );
                            })()}
                        </div>
                    </div>
                </div>
            )}

            {/* Missing Product Costs Warning Modal */}
            {missingCostModal.open && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                        {/* Header */}
                        <div className="bg-amber-50 p-6 border-b border-amber-100 flex items-start gap-4">
                            <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                                <AlertTriangle className="text-amber-600" size={24} />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-amber-900">Missing Product Costs</h3>
                                <p className="text-sm text-amber-700 mt-1">Action required before calculating</p>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="p-6">
                            <p className="text-sm text-slate-600 leading-relaxed">
                                You have <span className="font-bold text-amber-700">{missingCostModal.count} SKU{missingCostModal.count !== 1 ? 's' : ''}</span> in the selected marketplace {missingCostModal.count !== 1 ? 'have' : 'has'} no product cost filled in the cost sheet.
                                Calculations will run with <span className="font-semibold">₹0 product cost</span> for these SKUs, which may affect profit/loss accuracy.
                            </p>

                            {missingCostModal.skus.length > 0 && (
                                <div className="mt-4 p-3 bg-amber-50 rounded-xl border border-amber-100">
                                    <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-2">SKU Preview</p>
                                    <ul className="space-y-1">
                                        {missingCostModal.skus.map((sku, i) => (
                                            <li key={i} className="text-xs font-mono text-slate-700 truncate">{sku}</li>
                                        ))}
                                    </ul>
                                    {missingCostModal.count > missingCostModal.skus.length && (
                                        <p className="text-xs text-amber-600 mt-2">…and {missingCostModal.count - missingCostModal.skus.length} more</p>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="flex items-center justify-end gap-3 px-6 pb-6">
                            <button
                                onClick={() => setMissingCostModal({ open: false, count: 0, skus: [] })}
                                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleOpenCostSheet}
                                className="px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-all"
                            >
                                Go to Cost Sheet
                            </button>
                            <button
                                onClick={() => doCalculate(undefined, isElevatedUser && filterData?.requiresRecalculation ? 'full' : 'incremental')}
                                className="px-4 py-2 text-sm font-semibold text-white bg-amber-500 hover:bg-amber-600 rounded-lg transition-all shadow-sm"
                            >
                                Continue Anyway
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CalculationsTab;
