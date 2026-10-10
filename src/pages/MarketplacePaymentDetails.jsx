import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Loader2, Calendar, ArrowUp, ArrowDown, Download } from 'lucide-react';
import api from '../api';
import ExportButton from '../components/ExportButton';

const formatCurrency = (v) => {
    const n = parseFloat(v) || 0;
    return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const getToday    = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
const get90DaysAgo= () => { const d = new Date(); d.setDate(d.getDate()-90); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };

const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// Configuration for dynamic columns per platform
const PLATFORM_CONFIG = {
    myntra: {
        title: 'Myntra Payment Details',
        exportType: 'myntra_payment_details',
        columns: [
            { key: 'payment_date', label: 'Payment Date', align: 'left', format: 'date' },
            { key: 'prepaid', label: 'Prepaid', align: 'right', format: 'currency' },
            { key: 'postpaid', label: 'Postpaid', align: 'right', format: 'currency' },
            { key: 'nod', label: 'Nod', align: 'right', format: 'currency' },
            { key: 'settlement', label: 'Settlement', align: 'right', format: 'currency', bold: true }
        ]
    },
    flipkart: {
        title: 'Flipkart Payment Details',
        exportType: 'flipkart_payment_details',
        columns: [
            { key: 'payment_date', label: 'Payment Date', align: 'left', format: 'date' },
            { key: 'orders_settlement', label: 'Orders Settlement', align: 'right', format: 'currency' },
            { key: 'mp_fee_settlement', label: 'MP Fee Settlement', align: 'right', format: 'currency' },
            { key: 'tds', label: 'TDS', align: 'right', format: 'currency' },
            { key: 'non_order_spf', label: 'Non Order SPF', align: 'right', format: 'currency' },
            { key: 'tcs_recovery', label: 'TCS Recovery', align: 'right', format: 'currency' },
            { key: 'storage_recall', label: 'Storage & Recall', align: 'right', format: 'currency' },
            { key: 'value_added_services', label: 'Value Added Services', align: 'right', format: 'currency' },
            { key: 'ads', label: 'Ads', align: 'right', format: 'currency' },
            { key: 'settlement', label: 'Settlement', align: 'right', format: 'currency', bold: true }
        ]
    },
    meesho: {
        title: 'Meesho Payment Details',
        exportType: 'meesho_payment_details',
        columns: [
            { key: 'payment_date', label: 'Payment Date', align: 'left', format: 'date' },
            { key: 'orders_settlement', label: 'Orders Settlement', align: 'right', format: 'currency' },
            { key: 'ads_cost', label: 'Ads Cost', align: 'right', format: 'currency' },
            { key: 'referral', label: 'Referral', align: 'right', format: 'currency' },
            { key: 'compensation_recovery', label: 'Comp. & Recovery', align: 'right', format: 'currency' },
            { key: 'settlement', label: 'Settlement', align: 'right', format: 'currency', bold: true }
        ]
    },
    amazon: {
        title: 'Amazon Payment Details',
        exportType: 'amazon_payment_details',
        columns: [
            { key: 'payment_date', label: 'Payment Date', align: 'left', format: 'date' },
            { key: 'settlement', label: 'Settlement', align: 'right', format: 'currency', bold: true }
        ]
    }
};

const MarketplacePaymentDetails = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const navState = location.state || {};

    const [marketplaceFilter] = useState(navState.marketplaceIds || null);
    const platform = navState.platform || 'myntra';
    
    const config = PLATFORM_CONFIG[platform] || PLATFORM_CONFIG.myntra;

    const [startDate] = useState(navState.startDate || localStorage.getItem('payments_startDate') || get90DaysAgo());
    const [endDate]   = useState(navState.endDate   || localStorage.getItem('payments_endDate') || getToday());

    useEffect(() => {
        if (startDate) localStorage.setItem('payments_startDate', startDate);
        else localStorage.removeItem('payments_startDate');

        if (endDate) localStorage.setItem('payments_endDate', endDate);
        else localStorage.removeItem('payments_endDate');
    }, [startDate, endDate]);

    const [details, setDetails] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Sorting state
    const [sortConfig, setSortConfig] = useState({ key: 'payment_date', direction: 'desc' });

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 10;



    const fetchDetails = useCallback(async () => {
        const hasMarketplaceFilters = Array.isArray(marketplaceFilter) ? marketplaceFilter.length > 0 : Boolean(marketplaceFilter);
        if (!startDate || !endDate || !hasMarketplaceFilters) {
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const params = {
                startDate,
                endDate,
                marketplaceIds: JSON.stringify(marketplaceFilter)
            };
            if (navState.orderMonth) {
                params.orderMonth = navState.orderMonth;
            }
            const { data } = await api.get('/payments/settlements/details', { params });
            if (data && data.details) {
                setDetails(data.details);
            } else {
                setError('Failed to fetch details');
            }
        } catch (err) {
            setError(err.response?.data?.message || err.message || 'Server error');
        } finally {
            setLoading(false);
        }
    }, [startDate, endDate, marketplaceFilter]);

    useEffect(() => {
        fetchDetails();
    }, [fetchDetails]);



    // Apply sorting
    let filteredDetails = [...details];
    filteredDetails.sort((a, b) => {
        let valA, valB;
        if (sortConfig.key === 'payment_date') {
            valA = a.payment_date || '';
            valB = b.payment_date || '';
        } else {
            valA = parseFloat(a[sortConfig.key] || 0);
            valB = parseFloat(b[sortConfig.key] || 0);
        }

        if (valA < valB) {
            return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (valA > valB) {
            return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
    });

    // Reset pagination to page 1 when filters or sort change
    useEffect(() => {
        setCurrentPage(1);
    }, [startDate, endDate, sortConfig]);

    const totalSettlement = filteredDetails.reduce((acc, row) => acc + parseFloat(row.settlement || 0), 0);

    const requestSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const totalPages = Math.ceil(filteredDetails.length / ITEMS_PER_PAGE);
    const paginatedDetails = filteredDetails.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

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
                    <h1 className="m-0 text-[17px] font-bold text-gray-900 flex items-center">
                        {config.title}
                        {navState.orderMonth && (
                            <span className="ml-3 text-sm font-medium text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100">
                                Order Month: {navState.orderMonth === 'NA' ? 'N/A' : `${MONTHS_SHORT[parseInt(navState.orderMonth.split('-')[1]) - 1]} ${navState.orderMonth.split('-')[0]}`}
                            </span>
                        )}
                    </h1>
                </div>
                <div className="flex items-center gap-3">
                    <ExportButton
                        exportType={config.exportType}
                        marketplaceId={marketplaceFilter && Array.isArray(marketplaceFilter) && marketplaceFilter.length > 0 ? marketplaceFilter : null}
                        startDate={startDate}
                        endDate={endDate}
                        orderMonth={navState.orderMonth}
                        buttonText="Export"
                        buttonClassName="bg-white !text-slate-700 border border-slate-200 hover:bg-slate-50 text-[13px] !px-3.5 !py-1.5 shadow-sm"
                        disabled={loading}
                    />
                </div>
            </div>

            {/* ── body ── */}
            <div className="flex gap-[18px] px-6 py-5 items-start max-w-[1320px] mx-auto">


                {/* ── main content ── */}
                <div className="flex-1 min-w-0">
                    {/* Error */}
                    {error && (
                        <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg border border-red-200 mb-4 text-sm">
                            {error}
                        </div>
                    )}

                    {/* active filter info and actions */}
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2 text-[12px] text-slate-500">
                            <Calendar size={13} />
                            <span><strong className="text-slate-700 font-semibold">{startDate}</strong> to <strong className="text-slate-700 font-semibold">{endDate}</strong></span>
                        </div>
                        <div className="text-[12px] text-slate-500 font-medium">
                            Showing <strong className="text-slate-800">{filteredDetails.length}</strong> records
                        </div>
                    </div>

                    {/* Table */}
                    <div className="bg-white border border-slate-200 shadow-sm rounded-xl overflow-hidden flex flex-col relative min-h-[400px]">
                        {loading && (
                            <div className="absolute inset-0 z-10 bg-white/60 backdrop-blur-sm flex items-center justify-center">
                                <Loader2 className="animate-spin text-blue-600" size={32} />
                            </div>
                        )}
                        
                        <div className="flex items-center justify-between p-4 bg-slate-50 border-b border-slate-200">
                             <span className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Detailed View</span>
                             <div className="text-sm font-bold text-slate-800 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm">
                                 Total Settlement: <span className={totalSettlement >= 0 ? 'text-green-600' : 'text-red-600 ml-1'}>{formatCurrency(totalSettlement)}</span>
                             </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse min-w-full">
                                <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                                    <tr>
                                        {config.columns.map((col) => (
                                            <th 
                                                key={col.key}
                                                className={`py-3 px-6 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200 cursor-pointer hover:bg-slate-100 transition-colors ${col.align === 'right' ? 'text-right' : 'text-left'}`}
                                                onClick={() => requestSort(col.key)}
                                            >
                                                <div className={`flex items-center gap-1 ${col.align === 'right' ? 'justify-end' : ''}`}>
                                                    {col.label}
                                                    {sortConfig.key === col.key && (
                                                        sortConfig.direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                                                    )}
                                                </div>
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filteredDetails.length === 0 && !loading && !error && (
                                        <tr>
                                            <td colSpan={config.columns.length} className="py-12 text-center text-slate-400 text-[13px] font-medium bg-slate-50/50">
                                                No payment details found for the selected filters.
                                            </td>
                                        </tr>
                                    )}
                                    {paginatedDetails.map((row, idx) => {
                                        return (
                                            <tr key={idx} className="hover:bg-slate-50 transition-colors group">
                                                {config.columns.map(col => {
                                                    const rawVal = row[col.key];
                                                    let displayVal = '—';
                                                    let cellClass = `py-3.5 px-6 text-[13px] ${col.align === 'right' ? 'text-right' : 'text-left'}`;
                                                    
                                                    if (col.format === 'date' && rawVal) {
                                                        const [y, m, d] = rawVal.split('T')[0].split('-');
                                                        displayVal = new Date(y, m - 1, d).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
                                                        cellClass += " text-slate-700 font-medium whitespace-nowrap group-hover:text-blue-700 transition-colors";
                                                    } else if (col.format === 'currency') {
                                                        const num = parseFloat(rawVal || 0);
                                                        displayVal = formatCurrency(num);
                                                        cellClass += col.bold ? " font-bold tracking-tight" : " font-semibold";
                                                        cellClass += num >= 0 ? ' text-green-600' : ' text-red-600';
                                                    } else {
                                                        displayVal = rawVal !== undefined ? rawVal : '—';
                                                        cellClass += " text-slate-700 font-medium";
                                                    }

                                                    return (
                                                        <td key={col.key} className={cellClass}>
                                                            {displayVal}
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                        
                        {/* Pagination Controls */}
                        {totalPages > 1 && (
                            <div className="flex items-center justify-between px-6 py-3 bg-white border-t border-slate-200">
                                <div className="text-[12px] text-slate-500 font-medium">
                                    Showing <strong className="text-slate-800">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</strong> to <strong className="text-slate-800">{Math.min(currentPage * ITEMS_PER_PAGE, filteredDetails.length)}</strong> of <strong className="text-slate-800">{filteredDetails.length}</strong> entries
                                </div>
                                <div className="flex items-center gap-1">
                                    <button
                                        disabled={currentPage === 1}
                                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                        className="px-2.5 py-1.5 rounded bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed text-[12px] font-semibold transition-colors"
                                    >
                                        Prev
                                    </button>
                                    
                                    <div className="flex gap-1 px-2">
                                        {[...Array(Math.min(5, totalPages))].map((_, i) => {
                                            let pageNum = currentPage;
                                            if (currentPage <= 3) pageNum = i + 1;
                                            else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                                            else pageNum = currentPage - 2 + i;
                                            
                                            if (pageNum > 0 && pageNum <= totalPages) {
                                                return (
                                                    <button
                                                        key={pageNum}
                                                        onClick={() => setCurrentPage(pageNum)}
                                                        className={`w-7 h-7 rounded flex items-center justify-center text-[12px] font-bold transition-colors ${
                                                            currentPage === pageNum
                                                                ? 'bg-blue-50 text-blue-600 border border-blue-200'
                                                                : 'bg-white text-slate-500 hover:bg-slate-50 border border-transparent hover:border-slate-200'
                                                        }`}
                                                    >
                                                        {pageNum}
                                                    </button>
                                                )
                                            }
                                            return null;
                                        })}
                                    </div>

                                    <button
                                        disabled={currentPage === totalPages}
                                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                        className="px-2.5 py-1.5 rounded bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed text-[12px] font-semibold transition-colors"
                                    >
                                        Next
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MarketplacePaymentDetails;
