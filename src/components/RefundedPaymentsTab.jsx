/* eslint-disable no-unused-vars -- this client's eslint config lacks react/jsx-uses-vars, so
   JSX-only usage of these imports false-positives as unused (see ListingStudioPlansManager.jsx). */
import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Search, Loader2, RotateCw, RotateCcw, FileSpreadsheet, ChevronLeft, ChevronRight, AlertTriangle, CheckCircle, Clock, XCircle } from 'lucide-react';
import api from '../api';

const STATUS_BADGE = {
    processed: { cls: 'text-green-700 bg-green-50 border-green-200', Icon: CheckCircle, label: 'Processed' },
    pending: { cls: 'text-amber-700 bg-amber-50 border-amber-200', Icon: Clock, label: 'Pending' },
    failed: { cls: 'text-red-700 bg-red-50 border-red-200', Icon: XCircle, label: 'Failed' },
};

const COLUMNS = 8;

const getPageNumbers = (current, total) => {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const pages = [1];
    if (current > 3) pages.push('...');
    const start = Math.max(2, current - 1);
    const end = Math.min(total - 1, current + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    if (current < total - 2) pages.push('...');
    pages.push(total);
    return pages;
};

const formatDate = (d) => {
    if (!d) return '—';
    const dt = new Date(d);
    return `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}/${dt.getFullYear()}`;
};

const formatTime = (d) => (d ? new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '');

const money = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

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

    const hasFilters = status !== 'all' || needsReview || startDate || endDate || search;

    return (
        <>
            <div className="space-y-3">
                <h3 className="text-lg font-heading font-bold text-slate-800 flex items-center gap-2">
                    <RotateCcw size={18} className="text-[#1a2c5e]" />
                    Refunded Payments
                    <span className="text-sm font-normal text-slate-400">({pagination.total})</span>
                </h3>
                <p className="text-xs text-slate-500">
                    Payments refunded by Razorpay. They never receive an invoice number, so the invoice series is not affected.
                </p>

                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="relative flex-1 max-w-xs">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search by payment, refund, order id or tenant..."
                            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-400"
                        />
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <select
                            value={status}
                            onChange={(e) => setStatus(e.target.value)}
                            className="px-2.5 py-1.5 text-xs font-bold rounded-lg border border-slate-200 bg-white text-slate-600 focus:outline-none"
                        >
                            <option value="all">All statuses</option>
                            <option value="processed">Processed</option>
                            <option value="pending">Pending</option>
                            <option value="failed">Failed</option>
                        </select>
                        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-white text-slate-600" />
                        <span className="text-xs text-slate-400">to</span>
                        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-white text-slate-600" />
                        <button
                            onClick={() => setNeedsReview((v) => !v)}
                            className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold rounded-lg border transition-colors ${
                                needsReview ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                            }`}
                        >
                            <AlertTriangle size={12} />
                            Needs review
                        </button>
                        {hasFilters && (
                            <button
                                onClick={() => { setSearch(''); setStatus('all'); setNeedsReview(false); setStartDate(''); setEndDate(''); }}
                                className="text-xs font-bold text-slate-500 hover:text-slate-700 transition-colors"
                            >
                                Clear
                            </button>
                        )}
                        <button
                            onClick={() => fetchRefunds(pagination.page)}
                            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors"
                        >
                            <RotateCw size={12} />
                            Refresh
                        </button>
                        {canExport && (
                            <button
                                onClick={handleExport}
                                disabled={exporting}
                                className="px-3 py-1.5 text-xs font-bold rounded-lg bg-brand-600 text-white hover:bg-brand-700 transition-colors flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {exporting ? <Loader2 size={12} className="animate-spin" /> : <FileSpreadsheet size={12} />}
                                Export
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full table-fixed">
                        <thead>
                            <tr className="border-b border-slate-200 bg-[#1a2c5e]/10">
                                <th className="py-3.5 px-4 text-left" style={{ width: 110 }}><span className="text-[11px] font-bold uppercase tracking-wider text-black">Refund Date</span></th>
                                <th className="py-3.5 px-3 text-left" style={{ width: 190 }}><span className="text-[11px] font-bold uppercase tracking-wider text-black">Tenant</span></th>
                                <th className="py-3.5 px-3 text-left" style={{ width: 210 }}><span className="text-[11px] font-bold uppercase tracking-wider text-black">Payment</span></th>
                                <th className="py-3.5 px-3 text-left" style={{ width: 190 }}><span className="text-[11px] font-bold uppercase tracking-wider text-black">Refund ID</span></th>
                                <th className="py-3.5 px-3 text-right" style={{ width: 110 }}><span className="text-[11px] font-bold uppercase tracking-wider text-black">Paid</span></th>
                                <th className="py-3.5 px-3 text-right" style={{ width: 120 }}><span className="text-[11px] font-bold uppercase tracking-wider text-black">Refunded</span></th>
                                <th className="py-3.5 px-3 text-center" style={{ width: 130 }}><span className="text-[11px] font-bold uppercase tracking-wider text-black">Status</span></th>
                                <th className="py-3.5 px-2 text-right" style={{ width: 60 }}><span className="text-[11px] font-bold uppercase tracking-wider text-black">Sync</span></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        {[50, 70, 80, 80, 60, 60, 60, 30].map((w, j) => (
                                            <td key={j} className="py-4 px-6">
                                                <div className="h-4 bg-slate-200 rounded" style={{ width: `${w}%` }}></div>
                                            </td>
                                        ))}
                                    </tr>
                                ))
                            ) : rows.length === 0 ? (
                                <tr>
                                    <td colSpan={COLUMNS} className="py-16 text-center">
                                        <div className="p-4 bg-slate-100 rounded-2xl inline-flex mb-4">
                                            <RotateCcw className="w-10 h-10 text-slate-400" />
                                        </div>
                                        <p className="font-semibold text-slate-700">No refunded payments found</p>
                                        <p className="text-sm text-slate-500 mt-1">{hasFilters ? 'Try adjusting your filters' : 'Payments refunded by Razorpay will appear here'}</p>
                                    </td>
                                </tr>
                            ) : rows.map((row) => {
                                const badge = STATUS_BADGE[row.refundStatus] || STATUS_BADGE.pending;
                                return (
                                    <tr key={row._id} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="py-4 px-4">
                                            <span className="text-sm text-slate-600">
                                                {formatDate(row.refundedAt)}
                                                <br />
                                                <span className="text-[11px] text-slate-400">{formatTime(row.refundedAt)}</span>
                                            </span>
                                        </td>
                                        <td className="py-4 px-3">
                                            <p className="text-sm font-semibold text-slate-800 truncate" title={row.tenantName || ''}>
                                                {row.tenantCode ? `${row.tenantCode} - ` : ''}{row.tenantName || '—'}
                                            </p>
                                            {row.email && <p className="text-xs text-slate-400 truncate" title={row.email}>{row.email}</p>}
                                        </td>
                                        <td className="py-4 px-3">
                                            <p className="text-sm font-medium text-slate-700 truncate">{row.planName || '—'}</p>
                                            <p className="text-[10px] text-slate-400 font-mono truncate" title={row.paymentId}>{row.paymentId}</p>
                                            {row.method && <p className="text-[10px] text-slate-400 uppercase">{row.method}</p>}
                                        </td>
                                        <td className="py-4 px-3">
                                            <span className="text-[11px] text-slate-500 font-mono break-all">{row.refundId}</span>
                                        </td>
                                        <td className="py-4 px-3 text-right">
                                            <span className="text-sm font-semibold text-slate-600">{money(row.paymentAmount)}</span>
                                        </td>
                                        <td className="py-4 px-3 text-right">
                                            <span className="text-sm font-semibold text-red-600">{money(row.refundAmount)}</span>
                                            {!row.isFullRefund && (
                                                <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-500">Partial</p>
                                            )}
                                        </td>
                                        <td className="py-4 px-3 text-center">
                                            <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full border ${badge.cls}`}>
                                                <badge.Icon size={11} /> {badge.label}
                                            </span>
                                            {row.needsReview && (
                                                <p className="mt-1 flex items-center justify-center gap-1 text-[10px] font-bold text-amber-600 cursor-help" title={row.note}>
                                                    <AlertTriangle size={10} /> Needs review
                                                </p>
                                            )}
                                            {row.linkedInvoiceId && <p className="mt-1 text-[10px] text-slate-400">Had an invoice</p>}
                                        </td>
                                        <td className="py-4 px-2 text-right">
                                            <button
                                                onClick={() => handleSync(row)}
                                                disabled={syncingId === row._id}
                                                title="Re-check status with Razorpay"
                                                className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 transition-colors disabled:opacity-50"
                                            >
                                                {syncingId === row._id ? <Loader2 size={14} className="animate-spin" /> : <RotateCw size={14} />}
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {!loading && pagination.totalPages > 1 && (
                    <div className="flex items-center justify-between px-6 py-3 border-t border-slate-100">
                        <span className="text-sm text-slate-500">
                            {pagination.total} refund{pagination.total !== 1 ? 's' : ''}
                        </span>
                        <div className="flex items-center gap-1.5">
                            <button
                                onClick={() => fetchRefunds(1)}
                                disabled={pagination.page === 1}
                                className="px-3 h-8 text-xs font-semibold rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                            >
                                First
                            </button>
                            <button
                                onClick={() => fetchRefunds(pagination.page - 1)}
                                disabled={pagination.page === 1}
                                className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                            >
                                <ChevronLeft size={16} />
                            </button>
                            {getPageNumbers(pagination.page, pagination.totalPages).map((p, i) => (
                                p === '...' ? (
                                    <span key={`e${i}`} className="text-xs text-slate-400 px-1">...</span>
                                ) : (
                                    <button
                                        key={p}
                                        onClick={() => fetchRefunds(p)}
                                        className={`min-w-[32px] h-8 text-xs font-semibold rounded-lg border transition-colors ${
                                            p === pagination.page
                                                ? 'bg-[#1a2c5e] text-white border-[#1a2c5e] shadow-sm'
                                                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                                        }`}
                                    >
                                        {p}
                                    </button>
                                )
                            ))}
                            <button
                                onClick={() => fetchRefunds(pagination.page + 1)}
                                disabled={pagination.page === pagination.totalPages}
                                className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                            >
                                <ChevronRight size={16} />
                            </button>
                            <button
                                onClick={() => fetchRefunds(pagination.totalPages)}
                                disabled={pagination.page === pagination.totalPages}
                                className="px-3 h-8 text-xs font-semibold rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                            >
                                Last
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
};

export default RefundedPaymentsTab;
