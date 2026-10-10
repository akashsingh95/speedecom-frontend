import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
    Ticket, Clock, CheckCircle2, XCircle, IndianRupee, Search, X,
    ChevronRight, ArrowRight, Sparkles, AlertTriangle, Send, TrendingUp,
} from 'lucide-react';
import api from '../../../api';
import { ClaimStatusBadge, CopyButton, fmtINR, fmtShortDate, timeAgo } from './claimUi';

const PAGE_SIZE = 10;

const STATUS_TABS = [
    { key: 'all', label: 'All' },
    { key: 'pending', label: 'Pending' },
    { key: 'approved', label: 'Approved' },
    { key: 'rejected', label: 'Rejected' },
];

const KpiTile = ({ label, value, sub, icon: Icon, tone, active, onClick, index, featured }) => {
    const tones = {
        violet: 'bg-violet-50 text-violet-600',
        amber: 'bg-amber-50 text-amber-600',
        emerald: 'bg-emerald-50 text-emerald-600',
        rose: 'bg-rose-50 text-rose-600',
    };
    if (featured) {
        return (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }}
                className="relative col-span-2 overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 p-4 text-white shadow-md shadow-emerald-100 sm:col-span-1">
                <div className="pointer-events-none absolute -right-6 -top-8 h-28 w-28 rounded-full bg-white/15 blur-xl" />
                <div className="relative flex items-center justify-between">
                    <span className="text-xs font-semibold text-emerald-50">{label}</span>
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/20"><Icon size={16} /></span>
                </div>
                <p className="relative mt-2 font-heading text-2xl font-bold tabular-nums">{value}</p>
                {sub && <p className="relative mt-0.5 text-[11px] font-medium text-emerald-50">{sub}</p>}
            </motion.div>
        );
    }
    return (
        <motion.button type="button" onClick={onClick}
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }}
            className={`rounded-2xl border bg-white p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-md ${active ? 'border-violet-400 ring-4 ring-violet-500/10' : 'border-slate-200 shadow-sm'}`}>
            <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500">{label}</span>
                <span className={`flex h-8 w-8 items-center justify-center rounded-xl ${tones[tone]}`}><Icon size={16} /></span>
            </div>
            <p className="mt-2 font-heading text-2xl font-bold tabular-nums text-slate-900">{value}</p>
            {sub && <p className="mt-0.5 text-[11px] font-medium text-slate-400">{sub}</p>}
        </motion.button>
    );
};

const SkeletonRows = () => (
    <div className="divide-y divide-slate-100">
        {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-4">
                {[90, 220, 130, 90, 80, 70].map((w, j) => (
                    <div key={j} className="h-3.5 animate-pulse rounded bg-slate-100" style={{ width: w, animationDelay: `${(i + j) * 60}ms` }} />
                ))}
            </div>
        ))}
    </div>
);

const EmptyClaims = ({ claimable, canRaise, onReviewOverdue }) => (
    <div className="px-6 py-12 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-100 to-indigo-100">
            <Ticket size={24} className="text-violet-600" />
        </div>
        <h4 className="mt-4 font-heading text-base font-bold text-slate-900">No claims raised yet</h4>
        <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
            Overdue returns that never reached you can be claimed from Meesho. Raise one in a few clicks and track the money you recover here.
        </p>
        <ol className="mx-auto mt-6 grid max-w-xl grid-cols-1 gap-2 text-left sm:grid-cols-3">
            {[
                { n: 1, t: 'Find an overdue return', d: 'RTO 45+ days or customer return 25+ days' },
                { n: 2, t: 'Raise the claim', d: 'Details are pre-filled for you' },
                { n: 3, t: 'Sync & recover', d: 'Status and amount update after Sync Claims' },
            ].map(s => (
                <li key={s.n} className="rounded-xl border border-slate-200 bg-white p-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-violet-600 text-[11px] font-bold text-white">{s.n}</span>
                    <p className="mt-2 text-xs font-bold text-slate-800">{s.t}</p>
                    <p className="text-[11px] text-slate-500">{s.d}</p>
                </li>
            ))}
        </ol>
        {canRaise && claimable > 0 && (
            <button type="button" onClick={onReviewOverdue}
                className="mt-6 inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-violet-200 hover:bg-violet-700 active:scale-[0.98] transition-all">
                Review {claimable} overdue return{claimable === 1 ? '' : 's'} <ArrowRight size={15} />
            </button>
        )}
    </div>
);

const ClaimRow = ({ claim, accountName, showAccount }) => {
    const [open, setOpen] = useState(false);
    const hasAmount = claim.claim_amount !== null && claim.claim_amount !== undefined;
    return (
        <>
            <tr onClick={() => setOpen(o => !o)} className={`cursor-pointer transition-colors ${open ? 'bg-violet-50/40' : 'hover:bg-slate-50/80'}`}>
                <td className="px-4 py-3 align-top">
                    <div className="flex items-center gap-1.5">
                        <ChevronRight size={14} className={`shrink-0 text-slate-400 transition-transform ${open ? 'rotate-90' : ''}`} />
                        <span className="font-mono text-[13px] font-semibold text-slate-900">#{claim.ticket_id}</span>
                        <CopyButton value={claim.ticket_id} label="Copy ticket ID" />
                    </div>
                    {showAccount && <span className="ml-5 mt-1 inline-block max-w-[140px] truncate rounded bg-pink-50 px-1.5 py-0.5 text-[10px] font-semibold text-pink-700">{accountName}</span>}
                </td>
                <td className="px-4 py-3 align-top">
                    <p className="max-w-[240px] truncate text-sm font-medium text-slate-800" title={claim.product_name}>{claim.product_name || '—'}</p>
                    <p className="text-[11px] text-slate-400">{claim.sku ? `SKU ${claim.sku}` : ''}</p>
                </td>
                <td className="px-4 py-3 align-top font-mono text-xs text-slate-600">
                    <p>{claim.suborder_number}</p>
                    <p className="text-slate-400">{claim.awb_number}</p>
                </td>
                <td className="px-4 py-3 align-top text-sm text-slate-600">{claim.courier_partner || '—'}</td>
                <td className="px-4 py-3 align-top">
                    <p className="text-sm text-slate-700">{fmtShortDate(claim.raised_at)}</p>
                    <p className="text-[11px] text-slate-400">{timeAgo(claim.raised_at)}</p>
                </td>
                <td className="px-4 py-3 align-top"><ClaimStatusBadge status={claim.ticket_status} /></td>
                <td className="px-4 py-3 text-right align-top">
                    {hasAmount
                        ? <span className="text-sm font-bold tabular-nums text-emerald-700">{fmtINR(claim.claim_amount)}</span>
                        : <span className="text-sm text-slate-300">—</span>}
                </td>
            </tr>
            <AnimatePresence initial={false}>
                {open && (
                    <tr>
                        <td colSpan={7} className="p-0">
                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                                className="overflow-hidden bg-violet-50/40">
                                <div className="grid gap-3 px-11 pb-4 pt-1 sm:grid-cols-2">
                                    <div className="rounded-xl bg-white p-3 ring-1 ring-slate-200">
                                        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Latest from Meesho</p>
                                        <p className="mt-1 text-xs leading-relaxed text-slate-700">
                                            {claim.last_update || 'No update yet — run Sync Claims after Meesho reviews the ticket.'}
                                        </p>
                                        {claim.last_synced_at && <p className="mt-2 text-[10px] text-slate-400">Synced {timeAgo(claim.last_synced_at)}</p>}
                                    </div>
                                    <div className="rounded-xl bg-white p-3 ring-1 ring-slate-200">
                                        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Your description</p>
                                        <p className="mt-1 text-xs leading-relaxed text-slate-700">{claim.description || '—'}</p>
                                    </div>
                                </div>
                            </motion.div>
                        </td>
                    </tr>
                )}
            </AnimatePresence>
        </>
    );
};

const ReturnClaimsSection = ({ marketplaceIds, meeshoAccounts = [], refreshKey = 0, canRaise, onReviewOverdue, onStats }) => {
    const [status, setStatus] = useState('all');
    const [searchDraft, setSearchDraft] = useState('');
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState(null);
    const [loadError, setLoadError] = useState(null);
    const [reloadKey, setReloadKey] = useState(0);

    const idsKey = JSON.stringify(marketplaceIds || []);
    const nameOf = useMemo(() => {
        const map = new Map(meeshoAccounts.map(a => [String(a._id), a.name]));
        return (id) => map.get(String(id)) || 'Account';
    }, [meeshoAccounts]);

    useEffect(() => {
        const t = setTimeout(() => { setSearch(searchDraft.trim()); setPage(1); }, 350);
        return () => clearTimeout(t);
    }, [searchDraft]);

    useEffect(() => { setPage(1); }, [idsKey, status]);

    useEffect(() => {
        if (!marketplaceIds?.length) return undefined;
        let cancelled = false;
        setLoading(true);
        setLoadError(null);
        (async () => {
            try {
                const { data: res } = await api.get('/returns/claims', {
                    params: { marketplaceIds: idsKey, status, page, limit: PAGE_SIZE, ...(search ? { search } : {}) },
                    skipErrorToast: true,
                });
                if (!cancelled) setData(res);
            } catch (err) {
                if (!cancelled) setLoadError(err.response?.data?.message || 'Could not load claims');
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [idsKey, status, search, page, refreshKey, reloadKey]);

    const stats = data?.stats;
    const rows = data?.rows || [];
    const pagination = data?.pagination || { currentPage: 1, totalPages: 1, totalItems: 0 };
    const showAccount = (marketplaceIds?.length || 0) > 1;
    const claimable = stats?.claimable_count || 0;
    const neverRaised = !loading && stats && stats.total_raised === 0;

    useEffect(() => { if (data) onStats?.(data.stats, data.eligibleAccountIds || []); }, [data]);

    const tabCount = (key) => {
        if (!stats) return null;
        return { all: stats.total_raised, pending: stats.pending_count, approved: stats.approved_count, rejected: stats.rejected_count }[key];
    };

    return (
        <div className="space-y-5">
                {/* Claimable banner */}
                <AnimatePresence>
                    {canRaise && claimable > 0 && !neverRaised && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                            className="overflow-hidden">
                            <div className="flex flex-col gap-3 rounded-2xl border border-violet-200 bg-gradient-to-r from-violet-50 via-indigo-50 to-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                                <div className="flex items-center gap-3">
                                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-violet-100">
                                        <Sparkles size={16} className="text-violet-600" />
                                    </span>
                                    <div>
                                        <p className="text-sm font-bold text-slate-900">{claimable} overdue return{claimable === 1 ? '' : 's'} can still be claimed</p>
                                        <p className="text-xs text-slate-500">They never reached you — raise a claim before Meesho&apos;s window closes.</p>
                                    </div>
                                </div>
                                <button type="button" onClick={onReviewOverdue}
                                    className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-violet-700 active:scale-[0.98] transition-all">
                                    <Send size={14} /> Review &amp; claim
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* KPIs */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                    <KpiTile index={0} label="Claims raised" value={(stats?.total_raised ?? 0).toLocaleString('en-IN')} icon={Ticket} tone="violet"
                        active={status === 'all'} onClick={() => setStatus('all')} sub={claimable ? `${claimable} more claimable` : 'Through SpeedEcom'} />
                    <KpiTile index={1} label="Pending" value={(stats?.pending_count ?? 0).toLocaleString('en-IN')} icon={Clock} tone="amber"
                        active={status === 'pending'} onClick={() => setStatus('pending')} sub="Awaiting Meesho" />
                    <KpiTile index={2} label="Approved" value={(stats?.approved_count ?? 0).toLocaleString('en-IN')} icon={CheckCircle2} tone="emerald"
                        active={status === 'approved'} onClick={() => setStatus('approved')}
                        sub={stats?.approval_rate !== null && stats?.approval_rate !== undefined ? `${stats.approval_rate}% approval rate` : 'No decisions yet'} />
                    <KpiTile index={3} label="Rejected" value={(stats?.rejected_count ?? 0).toLocaleString('en-IN')} icon={XCircle} tone="rose"
                        active={status === 'rejected'} onClick={() => setStatus('rejected')} sub="Declined by Meesho" />
                    <KpiTile index={4} featured label="Recovered" value={fmtINR(stats?.total_recovered || 0, { compact: true })} icon={IndianRupee}
                        sub={<span className="inline-flex items-center gap-1"><TrendingUp size={11} /> From approved claims</span>} />
                </div>

                {neverRaised ? (
                    <div className="rounded-2xl border border-dashed border-slate-200">
                        <EmptyClaims claimable={claimable} canRaise={canRaise} onReviewOverdue={onReviewOverdue} />
                    </div>
                ) : (
                    <div className="overflow-hidden rounded-2xl border border-slate-200">
                        {/* Toolbar */}
                        <div className="flex flex-col gap-3 border-b border-slate-100 bg-slate-50/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="inline-flex rounded-xl bg-slate-100 p-1">
                                {STATUS_TABS.map(t => {
                                    const count = tabCount(t.key);
                                    const active = status === t.key;
                                    return (
                                        <button key={t.key} type="button" onClick={() => setStatus(t.key)}
                                            className={`relative rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${active ? 'text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}>
                                            {active && <motion.span layoutId="claims-tab" className="absolute inset-0 rounded-lg bg-white shadow-sm" transition={{ type: 'spring', stiffness: 400, damping: 32 }} />}
                                            <span className="relative">{t.label}{count !== null && count !== undefined && <span className="ml-1 text-slate-400">{count}</span>}</span>
                                        </button>
                                    );
                                })}
                            </div>
                            <div className="relative w-full sm:w-72">
                                <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input value={searchDraft} onChange={e => setSearchDraft(e.target.value)}
                                    placeholder="Ticket, sub-order, AWB or SKU"
                                    className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-8 pr-8 text-sm text-slate-800 placeholder:text-slate-400 focus:border-violet-400 focus:outline-none focus:ring-4 focus:ring-violet-500/10" />
                                {searchDraft && (
                                    <button type="button" onClick={() => setSearchDraft('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                        <X size={14} />
                                    </button>
                                )}
                            </div>
                        </div>

                        {loadError ? (
                            <div className="flex items-center justify-between gap-3 px-4 py-6">
                                <p className="flex items-center gap-2 text-sm text-rose-700"><AlertTriangle size={15} /> {loadError}</p>
                                <button type="button" onClick={() => setReloadKey(k => k + 1)}
                                    className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50">Retry</button>
                            </div>
                        ) : loading && !data ? <SkeletonRows /> : rows.length === 0 ? (
                            <div className="px-4 py-10 text-center">
                                <p className="text-sm font-semibold text-slate-700">No claims match</p>
                                <p className="mt-1 text-xs text-slate-500">Try another status or clear the search.</p>
                            </div>
                        ) : (
                            <div className={`overflow-x-auto transition-opacity ${loading ? 'opacity-60' : ''}`}>
                                <table className="min-w-full text-sm">
                                    <thead className="bg-white text-[11px] uppercase tracking-wider text-slate-400">
                                        <tr>
                                            <th className="px-4 py-2.5 text-left font-semibold">Ticket</th>
                                            <th className="px-4 py-2.5 text-left font-semibold">Product</th>
                                            <th className="px-4 py-2.5 text-left font-semibold">Sub-order / AWB</th>
                                            <th className="px-4 py-2.5 text-left font-semibold">Courier</th>
                                            <th className="px-4 py-2.5 text-left font-semibold">Raised</th>
                                            <th className="px-4 py-2.5 text-left font-semibold">Status</th>
                                            <th className="px-4 py-2.5 text-right font-semibold">Recovered</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {rows.map(c => (
                                            <ClaimRow key={c.id} claim={c} accountName={nameOf(c.marketplace_id)} showAccount={showAccount} />
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {pagination.totalPages > 1 && (
                            <div className="flex items-center justify-between border-t border-slate-100 px-4 py-2.5">
                                <span className="text-xs text-slate-500">{pagination.totalItems.toLocaleString('en-IN')} claims</span>
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
                )}
        </div>
    );
};

export default ReturnClaimsSection;
