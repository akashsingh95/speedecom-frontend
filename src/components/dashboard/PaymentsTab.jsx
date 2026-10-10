import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api';
import { IndianRupee, TrendingUp, TrendingDown, Calendar, Loader2, FileSpreadsheet, ExternalLink, CheckCircle, XCircle, Clock, Calculator, Store, ShoppingBag, Filter, Search, X, ChevronDown } from 'lucide-react';
import { getMarketplaceLogo } from '../../utils/marketplaceLogos';
import ExportButton from '../ExportButton';
import { useAuth } from '../../AuthContext';
import AdvancedDateRangePicker from '../AdvancedDateRangePicker';

const PaymentsTab = ({ viewMode = 'grid' }) => {
    const navigate = useNavigate();
    const { user, isImpersonating } = useAuth();
    const view = viewMode;
    const [accountMetrics, setAccountMetrics] = useState([]);
    const [accountLoading, setAccountLoading] = useState(false);

    // Ads type toggle: 'sku_wise' | 'payment'
    // Only applies to Flipkart and Amazon accounts; Meesho always shows "–"
    const [adsType, setAdsType] = useState('sku_wise');

    // List view: marketplace filter state
    const [listAvailableMarketplaces, setListAvailableMarketplaces] = useState([]);
    const [listMktDropdownOpen, setListMktDropdownOpen] = useState(false);
    const [listTempMktFilters, setListTempMktFilters] = useState([]); // temp selection before Apply
    const [listMktFilters, setListMktFilters] = useState([]); // applied selection (ids)
    const [listMktSearch, setListMktSearch] = useState('');
    const listMktDropdownRef = useRef(null);

    // List view: date range state (AdvancedDateRangePicker)
    const [listStartDate, setListStartDate] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() - 90);
        return d.toISOString().split('T')[0];
    });
    const [listEndDate, setListEndDate] = useState(() => new Date().toISOString().split('T')[0]);

    // Close list-view marketplace dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (listMktDropdownRef.current && !listMktDropdownRef.current.contains(e.target)) {
                setListMktDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Stable filter key to avoid re-fetching when array references change but values don't
    const prevListFilterKey = useRef();

    const getListFilterKey = () => JSON.stringify({
        mIds: listMktFilters,
        sd: listStartDate,
        ed: listEndDate,
        adsType
    });

    const fetchAccountMetrics = useCallback(async () => {
        setAccountLoading(true);
        try {
            const params = { adsType };
            // List view uses its own date state
            if (listStartDate) params.startDate = listStartDate;
            if (listEndDate) params.endDate = listEndDate;
            // Pass marketplace filter for list view
            if (listMktFilters.length > 0) {
                params.marketplaceIds = JSON.stringify(listMktFilters);
            }

            const { data } = await api.get('/payments/metrics-by-account', { params });
            setAccountMetrics(data || []);
        } catch (error) {
            console.error('Error fetching account metrics', error);
            setAccountMetrics([]);
        } finally {
            setAccountLoading(false);
        }
    }, [listStartDate, listEndDate, listMktFilters, adsType]);

    // List View: only fetch when list filter key changes (deep compare)
    useEffect(() => {
        if (view === 'list') {
            const key = getListFilterKey();
            if (key !== prevListFilterKey.current) {
                prevListFilterKey.current = key;
                fetchAccountMetrics();
            }
        }
    }, [view, listStartDate, listEndDate, listMktFilters, adsType]);

    // Show ads toggle only when there are Flipkart or Amazon accounts in the list
    const hasNonMeeshoAccounts = accountMetrics.some(a => a.platform !== 'meesho');

    return (
        <div className="w-full">
            {/* Filters - list view only (grid view uses shared filter from Dashboard) */}
            {view !== 'grid' && (
                <div className="-mx-4 md:-mx-8 px-4 md:px-8 pt-3 pb-3 mb-3 bg-gradient-to-br from-gray-50 to-slate-100/80 border-b border-slate-200/60">
                    <div className="flex items-center gap-3 flex-wrap max-w-[650px]">
                        {/* Advanced Date Range Picker */}
                        <div className="flex items-center gap-2 flex-1 min-w-0">
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

                        {/* Marketplace Filter Dropdown */}
                        <div className="relative" ref={listMktDropdownRef}>
                        <button
                            onClick={() => {
                                if (!listMktDropdownOpen) setListTempMktFilters([...listMktFilters]);
                                setListMktDropdownOpen(!listMktDropdownOpen);
                                setListMktSearch('');
                            }}
                            className={`flex items-center gap-2 px-4 py-[7px] rounded-lg border text-sm font-semibold transition-all duration-150 ${
                                listMktDropdownOpen
                                    ? 'border-brand-600 bg-brand-600 text-white shadow-sm'
                                    : 'border-slate-200 bg-white text-slate-600 hover:border-brand-400 hover:text-brand-700 shadow-sm'
                            }`}
                        >
                            <Filter size={14} />
                            <span>Filter Accounts</span>
                            {listMktFilters.length > 0 && (
                                <span className={`ml-1 px-1.5 py-0.5 text-[10px] rounded-full font-bold ${
                                    listMktDropdownOpen ? 'bg-white text-brand-700' : 'bg-brand-100 text-brand-700'
                                }`}>
                                    {listMktFilters.length}
                                </span>
                            )}
                            <ChevronDown size={13} className={`transition-transform duration-200 ${listMktDropdownOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {listMktDropdownOpen && (() => {
                            const allAccounts = listAvailableMarketplaces.flatMap(mp => mp.accounts || []);
                            const filteredAccounts = allAccounts.filter(acc =>
                                acc.name.toLowerCase().includes(listMktSearch.toLowerCase())
                            );
                            const allIds = allAccounts.map(a => a._id);
                            const isAllSelected = allIds.length > 0 && allIds.every(id => listTempMktFilters.includes(id));

                            return (
                                <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-xl shadow-2xl border border-slate-200/80 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                                    {/* Header */}
                                    <div className="bg-gradient-to-r from-slate-50 to-white px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                                        <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Select Accounts</h3>
                                        <button
                                            onClick={() => setListTempMktFilters([])}
                                            className="text-xs font-semibold text-red-500 hover:text-red-700 disabled:opacity-30 transition-colors"
                                            disabled={listTempMktFilters.length === 0}
                                        >
                                            Clear All
                                        </button>
                                    </div>

                                    {/* Search */}
                                    <div className="px-3 pt-2.5 pb-1.5">
                                        <div className="relative">
                                            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                            <input
                                                type="text"
                                                placeholder="Search accounts..."
                                                value={listMktSearch}
                                                onChange={e => setListMktSearch(e.target.value)}
                                                onClick={e => e.stopPropagation()}
                                                className="w-full pl-7 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 placeholder:text-slate-400 bg-white shadow-inner transition-all cursor-text"
                                            />
                                        </div>
                                    </div>

                                    {/* Account list */}
                                    <div className="max-h-64 overflow-y-auto p-2 space-y-0.5 custom-scrollbar">
                                        {/* All Accounts toggle */}
                                        {!listMktSearch && (
                                            <div
                                                onClick={() => {
                                                    if (isAllSelected) setListTempMktFilters([]);
                                                    else setListTempMktFilters(allIds);
                                                }}
                                                className="px-3 py-2.5 mb-1 hover:bg-gradient-to-r hover:from-brand-50 hover:to-blue-50 cursor-pointer flex items-center gap-3 border-b border-slate-100 transition-all group rounded-lg"
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={isAllSelected}
                                                    onChange={() => {}}
                                                    className="w-4 h-4 text-brand-600 border-slate-300 rounded focus:ring-2 focus:ring-brand-500/20 pointer-events-none"
                                                />
                                                <span className="text-sm font-bold text-brand-700 group-hover:text-brand-800">All Accounts</span>
                                            </div>
                                        )}

                                        {filteredAccounts.length === 0 && (
                                            <div className="px-3 py-4 text-xs text-slate-500 text-center italic">
                                                No accounts found matching "{listMktSearch}"
                                            </div>
                                        )}

                                        {filteredAccounts.map((account, accIdx) => {
                                            const isSelected = listTempMktFilters.includes(account._id);
                                            return (
                                                <div
                                                    key={account._id}
                                                    onClick={() => {
                                                        if (isSelected) {
                                                            setListTempMktFilters(prev => prev.filter(id => id !== account._id));
                                                        } else {
                                                            setListTempMktFilters(prev => [...prev, account._id]);
                                                        }
                                                    }}
                                                    className="px-3 py-2.5 hover:bg-slate-50 cursor-pointer flex items-center gap-3 transition-all duration-150 group border-l-2 border-transparent hover:border-brand-500 hover:bg-gradient-to-r hover:from-slate-50 hover:to-white rounded-r-lg"
                                                    style={{ animationDelay: `${accIdx * 20}ms` }}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={() => {}}
                                                        className="w-4 h-4 text-brand-600 border-slate-300 rounded focus:ring-2 focus:ring-brand-500/20 pointer-events-none"
                                                    />
                                                    <span className="text-sm text-slate-700 font-medium group-hover:text-slate-900">{account.name}</span>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* Apply button */}
                                    <div className="border-t border-slate-100 p-2 bg-slate-50/50">
                                        <button
                                            onClick={() => {
                                                setListMktFilters(listTempMktFilters);
                                                setListMktDropdownOpen(false);
                                            }}
                                            className="w-full px-3 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold rounded-lg transition-all duration-200 hover:shadow-md active:scale-95"
                                        >
                                            Apply Filters
                                        </button>
                                    </div>
                                </div>
                            );
                        })()}
                        </div>
                    </div>
                </div>
            )}

            {/* List View */}
            {view === 'list' && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="bg-white rounded-2xl shadow-card border border-slate-200 overflow-hidden hover:shadow-xl transition-shadow duration-300">
                        <div className="px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white flex items-center justify-between shadow-sm">
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
                                            className={`px-3 py-1.5 rounded-md transition-all duration-200 ${
                                                adsType === 'sku_wise'
                                                    ? 'bg-white text-brand-700 shadow-sm border border-slate-200'
                                                    : 'text-slate-500 hover:text-slate-700'
                                            }`}
                                        >
                                            SKU-wise Ads
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setAdsType('payment')}
                                            className={`px-3 py-1.5 rounded-md transition-all duration-200 ${
                                                adsType === 'payment'
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
                        <div className="overflow-auto max-h-[calc(100vh-280px)] custom-scrollbar relative">
                            <table className="w-full">
                                <thead className="sticky top-0 z-[40] bg-gradient-to-r from-slate-50 to-slate-100/95 backdrop-blur-md border-b-2 border-slate-200 shadow-sm">
                                    <tr>
                                        <th className="px-4 py-4 text-center text-xs font-bold text-slate-700 uppercase tracking-wider w-16">Marketplace</th>
                                        <th className="px-4 py-4 text-center text-xs font-bold text-slate-700 uppercase tracking-wider">Account Name</th>
                                        <th className="px-4 py-4 text-center text-xs font-bold text-slate-700 uppercase tracking-wider">Net Sales</th>
                                        <th className="px-4 py-4 text-center text-xs font-bold text-slate-700 uppercase tracking-wider">Net Settlement</th>
                                        <th className="px-4 py-4 text-center text-xs font-bold text-slate-700 uppercase tracking-wider">MP Fee &amp; Other</th>

                                        <th className="px-4 py-4 text-center text-xs font-bold text-slate-700 uppercase tracking-wider">Ads Cost</th>
                                        <th className="px-4 py-4 text-center text-xs font-bold text-slate-700 uppercase tracking-wider">Net Profit</th>
                                    </tr>
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
                                                    <p className="font-medium text-base">No marketplace accounts found</p>
                                                    <p className="text-sm text-slate-400">Upload payment reports to see analytics here</p>
                                                </div>
                                            </td>
                                        </tr>
                                    )}

                                    {/* Total Row */}
                                    {accountMetrics.length > 0 && (() => {
                                        const totals = accountMetrics.reduce((acc, a) => ({
                                            totalSales:           acc.totalSales           + (a.totalSales           || 0),
                                            totalSettlement:      acc.totalSettlement      + (a.totalSettlement      || 0),
                                            totalMarketplaceFees: acc.totalMarketplaceFees + (a.totalMarketplaceFees || 0),
                                            adsCost:              acc.adsCost              + (a.adsCost              || 0),
                                            netProfit:            acc.netProfit            + (a.netProfit            || 0),
                                        }), { totalSales: 0, totalSettlement: 0, totalMarketplaceFees: 0, adsCost: 0, netProfit: 0 });
                                        const totalIsProfit = totals.netProfit >= 0;
                                        const totalProfitPct = totals.totalSales > 0 ? ((totals.netProfit / totals.totalSales) * 100) : 0;
                                        return (
                                            <tr className="bg-slate-200 text-slate-800">
                                                <td className="px-4 py-4 text-center">
                                                    <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">∑</span>
                                                </td>
                                                <td className="px-4 py-4 text-center">
                                                    <span className="text-sm font-extrabold text-slate-900 tracking-wide uppercase">Total</span>
                                                </td>
                                                <td className="px-4 py-4 text-center">
                                                    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/60 rounded-lg border border-slate-300 shadow-sm">
                                                        <IndianRupee size={14} className="text-slate-600" />
                                                        <span className="text-sm font-bold text-slate-800">{totals.totalSales.toLocaleString('en-IN')}</span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-4 text-center">
                                                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-100 text-emerald-800 rounded-lg font-semibold text-sm shadow-sm border border-emerald-200/50">
                                                        <TrendingUp size={14} />
                                                        ₹{totals.totalSettlement.toLocaleString('en-IN')}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-4 text-center">
                                                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-100 text-red-800 rounded-lg font-semibold text-sm shadow-sm border border-red-200/50">
                                                        <TrendingDown size={14} />
                                                        ₹{Math.abs(totals.totalMarketplaceFees).toLocaleString('en-IN')}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-4 text-center">
                                                    <div className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white/60 text-slate-700 rounded-lg border border-slate-300 shadow-sm">
                                                        <span className="text-sm font-medium">
                                                            ₹{Math.abs(totals.adsCost).toLocaleString('en-IN')}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-4 text-center">
                                                    <div className="inline-flex flex-col items-center gap-0.5">
                                                        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold text-sm shadow-sm border ${
                                                            totalIsProfit ? 'bg-emerald-100 text-emerald-800 border-emerald-200/50' : 'bg-red-100 text-red-800 border-red-200/50'
                                                        }`}>
                                                            {totalIsProfit ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                                                            ₹{totals.netProfit.toLocaleString('en-IN')}
                                                        </span>
                                                        <span className={`text-xs font-semibold ${totalIsProfit ? 'text-emerald-700' : 'text-red-700'}`}>
                                                            ({totalProfitPct > 0 ? '+' : ''}{totalProfitPct.toFixed(1)}%)
                                                        </span>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })()}

                                    {/* Account Rows */}
                                    {accountMetrics.map((account, idx) => {
                                        const logoUrl = getMarketplaceLogo(account.marketplaceName);
                                        const isProfit = account.netProfit >= 0;
                                        const profitPercentage = account.totalSales > 0 ? ((account.netProfit / account.totalSales) * 100) : 0;

                                        return (
                                            <tr
                                                key={idx}
                                                className={`hover:bg-gradient-to-r hover:from-slate-50 hover:to-blue-50/30 transition-all duration-300 hover:shadow-sm cursor-pointer group ${account.status === 'inactive' ? 'opacity-60' : ''}`}
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
                                                    <button
                                                        onClick={() => {
                                                            const params = new URLSearchParams();
                                                            params.set('marketplaceIds', JSON.stringify([account.marketplaceId]));
                                                            if (listStartDate) params.set('startDate', listStartDate);
                                                            if (listEndDate) params.set('endDate', listEndDate);
                                                            window.open(`/client/payments/calculations?${params.toString()}`, '_blank');
                                                        }}
                                                        className="text-sm font-semibold text-brand-700 hover:text-brand-900 hover:underline underline-offset-2 transition-colors cursor-pointer"
                                                    >
                                                        {account.accountName || account.marketplaceName}
                                                    </button>
                                                    {account.status === 'inactive' && (
                                                        <span className="ml-2 px-2 py-0.5 bg-slate-200 text-slate-600 text-[10px] font-bold uppercase rounded-md tracking-wide">
                                                            Deactivated
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-4 text-center">
                                                    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 group-hover:bg-slate-200 rounded-lg transition-all duration-300">
                                                        <IndianRupee size={14} className="text-slate-600" />
                                                        <span className="text-sm font-bold text-slate-800">
                                                            {(account.totalSales || 0).toLocaleString('en-IN')}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-4 text-center">
                                                    <div className="flex justify-center">
                                                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg font-semibold text-sm group-hover:bg-emerald-100 group-hover:shadow-sm transition-all duration-300">
                                                            <TrendingUp size={14} />
                                                            ₹{(account.totalSettlement || 0).toLocaleString('en-IN')}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-4 text-center">
                                                    <div className="flex justify-center">
                                                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-700 rounded-lg font-semibold text-sm group-hover:bg-red-100 group-hover:shadow-sm transition-all duration-300">
                                                            <TrendingDown size={14} />
                                                            ₹{Math.abs(account.totalMarketplaceFees || 0).toLocaleString('en-IN')}
                                                        </span>
                                                    </div>
                                                </td>

                                                <td className="px-4 py-4 text-center">
                                                    <div className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-violet-50 group-hover:bg-violet-100 text-violet-700 rounded-lg border border-violet-100 transition-all duration-300">
                                                        <span className="text-sm font-medium">
                                                            ₹{Math.abs(account.adsCost || 0).toLocaleString('en-IN')}
                                                        </span>
                                                    </div>
                                                </td>

                                                <td className="px-4 py-4 text-center">
                                                    <div className="flex justify-center">
                                                        <div className="inline-flex flex-col items-center gap-0.5">
                                                            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold text-sm transition-all duration-300 group-hover:shadow-sm ${isProfit
                                                                ? 'bg-emerald-50 text-emerald-700 group-hover:bg-emerald-100'
                                                                : 'bg-red-50 text-red-700 group-hover:bg-red-100'
                                                            }`}>
                                                                {isProfit ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                                                                ₹{(account.netProfit || 0).toLocaleString('en-IN')}
                                                            </span>
                                                            <span className={`text-xs font-medium ${isProfit ? 'text-emerald-600' : 'text-red-600'}`}>
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
        </div>
    );
};

export default PaymentsTab;
