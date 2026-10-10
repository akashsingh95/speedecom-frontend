import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Search, X, Ticket, Lock, AlertTriangle, PartyPopper, Info, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import api from '../../../api';
import { ClaimStatusBadge, CopyButton, fmtDateOnly } from './claimUi';

const PAGE_SIZE = 25;

const CATEGORY_FILTERS = [
    { key: '', label: 'All' },
    { key: 'rto', label: 'RTO' },
    { key: 'customer', label: 'Customer returns' },
];

const COURIER_STATUS = {
    intransit: { label: 'In transit', cls: 'bg-cyan-50 text-cyan-700' },
    ofd: { label: 'Out for delivery', cls: 'bg-amber-50 text-amber-700' },
};

const isRto = (row) => /rto/i.test(String(row.type_of_return || ''));

const SkeletonRows = () => (
    <div className="divide-y divide-slate-100">
        {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-4">
                {[220, 150, 80, 90, 70, 100].map((w, j) => (
                    <div key={j} className="h-3.5 animate-pulse rounded bg-slate-100" style={{ width: w, animationDelay: `${(i + j) * 60}ms` }} />
                ))}
            </div>
        ))}
    </div>
);

const ClaimCell = ({ row, canRaise, onRaise, bulkProgress }) => {
    const bp = bulkProgress?.[row.suborder_number];
    if (bp?.phase === 'raising') {
        return (
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-700">
                <Loader2 size={12} className="animate-spin" /> Raising…
            </span>
        );
    }
    if (bp?.phase === 'success') {
        return (
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
                <CheckCircle2 size={12} /> Raised
            </span>
        );
    }
    if (bp?.phase === 'error') {
        return (
            <span title={bp.error} className="inline-flex cursor-help items-center gap-1.5 rounded-lg bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700">
                <XCircle size={12} /> Failed
            </span>
        );
    }
    if (row.claim) {
        return (
            <div className="flex flex-col items-end gap-1">
                <ClaimStatusBadge status={row.claim.ticket_status} />
                <span className="font-mono text-[11px] text-slate-400">#{row.claim.ticket_id}</span>
            </div>
        );
    }
    if (!canRaise) return <span className="text-xs text-slate-300">—</span>;
    if (!row.claim_eligible) {
        return (
            <span title="Raising claims needs an Auto Sync account — connect this account's Meesho login in Settings"
                className="inline-flex cursor-not-allowed items-center gap-1 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-400">
                <Lock size={12} /> Auto Sync needed
            </span>
        );
    }
    return (
        <button type="button" onClick={() => onRaise(row)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm shadow-violet-200 hover:from-violet-700 hover:to-indigo-700 active:scale-95 transition-all">
            <Ticket size={12} /> Raise claim
        </button>
    );
};

const OverdueReturnsPanel = ({ accountId, canRaise, refreshKey = 0, onRaise, onTotal, bulkProgress = {} }) => {
    const [category, setCategory] = useState('');
    const [searchDraft, setSearchDraft] = useState('');
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [rows, setRows] = useState([]);
    const [pagination, setPagination] = useState({ totalPages: 1, totalItems: 0 });
    const [error, setError] = useState(null);
    const [reloadKey, setReloadKey] = useState(0);

    useEffect(() => {
        const t = setTimeout(() => { setSearch(searchDraft.trim()); setPage(1); }, 350);
        return () => clearTimeout(t);
    }, [searchDraft]);

    useEffect(() => { setPage(1); }, [accountId, category]);

    useEffect(() => {
        if (!accountId) return undefined;
        let cancelled = false;
        setLoading(true);
        setError(null);
        (async () => {
            try {
                const { data } = await api.get('/returns/list', {
                    params: {
                        marketplaceIds: JSON.stringify([accountId]),
                        status: 'overdue',
                        sortBy: 'days_pending',
                        sortOrder: 'desc',
                        page,
                        limit: PAGE_SIZE,
                        ...(category ? { returnCategory: category } : {}),
                        ...(search ? { search } : {}),
                    },
                    skipErrorToast: true,
                });
                if (cancelled) return;
                const p = data?.pagination || { totalPages: 1, totalItems: 0 };
                setRows(data?.returns || []);
                setPagination(p);
                if (!category && !search) onTotal?.(p.totalItems);
            } catch (err) {
                if (!cancelled) setError(err.response?.data?.message || 'Could not load overdue returns');
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [accountId, category, search, page, refreshKey, reloadKey]);

    const filtered = Boolean(category || search);

    return (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-start gap-2.5 border-b border-slate-100 bg-gradient-to-r from-amber-50/70 to-white px-4 py-3">
                <Info size={14} className="mt-0.5 shrink-0 text-amber-600" />
                <p className="text-xs leading-relaxed text-slate-600">
                    Returns that still haven&apos;t reached you — <span className="font-semibold text-slate-800">RTO 45+ days</span> after dispatch or
                    <span className="font-semibold text-slate-800"> customer returns 25+ days</span> after creation. Raise a claim so Meesho compensates you for the lost shipment.
                </p>
            </div>

            <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="inline-flex rounded-xl bg-slate-100 p-1">
                    {CATEGORY_FILTERS.map(f => {
                        const active = category === f.key;
                        return (
                            <button key={f.key || 'all'} type="button" onClick={() => setCategory(f.key)}
                                className={`relative rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${active ? 'text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}>
                                {active && <motion.span layoutId="overdue-cat" className="absolute inset-0 rounded-lg bg-white shadow-sm" transition={{ type: 'spring', stiffness: 400, damping: 32 }} />}
                                <span className="relative">{f.label}</span>
                            </button>
                        );
                    })}
                </div>
                <div className="relative w-full sm:w-80">
                    <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input value={searchDraft} onChange={e => setSearchDraft(e.target.value)}
                        placeholder="Search sub-order, AWB or SKU"
                        className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-8 pr-8 text-sm text-slate-800 placeholder:text-slate-400 focus:border-violet-400 focus:outline-none focus:ring-4 focus:ring-violet-500/10" />
                    {searchDraft && (
                        <button type="button" onClick={() => setSearchDraft('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                            <X size={14} />
                        </button>
                    )}
                </div>
            </div>

            {error ? (
                <div className="flex items-center justify-between gap-3 px-4 py-6">
                    <p className="flex items-center gap-2 text-sm text-rose-700"><AlertTriangle size={15} /> {error}</p>
                    <button type="button" onClick={() => setReloadKey(k => k + 1)}
                        className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50">Retry</button>
                </div>
            ) : loading && rows.length === 0 ? <SkeletonRows /> : rows.length === 0 ? (
                <div className="px-6 py-14 text-center">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50">
                        <PartyPopper size={24} className="text-emerald-600" />
                    </div>
                    <p className="mt-4 font-heading text-base font-bold text-slate-900">{filtered ? 'No overdue returns match' : 'Nothing overdue'}</p>
                    <p className="mt-1 text-sm text-slate-500">
                        {filtered ? 'Try another filter or clear the search.' : 'Every return on this account is on track or already received.'}
                    </p>
                </div>
            ) : (
                <div className={`overflow-x-auto transition-opacity ${loading ? 'opacity-60' : ''}`}>
                    <table className="min-w-full text-sm">
                        <thead className="bg-slate-50/70 text-[11px] uppercase tracking-wider text-slate-400">
                            <tr>
                                <th className="px-4 py-2.5 text-left font-semibold">Product</th>
                                <th className="px-4 py-2.5 text-left font-semibold">Sub-order / AWB</th>
                                <th className="px-4 py-2.5 text-left font-semibold">Type</th>
                                <th className="px-4 py-2.5 text-left font-semibold">Courier</th>
                                <th className="px-4 py-2.5 text-left font-semibold">Overdue</th>
                                <th className="px-4 py-2.5 text-right font-semibold">Claim</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {rows.map(r => {
                                const rto = isRto(r);
                                const courierStatus = COURIER_STATUS[r.return_file_type];
                                return (
                                    <tr key={r.id} className={`transition-colors hover:bg-slate-50/80 ${r.claim ? 'bg-violet-50/20' : ''}`}>
                                        <td className="px-4 py-3 align-top">
                                            <p className="max-w-[280px] truncate font-medium text-slate-800" title={r.product_title}>{r.product_title || '—'}</p>
                                            <p className="text-[11px] text-slate-400">{r.sku ? `SKU ${r.sku}` : ''}</p>
                                        </td>
                                        <td className="px-4 py-3 align-top font-mono text-xs text-slate-600">
                                            <p className="flex items-center gap-0.5">{r.suborder_number}<CopyButton value={r.suborder_number} /></p>
                                            <p className="text-slate-400">{r.awb_number || '—'}</p>
                                        </td>
                                        <td className="px-4 py-3 align-top">
                                            <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${rto ? 'bg-indigo-50 text-indigo-700' : 'bg-pink-50 text-pink-700'}`}>
                                                {rto ? 'RTO' : 'Customer'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 align-top">
                                            <p className="text-slate-700">{r.courier_partner || '—'}</p>
                                            {courierStatus && <span className={`mt-1 inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold ${courierStatus.cls}`}>{courierStatus.label}</span>}
                                        </td>
                                        <td className="px-4 py-3 align-top">
                                            <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-xs font-bold tabular-nums text-red-700 ring-1 ring-inset ring-red-100">
                                                {r.days_pending} days
                                            </span>
                                            <p className="mt-1 text-[11px] text-slate-400">
                                                {rto ? `Dispatched ${fmtDateOnly(r.dispatch_date)}` : `Created ${fmtDateOnly(r.return_date)}`}
                                            </p>
                                        </td>
                                        <td className="px-4 py-3 text-right align-top">
                                            <ClaimCell row={r} canRaise={canRaise} onRaise={onRaise} bulkProgress={bulkProgress} />
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {pagination.totalPages > 1 && (
                <div className="flex items-center justify-between border-t border-slate-100 px-4 py-2.5">
                    <span className="text-xs text-slate-500">{pagination.totalItems.toLocaleString('en-IN')} overdue returns</span>
                    <div className="flex items-center gap-1">
                        <button type="button" disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40">Prev</button>
                        <span className="min-w-[3.5rem] text-center text-xs text-slate-500">{page} / {pagination.totalPages}</span>
                        <button type="button" disabled={page >= pagination.totalPages} onClick={() => setPage(p => p + 1)}
                            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40">Next</button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default OverdueReturnsPanel;
