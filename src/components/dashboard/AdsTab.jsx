/* eslint-disable no-unused-vars -- this client's eslint config lacks react/jsx-uses-vars, so
   JSX-only usage of these imports false-positives as unused (see ListingStudioPlansManager.jsx). */
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
    Users, MousePointer, ShoppingBag, DollarSign, TrendingUp, TrendingDown,
    BarChart3, Loader2, ArrowUpRight, ArrowDownRight, Store
} from 'lucide-react';
import api from '../../api';
import AdvancedDateRangePicker from '../AdvancedDateRangePicker';
import MarketplaceAccountSelector from '../MarketplaceAccountSelector';
import { getMarketplaceLogo } from '../../utils/marketplaceLogos';

const AdsTab = ({ viewMode = 'grid', filterData: sharedFilterData, hasMarketplacesSelected: sharedHasMarketplacesSelected, handleFilterChange: sharedHandleFilterChange }) => {
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState({ metrics: {}, campaigns: [], products: [] });
    const view = viewMode;
    const [accountMetrics, setAccountMetrics] = useState([]);
    const [accountLoading, setAccountLoading] = useState(false);

    // List view: marketplace filter state
    const [listAvailableMarketplaces, setListAvailableMarketplaces] = useState([]);
    const [listSelectedMarketplaceKey, setListSelectedMarketplaceKey] = useState('');
    const [listMktFilters, setListMktFilters] = useState([]);

    // List view: date range state
    const [listStartDate, setListStartDate] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() - 90);
        return d.toISOString().split('T')[0];
    });
    const [listEndDate, setListEndDate] = useState(() => new Date().toISOString().split('T')[0]);

    // Use shared filter props from Dashboard
    const filterData = sharedFilterData;
    const hasMarketplacesSelected = sharedHasMarketplacesSelected;
    const handleFilterChange = sharedHandleFilterChange;
    const [dateError, setDateError] = useState('');

    // Fetch marketplace options for list-view filter on mount
    useEffect(() => {
        if (view === 'list') fetchListMarketplaces();
    }, [view]);

    const fetchListMarketplaces = async () => {
        try {
            const { data } = await api.get('/marketplaces/filter-options');
            const allData = data || [];
            setListAvailableMarketplaces(allData);

            // Default priority: 1. Flipkart, 2. Amazon, 3. First available non-disabled
            const selectableData = allData.filter(mp => {
                const key = String(mp.key || mp.name || '').toLowerCase();
                return !key.includes('meesho') && !key.includes('myntra');
            });
            const flipkartMp = selectableData.find(m => String(m.key || m.name || '').toLowerCase() === 'flipkart');
            const amazonMp = selectableData.find(m => String(m.key || m.name || '').toLowerCase() === 'amazon');
            const targetMp = flipkartMp || amazonMp || selectableData[0];

            if (targetMp) {
                const targetKey = targetMp.key;
                const allAccountIds = (targetMp.accounts || []).map(a => String(a._id || a.id).trim()).filter(Boolean);
                setListSelectedMarketplaceKey(targetKey);
                setListMktFilters(allAccountIds);
            }
        } catch (err) {
            console.error('Error fetching list-view marketplace options for ads', err);
        }
    };

    // Stable filter keys to avoid re-fetching when array references change but values don't
    const prevGridFilterKey = useRef();
    const prevListFilterKey = useRef();

    const getGridFilterKey = () => JSON.stringify({
        mIds: filterData.marketplaceIds,
        sd: filterData.startDate,
        ed: filterData.endDate
    });

    const getListFilterKey = () => JSON.stringify({
        sd: listStartDate,
        ed: listEndDate
    });

    const fetchAdsAnalytics = useCallback(async (forceClear = false) => {
        setLoading(true);
        try {
            const params = {};

            const start = forceClear === true ? '' : filterData.startDate;
            const end = forceClear === true ? '' : filterData.endDate;

            if (start) params.startDate = start;
            if (end) params.endDate = end;

            // Send marketplace IDs directly (no name-based lookup needed)
            if (filterData.marketplaceIds && filterData.marketplaceIds !== 'ALL') {
                params.marketplaceIds = JSON.stringify(filterData.marketplaceIds);
            }

            const { data: analytics } = await api.get('/ads/analytics', { params });
            setData(analytics);
            setDateError(''); // Clear any previous date errors on success
        } catch (error) {
            const errorMsg = error.response?.data?.message || 'Error fetching ads analytics';
            if (errorMsg.includes('Date range') || errorMsg.includes('date')) {
                setDateError(errorMsg);
            }
            console.error('Error fetching ads analytics', error);
        } finally {
            setLoading(false);
        }
    }, [filterData]);

    const fetchAccountMetrics = useCallback(async () => {
        setAccountLoading(true);
        try {
            const params = {};
            if (listStartDate) params.startDate = listStartDate;
            if (listEndDate) params.endDate = listEndDate;
            const { data } = await api.get('/ads/analytics-by-account', { params });
            setAccountMetrics(data || []);
        } catch (error) {
            console.error('Error fetching account metrics', error);
            setAccountMetrics([]);
        } finally {
            setAccountLoading(false);
        }
    }, [listStartDate, listEndDate]);

    // Client-side filtering of accounts based on selected filter
    const visibleAccountMetrics = useMemo(() => {
        if (!listMktFilters || listMktFilters.length === 0) return [];
        return accountMetrics.filter(account => {
            const accId = String(account.marketplaceId || account._id || account.id).trim();
            return listMktFilters.some(fId => String(fId).trim() === accId);
        });
    }, [accountMetrics, listMktFilters]);

    // Grid View: only fetch when grid filter key actually changes (deep compare)
    useEffect(() => {
        if (view === 'grid' && hasMarketplacesSelected) {
            const key = getGridFilterKey();
            if (key !== prevGridFilterKey.current) {
                prevGridFilterKey.current = key;
                fetchAdsAnalytics();
            }
        }
         
    }, [view, filterData.marketplaceIds, filterData.startDate, filterData.endDate]);

    // List View: only fetch when list date range changes
    useEffect(() => {
        if (view === 'list') {
            const key = getListFilterKey();
            if (key !== prevListFilterKey.current) {
                prevListFilterKey.current = key;
                fetchAccountMetrics();
            }
        }
         
    }, [view, listStartDate, listEndDate]);

    const MetricCard = ({ title, value, icon: Icon, color, prefix = '', suffix = '', formatOptions = {} }) => (
        <div className="bg-white p-6 rounded-2xl shadow-card border border-slate-100 hover:shadow-lg transition-all duration-300 hover:scale-105">
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-sm font-medium text-slate-500 mb-1">{title}</p>
                    <h3 className="text-2xl font-bold text-slate-800 transition-all duration-300">
                        {prefix}{Number(value || 0).toLocaleString('en-IN', formatOptions)}{suffix}
                    </h3>
                </div>
                <div className={`p-3 rounded-xl ${color} bg-opacity-10 transition-transform duration-300 hover:scale-110`}>
                    <Icon size={24} className={color.replace('bg-', 'text-')} />
                </div>
            </div>
        </div>
    );

    return (
        <div className="w-full">
            {/* Filters - list view only (grid view uses shared filter from Dashboard) */}
            {view !== 'grid' && (
                <div className="-mx-4 md:-mx-8 px-4 md:px-8 pt-3 pb-3 mb-3 bg-gradient-to-br from-gray-50 to-slate-100/80 border-b border-slate-200/60 relative z-50">
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

                        {/* Marketplace Account Selector (Cost Sheet style: single marketplace + multi-account) */}
                        <MarketplaceAccountSelector
                            selectionMode="single"
                            accountSelection="multiple"
                            variant="popover"
                            buttonLabel="Filter Accounts"
                            disabledMarketplaces={['meesho', 'myntra']}
                            availableMarketplaces={listAvailableMarketplaces}
                            selectedMarketplaceKey={listSelectedMarketplaceKey}
                            selectedAccountIds={listMktFilters}
                            onApply={({ selectedMarketplaces, selectedAccountIds }) => {
                                setListSelectedMarketplaceKey(selectedMarketplaces[0] || '');
                                setListMktFilters(selectedAccountIds);
                            }}
                        />
                    </div>
                </div>
            )}

            {/* Grid View */}
            {view === 'grid' && (
                <div className="animate-in fade-in duration-300 relative z-10">
                    {/* Loading Overlay */}
                    {loading ? (
                        <div className="flex items-center justify-center py-12 animate-in fade-in zoom-in-95 duration-300">
                            <Loader2 className="animate-spin text-brand-600" size={40} />
                        </div>
                    ) : !hasMarketplacesSelected ? (
                        <div className="p-8 animate-in fade-in duration-300 text-center">
                            <div className="w-16 h-16 bg-slate-50 mx-auto rounded-full flex items-center justify-center mb-4">
                                <BarChart3 className="text-slate-400" size={32} />
                            </div>
                            <p className="text-slate-600">Please select a marketplace to view ads analytics.</p>
                        </div>
                    ) : (
                        <>
                            {/* Scorecards */}
                             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <MetricCard
                            title="Total Views"
                            value={data.metrics.total_views}
                            icon={Users}
                            color="bg-blue-500"
                        />
                        <MetricCard
                            title="Total Clicks"
                            value={data.metrics.total_clicks}
                            icon={MousePointer}
                            color="bg-purple-500"
                        />
                        <MetricCard
                            title="Units Sold (Direct+Indirect)"
                            value={data.metrics.total_units_sold}
                            icon={ShoppingBag}
                            color="bg-emerald-500"
                        />
                        <MetricCard
                            title="Revenue"
                            value={data.metrics.total_revenue}
                            icon={DollarSign}
                            color="bg-amber-500"
                            prefix="₹"
                            formatOptions={{ minimumFractionDigits: 2, maximumFractionDigits: 2 }}
                        />
                        <MetricCard
                            title="Avg. ROI"
                            value={Number(data.metrics.avg_roi).toFixed(2)}
                            icon={TrendingUp}
                            color="bg-rose-500"
                        />
                        <MetricCard
                            title="Conversion Rate"
                            value={parseFloat(data.metrics.avg_conversion_rate || 0).toFixed(3)}
                            icon={BarChart3}
                            color="bg-indigo-500"
                            suffix="%"
                        />
                    </div>

                    {/* Campaign Performance Table */}
                    <div className="bg-white rounded-2xl shadow-card border border-slate-200 overflow-hidden animate-in fade-in slide-in-from-left-4 duration-500">
                        <div className="px-6 py-5 border-b border-slate-100">
                            <h3 className="font-semibold text-slate-800">Top Performing Campaigns</h3>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-slate-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Campaign</th>
                                        <th className="px-6 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Views</th>
                                        <th className="px-6 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Clicks</th>
                                        <th className="px-6 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Units</th>
                                        <th className="px-6 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Revenue</th>
                                        <th className="px-6 py-3 text-right text-xs font-semibold text-slate-600 uppercase">ROI</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {data.campaigns.map((camp, idx) => (
                                        <tr key={idx} className="hover:bg-slate-50 transition-colors duration-150">
                                            <td className="px-6 py-4 text-sm font-medium text-slate-800">{camp.campaign_name}</td>
                                            <td className="px-6 py-4 text-sm text-right text-slate-600">{Number(camp.views).toLocaleString('en-IN')}</td>
                                            <td className="px-6 py-4 text-sm text-right text-slate-600">{Number(camp.clicks).toLocaleString('en-IN')}</td>
                                            <td className="px-6 py-4 text-sm text-right text-slate-600">{Number(camp.units_sold).toLocaleString('en-IN')}</td>
                                            <td className="px-6 py-4 text-sm text-right font-medium text-emerald-600">₹{Number(camp.revenue).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                            <td className="px-6 py-4 text-sm text-right text-slate-600">{Number(camp.roi).toFixed(2)}</td>
                                        </tr>
                                    ))}
                                    {data.campaigns.length === 0 && (
                                        <tr>
                                            <td colSpan="6" className="px-6 py-8 text-center text-slate-500">No campaign data available</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Product Performance Table */}
                    <div className="bg-white rounded-2xl shadow-card border border-slate-200 overflow-hidden animate-in fade-in slide-in-from-right-4 duration-500 mt-4">
                        <div className="px-6 py-5 border-b border-slate-100">
                            <h3 className="font-semibold text-slate-800">Top Performing Products</h3>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-slate-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Product Name</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">SKU</th>
                                        <th className="px-6 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Views</th>
                                        <th className="px-6 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Clicks</th>
                                        <th className="px-6 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Units</th>
                                        <th className="px-6 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Revenue</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {data.products.map((prod, idx) => (
                                        <tr key={idx} className="hover:bg-slate-50 transition-colors duration-150">
                                            <td className="px-6 py-4 text-sm font-medium text-slate-800 max-w-xs truncate" title={prod.product_name}>{prod.product_name || 'N/A'}</td>
                                            <td className="px-6 py-4 text-sm text-slate-500">{prod.sku}</td>
                                            <td className="px-6 py-4 text-sm text-right text-slate-600">{Number(prod.views).toLocaleString('en-IN')}</td>
                                            <td className="px-6 py-4 text-sm text-right text-slate-600">{Number(prod.clicks).toLocaleString('en-IN')}</td>
                                            <td className="px-6 py-4 text-sm text-right text-slate-600">{Number(prod.units_sold).toLocaleString('en-IN')}</td>
                                            <td className="px-6 py-4 text-sm text-right font-medium text-emerald-600">₹{Number(prod.revenue).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                        </tr>
                                    ))}
                                    {data.products.length === 0 && (
                                        <tr>
                                            <td colSpan="6" className="px-6 py-8 text-center text-slate-500">No product data available</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    </>
                    )}
                </div>
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
                                <span className="text-base">Marketplace Accounts - Ads Analytics</span>
                            </h3>
                        </div>
                        <div className="overflow-auto max-h-[calc(100vh-280px)] custom-scrollbar relative">
                            <table className="w-full">
                                <thead className="sticky top-0 z-[40] bg-gradient-to-r from-slate-50 to-slate-100/95 backdrop-blur-md border-b-2 border-slate-200 shadow-sm">
                                    <tr>
                                        <th className="px-4 py-4 text-center text-xs font-bold text-slate-700 uppercase tracking-wider w-16">Marketplace</th>
                                        <th className="px-4 py-4 text-center text-xs font-bold text-slate-700 uppercase tracking-wider">Account Name</th>
                                        <th className="px-4 py-4 text-center text-xs font-bold text-slate-700 uppercase tracking-wider">Total Views</th>
                                        <th className="px-4 py-4 text-center text-xs font-bold text-slate-700 uppercase tracking-wider">Total Clicks</th>
                                        <th className="px-4 py-4 text-center text-xs font-bold text-slate-700 uppercase tracking-wider">Conversion Rate</th>
                                        <th className="px-4 py-4 text-center text-xs font-bold text-slate-700 uppercase tracking-wider">Units Sold</th>
                                        <th className="px-4 py-4 text-center text-xs font-bold text-slate-700 uppercase tracking-wider">Revenue</th>
                                        <th className="px-4 py-4 text-center text-xs font-bold text-slate-700 uppercase tracking-wider">Avg ROI</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {accountLoading && (
                                        <tr>
                                            <td colSpan="8" className="px-6 py-16 text-center">
                                                <div className="flex flex-col items-center gap-3 animate-in fade-in zoom-in-95 duration-300">
                                                    <Loader2 className="animate-spin text-brand-600" size={40} />
                                                    <p className="text-sm text-slate-500 font-medium">Loading ads analytics...</p>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                    {!accountLoading && visibleAccountMetrics.length === 0 && (
                                        <tr>
                                            <td colSpan="8" className="px-6 py-16 text-center text-slate-500">
                                                <div className="flex flex-col items-center gap-3 animate-in fade-in zoom-in-95 duration-300">
                                                    <div className="p-4 bg-slate-100 rounded-full">
                                                        <BarChart3 size={40} className="text-slate-400" />
                                                    </div>
                                                    <p className="font-medium text-base">No marketplace accounts found</p>
                                                    <p className="text-sm text-slate-400">Select accounts from the filter above</p>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                    {!accountLoading && visibleAccountMetrics.map((account, idx) => {
                                        const conversionRate = parseFloat(account.avg_conversion_rate || 0);
                                        const roi = parseFloat(account.avg_roi || 0);
                                        const ctr = account.total_views > 0 ? ((account.total_clicks / account.total_views) * 100) : 0;

                                        const logoUrl = getMarketplaceLogo(account.marketplaceName);

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
                                                    <span className="text-sm font-semibold text-slate-800 group-hover:text-brand-700 transition-colors">
                                                        {account.accountName || account.marketplaceName}
                                                    </span>
                                                    {account.status === 'inactive' && (
                                                        <span className="ml-2 px-2 py-0.5 bg-slate-200 text-slate-600 text-[10px] font-bold uppercase rounded-md tracking-wide">
                                                            Deactivated
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-4 text-center">
                                                    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 group-hover:bg-purple-100 text-purple-700 rounded-lg transition-all duration-300">
                                                        <Users size={14} />
                                                        <span className="text-sm font-semibold">
                                                            {(account.total_views || 0).toLocaleString('en-IN')}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-4 text-center">
                                                    <div className="flex flex-col items-center gap-0.5">
                                                        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 group-hover:bg-blue-100 text-blue-700 rounded-lg transition-all duration-300">
                                                            <MousePointer size={14} />
                                                            <span className="text-sm font-semibold">
                                                                {(account.total_clicks || 0).toLocaleString('en-IN')}
                                                            </span>
                                                        </div>
                                                        <span className="text-xs text-slate-500 font-medium">
                                                            CTR: {ctr.toFixed(2)}%
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-4">
                                                    <div className="flex justify-center">
                                                        <span className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-bold transition-all duration-300 group-hover:shadow-md animate-pulse ${conversionRate > 5
                                                                ? 'bg-gradient-to-r from-emerald-50 to-green-100 text-emerald-700 group-hover:from-emerald-100 group-hover:to-green-200'
                                                                : conversionRate > 2
                                                                    ? 'bg-gradient-to-r from-amber-50 to-yellow-100 text-amber-700 group-hover:from-amber-100 group-hover:to-yellow-200'
                                                                : 'bg-gradient-to-r from-red-50 to-orange-100 text-red-700 group-hover:from-red-100 group-hover:to-orange-200'
                                                        }`}>
                                                            {conversionRate > 5 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                                                            {conversionRate.toFixed(3)}%
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-4 text-center">
                                                    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 group-hover:bg-indigo-100 text-indigo-700 rounded-lg font-semibold text-sm transition-all duration-300 group-hover:shadow-sm">
                                                        <ShoppingBag size={14} />
                                                        {(account.total_units_sold || 0).toLocaleString('en-IN')}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-4 text-center">
                                                    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 group-hover:bg-emerald-100 text-emerald-700 rounded-lg font-bold text-sm transition-all duration-300 group-hover:shadow-sm">
                                                        <DollarSign size={14} />
                                                        ₹{(account.total_revenue || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-4 text-center">
                                                    <div className="flex justify-center">
                                                        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold text-sm transition-all duration-300 group-hover:shadow-md ${roi >= 5
                                                                ? 'bg-gradient-to-r from-emerald-50 to-green-100 text-emerald-700 group-hover:from-emerald-100 group-hover:to-green-200'
                                                                 : roi >= 0 
                                                                ? 'bg-gradient-to-r from-blue-50 to-cyan-100 text-blue-700 group-hover:from-blue-100 group-hover:to-cyan-200' 
                                                                : 'bg-gradient-to-r from-red-50 to-rose-100 text-red-700 group-hover:from-red-100 group-hover:to-rose-200'
                                                        }`}>
                                                            {roi >= 0 ? (
                                                                <ArrowUpRight size={14} className="animate-bounce" />
                                                            ) : (
                                                                <ArrowDownRight size={14} className="animate-bounce" />
                                                            )}
                                                            {roi >= 0 ? '+' : ''}{roi.toFixed(2)}
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

export default AdsTab;
