import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Loader2, Calendar } from 'lucide-react';
import api from '../api';
import AdvancedDateRangePicker from '../components/AdvancedDateRangePicker';
import ExportButton from '../components/ExportButton';
import Tooltip from '../components/Tooltip';

// ─── helpers ────────────────────────────────────────────────────────────────
const formatCurrency = (v) => {
    const n = parseFloat(v) || 0;
    return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];


// ─── component ───────────────────────────────────────────────────────────────
const PaymentsSettlements = () => {
    const navigate   = useNavigate();
    const location   = useLocation();
    const navState   = location.state || {};

    const [marketplaceFilter] = useState(navState.marketplaceIds || null);

    // Always payment_date — toggle removed
    const dateType = 'payment_date';

    const [startDate, setStartDate] = useState(navState.startDate || localStorage.getItem('payments_startDate') || '');
    const [endDate,   setEndDate]   = useState(navState.endDate   || localStorage.getItem('payments_endDate') || '');

    useEffect(() => {
        if (startDate) localStorage.setItem('payments_startDate', startDate);
        else localStorage.removeItem('payments_startDate');

        if (endDate) localStorage.setItem('payments_endDate', endDate);
        else localStorage.removeItem('payments_endDate');

        const currentNavState = location.state || {};
        if (startDate !== currentNavState.startDate || endDate !== currentNavState.endDate) {
            navigate(location.pathname + location.search, {
                replace: true,
                state: { ...currentNavState, startDate, endDate }
            });
        }
    }, [startDate, endDate, location.pathname, location.search, location.state, navigate]);

    // Available payment months (for AdvancedDateRangePicker)
    const [availableYears,  setAvailableYears]  = useState([]);
    const [availableMonths, setAvailableMonths] = useState(null);

    // Order month filter
    const [orderMonthAmounts,    setOrderMonthAmounts]    = useState([]);
    const [orderAvailableYears,  setOrderAvailableYears]  = useState([]);
    const [orderAvailableMonths, setOrderAvailableMonths] = useState({});
    const [activeOrderYear,      setActiveOrderYear]      = useState(null);
    const [selectedOrderMonth,   setSelectedOrderMonth]   = useState('All');
    const [cardsPage,            setCardsPage]            = useState(1);

    const [settlements, setSettlements] = useState([]);
    const [platform,    setPlatform]    = useState(null);
    const [loading,     setLoading]     = useState(false);
    const [error,       setError]       = useState('');

    const [nullDateFilter, setNullDateFilter] = useState(false);

    const [marketplaceIdToName] = useState(navState.marketplaceIdToName || {});

    // ── fetch available payment months ─────────────────────────────────────
    const fetchAvailableMonths = useCallback(async () => {
        try {
            const params = { dateType };
            if (marketplaceFilter) {
                params.marketplaceIds = JSON.stringify(
                    Array.isArray(marketplaceFilter) ? marketplaceFilter : [marketplaceFilter]
                );
            }
            const { data } = await api.get('/payments/settlements/available-months', { params });
            if (data && data.years && data.years.length > 0) {
                setAvailableYears(data.years);
                setAvailableMonths(data.yearMonthData || null);
            }
        } catch (e) {
            console.error('Error fetching available months:', e);
        }
    }, [marketplaceFilter, dateType]);

    useEffect(() => { fetchAvailableMonths(); }, [fetchAvailableMonths]);

    // ── fetch available order months (Myntra: based on payment date range) ─
    const fetchAvailableOrderMonths = useCallback(async () => {
        if (platform === 'amazon' || !startDate || !endDate) {
            setOrderMonthAmounts([]);
            return;
        }
        try {
            const params = { startDate, endDate };
            if (marketplaceFilter) {
                params.marketplaceIds = JSON.stringify(
                    Array.isArray(marketplaceFilter) ? marketplaceFilter : [marketplaceFilter]
                );
            }
            const { data } = await api.get('/payments/settlements/available-order-months', { params });
            if (data) {
                setOrderAvailableYears(data.years || []);
                setOrderAvailableMonths(data.yearMonthData || {});
                setOrderMonthAmounts(data.monthAmounts || []);
                setSelectedOrderMonth('All');
                setActiveOrderYear(data.years && data.years.length > 0 ? data.years[0] : null);
                setCardsPage(1);
            }
        } catch (e) {
            console.error('Error fetching available order months:', e);
        }
    }, [startDate, endDate, marketplaceFilter, platform]);

    useEffect(() => { fetchAvailableOrderMonths(); }, [fetchAvailableOrderMonths]);

    // ── fetch settlements ──────────────────────────────────────────────────
    const fetchSettlements = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const params = { dateType };
            if (nullDateFilter) {
                params.nullOrderDate = 'true';
            } else {
                if (startDate) params.startDate = startDate;
                if (endDate)   params.endDate   = endDate;
            }
            if (marketplaceFilter) {
                params.marketplaceIds = JSON.stringify(
                    Array.isArray(marketplaceFilter) ? marketplaceFilter : [marketplaceFilter]
                );
            }
            const { data } = await api.get('/payments/settlements', { params });
            setSettlements(data.settlements || []);
            setPlatform(data.platform || null);
        } catch (e) {
            setError(e.response?.data?.message || 'Failed to load settlements');
        } finally {
            setLoading(false);
        }
    }, [startDate, endDate, marketplaceFilter, dateType, nullDateFilter]);

    useEffect(() => { fetchSettlements(); }, [fetchSettlements]);

    // ── date change handler ───────────────────────────────────────────────
    const handleDateChange = (s, e) => {
        setStartDate(s || '');
        setEndDate(e || '');
    };

    const handleNullDateSelect = (active) => {
        setNullDateFilter(active);
    };

    // ── derived ────────────────────────────────────────────────────────────
    const isAmazon = platform === 'amazon';
    const isMyntra = platform === 'myntra';
    const displayedSettlements = isAmazon
        ? settlements.filter(s => s.name === 'Bank Transfer')
        : settlements;
    const { total, positive, negative } = displayedSettlements.reduce(
        (acc, r) => {
            const value = parseFloat(r.value) || 0;
            acc.total += value;
            if (value >= 0) {
                acc.positive += value;
            } else {
                acc.negative += value;
            }
            return acc;
        },
        { total: 0, positive: 0, negative: 0 }
    );

    const resolvedNames = marketplaceFilter
        ? (Array.isArray(marketplaceFilter) ? marketplaceFilter : [marketplaceFilter])
            .map(id => marketplaceIdToName[id] || id)
        : [];

    // ── platform accent ──────────────────────────────────────────────────
    const accent =
        platform === 'flipkart' ? { bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-200', label: 'Flipkart' } :
        platform === 'meesho'   ? { bg: 'bg-fuchsia-50', text: 'text-fuchsia-600', border: 'border-fuchsia-200', label: 'Meesho' } :
        platform === 'amazon'   ? { bg: 'bg-orange-50', text: 'text-orange-600', border: 'border-orange-200', label: 'Amazon' } :
        platform === 'myntra'   ? { bg: 'bg-indigo-50', text: 'text-indigo-600', border: 'border-indigo-200', label: 'Myntra' } :
                                  { bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200', label: '' };

    // ── render ─────────────────────────────────────────────────────────────
    return (
        <div className="min-h-screen bg-slate-50 font-sans pb-10">
            {/* ── top bar ── */}
            <div className="bg-white border-b border-slate-200 px-6 flex items-center gap-4 h-14 sticky top-0 z-50 shadow-sm">
                <button
                    onClick={() => navigate(-1)}
                    className="flex items-center gap-1.5 text-slate-500 text-[13px] font-medium px-2.5 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                >
                    <ArrowLeft size={16} /> Back
                </button>

                <div className="w-px h-7 bg-slate-200" />

                <div className="flex-1">
                    <h1 className="m-0 text-[17px] font-bold text-gray-900">
                        Settlements Breakdown
                    </h1>
                    {resolvedNames.length > 0 && (
                        <p className="m-0 text-xs text-gray-500">
                            {resolvedNames.join(' · ')}
                        </p>
                    )}
                </div>

                {platform && (
                    <span className={`px-3 py-1 rounded-full text-[12px] font-semibold border ${accent.bg} ${accent.text} ${accent.border}`}>
                        {accent.label}
                    </span>
                )}

            </div>

            {/* ── body ── */}
            <div className="flex gap-5 px-6 py-5 items-start max-w-[1400px] mx-auto">

                {/* ── sidebar ── */}
                <div className="w-[340px] shrink-0 flex flex-col gap-4">

                    {/* ── Date Range Picker (same as Calculations) ── */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                        <h2 className="text-sm font-semibold text-slate-800 mb-3">Date Range</h2>
                        <div className="w-full">
                            <AdvancedDateRangePicker
                                startDate={startDate}
                                endDate={endDate}
                                onChange={handleDateChange}
                                onApply={handleDateChange}
                                maxDays={92}
                                alwaysOpen={true}
                                inlineMode={true}
                                availableMonths={availableMonths}
                                availableYears={availableYears}
                                defaultMonthOpen={true}
                                nullDateActive={isAmazon ? nullDateFilter : false}
                                onNullDate={isAmazon ? handleNullDateSelect : null}
                            />
                        </div>
                    </div>

                    {/* ── Order Month Filter ── */}
                    {orderMonthAmounts && orderMonthAmounts.length > 0 && !nullDateFilter && !isAmazon && (
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                            <div className="flex justify-between items-center mb-3">
                                <h2 className="text-sm font-semibold text-slate-800">Order Month</h2>
                                {selectedOrderMonth !== 'All' && (
                                    <button
                                        onClick={() => { setSelectedOrderMonth('All'); setCardsPage(1); }}
                                        className="text-[11px] font-bold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded"
                                    >
                                        Clear
                                    </button>
                                )}
                            </div>

                            {/* Year Tabs */}
                            <div className="flex gap-1.5 flex-wrap mb-3 border-b border-slate-100 pb-3">
                                {orderAvailableYears.map(year => (
                                    <button
                                        key={year}
                                        onClick={() => setActiveOrderYear(year)}
                                        className={`px-3 py-1 text-[12px] font-bold rounded-lg transition-colors border ${
                                            activeOrderYear === year
                                                ? 'bg-blue-50 text-blue-700 border-blue-200 shadow-sm'
                                                : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50 hover:text-slate-700'
                                        }`}
                                    >
                                        {year === 'NA' ? 'N/A' : year}
                                    </button>
                                ))}
                            </div>

                            {/* Month Pills for selected year */}
                            {activeOrderYear && orderAvailableMonths[activeOrderYear] && (
                                <div className="grid grid-cols-3 gap-1.5">
                                    {orderAvailableMonths[activeOrderYear].map(month => {
                                        const key = `${activeOrderYear}-${month}`;
                                        const isSelected = selectedOrderMonth === key;
                                        return (
                                            <button
                                                key={key}
                                                onClick={() => {
                                                    setSelectedOrderMonth(isSelected ? 'All' : key);
                                                    setCardsPage(1);
                                                }}
                                                className={`py-1.5 text-[12px] font-bold rounded-lg transition-colors border ${
                                                    isSelected
                                                        ? 'bg-blue-50 text-blue-700 border-blue-200 shadow-sm'
                                                        : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50 hover:text-slate-700'
                                                }`}
                                            >
                                                {month === 'NA' ? 'N/A' : MONTHS_SHORT[month - 1]}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                </div>

                {/* ── main content ── */}
                <div className="flex-1 min-w-0">
                    {/* summary cards */}
                    <div className="grid grid-cols-3 gap-4 mb-5">
                        {[
                            { label: 'Total Credits',  value: positive, grad: 'bg-gradient-to-br from-blue-600 to-blue-500' },
                            { label: 'Total Debits',   value: negative, grad: 'bg-gradient-to-br from-red-600 to-red-500' },
                            { label: 'Net Settlement', value: total,    grad: 'bg-gradient-to-br from-green-600 to-green-500' },
                        ].map(c => (
                            <div key={c.label} className={`${c.grad} rounded-xl px-5 py-4 text-white shadow-md flex flex-col justify-center`}>
                                <div className="text-[11px] font-medium opacity-90 mb-1 tracking-wide uppercase">{c.label}</div>
                                <div className="text-[22px] font-extrabold tracking-tight">
                                    {formatCurrency(c.value)}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* active filter info and actions */}
                    <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                        <div className="flex items-center gap-2 text-[12px] text-slate-500 flex-wrap">
                            <Calendar size={13} />
                            {nullDateFilter ? (
                                <span className="px-2.5 py-0.5 rounded-full text-[11px] bg-orange-50 text-orange-700 font-semibold border border-orange-200">
                                    N/A (No Order Date)
                                </span>
                            ) : startDate ? (
                                <span>
                                    <strong className="text-slate-700 font-semibold">{startDate}</strong>
                                    {' '}to{' '}
                                    <strong className="text-slate-700 font-semibold">{endDate}</strong>
                                </span>
                            ) : (
                                <span className="text-slate-400 italic text-[11px]">No date selected</span>
                            )}
                            {startDate && !nullDateFilter && (
                                <>
                                    <span className="text-slate-300">·</span>
                                    <span className="px-2.5 py-0.5 rounded-full text-[11px] bg-blue-50 text-blue-700 font-semibold">
                                        Payment Date
                                    </span>
                                </>
                            )}
                        </div>
                        {['myntra', 'flipkart', 'meesho'].includes(platform) && startDate && (
                            <button
                                onClick={() => navigate('/payments/details', { state: { platform, marketplaceIds: marketplaceFilter, startDate, endDate } })}
                                className={`px-3 py-1.5 text-[12px] font-bold rounded-lg border shadow-sm transition-colors ${accent.bg} ${accent.text} hover:bg-slate-100 ${accent.border}`}
                            >
                                View Payment Details
                            </button>
                        )}
                    </div>

                    {/* settlements table card */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        {loading ? (
                            <div className="p-20 text-center text-slate-500 flex flex-col items-center">
                                <Loader2 size={30} className="animate-spin mb-3 text-blue-500" />
                                <div className="text-[14px]">Loading settlements…</div>
                            </div>
                        ) : error ? (
                            <div className="p-16 text-center text-red-600 text-[14px]">
                                {error}
                            </div>
                        ) : settlements.length === 0 ? (
                            <div className="p-16 text-center text-slate-400 text-[14px]">
                                No settlement data found.
                            </div>
                        ) : (
                            <>
                                {/* header */}
                                <div className="grid grid-cols-[1fr_auto] px-5 py-3 bg-slate-50 border-b-2 border-slate-200">
                                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                                        Settlement Component
                                    </span>
                                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                                        Amount
                                    </span>
                                </div>

                                {/* rows */}
                                {displayedSettlements.map((row, i) => {
                                    const v = parseFloat(row.value) || 0;
                                    const isNeg = v < 0;
                                    const isPos = v > 0;

                                    const rowBg    = isNeg ? 'bg-red-50 hover:bg-red-100'     : isPos ? 'bg-green-50 hover:bg-green-100' : 'bg-white hover:bg-slate-50';
                                    const stripeBg = isNeg ? 'bg-red-500'                      : isPos ? 'bg-green-500'                  : 'bg-slate-300';
                                    const textColor = isNeg ? 'text-red-600'                   : isPos ? 'text-green-600'                : 'text-slate-500';

                                    return (
                                        <div
                                            key={row.name}
                                            className={`grid grid-cols-[1fr_auto] px-5 py-3.5 items-center transition-colors ${rowBg} ${i < displayedSettlements.length - 1 ? 'border-b border-slate-100' : ''}`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={`w-1 h-9 rounded-sm shrink-0 ${stripeBg}`} />
                                                <div className="flex flex-col">
                                                    <div className="text-[14px] font-semibold text-gray-900">
                                                        {row.subItems && row.subItems.length > 0 ? (
                                                            <Tooltip text={
                                                                <div className="flex flex-col gap-1.5 text-left min-w-[250px] p-1">
                                                                    <div className="font-bold border-b border-slate-600 pb-1 mb-1">{row.name} Breakdown</div>
                                                                    {row.subItems.map(item => (
                                                                        <div key={item.name} className="flex justify-between items-center gap-4">
                                                                            <span className="truncate max-w-[200px] opacity-90">{item.name}</span>
                                                                            <span className="font-mono">{formatCurrency(item.value)}</span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            }>
                                                                <span className="border-b border-dashed border-slate-400 cursor-help">{row.name}</span>
                                                            </Tooltip>
                                                        ) : (
                                                            row.name
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className={`text-[15px] font-bold tabular-nums flex items-center gap-1.5 ${textColor}`}>
                                                {isNeg ? '▼' : isPos ? '▲' : '—'}
                                                {formatCurrency(v)}
                                            </div>
                                        </div>
                                    );
                                })}

                                {/* total footer */}
                                <div className="grid grid-cols-[1fr_auto] px-5 py-4 bg-slate-50 border-t-2 border-slate-200 items-center">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-1 h-9 rounded-sm ${total < 0 ? 'bg-red-500' : 'bg-blue-600'}`} />
                                        <span className="text-[15px] font-bold text-gray-900">Net Total</span>
                                    </div>
                                    <div className={`text-[18px] font-extrabold tabular-nums flex items-center gap-1.5 ${total < 0 ? 'text-red-600' : 'text-blue-600'}`}>
                                        {total < 0 ? '▼' : '▲'}
                                        {formatCurrency(total)}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                    
                    {/* Order Month Settlement Cards */}
                    {orderMonthAmounts && orderMonthAmounts.length > 0 && !nullDateFilter && !isAmazon && (
                        <div className="mt-8">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                    <Calendar size={16} className="text-indigo-500" />
                                    Order Month Settlements
                                </h3>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                {(() => {
                                    const filteredCards = selectedOrderMonth === 'All' 
                                        ? orderMonthAmounts 
                                        : orderMonthAmounts.filter(item => `${item.year}-${item.month}` === selectedOrderMonth);
                                    const CARDS_PER_PAGE = 12;
                                    const totalPages = Math.ceil(filteredCards.length / CARDS_PER_PAGE);
                                    const startIndex = (cardsPage - 1) * CARDS_PER_PAGE;
                                    const displayedCards = filteredCards.slice(startIndex, startIndex + CARDS_PER_PAGE);

                                    return (
                                        <>
                                            {displayedCards.map((item, idx) => {
                                                const globalIdx = startIndex + idx;
                                                const val = parseFloat(item.amount) || 0;
                                                const isNeg = val < 0;
                                                const isPos = val > 0;
                                                const valColor = isNeg ? 'text-red-600' : isPos ? 'text-green-600' : 'text-slate-700';
                                                
                                                let bgColor = 'bg-red-100';
                                                if (globalIdx < 3) bgColor = 'bg-green-100';
                                                else if (globalIdx < 6) bgColor = 'bg-orange-100';
                                                
                                                return (
                                                    <div key={`${item.year}-${item.month}`} 
                                                         className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col cursor-pointer hover:shadow-md transition-shadow"
                                                         onClick={() => {
                                                             navigate('/payments/details', { 
                                                                 state: { 
                                                                     platform, 
                                                                     marketplaceIds: marketplaceFilter, 
                                                                     startDate, 
                                                                     endDate,
                                                                     orderMonth: (item.year === 'NA' || item.year == null) ? 'NA' : `${item.year}-${String(item.month).padStart(2, '0')}` 
                                                                 } 
                                                             });
                                                         }}
                                                    >
                                                        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                                                            <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">
                                                                {item.year === 'NA' ? 'N/A' : `${MONTHS_SHORT[item.month - 1]} ${item.year}`}
                                                            </span>
                                                        </div>
                                                        <div className={`px-4 py-5 flex-1 flex flex-col justify-center ${bgColor}`}>
                                                            <div className={`text-xl font-extrabold tabular-nums flex items-center ${valColor}`}>
                                                                {isNeg ? '▼' : isPos ? '▲' : ''}
                                                                {formatCurrency(val)}
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                            {totalPages > 1 && (
                                                <div className="col-span-full flex items-center justify-between mt-2 px-1">
                                                    <div className="text-xs text-slate-500 font-medium">
                                                        Showing <span className="font-bold">{startIndex + 1}</span> to <span className="font-bold">{Math.min(startIndex + CARDS_PER_PAGE, filteredCards.length)}</span> of <span className="font-bold">{filteredCards.length}</span> months
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <button 
                                                            disabled={cardsPage === 1}
                                                            onClick={() => setCardsPage(p => p - 1)}
                                                            className="px-3 py-1.5 text-xs font-bold border border-slate-200 bg-white hover:bg-slate-50 rounded-lg shadow-sm text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                                        >
                                                            Previous
                                                        </button>
                                                        <button 
                                                            disabled={cardsPage === totalPages}
                                                            onClick={() => setCardsPage(p => p + 1)}
                                                            className="px-3 py-1.5 text-xs font-bold border border-slate-200 bg-white hover:bg-slate-50 rounded-lg shadow-sm text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                                        >
                                                            Next
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </>
                                    );
                                })()}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PaymentsSettlements;
