/* eslint-disable no-unused-vars -- this client's eslint config lacks react/jsx-uses-vars, so
   JSX-only usage of these imports false-positives as unused (see ListingStudioPlansManager.jsx). */
import React, { useState, useEffect, useCallback } from 'react';
import api from '../../api';
import { Package, TrendingUp, TrendingDown, Clock, CheckCircle, XCircle, Loader2, AlertCircle, Store, ShoppingBag } from 'lucide-react';
import MarketplaceAccountFilter from '../MarketplaceAccountFilter';
import DateRangeFilter from './DateRangeFilter';
import { useDateRangeFilter } from '../../hooks/useDateRangeFilter';
import { getMarketplaceLogo } from '../../utils/marketplaceLogos';

const OrdersTab = ({ viewMode = 'grid' }) => {
    const [metrics, setMetrics] = useState(null);
    const [loading, setLoading] = useState(false);
    const view = viewMode; // Use prop instead of local state
    const [accountMetrics, setAccountMetrics] = useState([]);
    const [accountLoading, setAccountLoading] = useState(false);

    // Use the shared date range filter hook
    const {
        filterData,
        hasMarketplacesSelected,
        tempStartDate,
        tempEndDate,
        dateError,
        setTempStartDate,
        setTempEndDate,
        setDateError,
        handleApplyDateFilter,
        handleClearDateFilter,
        handleFilterChange,
        handleStartDateChange,
        handleEndDateChange
    } = useDateRangeFilter();

    const fetchMetrics = useCallback(async () => {
        // Don't fire until the marketplace filter has loaded and selected at least one account.
        if (!hasMarketplacesSelected) return;
        setLoading(true);
        try {
            const params = {};
            if (filterData.startDate) params.startDate = filterData.startDate;
            if (filterData.endDate) params.endDate = filterData.endDate;

            // Send marketplace IDs directly (no name-based lookup needed)
            if (filterData.marketplaceIds && filterData.marketplaceIds !== 'ALL') {
                params.marketplaceIds = JSON.stringify(filterData.marketplaceIds);
            }

            const { data } = await api.get('/orders/metrics', { params });
            setMetrics(data);
            setDateError(''); // Clear any previous date errors on success
        } catch (error) {
            const errorMsg = error.response?.data?.message || 'Error fetching metrics';
            if (errorMsg.includes('Date range') || errorMsg.includes('date')) {
                setDateError(errorMsg);
            }
            console.error('Error fetching metrics', error);
        } finally {
            setLoading(false);
        }
    }, [filterData]);

    const fetchAccountMetrics = useCallback(async () => {
        setAccountLoading(true);
        try {
            const params = {};
            if (filterData.startDate) params.startDate = filterData.startDate;
            if (filterData.endDate) params.endDate = filterData.endDate;

            const { data } = await api.get('/orders/metrics-by-account', { params });
            setAccountMetrics(data || []);
        } catch (error) {
            console.error('Error fetching account metrics', error);
            setAccountMetrics([]);
        } finally {
            setAccountLoading(false);
        }
    }, [filterData]);

    // Grid View: Refetch when marketplace selection OR dates change
    useEffect(() => {
        if (view === 'grid' && hasMarketplacesSelected) {
            fetchMetrics();
        }
         
    }, [view, filterData.marketplaceIds, filterData.startDate, filterData.endDate]);

    // List View: ONLY refetch when dates change (ignore marketplace filter)
    useEffect(() => {
        if (view === 'list') {
            fetchAccountMetrics();
        }
         
    }, [view, filterData.startDate, filterData.endDate]);

    return (
        <div className="w-full">
            {/* Filters */}
            {view === 'grid' ? (
                <div className="flex items-start gap-4 mb-4 relative z-50">
                    <div className="flex-1">
                        <MarketplaceAccountFilter 
                            onChange={handleFilterChange} 
                            dateLabel="Filter by Order Date"
                        />
                    </div>
                </div>
            ) : (
                <DateRangeFilter
                    tempStartDate={tempStartDate}
                    tempEndDate={tempEndDate}
                    setTempStartDate={setTempStartDate}
                    setTempEndDate={setTempEndDate}
                    handleStartDateChange={handleStartDateChange}
                    handleEndDateChange={handleEndDateChange}
                    onApply={handleApplyDateFilter}
                    onClear={handleClearDateFilter}
                    dateError={dateError}
                />
            )}

            {/* Grid View */}
            {view === 'grid' && (
                <>
                    {loading ? (
                        <div className="flex items-center justify-center py-12 animate-in fade-in duration-300">
                            <Loader2 className="animate-spin text-brand-600" size={32} />
                        </div>
                    ) : !metrics ? (
                        <div className="p-8 animate-in fade-in duration-300 text-center">
                            <p className="text-slate-600">Please select a marketplace to view orders.</p>
                        </div>
                    ) : (
                        <div className="animate-in fade-in duration-300">
                    {/* Stats Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-4 animate-in fade-in slide-in-from-bottom-4 duration-500 relative z-10">
                        {[
                            {
                                title: 'Total Orders',
                                value: metrics.totalOrders?.toLocaleString('en-IN') || '0',
                                icon: Package,
                                color: 'blue',
                                bgColor: 'bg-blue-50',
                                iconColor: 'text-blue-600',
                                borderColor: 'border-blue-200'
                            },
                            {
                                title: 'Delivered',
                                value: metrics.delivered?.toLocaleString('en-IN') || '0',
                                icon: CheckCircle,
                                color: 'green',
                                bgColor: 'bg-emerald-50',
                                iconColor: 'text-emerald-600',
                                borderColor: 'border-emerald-200'
                            },
                            {
                                title: 'Cancelled',
                                value: metrics.cancelled?.toLocaleString('en-IN') || '0',
                                icon: XCircle,
                                color: 'red',
                                bgColor: 'bg-red-50',
                                iconColor: 'text-red-600',
                                borderColor: 'border-red-200'
                            },
                            {
                                title: 'Pending',
                                value: metrics.pending?.toLocaleString('en-IN') || '0',
                                icon: Clock,
                                color: 'yellow',
                                bgColor: 'bg-amber-50',
                                iconColor: 'text-amber-600',
                                borderColor: 'border-amber-200'
                            },
                            {
                                title: 'SLA Breached',
                                value: metrics.slaBreached?.toLocaleString('en-IN') || '0',
                                icon: AlertCircle,
                                color: 'orange',
                                bgColor: 'bg-orange-50',
                                iconColor: 'text-orange-600',
                                borderColor: 'border-orange-200'
                            },
                            {
                                title: 'Total Quantity',
                                value: metrics.totalQuantity?.toLocaleString('en-IN') || '0',
                                icon: TrendingUp,
                                color: 'purple',
                                bgColor: 'bg-purple-50',
                                iconColor: 'text-purple-600',
                                borderColor: 'border-purple-200'
                            }
                        ].map((stat, idx) => (
                            <div
                                key={idx}
                                className={`bg-white rounded-2xl shadow-card border ${stat.borderColor} p-6 hover:shadow-lg transition-all duration-300 hover:scale-105`}
                            >
                                <div className="flex items-center justify-between mb-4">
                                    <div className={`p-3 rounded-xl ${stat.bgColor}`}>
                                        <stat.icon className={stat.iconColor} size={24} />
                                    </div>
                                </div>
                                <h3 className="text-sm font-medium text-slate-600 mb-1">{stat.title}</h3>
                                <p className="text-3xl font-bold text-slate-800">{stat.value}</p>
                            </div>
                        ))}
                    </div>

                    {/* Status Breakdown */}
                    {metrics.statusBreakdown && Object.keys(metrics.statusBreakdown).length > 0 && (
                        <div className="bg-white rounded-2xl shadow-card border border-slate-200 p-6 animate-in fade-in slide-in-from-left-4 duration-500 mt-4">
                            <h2 className="text-lg font-heading font-bold text-slate-800 mb-4">Status Breakdown</h2>
                            <div className="space-y-3">
                                {Object.entries(metrics.statusBreakdown)
                                    .sort((a, b) => b[1] - a[1])
                                    .map(([status, count]) => (
                                        <div key={status} className="flex items-center justify-between hover:bg-slate-50 -mx-3 px-3 py-2 rounded-lg transition-all duration-200 animate-in fade-in slide-in-from-left-2">
                                            <div className="flex items-center gap-3">
                                                <div className="w-2 h-2 rounded-full bg-brand-600"></div>
                                                <span className="text-sm font-medium text-slate-700">{status}</span>
                                            </div>
                                            <span className="text-sm font-bold text-slate-800">{count.toLocaleString('en-IN')}</span>
                                        </div>
                                    ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
            </>
            )}

            {/* List View */}
            {view === 'list' && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="bg-white rounded-2xl shadow-card border border-slate-200 overflow-hidden hover:shadow-xl transition-shadow duration-300">
                        <div className="px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
                            <h3 className="font-semibold text-slate-800 flex items-center gap-2.5">
                                <div className="p-2 bg-brand-100 rounded-lg">
                                    <Store size={18} className="text-brand-600" />
                                </div>
                                <span className="text-base">Active Marketplace Accounts - Orders Analysis</span>
                            </h3>
                        </div>
                        <div className="overflow-x-auto custom-scrollbar">
                            <table className="w-full">
                                <thead className="bg-gradient-to-r from-slate-50 to-slate-100/50 border-b-2 border-slate-200">
                                    <tr>
                                        <th className="px-4 py-4 text-center text-xs font-bold text-slate-700 uppercase tracking-wider w-16">Marketplace</th>
                                        <th className="px-4 py-4 text-center text-xs font-bold text-slate-700 uppercase tracking-wider">Account Name</th>
                                        <th className="px-4 py-4 text-center text-xs font-bold text-slate-700 uppercase tracking-wider">Total Orders</th>
                                        <th className="px-4 py-4 text-center text-xs font-bold text-slate-700 uppercase tracking-wider">Delivered</th>
                                        <th className="px-4 py-4 text-center text-xs font-bold text-slate-700 uppercase tracking-wider">Cancelled</th>
                                        <th className="px-4 py-4 text-center text-xs font-bold text-slate-700 uppercase tracking-wider">SLA Breached</th>
                                        <th className="px-4 py-4 text-center text-xs font-bold text-slate-700 uppercase tracking-wider">Pending</th>
                                        <th className="px-4 py-4 text-center text-xs font-bold text-slate-700 uppercase tracking-wider">Total Qty</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {accountLoading && (
                                        <tr>
                                            <td colSpan="8" className="px-6 py-16 text-center">
                                                <div className="flex flex-col items-center gap-3 animate-in fade-in zoom-in-95 duration-300">
                                                    <Loader2 className="animate-spin text-brand-600" size={40} />
                                                    <p className="text-sm text-slate-500 font-medium">Loading accounts...</p>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                    {accountMetrics.length === 0 && !accountLoading && (
                                        <tr>
                                            <td colSpan="8" className="px-6 py-16 text-center text-slate-500">
                                                <div className="flex flex-col items-center gap-3 animate-in fade-in zoom-in-95 duration-300">
                                                    <div className="p-4 bg-slate-100 rounded-full">
                                                        <Store size={40} className="text-slate-400" />
                                                    </div>
                                                    <p className="font-medium text-base">No active marketplace accounts found</p>
                                                    <p className="text-sm text-slate-400">Add marketplace accounts to see analytics here</p>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                    {!accountLoading && accountMetrics.map((account, idx) => {
                                        const logoUrl = getMarketplaceLogo(account.marketplaceName);
                                        const deliveryRate = account.totalOrders > 0 ? ((account.delivered / account.totalOrders) * 100) : 0;
                                        
                                        return (
                                            <tr 
                                                key={idx} 
                                                className="hover:bg-gradient-to-r hover:from-slate-50 hover:to-blue-50/30 transition-all duration-300 hover:shadow-sm cursor-pointer group"
                                                style={{ 
                                                    animation: `fadeIn 0.3s ease-out ${idx * 0.05}s backwards` 
                                                }}
                                            >
                                                <td className="px-4 py-4">
                                                    <div className="flex items-center justify-center">
                                                        <div className="flex-shrink-0 w-11 h-11 group-hover:scale-110 transition-transform duration-300">
                                                            {logoUrl ? (
                                                                <img 
                                                                    src={logoUrl}
                                                                    alt={account.marketplaceName}
                                                                    className="w-11 h-11 object-contain rounded-lg border border-slate-200 bg-white p-1.5 shadow-sm group-hover:shadow-md group-hover:border-brand-300 transition-all duration-300"
                                                                    title={account.marketplaceName}
                                                                    onError={(e) => {
                                                                        e.target.style.display = 'none';
                                                                        e.target.nextElementSibling.style.display = 'flex';
                                                                    }}
                                                                />
                                                            ) : null}
                                                            <div 
                                                                className="w-11 h-11 rounded-lg bg-gradient-to-br from-slate-100 to-slate-200 border border-slate-300 text-slate-600 items-center justify-center shadow-sm group-hover:from-brand-100 group-hover:to-brand-200 group-hover:border-brand-400 group-hover:shadow-md transition-all duration-300"
                                                                style={{ display: logoUrl ? 'none' : 'flex' }}
                                                                title={account.marketplaceName}
                                                            >
                                                                <ShoppingBag size={20} className="group-hover:text-brand-600 transition-colors" />
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-4 text-center">
                                                    <span className="text-sm font-semibold text-slate-800 group-hover:text-brand-700 transition-colors">
                                                        {account.accountName || account.marketplaceName}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-4 text-center">
                                                    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 group-hover:bg-brand-50 rounded-lg transition-all duration-300">
                                                        <Package size={14} className="text-slate-500 group-hover:text-brand-600 transition-colors" />
                                                        <span className="text-sm font-bold text-slate-800 group-hover:text-brand-700 transition-colors">
                                                            {(account.totalOrders || 0).toLocaleString('en-IN')}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-4 text-center">
                                                    <div className="flex justify-center">
                                                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg font-semibold text-sm group-hover:bg-emerald-100 group-hover:shadow-sm transition-all duration-300">
                                                            <CheckCircle size={14} />
                                                            {(account.delivered || 0).toLocaleString('en-IN')}
                                                            <span className="text-xs opacity-75">({deliveryRate.toFixed(1)}%)</span>
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-4 text-center">
                                                    <div className="flex justify-center">
                                                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-700 rounded-lg font-semibold text-sm group-hover:bg-red-100 group-hover:shadow-sm transition-all duration-300">
                                                            <XCircle size={14} />
                                                            {(account.cancelled || 0).toLocaleString('en-IN')}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-4 text-center">
                                                    <div className="flex justify-center">
                                                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-700 rounded-lg font-semibold text-sm group-hover:bg-amber-100 group-hover:shadow-sm transition-all duration-300">
                                                            <AlertCircle size={14} />
                                                            {(account.slaBreached || 0).toLocaleString('en-IN')}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-4 text-center">
                                                    <div className="flex justify-center">
                                                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 text-orange-700 rounded-lg font-semibold text-sm group-hover:bg-orange-100 group-hover:shadow-sm transition-all duration-300">
                                                            <Clock size={14} />
                                                            {(account.pending || 0).toLocaleString('en-IN')}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-4 text-center">
                                                    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 group-hover:bg-blue-100 text-blue-700 rounded-lg transition-all duration-300">
                                                        <span className="text-sm font-bold">
                                                            {(account.totalQuantity || 0).toLocaleString('en-IN')}
                                                        </span>
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
        </div>
    );
};

export default OrdersTab;
