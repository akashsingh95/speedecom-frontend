import React, { useState, useEffect, Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import api from '../../api';
import { CreditCard, History, TrendingUp, AlertCircle, ArrowUpRight, ArrowDownLeft, Receipt, Loader2, Plus, ChevronDown, ChevronRight, Calendar, Package, Award, ExternalLink, Info, LayoutGrid, List, X } from 'lucide-react';

const base = import.meta.env.BASE_URL;

const CreditsTab = ({ tenantId, viewMode = 'grid' }) => {
    const [loading, setLoading] = useState(true);
    const [balance, setBalance] = useState(0);
    const [billedBalance, setBilledBalance] = useState(0);
    const [monthlyData, setMonthlyData] = useState([]);
    const [summary, setSummary] = useState({});
    const [history, setHistory] = useState([]);
    const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0 });
    const [expandedMonths, setExpandedMonths] = useState(new Set());
    const [expandedTransactions, setExpandedTransactions] = useState(new Set());
    const [showAllMonths, setShowAllMonths] = useState(false);
    const [showAllHistory, setShowAllHistory] = useState(false);
    const [uploadDistributions, setUploadDistributions] = useState({});
    const [loadingDistributions, setLoadingDistributions] = useState(new Set());
    const [uploadMonthGroups, setUploadMonthGroups] = useState([]);
    const [expandedUploadMonths, setExpandedUploadMonths] = useState(new Set());
    const [isPlansModalOpen, setIsPlansModalOpen] = useState(false);

    useEffect(() => {
        fetchAllData();
    }, [pagination.page, tenantId, showAllMonths, showAllHistory]);

    const fetchAllData = async () => {
        setLoading(true);
        try {
            const query = tenantId ? `?tenantId=${tenantId}` : '';
            const breakdownQuery = tenantId ? `?tenantId=${tenantId}&months=` : '?months=';
            const historyQuery = tenantId ? `&tenantId=${tenantId}` : '';
            const monthsToFetch = showAllMonths ? 12 : 5; // Fetch 5 or 12 months
           
            const historyLimit = showAllHistory ? 50 : 5;
            const [balanceRes, breakdownRes, historyRes, groupsRes] = await Promise.all([
                api.get(`/credits/balance${query}`),
                api.get(`/credits/monthly-breakdown${breakdownQuery}${monthsToFetch}`),
                api.get(`/credits/history?page=${pagination.page}&limit=${historyLimit}${historyQuery}`),
                api.get(`/credits/upload-month-groups${query}`)
            ]);

            setBalance(balanceRes.data.balance || 0);
            setBilledBalance(balanceRes.data.billedBalance || 0);
            setMonthlyData(breakdownRes.data.months || []);
            setSummary(breakdownRes.data.summary || {});
            setHistory(historyRes.data.transactions || []);
            setPagination(prev => ({ ...prev, total: historyRes.data.total || 0 }));
            setUploadMonthGroups(groupsRes.data.groups || []);

            // Auto-expand the most recent month
            if (breakdownRes.data.months && breakdownRes.data.months.length > 0) {
                setExpandedMonths(new Set([breakdownRes.data.months[0].month]));
            }

        } catch (error) {
            console.error('Error fetching credit data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleShowAllMonths = () => {
        setShowAllMonths(true);
    };

    const handleShowAllHistory = () => {
        setShowAllHistory(true);
        setPagination(prev => ({ ...prev, page: 1 }));
    };

    const handleFetchDistribution = async (marketplaceId, month) => {
        const key = `${marketplaceId}-${month}`;
        if (uploadDistributions[key]) {
            setUploadDistributions(prev => ({
                ...prev,
                [key]: { ...prev[key], show: !prev[key].show }
            }));
            return;
        }

        setLoadingDistributions(prev => new Set([...prev, key]));
        try {
            const query = tenantId ? `&tenantId=${tenantId}` : '';
            const res = await api.get(`/credits/upload-distribution?marketplaceId=${marketplaceId}&month=${month}${query}`);
            setUploadDistributions(prev => ({
                ...prev,
                [key]: { data: res.data.distribution, show: true }
            }));
        } catch (error) {
            console.error('Error fetching distribution:', error);
        } finally {
            setLoadingDistributions(prev => {
                const next = new Set(prev);
                next.delete(key);
                return next;
            });
        }
    };

    const toggleMonth = (month) => {
        setExpandedMonths(prev => {
            const newSet = new Set(prev);
            if (newSet.has(month)) {
                newSet.delete(month);
            } else {
                newSet.add(month);
            }
            return newSet;
        });
    };

    const toggleTransaction = (txId) => {
        setExpandedTransactions(prev => {
            const newSet = new Set(prev);
            if (newSet.has(txId)) {
                newSet.delete(txId);
            } else {
                newSet.add(txId);
            }
            return newSet;
        });
    };

    const getMonthName = (monthStr) => {
        const [year, month] = monthStr.split('-');
        const date = new Date(year, parseInt(month) - 1);
        return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    };

    const getTierBadge = (tier) => {
        const configs = {
            'Tier 1': { bg: 'bg-slate-100', text: 'text-slate-700', label: 'Tier 1', tooltip: '≤ 1,000 orders' },
            'Tier 2': { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Tier 2', tooltip: '≤ 2,000 orders' },
            'Tier 3': { bg: 'bg-cyan-100', text: 'text-cyan-700', label: 'Tier 3', tooltip: '≤ 3,000 orders' },
            'Tier 4': { bg: 'bg-green-100', text: 'text-green-700', label: 'Tier 4', tooltip: '≤ 5,000 orders' },
            'Tier 5': { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Tier 5', tooltip: '≤ 7,000 orders' },
            'Tier 6': { bg: 'bg-orange-100', text: 'text-orange-700', label: 'Tier 6', tooltip: '≤ 8,500 orders' },
            'Tier 7': { bg: 'bg-purple-100', text: 'text-purple-700', label: 'Tier 7', tooltip: '≤ 10,000 orders' },
            'Pay-per-order': { bg: 'bg-pink-100', text: 'text-pink-700', label: 'Pay-per-order', tooltip: '> 10,000 orders' }
        };
        const config = configs[tier] || configs['Tier 1'];
        return (
            <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${config.bg} ${config.text}`}
                title={config.tooltip}
            >
                <Award size={12} />
                {config.label}
            </span>
        );
    };

    // Returns a signed amount: negative means deduction, positive means credit.
    // Handles both new records (amount already negative) and old records
    // where amount was stored as Math.abs but metadata.note contains 'deducted'.
    const resolveAmount = (tx) => {
        if (tx.amount < 0) return tx.amount; // new signed records
        if (tx.type === 'INVOICE_CANCELLATION' || tx.type === 'INVOICE_DELETION' || tx.type === 'INVOICE_REFUND') return -Math.abs(tx.amount);
        if (tx.type === 'INVOICE_ADJUSTMENT') {
            const isDeduction =
                tx.metadata?.direction === 'deduction' ||
                tx.metadata?.note?.includes('deducted');
            if (isDeduction) return -Math.abs(tx.amount);
        }
        return tx.amount;
    };

    const getTransactionIcon = (type, resolvedAmt) => {
        // REVERSAL_CHARGE deliberately excluded: it can be either sign (a refund or an extra
        // charge), so it falls through to the resolvedAmt-based check below instead.
        const creditTypes = ['CREDIT_PURCHASE', 'ADMIN_GIFT', 'TIER_ADJUSTMENT_REFUND', 'REFUND', 'FREE_TRIAL_CREDIT', 'INVOICE_CREDIT'];
        const deductionTypes = ['USAGE_CHARGE', 'TIER_ADJUSTMENT_CHARGE', 'ADMIN_DEDUCTION', 'INVOICE_CANCELLATION', 'INVOICE_DELETION', 'INVOICE_REFUND'];
        if (creditTypes.includes(type)) {
            return <ArrowDownLeft className="text-emerald-600" size={18} />;
        }
        if (deductionTypes.includes(type)) {
            return <ArrowUpRight className="text-red-600" size={18} />;
        }
        return resolvedAmt >= 0
            ? <ArrowDownLeft className="text-emerald-600" size={18} />
            : <ArrowUpRight className="text-red-600" size={18} />;
    };

    const formatTransactionType = (type, metadata) => {
        const typeLabels = {
            ADMIN_GIFT: 'Admin Gift',
            ADMIN_DEDUCTION: 'Admin Credit Deduction',
            FREE_TRIAL_CREDIT: 'Free Trial Credit',
            INVOICE_CREDIT: 'Invoice Payment',
            INVOICE_ADJUSTMENT: 'Invoice Adjustment',
            INVOICE_CANCELLATION: 'Invoice Cancellation',
            INVOICE_DELETION: 'Invoice Deletion',
            INVOICE_REFUND: 'Invoice Refunded',
            TIER_ADJUSTMENT_CHARGE: 'Tier Adjustment Charge',
            REVERSAL_CHARGE: metadata?.originalType === 'USAGE_CHARGE' ? 'Usage Charge Reversal' : 'Tier Refund Reversal'
        };
        if (typeLabels[type]) return typeLabels[type];
        return type.replace(/_/g, ' ').toLowerCase();
    };

    if (loading && pagination.page === 1) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px]">
                <Loader2 className="animate-spin text-brand-600 mb-4" size={40} />
                <p className="text-slate-500">Loading your credit details...</p>
            </div>
        );
    }

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-8">

            {/* Top Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Balance Card */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-brand-50 rounded-lg text-brand-600">
                            <CreditCard size={24} />
                        </div>
                        <h3 className="font-semibold text-slate-700">Available Credits</h3>
                    </div>
                    <p className="text-4xl font-heading font-bold text-slate-900">{billedBalance.toLocaleString()}</p>
                </div>

                {/* Total Billed Months */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
                            <Calendar size={24} />
                        </div>
                        <h3 className="font-semibold text-slate-700">Months Reconciled</h3>
                    </div>
                    <p className="text-4xl font-heading font-bold text-slate-900">{summary.totalMonths || 0}</p>
                </div>
            </div>

            {/* Low Balance Warning */}
            {
                balance < 1000 && (
                    <div className="bg-amber-50 rounded-2xl border border-amber-100 p-6">
                        <div className="flex items-start gap-4">
                            <AlertCircle className="text-amber-600 shrink-0" size={24} />
                            <div className="flex-1">
                                <h3 className="font-bold text-amber-800 text-lg mb-1">Low Balance Warning</h3>
                                <p className="text-sm text-amber-700 mb-4">
                                    Your credit balance is running low. Please top up to avoid service interruption.
                                </p>
                                <a
                                    href="/client/subscription"
                                    className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 transition-colors"
                                >
                                    <Plus size={16} />
                                    Add Funds
                                </a>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Pricing Tier Information */}
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border border-blue-100 p-6">
                <div className="flex items-start gap-4">
                    <Info className="text-blue-600 shrink-0 mt-1" size={24} />
                    <div className="flex-1">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="font-bold text-blue-900 text-lg">Understanding Pricing Tiers</h3>
                            <button
                                type="button"
                                onClick={() => setIsPlansModalOpen(true)}
                                className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors"
                                title="View detailed pricing plan"
                                aria-label="View detailed pricing plan"
                            >
                                <Info size={16} />
                            </button>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                            <div className="bg-white/60 rounded-lg p-3 border border-blue-100">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 mb-2">
                                    <Award size={12} />
                                    Tier 1
                                </span>
                                <p className="text-xs text-slate-700 font-medium">≤ 1,000 orders</p>
                            </div>
                            <div className="bg-white/60 rounded-lg p-3 border border-blue-100">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 mb-2">
                                    <Award size={12} />
                                    Tier 2
                                </span>
                                <p className="text-xs text-slate-700 font-medium">≤ 2,000 orders</p>
                            </div>
                            <div className="bg-white/60 rounded-lg p-3 border border-blue-100">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-cyan-100 text-cyan-700 mb-2">
                                    <Award size={12} />
                                    Tier 3
                                </span>
                                <p className="text-xs text-slate-700 font-medium">≤ 3,000 orders</p>
                            </div>
                            <div className="bg-white/60 rounded-lg p-3 border border-blue-100">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700 mb-2">
                                    <Award size={12} />
                                    Tier 4
                                </span>
                                <p className="text-xs text-slate-700 font-medium">≤ 5,000 orders</p>
                            </div>
                            <div className="bg-white/60 rounded-lg p-3 border border-blue-100">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-700 mb-2">
                                    <Award size={12} />
                                    Tier 5
                                </span>
                                <p className="text-xs text-slate-700 font-medium">≤ 7,000 orders</p>
                            </div>
                            <div className="bg-white/60 rounded-lg p-3 border border-blue-100">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-700 mb-2">
                                    <Award size={12} />
                                    Tier 6
                                </span>
                                <p className="text-xs text-slate-700 font-medium">≤ 8,500 orders</p>
                            </div>
                            <div className="bg-white/60 rounded-lg p-3 border border-blue-100">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-700 mb-2">
                                    <Award size={12} />
                                    Tier 7
                                </span>
                                <p className="text-xs text-slate-700 font-medium">≤ 10,000 orders</p>
                            </div>
                            <div className="bg-white/60 rounded-lg p-3 border border-blue-100">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-pink-100 text-pink-700 mb-2">
                                    <Award size={12} />
                                    Pay-per-order
                                </span>
                                <p className="text-xs text-slate-700 font-medium">&gt; 10,000 orders</p>
                            </div>
                        </div>
                        <p className="text-xs text-blue-700">
                            <strong>Note:</strong> Pricing tiers are calculated per account per billing month based on total order volume. Higher volumes may result in better per-order rates.
                        </p>
                    </div>
                </div>
            </div>

            <Transition appear show={isPlansModalOpen} as={Fragment}>
                <Dialog as="div" className="relative z-[100]" onClose={setIsPlansModalOpen}>
                    <Transition.Child
                        as={Fragment}
                        enter="ease-out duration-200"
                        enterFrom="opacity-0"
                        enterTo="opacity-100"
                        leave="ease-in duration-150"
                        leaveFrom="opacity-100"
                        leaveTo="opacity-0"
                    >
                        <div className="fixed inset-0 bg-black/60" />
                    </Transition.Child>

                    <div className="fixed inset-0 p-4 flex items-center justify-center">
                        <Transition.Child
                            as={Fragment}
                            enter="ease-out duration-200"
                            enterFrom="opacity-0 scale-95"
                            enterTo="opacity-100 scale-100"
                            leave="ease-in duration-150"
                            leaveFrom="opacity-100 scale-100"
                            leaveTo="opacity-0 scale-95"
                        >
                            <Dialog.Panel className="relative w-full max-w-4xl focus:outline-none">
                                <button
                                    type="button"
                                    onClick={() => setIsPlansModalOpen(false)}
                                    className="absolute top-3 right-3 z-10 p-1.5 rounded-full bg-black/25 text-white hover:bg-black/40 transition-colors"
                                    aria-label="Close pricing plan image"
                                >
                                    <X size={18} />
                                </button>
                                <img
                                    src={`${base}assets/plans.jpeg`}
                                    alt="Detailed pricing tiers plan"
                                    className="w-full max-h-[85vh] object-contain"
                                />
                            </Dialog.Panel>
                        </Transition.Child>
                    </div>
                </Dialog>
            </Transition>

            {/* Content Grid */}
            {
                viewMode === 'grid' ? (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                        {/* Monthly Billing Breakdown - Left 50% */}
                        <div className="lg:col-span-1 space-y-6">
                            <div className="bg-white rounded-2xl shadow-card border border-slate-100 overflow-hidden">
                                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                                    <h3 className="font-heading font-bold text-lg text-slate-800">Reconciliation Month Wise Invested</h3>
                                    <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-1 rounded">
                                        Last {monthlyData.length} Months
                                    </span>
                                </div>

                                {monthlyData.length === 0 ? (
                                    <div className="p-12 text-center">
                                        <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                            <Calendar className="text-slate-400" size={32} />
                                        </div>
                                        <h3 className="text-lg font-bold text-slate-800 mb-2">No Billing History</h3>
                                        <p className="text-slate-500 text-sm">Upload payment files to see your billing breakdown.</p>
                                    </div>
                                ) : (
                                    <>
                                        <div className="flex flex-col">
                                            {monthlyData.map((monthData, idx) => (
                                                <div key={monthData.month} className={`border-l-4 transition-all ${expandedMonths.has(monthData.month) ? 'border-l-brand-500 bg-slate-50/50' : 'border-l-transparent hover:border-l-brand-500 hover:bg-slate-50/50'} ${idx !== monthlyData.length - 1 ? 'border-b border-slate-100' : ''}`}>
                                                    {/* Month Header */}
                                                    <button
                                                        onClick={() => toggleMonth(monthData.month)}
                                                        className="w-full px-6 py-4 flex items-center justify-between text-left group"
                                                    >
                                                        <div className="flex items-center gap-4 flex-1">
                                                            <div className="p-2 bg-brand-50 rounded-lg text-brand-600 group-hover:bg-brand-100 transition-colors">
                                                                {expandedMonths.has(monthData.month) ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                                                            </div>
                                                            <div className="flex-1">
                                                                <h4 className="font-bold text-slate-800 text-lg">{getMonthName(monthData.month)}</h4>
                                                                <p className="text-sm text-slate-500">
                                                                    {monthData.totalOrders.toLocaleString()} orders • {monthData.totalCharged.toLocaleString()} credits charged
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <div className="text-right">
                                                            <p className="text-2xl font-bold text-slate-900">{monthData.totalCharged.toLocaleString()}</p>
                                                            <p className="text-xs text-slate-500">Credits</p>
                                                        </div>
                                                    </button>

                                                    {/* Expanded Account Details */}
                                                    {expandedMonths.has(monthData.month) && (
                                                        <div className="px-6 pb-6 space-y-4 bg-slate-50/30">
                                                            {monthData.accounts.map((account, idx) => (
                                                                <div key={idx} className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-sm transition-shadow">
                                                                    <div className="flex items-start justify-between mb-3">
                                                                        <div className="flex-1">
                                                                            <div className="flex items-center gap-2 mb-1">
                                                                                <h5 className="font-bold text-slate-800">{account.accountName}</h5>
                                                                                {getTierBadge(account.tier)}
                                                                            </div>
                                                                            <p className="text-sm text-slate-500">{account.marketplaceType}</p>
                                                                        </div>
                                                                        <div className="text-right">
                                                                            <p className="text-xl font-bold text-slate-900">{account.totalCharged.toLocaleString()}</p>
                                                                            <p className="text-xs text-slate-500">Credits</p>
                                                                        </div>
                                                                    </div>
                                                                    <div className="grid grid-cols-2 gap-4 pt-3 border-t border-slate-100">
                                                                        <div>
                                                                            <p className="text-xs text-slate-500 mb-1">Orders Processed</p>
                                                                            <p className="text-lg font-bold text-slate-700">{account.totalOrders.toLocaleString()}</p>
                                                                        </div>
                                                                        <div>
                                                                            <p className="text-xs text-slate-500 mb-1">Billing Tier</p>
                                                                            <p className="text-lg font-bold text-slate-700 capitalize">{account.tier}</p>
                                                                        </div>
                                                                    </div>
                                                                    {/* Upload Distribution Toggle */}
                                                                    <div className="pt-3 border-t border-slate-100 mt-3">
                                                                        <button
                                                                            onClick={() => handleFetchDistribution(account.marketplaceId, monthData.month)}
                                                                            disabled={loadingDistributions.has(`${account.marketplaceId}-${monthData.month}`)}
                                                                            className="w-full flex items-center justify-center gap-2 px-3 py-1.5 text-xs font-semibold text-brand-600 hover:bg-brand-50 rounded-lg transition-colors"
                                                                        >
                                                                            {loadingDistributions.has(`${account.marketplaceId}-${monthData.month}`) ? (
                                                                                <Loader2 className="animate-spin" size={14} />
                                                                            ) : (
                                                                                uploadDistributions[`${account.marketplaceId}-${monthData.month}`]?.show ? <ChevronDown size={14} /> : <ChevronRight size={14} />
                                                                            )}
                                                                            View Upload Distribution
                                                                        </button>

                                                                        {uploadDistributions[`${account.marketplaceId}-${monthData.month}`]?.show && (
                                                                            <div className="mt-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                                                                                {uploadDistributions[`${account.marketplaceId}-${monthData.month}`].data.length === 0 ? (
                                                                                    <p className="text-xs text-slate-500 text-center py-2">No upload data found for this month.</p>
                                                                                ) : (
                                                                                    <div className="space-y-2">
                                                                                        <div className="grid grid-cols-12 gap-2 text-xs font-semibold text-slate-500 mb-2 px-2">
                                                                                            <div className="col-span-4">Upload Date</div>
                                                                                            <div className="col-span-5">File Name</div>
                                                                                            <div className="col-span-3 text-right">Unique Orders</div>
                                                                                        </div>
                                                                                        <div className="divide-y divide-slate-200 max-h-48 overflow-y-auto pr-1">
                                                                                            {uploadDistributions[`${account.marketplaceId}-${monthData.month}`].data.map((dist, i) => (
                                                                                                <div key={i} className="grid grid-cols-12 gap-2 text-xs text-slate-700 py-1.5 px-2 hover:bg-white transition-colors rounded">
                                                                                                    <div className="col-span-4 truncate">
                                                                                                        {new Date(dist.uploadDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                                                                                    </div>
                                                                                                    <div className="col-span-5 truncate" title={dist.fileName}>{dist.fileName}</div>
                                                                                                    <div className="col-span-3 text-right font-medium">{dist.newUniqueOrders.toLocaleString()}</div>
                                                                                                </div>
                                                                                            ))}
                                                                                        </div>
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                        {/* See All Button */}
                                        {!showAllMonths && monthlyData.length >= 5 && (
                                            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/30">
                                                <button
                                                    onClick={handleShowAllMonths}
                                                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-brand-600 hover:text-brand-700 font-medium text-sm hover:bg-brand-50 rounded-lg transition-all"
                                                >
                                                    <ExternalLink size={16} />
                                                    <span>See All Months</span>
                                                </button>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Transaction History - Right 50% */}
                        <div className="lg:col-span-1">
                            <div className="bg-white rounded-2xl shadow-card border border-slate-100 overflow-hidden sticky top-6">
                                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                                    <div>
                                        <h3 className="font-heading font-bold text-lg text-slate-800">Recent History</h3>
                                        <p className="text-xs text-slate-500 mt-0.5">
                                            {history.length > 0 && (
                                                pagination.total > history.length
                                                    ? `Showing ${history.length} of ${pagination.total} transactions`
                                                    : `${pagination.total} transaction${pagination.total !== 1 ? 's' : ''}`
                                            )}
                                        </p>
                                    </div>
                                    <Receipt size={18} className="text-slate-400" />
                                </div>

                                <div className="flex flex-col max-h-[600px] overflow-y-auto">
                                    {history.length === 0 ? (
                                        <div className="p-8 text-center text-slate-500">No transactions found.</div>
                                    ) : (
                                        <>
                                            {history.map((tx, idx) => {
                                                const resolvedAmt = resolveAmount(tx);
                                                return (
                                                <div key={tx._id} className={`border-l-4 transition-all ${expandedTransactions.has(tx._id) ? 'border-l-brand-500 bg-slate-50/50' : 'border-l-transparent hover:border-l-brand-500 hover:bg-slate-50/50'} ${idx !== history.length - 1 ? 'border-b border-slate-100' : ''}`}>
                                                    {/* Transaction Header - Clickable */}
                                                    <button
                                                        onClick={() => toggleTransaction(tx._id)}
                                                        className="w-full px-5 py-4 flex items-center gap-4 text-left group"
                                                    >
                                                        <div className="p-2 bg-brand-50 rounded-lg text-brand-600 group-hover:bg-brand-100 transition-colors flex-shrink-0">
                                                            {expandedTransactions.has(tx._id) ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                                        </div>
                                                        <div className={`p-2 rounded-full flex-shrink-0 ${resolvedAmt >= 0 ? 'bg-emerald-50' : 'bg-red-50'}`}>
                                                            {getTransactionIcon(tx.type, resolvedAmt)}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-bold text-slate-800 capitalize mb-0.5">
                                                                {formatTransactionType(tx.type, tx.metadata)}
                                                            </p>
                                                            <p className="text-xs text-slate-500">
                                                                {new Date(tx.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                                                {' · '}
                                                                {new Date(tx.createdAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                                                            </p>
                                                        </div>
                                                        <div className="text-right flex-shrink-0">
                                                            <p className={`text-lg font-bold ${resolvedAmt >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                                                {resolvedAmt >= 0 ? '+' : ''}{resolvedAmt}
                                                            </p>
                                                            <p className="text-[10px] text-slate-400">credits</p>
                                                        </div>
                                                    </button>

                                                    {/* Expanded Details */}
                                                    {expandedTransactions.has(tx._id) && (
                                                        <div className="px-5 pb-4 space-y-2 bg-slate-50/30">
                                                            {tx.uploadDate && (
                                                                <div className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg">
                                                                    <Calendar size={14} className="text-slate-400 flex-shrink-0" />
                                                                    <span className="text-xs text-slate-500">Upload Date:</span>
                                                                    <span className="text-xs text-slate-700 font-semibold">
                                                                        {new Date(tx.uploadDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                                                    </span>
                                                                </div>
                                                            )}
                                                            {tx.metadata?.newUniqueOrdersInFile !== undefined && (
                                                                <div className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg">
                                                                    <Package size={14} className="text-slate-400 flex-shrink-0" />
                                                                    <span className="text-xs text-slate-500">Unique Orders found in file:</span>
                                                                    <span className="text-xs text-slate-700 font-semibold truncate">
                                                                        {tx.metadata.newUniqueOrdersInFile}
                                                                    </span>
                                                                </div>
                                                            )}
                                                            {tx.billingMonth && (
                                                                <div className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg">
                                                                    <Calendar size={14} className="text-slate-400 flex-shrink-0" />
                                                                    <span className="text-xs text-slate-500">Billing Month:</span>
                                                                    <span className="text-xs text-slate-700 font-semibold">
                                                                        {getMonthName(tx.billingMonth)}
                                                                    </span>
                                                                </div>
                                                            )}
                                                            {tx.accountName && (
                                                                <div className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg">
                                                                    <Package size={14} className="text-slate-400 flex-shrink-0" />
                                                                    <span className="text-xs text-slate-500">Account:</span>
                                                                    <span className="text-xs text-slate-700 font-semibold truncate" title={tx.marketplaceType}>
                                                                        {tx.accountName}
                                                                    </span>
                                                                </div>
                                                            )}
                                                            {(tx.metadata?.note || tx.description) && (
                                                                <div className="flex items-start gap-2 px-3 py-2 bg-white rounded-lg">
                                                                    <Info size={14} className="text-slate-400 flex-shrink-0 mt-0.5" />
                                                                    <div className="flex-1">
                                                                        <span className="text-xs text-slate-500">Note:</span>
                                                                        <p className="text-xs text-slate-700 mt-0.5">
                                                                            {tx.metadata?.note || tx.description}
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                                );
                                            })}
                                        </>
                                    )}
                                </div>

                                {/* See All Button for History */}
                                {!showAllHistory && history.length >= 5 && pagination.total > 5 && (
                                    <div className="px-4 py-3 border-t border-slate-100 bg-slate-50/30">
                                        <button
                                            onClick={handleShowAllHistory}
                                            className="w-full flex items-center justify-center gap-2 px-4 py-2 text-brand-600 hover:text-brand-700 font-medium text-sm hover:bg-brand-50 rounded-lg transition-all"
                                        >
                                            <ExternalLink size={14} />
                                            <span>See All Transactions</span>
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-6">
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 px-6 py-4">
                            <h3 className="font-heading font-bold text-lg text-slate-800">Billing Month Wise Invested</h3>
                        </div>
                        <div className="grid grid-cols-1 gap-6">
                            {uploadMonthGroups.map(group => (
                                <div key={group.uploadMonth} className="bg-white rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-all">
                                    {/* Card Header */}
                                    <div className="p-5 border-b border-slate-50 bg-slate-50/30 flex justify-between items-center cursor-pointer rounded-t-2xl" onClick={() => {
                                        setExpandedUploadMonths(prev => {
                                            const next = new Set(prev);
                                            next.has(group.uploadMonth) ? next.delete(group.uploadMonth) : next.add(group.uploadMonth);
                                            return next;
                                        });
                                    }}>
                                        <div>
                                            <h4 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                                                <Calendar size={18} className="text-brand-500" />
                                                {getMonthName(group.uploadMonth)} Uploads
                                            </h4>
                                        </div>
                                        <div className="text-right flex items-center gap-3">
                                            <div>
                                                <p className="text-xl font-bold text-slate-900">{group.totalCreditsChanged?.toLocaleString()}</p>
                                            </div>
                                            <div className="text-slate-400">
                                                {expandedUploadMonths.has(group.uploadMonth) ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Expanded Table */}
                                    {expandedUploadMonths.has(group.uploadMonth) && (
                                        <div className="p-0 rounded-b-2xl pb-2">
                                            <div className="overflow-x-auto">
                                            <table className="min-w-full text-left text-sm whitespace-nowrap">
                                                <thead className="bg-slate-50 text-slate-600 font-semibold text-xs uppercase tracking-wider">
                                                    <tr>
                                                        <th className="px-5 py-3">S.No</th>
                                                        <th className="px-5 py-3">Account Name</th>
                                                        <th className="px-5 py-3">Billing Month</th>
                                                        <th className="px-5 py-3 text-right">Prev Orders</th>
                                                        <th className="px-5 py-3 text-right">Orders Added</th>
                                                        <th className="px-5 py-3 text-right">Total Orders</th>
                                                        <th className="px-5 py-3 text-right">Prev Credits</th>
                                                        <th className="px-5 py-3 text-right">New Credits</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100">
                                                    {group.rows.map((row, idx) => (
                                                        <tr key={idx} className="hover:bg-slate-50/50 hover:relative hover:z-[60] group/row">
                                                            <td className="px-5 py-3 text-slate-500">{idx + 1}</td>
                                                            <td className="px-5 py-3 font-semibold text-slate-800">{row.accountName}</td>
                                                            <td className="px-5 py-3 text-slate-600">{getMonthName(row.billingMonth)}</td>
                                                            <td className="px-5 py-3 text-right text-slate-600 font-medium">{row.previousOrders?.toLocaleString() || 0}</td>
                                                            <td className="px-5 py-3 text-right text-slate-800 font-bold group relative">
                                                                <span className="border-b border-dashed border-brand-300 cursor-help">
                                                                    {row.ordersAdded?.toLocaleString() || 0}
                                                                </span>
                                                                <div className="absolute opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 bottom-full right-0 mb-2 w-72 bg-slate-800 text-white text-xs rounded-lg py-3 px-4 shadow-xl pointer-events-none">
                                                                    <div className="font-semibold text-slate-300 mb-2 border-b border-slate-700 pb-2 flex justify-between">
                                                                        <span>Files Uploaded</span>
                                                                        <span>Orders</span>
                                                                    </div>
                                                                    <ul className="space-y-2">
                                                                        {row.fileHoverData?.map((file, fIdx) => (
                                                                            <li key={fIdx} className="flex justify-between items-center gap-3">
                                                                                <div className="flex flex-col overflow-hidden">
                                                                                    <span className="truncate" title={file.fileName}>{file.fileName}</span>
                                                                                    <span className="text-[10px] text-slate-400">{new Date(file.uploadDate).toLocaleString()}</span>
                                                                                </div>
                                                                                <span className="text-brand-300 font-medium whitespace-nowrap">{file.ordersAdded > 0 ? '+' : ''}{file.ordersAdded}</span>
                                                                            </li>
                                                                        ))}
                                                                    </ul>
                                                                </div>
                                                            </td>
                                                            <td className="px-5 py-3 text-right text-brand-600 font-bold">
                                                                {((row.previousOrders || 0) + (row.ordersAdded || 0)).toLocaleString()}
                                                            </td>
                                                            <td className="px-5 py-3 text-right text-slate-600 font-medium">{row.oldCredits?.toLocaleString() || 0}</td>
                                                            <td className="px-5 py-3 text-right font-bold text-brand-600">
                                                                {row.creditHoverData ? (
                                                                    <div className="group/credit relative inline-block cursor-help">
                                                                        <span className="border-b border-dashed border-slate-300">
                                                                            {row.newCredits?.toLocaleString() || 0}
                                                                        </span>
                                                                        <div className="absolute opacity-0 invisible group-hover/credit:opacity-100 group-hover/credit:visible transition-all z-50 bottom-full right-0 mb-2 w-64 bg-slate-800 text-white text-xs rounded-lg py-3 px-4 shadow-xl pointer-events-none text-left font-normal">
                                                                            <div className="font-semibold text-slate-300 mb-2 border-b border-slate-700 pb-2 flex justify-between">
                                                                                <span>Calculation</span>
                                                                                <span className="text-brand-300">{row.creditHoverData.tier}</span>
                                                                            </div>
                                                                            <ul className="space-y-1">
                                                                                <li className="flex justify-between">
                                                                                    <span className="text-slate-400">Previous</span>
                                                                                    <span>{row.oldCredits?.toLocaleString() || 0}</span>
                                                                                </li>
                                                                                <li className="flex justify-between">
                                                                                    <span className="text-slate-400">Usage Charge</span>
                                                                                    <span className="text-red-400">+{row.creditHoverData.baseCharge?.toLocaleString() || 0}</span>
                                                                                </li>
                                                                                {row.creditHoverData.discounts?.map((d, i) => (
                                                                                    <li key={i} className="flex justify-between">
                                                                                        <span className="text-emerald-400 truncate max-w-[140px]" title={d.reason}>{d.reason}</span>
                                                                                        <span className="text-emerald-400">-{d.amount?.toLocaleString() || 0}</span>
                                                                                    </li>
                                                                                ))}
                                                                                <li className="flex justify-between border-t border-slate-700 pt-1 mt-1 font-bold text-white">
                                                                                    <span>New Credits</span>
                                                                                    <span>{row.newCredits?.toLocaleString() || 0}</span>
                                                                                </li>
                                                                            </ul>
                                                                        </div>
                                                                    </div>
                                                                ) : (
                                                                    row.newCredits?.toLocaleString() || 0
                                                                )}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                            </div>
                                            {group.rows.length === 0 && (
                                                <div className="p-4 text-center text-sm text-slate-500">No account changes found.</div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                        {uploadMonthGroups.length === 0 && !loading && (
                            <div className="p-12 text-center bg-white rounded-2xl shadow-sm border border-slate-100 mt-4">
                                <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                    <Package className="text-slate-400" size={32} />
                                </div>
                                <h3 className="text-lg font-bold text-slate-800 mb-2">No Upload Months Found</h3>
                                <p className="text-slate-500 text-sm">You haven't uploaded any payment files yet.</p>
                            </div>
                        )}
                    </div>
                )}
        </div>
    );
};

export default CreditsTab;