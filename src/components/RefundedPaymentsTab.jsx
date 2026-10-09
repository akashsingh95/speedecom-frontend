/* eslint-disable no-unused-vars -- this client's eslint config lacks react/jsx-uses-vars, so
   JSX-only usage of these imports false-positives as unused (see ListingStudioPlansManager.jsx). */
import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Search, Loader2, RotateCw, RotateCcw, FileSpreadsheet, ChevronLeft, ChevronRight, AlertTriangle } from 'lucide-react';
import api from '../api';

const STATUS_STYLES = {
    processed: 'bg-emerald-100 text-emerald-700',
    pending: 'bg-amber-100 text-amber-700',
    failed: 'bg-red-100 text-red-700',
};

const formatDate = (d) => (d
    ? new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '—');

const RefundedPaymentsTab = ({ canExport }) => {
    const [rows, setRows] = useState([]);
    const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 10, totalPages: 1 });
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [status, setStatus] = useState('all');
    const [needsReview, setNeedsReview] = useState(false);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [syncingId, setSyncingId] = useState(null);
    const [exporting, setExporting] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(search), 400);
        return () => clearTimeout(timer);
    }, [search]);

    const buildParams = useCallback(() => {
        const params = {};
        if (debouncedSearch) params.q = debouncedSearch;
        if (status !== 'all') params.status = status;
        if (needsReview) params.needsReview = 'true';
        if (startDate) params.startDate = startDate;
        if (endDate) params.endDate = endDate;
        return params;
    }, [debouncedSearch, status, needsReview, startDate, endDate]);

    const fetchRefunds = useCallback(async (page = 1) => {
        setLoading(true);
        try {
            const { data } = await api.get('/admin/invoices/refunded-payments', { params: { ...buildParams(), page, limit: 10 } });
            setRows(data.refunds);
            setPagination(data.pagination);
        } catch {
            toast.error('Failed to load refunded payments');
        } finally {
            setLoading(false);
        }
    }, [buildParams]);

    useEffect(() => { fetchRefunds(1); }, [fetchRefunds]);

    const handleSync = async (row) => {
        setSyncingId(row._id);
        try {
            const { data } = await api.post(`/admin/invoices/refunded-payments/${row._id}/sync`);
            toast.success(data?.message || 'Synced');
            fetchRefunds(pagination.page);
        } catch {
            toast.error('Failed to sync with Razorpay');
        } finally {
            setSyncingId(null);
        }
    };

    const handleExport = async () => {
        setExporting(true);
        try {
            const response = await api.get('/admin/invoices/refunded-payments/export-excel', { params: buildParams(), responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
            const link = document.createElement('a');
            link.href = url;
            link.download = `Refunded-Payments-${new Date().toISOString().slice(0, 10)}.xlsx`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
        } catch {
            toast.error('Failed to export Excel');
        } finally {
            setExporting(false);
        }
    };

    return (
        <div className="space-y-3">
            <h3 className="text-lg font-heading font-bold text-slate-800 flex items-center gap-2">
                <RotateCcw size={18} className="text-blue-600" />
                Refunded Payments
                <span className="text-xs font-semibold text-slate-400">{pagination.total}</span>
            </h3>
            <p className="text-xs text-slate-500">
                Payments refunded by Razorpay. These never receive an invoice number, so they do not affect the invoice series.
            </p>

            <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Payment / refund / order id, email, tenant"
                        className="pl-8 pr-3 py-1.5 text-sm rounded-lg border border-slate-200 w-72 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                    />
                </div>
                <select value={status} onChange={(e) => setStatus(e.target.value)} className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 bg-white">
                    <option value="all">All statuses</option>
                    <option value="pending">Pending</option>
                    <option value="processed">Processed</option>
                    <option value="failed">Failed</option>
                </select>
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="px-3 py-1.5 text-sm rounded-lg border border-slate-200" />
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="px-3 py-1.5 text-sm rounded-lg border border-slate-200" />
                <label className="flex items-center gap-1.5 text-sm text-slate-600 cursor-pointer">
                    <input type="checkbox" checked={needsReview} onChange={(e) => setNeedsReview(e.target.checked)} />
                    Needs review
                </label>
                {canExport && (
                    <button
                        onClick={handleExport}
                        disabled={exporting}
                        className="ml-auto px-3 py-1.5 text-xs font-bold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {exporting ? <Loader2 size={12} className="animate-spin" /> : <FileSpreadsheet size={12} />}
                        Excel
                    </button>
                )}
            </div>

            <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead>
                        <tr className="border-b border-slate-200 bg-blue-500/10 text-xs uppercase text-slate-600">
                            <th className="px-4 py-3">Refund Date</th>
                            <th className="px-4 py-3">Tenant</th>
                            <th className="px-4 py-3">Plan</th>
                            <th className="px-4 py-3">Payment ID</th>
                            <th className="px-4 py-3">Refund ID</th>
                            <th className="px-4 py-3">Paid</th>
                            <th className="px-4 py-3">Refunded</th>
                            <th className="px-4 py-3">Status</th>
                            <th className="px-4 py-3"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {loading ? (
                            <tr><td colSpan={9} className="px-4 py-10 text-center text-slate-400"><Loader2 size={18} className="animate-spin inline" /></td></tr>
                        ) : rows.length === 0 ? (
                            <tr><td colSpan={9} className="px-4 py-10 text-center text-slate-500">No refunded payments found</td></tr>
                        ) : rows.map((row) => (
                            <tr key={row._id} className="hover:bg-slate-50/70 transition-colors">
                                <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{formatDate(row.refundedAt)}</td>
                                <td className="px-4 py-3">
                                    <div className="font-semibold text-slate-800">{row.tenantName || '—'}</div>
                                    <div className="text-xs text-slate-400">{row.tenantCode || ''}</div>
                                </td>
                                <td className="px-4 py-3 text-slate-600">{row.planName || '—'}</td>
                                <td className="px-4 py-3 font-mono text-xs text-slate-600">{row.paymentId}</td>
                                <td className="px-4 py-3 font-mono text-xs text-slate-600">{row.refundId}</td>
                                <td className="px-4 py-3 text-slate-600">₹{row.paymentAmount.toFixed(2)}</td>
                                <td className="px-4 py-3 font-bold text-slate-800">
                                    ₹{row.refundAmount.toFixed(2)}
                                    {!row.isFullRefund && <span className="ml-1 text-[10px] font-semibold text-amber-600">partial</span>}
                                </td>
                                <td className="px-4 py-3">
                                    <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-bold capitalize ${STATUS_STYLES[row.refundStatus] || ''}`}>
                                        {row.refundStatus}
                                    </span>
                                    {row.needsReview && (
                                        <div className="mt-1 flex items-center gap-1 text-[10px] text-amber-600" title={row.note}>
                                            <AlertTriangle size={10} /> Needs review
                                        </div>
                                    )}
                                    {row.linkedInvoiceId && <div className="mt-1 text-[10px] text-slate-400">Had an invoice</div>}
                                </td>
                                <td className="px-4 py-3">
                                    <button
                                        onClick={() => handleSync(row)}
                                        disabled={syncingId === row._id}
                                        title="Re-check status with Razorpay"
                                        className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors disabled:opacity-50"
                                    >
                                        {syncingId === row._id ? <Loader2 size={14} className="animate-spin" /> : <RotateCw size={14} />}
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {pagination.totalPages > 1 && (
                <div className="flex items-center justify-end gap-2">
                    <button
                        onClick={() => fetchRefunds(pagination.page - 1)}
                        disabled={pagination.page === 1}
                        className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        <ChevronLeft size={16} />
                    </button>
                    <span className="text-xs text-slate-500">Page {pagination.page} of {pagination.totalPages}</span>
                    <button
                        onClick={() => fetchRefunds(pagination.page + 1)}
                        disabled={pagination.page === pagination.totalPages}
                        className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        <ChevronRight size={16} />
                    </button>
                </div>
            )}
        </div>
    );
};

export default RefundedPaymentsTab;
