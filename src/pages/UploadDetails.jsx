import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import api from '../api';
import {
    ArrowLeft, Loader2, FileSpreadsheet,
    ChevronLeft, ChevronRight, Download, Search, X
} from 'lucide-react';

// Internal DB columns that should never be shown to end users
const HIDDEN_COLUMNS = new Set([
    'id', 'tenant_id', 'upload_id', 'marketplace_id',
    'raw_data', 'created_at', 'updated_at',
    'file_type_priority', 'arrival_status', 'condition', 'ticket_raised',
]);

const ROWS_PER_PAGE = 100;

const UploadDetails = () => {
    const { uploadId } = useParams();
    const navigate     = useNavigate();

    const [data, setData]                   = useState(null);
    const [loading, setLoading]             = useState(true);
    const [currentPage, setCurrentPage]     = useState(1);
    const [dateRange, setDateRange]         = useState({ start: '', end: '' });
    // Set after the first fetch, based on uploadType ('Orders' for Flipkart
    // payments, 'Order Payments' for Meesho payments) — a hardcoded default
    // would not match the other type's <option> list and render a blank select.
    const [selectedSheet, setSelectedSheet] = useState('');

    // Two search states: one for instant UI, one debounced for API calls
    const [searchInput, setSearchInput]     = useState('');  // what the user types
    const [search, setSearch]               = useState('');   // sent to the backend

    // Debounce: fire API search 400 ms after the user stops typing
    useEffect(() => {
        const timer = setTimeout(() => {
            setSearch(searchInput);
            setCurrentPage(1);
        }, 400);
        return () => clearTimeout(timer);
    }, [searchInput]);

    // Fetch whenever page / date / sheet / debounced search changes
    useEffect(() => {
        fetchDetails();
    }, [uploadId, currentPage, dateRange, selectedSheet, search]);

    // Once the upload type is known, give the sheet selector a valid default
    useEffect(() => {
        const type = data?.upload?.uploadType;
        if (!type || selectedSheet) return;
        if (type === 'payments')        setSelectedSheet('Orders');
        if (type === 'meesho_payments') setSelectedSheet('Order Payments');
         
    }, [data?.upload?.uploadType]);

    const fetchDetails = async () => {
        setLoading(true);
        try {
            const params = { page: currentPage, limit: ROWS_PER_PAGE };
            if (dateRange.start) params.startDate = dateRange.start;
            if (dateRange.end)   params.endDate   = dateRange.end;
            if (search)          params.search    = search;
            if ((data?.upload?.uploadType === 'payments' || data?.upload?.uploadType === 'meesho_payments') && selectedSheet) {
                params.sheet = selectedSheet;
            }
            const { data: response } = await api.get(`/upload/${uploadId}`, { params });
            setData(response);
        } catch (error) {
            console.error('Error fetching upload details', error);
        } finally {
            setLoading(false);
        }
    };

    // Columns to display (all except internal DB columns)
    const visibleColumns = useMemo(() => {
        if (!data?.rows?.length) return [];
        return Object.keys(data.rows[0]).filter(k => !HIDDEN_COLUMNS.has(k));
    }, [data]);

    if (loading && !data) {
        return (
            <DashboardLayout>
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="animate-spin text-brand-600" size={32} />
                </div>
            </DashboardLayout>
        );
    }

    if (!data) {
        return (
            <DashboardLayout>
                <div className="p-8">
                    <p className="text-slate-600">Upload not found.</p>
                </div>
            </DashboardLayout>
        );
    }

    const { total = 0, totalPages = 1, page = 1, rowsPerPage: rpp = ROWS_PER_PAGE } = data;
    const startIndex = (page - 1) * rpp + 1;
    const endIndex   = Math.min(page * rpp, total);

    return (
        <DashboardLayout>
            <div className="p-6 max-w-full">

                {/* Back */}
                <button
                    onClick={() => navigate('/uploads?tab=history')}
                    className="flex items-center gap-2 text-slate-600 hover:text-slate-800 mb-5 transition-colors"
                >
                    <ArrowLeft size={20} />
                    Back to History
                </button>

                {/* Header */}
                <div className="mb-6 flex items-start justify-between gap-4">
                    <div className="min-w-0">
                        <div className="flex items-center gap-3 mb-1">
                            <FileSpreadsheet className="text-brand-600 shrink-0" size={26} />
                            <h1 className="text-xl font-heading font-bold text-slate-800 truncate">
                                {data.upload.fileName}
                            </h1>
                        </div>
                        <p className="text-slate-500 text-sm">
                            {total.toLocaleString()} rows total &nbsp;·&nbsp;
                            Uploaded {new Date(data.upload.createdAt).toLocaleDateString('en-IN', {
                                year: 'numeric', month: 'short', day: 'numeric',
                                hour: '2-digit', minute: '2-digit'
                            })}
                        </p>
                    </div>
                    {data.upload.fileName && data.upload.status === 'completed' && (() => {
                        const isOld = new Date() - new Date(data.upload.createdAt) > 365 * 24 * 60 * 60 * 1000;
                        return (
                            <button
                                disabled={isOld}
                                onClick={async () => {
                                    try {
                                        const { data: dlData } = await api.get(`/upload/${data.upload.uploadId}/download`);
                                        if (dlData.downloadUrl) window.location.assign(dlData.downloadUrl);
                                        else alert('Failed to get download link');
                                    } catch { alert('Failed to get download link'); }
                                }}
                                className={`shrink-0 flex items-center gap-2 px-4 py-2 bg-white text-slate-700 border border-slate-200 rounded-lg text-sm font-medium shadow-sm ${
                                    isOld ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-50 transition-colors'
                                }`}
                                title={isOld ? 'Download expired (older than 365 days)' : 'Download Original File'}
                            >
                                <Download size={16} />
                                Download
                            </button>
                        );
                    })()}
                </div>

                {/* Controls row */}
                <div className="flex flex-wrap items-center gap-3 mb-4 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">

                    {/* Sheet selector — Flipkart payments */}
                    {data.upload.uploadType === 'payments' && (
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-slate-700">Sheet:</span>
                            <select
                                className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
                                value={selectedSheet}
                                onChange={e => { setSelectedSheet(e.target.value); setCurrentPage(1); }}
                            >
                                <option value="Orders">Orders</option>
                                <option value="MP Fee Rebate">MP Fee Rebate</option>
                                <option value="Non_Order_SPF">Non Order SPF</option>
                                <option value="Storage_Recall">Storage Recall</option>
                                <option value="Value Added Services">Value Added Services</option>
                                <option value="Google Ads Services">Google Ads Services</option>
                                <option value="Ads">Ads</option>
                                <option value="TCS_Recovery">TCS Recovery</option>
                                <option value="TDS">TDS</option>
                                <option value="Support Services Services">Support Services Services</option>
                                <option value="Review Accelerator Services">Review Accelerator Services</option>
                                <option value="Insight Subscription Services">Insight Subscription Services</option>
                                <option value="Fines">Fines</option>
                            </select>
                        </div>
                    )}

                    {/* Sheet selector — Meesho payments */}
                    {data.upload.uploadType === 'meesho_payments' && (
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-slate-700">Sheet:</span>
                            <select
                                className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
                                value={selectedSheet}
                                onChange={e => { setSelectedSheet(e.target.value); setCurrentPage(1); }}
                            >
                                <option value="Order Payments">Order Payments</option>
                                <option value="Ads Cost">Ads Cost</option>
                                <option value="Referral Payments">Referral Payments</option>
                                <option value="Compensation and Recovery">Compensation and Recovery</option>
                            </select>
                        </div>
                    )}

                    {/* Date range filter */}
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-700">Date:</span>
                        <input
                            type="date"
                            className="px-2 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                            value={dateRange.start}
                            onChange={e => { setDateRange(p => ({ ...p, start: e.target.value })); setCurrentPage(1); }}
                        />
                        <span className="text-slate-400 text-xs">–</span>
                        <input
                            type="date"
                            className="px-2 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                            value={dateRange.end}
                            onChange={e => { setDateRange(p => ({ ...p, end: e.target.value })); setCurrentPage(1); }}
                        />
                        {(dateRange.start || dateRange.end) && (
                            <button
                                onClick={() => { setDateRange({ start: '', end: '' }); setCurrentPage(1); }}
                                className="text-sm text-red-600 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50 transition-colors"
                            >
                                Clear
                            </button>
                        )}
                    </div>

                    {/* Search — backend full-dataset search with debounce */}
                    <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                        <div className="relative flex-1">
                            {loading && searchInput
                                ? <Loader2 size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-brand-500 animate-spin" />
                                : <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                            }
                            <input
                                type="text"
                                placeholder="Search in upload…"
                                value={searchInput}
                                onChange={e => setSearchInput(e.target.value)}
                                className="w-full pl-8 pr-7 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
                            />
                            {searchInput && (
                                <button
                                    onClick={() => { setSearchInput(''); setSearch(''); }}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                >
                                    <X size={14} />
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Pagination — top */}
                <PaginationBar
                    page={currentPage}
                    totalPages={totalPages}
                    startIndex={startIndex}
                    endIndex={endIndex}
                    total={total}
                    search={search}
                    loading={loading}
                    onPrev={() => setCurrentPage(p => p - 1)}
                    onNext={() => setCurrentPage(p => p + 1)}
                />

                {/* Table */}
                <div className="mt-3 bg-white rounded-2xl shadow-sm border border-slate-200">
                    <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-315px)]">
                        <table className="min-w-full text-sm">
                            <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                                <tr>
                                    {visibleColumns.map(key => (
                                        <th
                                            key={key}
                                            className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide whitespace-nowrap"
                                        >
                                            {key.replace(/_/g, ' ')}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {(!data?.rows?.length) ? (
                                    <tr>
                                        <td colSpan={visibleColumns.length || 1} className="px-4 py-10 text-center text-slate-400 text-sm">
                                            {search ? `No rows match "${search}".` : 'No data found.'}
                                        </td>
                                    </tr>
                                ) : (
                                    data.rows.map((row, idx) => (
                                        <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                            {visibleColumns.map(key => (
                                                <td key={key} className="px-4 py-2.5 text-sm text-slate-700 whitespace-nowrap max-w-[300px] truncate">
                                                    {typeof row[key] === 'object' && row[key] !== null
                                                        ? JSON.stringify(row[key])
                                                        : row[key] == null ? <span className="text-slate-300">—</span> : String(row[key])}
                                                </td>
                                            ))}
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Pagination — bottom */}
                <div className="mt-3">
                    <PaginationBar
                        page={currentPage}
                        totalPages={totalPages}
                        startIndex={startIndex}
                        endIndex={endIndex}
                        total={total}
                        search={search}
                        loading={loading}
                        onPrev={() => setCurrentPage(p => p - 1)}
                        onNext={() => setCurrentPage(p => p + 1)}
                    />
                </div>
            </div>
        </DashboardLayout>
    );
};

const PaginationBar = ({ page, totalPages, startIndex, endIndex, total, search, loading, onPrev, onNext }) => (
    <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
            {loading
                ? <span className="flex items-center gap-1.5"><Loader2 size={13} className="animate-spin" />{search ? 'Searching…' : 'Loading…'}</span>
                : search
                    ? `${total.toLocaleString()} result${total !== 1 ? 's' : ''} for "${search}" — rows ${startIndex}–${endIndex}`
                    : `Rows ${startIndex}–${endIndex} of ${total.toLocaleString()}`}
        </p>
        <div className="flex items-center gap-1">
            <button
                onClick={onPrev}
                disabled={page <= 1 || loading}
                className="p-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
                <ChevronLeft size={16} />
            </button>
            <span className="text-sm text-slate-600 px-3">Page {page} of {totalPages}</span>
            <button
                onClick={onNext}
                disabled={page >= totalPages || loading}
                className="p-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
                <ChevronRight size={16} />
            </button>
        </div>
    </div>
);

export default UploadDetails;
