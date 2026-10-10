import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
    RefreshCw, Loader2, AlertTriangle, PackageX, Ticket, Clock,
    ShieldAlert, Phone, CheckCircle2, XCircle, Zap, AlignLeft,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import api from '../api';
import { useAuth } from '../AuthContext';
import DashboardLayout from '../components/DashboardLayout';
import MarketplaceAccountSelector from '../components/MarketplaceAccountSelector';
import OverdueReturnsPanel from '../components/dashboard/claims/OverdueReturnsPanel';
import ReturnClaimsSection from '../components/dashboard/claims/ReturnClaimsSection';
import RaiseClaimModal from '../components/dashboard/claims/RaiseClaimModal';
import useClaimsSync from '../components/dashboard/claims/useClaimsSync';
import { timeAgo } from '../components/dashboard/claims/claimUi';

const CLAIM_ROLES = ['Admin', 'SBM', 'RM', 'SuperAdmin'];
const PHONE_RE = /^[6-9]\d{9}$/;

// ─── Bulk raise progress banner ────────────────────────────────────────────────
const BulkBanner = ({ bulk, cancelRef, onStart, onChange, onDismiss }) => {
    if (!bulk) return null;

    if (bulk.phase === 'loading') {
        return (
            <div className="mb-4 flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500 shadow-sm">
                <Loader2 size={15} className="animate-spin text-violet-500" /> Loading eligible returns…
            </div>
        );
    }

    if (bulk.phase === 'confirm') {
        const phoneOk = PHONE_RE.test(bulk.callbackNumber);
        const descLen = (bulk.description || '').trim().length;
        const descOk = descLen >= 10;
        const canStart = phoneOk && descOk;
        return (
            <div className="mb-4 rounded-2xl border border-violet-200 bg-gradient-to-r from-violet-50 to-indigo-50 p-4 shadow-sm">
                <div className="mb-3 flex items-center justify-between gap-4">
                    <div>
                        <p className="font-semibold text-slate-800">
                            Raise claims for <span className="text-violet-700">{bulk.rows.length}</span> overdue return{bulk.rows.length !== 1 ? 's' : ''}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500">Same description used for each · submitted one at a time</p>
                    </div>
                    <button type="button" onClick={onDismiss}
                        className="shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">
                        Cancel
                    </button>
                </div>

                {/* Description */}
                <div className="mb-3">
                    <label className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                        <AlignLeft size={12} /> Description <span className="text-rose-500">*</span>
                    </label>
                    <textarea
                        rows={3}
                        value={bulk.description || ''}
                        onChange={e => onChange('description', e.target.value)}
                        placeholder="Describe the issue — e.g. RTO / customer returns not received at warehouse…"
                        maxLength={1000}
                        className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm leading-relaxed text-slate-800 shadow-sm focus:border-violet-400 focus:outline-none focus:ring-4 focus:ring-violet-500/10"
                    />
                    <div className="mt-1 flex items-center justify-between text-[11px]">
                        <span className="text-slate-400">{bulk.rows.length > 1 ? 'Applied to all claims' : ''}</span>
                        <span className={descLen > 900 ? 'font-semibold text-amber-600' : 'text-slate-400'}>{descLen}/1000</span>
                    </div>
                </div>

                {/* Callback + Start */}
                <div className="flex flex-wrap items-center gap-2">
                    <div className="relative flex-1 min-w-[160px]">
                        <Phone size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            value={bulk.callbackNumber}
                            onChange={e => onChange('callbackNumber', e.target.value.replace(/\D/g, '').slice(0, 10))}
                            placeholder="Callback number"
                            inputMode="numeric"
                            className="h-9 w-full rounded-xl border border-slate-200 bg-white pl-8 pr-3 font-mono text-sm text-slate-800 focus:border-violet-400 focus:outline-none focus:ring-4 focus:ring-violet-500/10"
                            maxLength={10}
                        />
                    </div>
                    <button type="button" disabled={!canStart} onClick={() => onStart(bulk)}
                        className="h-9 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-5 text-sm font-bold text-white shadow-sm shadow-violet-200 hover:from-violet-700 hover:to-indigo-700 disabled:opacity-50 transition-all">
                        Start raising
                    </button>
                </div>
                {bulk.callbackNumber.length > 0 && !phoneOk && (
                    <p className="mt-1.5 text-[11px] text-rose-600">Enter a valid 10-digit Indian mobile number (starts 6–9)</p>
                )}
                {!descOk && descLen > 0 && (
                    <p className="mt-1 text-[11px] text-rose-600">Description must be at least 10 characters</p>
                )}
            </div>
        );
    }

    if (bulk.phase === 'running') {
        const pct = bulk.total > 0 ? Math.round((bulk.current / bulk.total) * 100) : 0;
        return (
            <div className="mb-4 rounded-2xl border border-violet-100 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="flex-1">
                        <div className="mb-1.5 flex items-center justify-between text-xs font-semibold text-slate-700">
                            <span className="flex items-center gap-1.5">
                                <Loader2 size={13} className="animate-spin text-violet-600" />
                                Raising claim {bulk.current} of {bulk.total}…
                            </span>
                            <span className="text-slate-400">{pct}%</span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                            <motion.div
                                className="h-full rounded-full bg-gradient-to-r from-violet-500 to-indigo-500"
                                animate={{ width: `${pct}%` }}
                                transition={{ duration: 0.4 }}
                            />
                        </div>
                    </div>
                    <button type="button" onClick={() => { cancelRef.current = true; }}
                        className="shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">
                        Cancel
                    </button>
                </div>
            </div>
        );
    }

    if (bulk.phase === 'done') {
        const allOk = bulk.failed === 0;
        return (
            <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${allOk ? 'bg-emerald-50' : 'bg-amber-50'}`}>
                            {allOk
                                ? <CheckCircle2 size={18} className="text-emerald-600" />
                                : <XCircle size={18} className="text-amber-600" />}
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-slate-800">
                                {bulk.raised > 0 && <span>{bulk.raised} claim{bulk.raised !== 1 ? 's' : ''} raised</span>}
                                {bulk.raised > 0 && bulk.failed > 0 && <span className="text-slate-400"> · </span>}
                                {bulk.failed > 0 && <span className="text-rose-600">{bulk.failed} failed</span>}
                            </p>
                            <p className="text-xs text-slate-500">Statuses will update on the next claims sync</p>
                        </div>
                    </div>
                    <button type="button" onClick={onDismiss}
                        className="shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">
                        Dismiss
                    </button>
                </div>
            </div>
        );
    }

    return null;
};

// ─── Page ──────────────────────────────────────────────────────────────────────
const ReturnClaims = () => {
    const { user } = useAuth();
    const canManage = CLAIM_ROLES.includes(user?.role);
    const cancelRef = useRef(false);

    const [marketplaces, setMarketplaces] = useState([]);
    const [accountsLoaded, setAccountsLoaded] = useState(false);
    const [accountId, setAccountId] = useState('');
    const [tab, setTab] = useState('overdue');
    const [refreshKey, setRefreshKey] = useState(0);
    const [claimTarget, setClaimTarget] = useState(null);
    const [stats, setStats] = useState(null);
    const [eligibleIds, setEligibleIds] = useState(null);
    const [overdueTotal, setOverdueTotal] = useState(null);
    const [bulkRaise, setBulkRaise] = useState(null);

    const { progress, startSync, isSyncing } = useClaimsSync({ onSynced: () => setRefreshKey(k => k + 1) });

    useEffect(() => {
        (async () => {
            try {
                const { data } = await api.get('/marketplaces/filter-options?includeInactive=false');
                const meesho = (Array.isArray(data) ? data : []).find(m => m.key === 'Meesho');
                setMarketplaces(meesho ? [meesho] : []);
                if (meesho?.accounts?.length) setAccountId(meesho.accounts[0]._id);
            } catch {
                toast.error('Could not load connected Meesho accounts');
            } finally {
                setAccountsLoaded(true);
            }
        })();
    }, []);

    useEffect(() => {
        setStats(null);
        setEligibleIds(null);
        setOverdueTotal(null);
        setBulkRaise(null);
    }, [accountId]);

    const accounts = useMemo(() => marketplaces[0]?.accounts || [], [marketplaces]);
    const account = accounts.find(a => String(a._id) === String(accountId));
    const accountIds = useMemo(() => (accountId ? [accountId] : []), [accountId]);
    const notEligible = eligibleIds !== null && !eligibleIds.includes(String(accountId));
    const syncing = accountId ? isSyncing(accountId) : false;

    // ── Raise All ──────────────────────────────────────────────────────────────
    const handleRaiseAll = async () => {
        setBulkRaise({ phase: 'loading' });
        try {
            const { data } = await api.get('/returns/list', {
                params: {
                    marketplaceIds: JSON.stringify([accountId]),
                    status: 'overdue',
                    sortBy: 'days_pending',
                    sortOrder: 'desc',
                    page: 1,
                    limit: 500,
                },
                skipErrorToast: true,
            });
            const rows = (data?.returns || []).filter(
                r => r.claim_eligible && !r.claim && r.awb_number && r.courier_partner,
            );
            if (!rows.length) {
                toast.info('No eligible unclaimed overdue returns found');
                setBulkRaise(null);
                return;
            }
            let callbackNumber = '';
            try {
                const { data: ctx } = await api.get('/returns/claims/context', {
                    params: { marketplaceId: accountId, suborderNumber: rows[0].suborder_number, awbNumber: rows[0].awb_number || '' },
                    skipErrorToast: true,
                });
                callbackNumber = ctx?.defaults?.callbackNumber || '';
            } catch { /* non-fatal */ }
            setBulkRaise({ phase: 'confirm', rows, callbackNumber, description: '' });
        } catch {
            toast.error('Could not load overdue returns');
            setBulkRaise(null);
        }
    };

    const startBulkRaise = async ({ rows, callbackNumber, description }) => {
        cancelRef.current = false;
        const progress = {};
        setBulkRaise({ phase: 'running', rows, total: rows.length, current: 0, callbackNumber, progress });
        let raised = 0;
        let failed = 0;

        for (let i = 0; i < rows.length; i++) {
            if (cancelRef.current) break;
            const row = rows[i];
            progress[row.suborder_number] = { phase: 'raising' };
            setBulkRaise(prev => ({ ...prev, current: i + 1, progress: { ...progress } }));

            try {
                await api.post('/returns/claims', {
                    marketplaceId: row.marketplace_id,
                    suborderNumber: row.suborder_number,
                    awbNumber: row.awb_number || '',
                    description: description.trim(),
                    callbackNumber,
                    issueCategory: 5,
                });
                progress[row.suborder_number] = { phase: 'success' };
                raised++;
            } catch (err) {
                const msg = err.response?.data?.message || 'Failed';
                progress[row.suborder_number] = { phase: 'error', error: msg };
                failed++;
            }
            setBulkRaise(prev => ({ ...prev, progress: { ...progress } }));
        }

        setBulkRaise(prev => ({ ...prev, phase: 'done', raised, failed }));
        setRefreshKey(k => k + 1);
        if (raised) toast.success(`${raised} claim${raised !== 1 ? 's' : ''} raised`);
        if (failed) toast.error(`${failed} claim${failed !== 1 ? 's' : ''} failed — check the rows below`);
    };

    const handleRaise = (row) => setClaimTarget({
        marketplaceId: row.marketplace_id,
        suborderNumber: row.suborder_number,
        awbNumber: row.awb_number || row.tracking_id || '',
        accountName: account?.name,
    });

    const bulkProgress = bulkRaise?.progress || {};
    const isBulkRunning = bulkRaise?.phase === 'running';

    const showRaiseAll = canManage && tab === 'overdue' && !notEligible && overdueTotal > 0 && !isBulkRunning && !bulkRaise;

    const TABS = [
        { key: 'overdue', label: 'Overdue returns', icon: Clock, count: overdueTotal },
        { key: 'claims', label: 'My claims', icon: Ticket, count: stats?.total_raised },
    ];

    return (
        <DashboardLayout>
            <div className="flex h-full w-full flex-col overflow-hidden bg-slate-50">
                <header className="sticky top-0 z-10 flex flex-col gap-3 bg-slate-50 px-4 py-3 backdrop-blur-md sm:flex-row sm:items-center sm:justify-between md:px-8">
                    <div>
                        <h2 className="font-heading text-2xl font-bold text-slate-800">Return Claims</h2>
                        <p className="mt-0.5 text-xs text-slate-500">
                            {stats?.last_synced_at
                                ? <span>Statuses synced <span className="font-medium text-slate-700">{timeAgo(stats.last_synced_at)}</span> · raise claims for lost returns and track what Meesho pays back</span>
                                : 'Raise claims on Meesho for returns that never reached you, and track what they recover'}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        {showRaiseAll && (
                            <button type="button" onClick={handleRaiseAll}
                                className="flex items-center gap-2 rounded-xl border border-violet-200 bg-gradient-to-r from-violet-50 to-indigo-50 px-4 py-2.5 text-xs font-semibold text-violet-700 shadow-sm transition-all hover:from-violet-100 hover:to-indigo-100">
                                <Zap size={14} className="text-violet-600" />
                                Raise All ({overdueTotal})
                            </button>
                        )}
                        {canManage && (
                            <button type="button" onClick={() => startSync(accountId, account?.name)}
                                disabled={!accountId || syncing || notEligible}
                                title={notEligible ? 'Claims sync needs an Auto Sync account' : 'Download the latest claims from Meesho to update statuses and amounts'}
                                className="flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition-all hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50">
                                {syncing ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                                {syncing ? (progress[accountId] || 'Syncing…') : 'Sync Claims'}
                            </button>
                        )}
                    </div>
                </header>

                <main className="relative flex w-full flex-1 flex-col overflow-y-auto px-4 pb-8 md:px-8">
                    <div className="mb-4 flex flex-wrap items-center gap-4 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                        <MarketplaceAccountSelector
                            marketplaces={marketplaces}
                            selectedMarketplaceKey="Meesho"
                            selectedAccountId={accountId}
                            onSelect={({ accountId: id }) => setAccountId(id)}
                        />
                        {notEligible && (
                            <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-800 ring-1 ring-inset ring-amber-200">
                                <ShieldAlert size={13} />
                                This account isn&apos;t on Auto Sync — connect its Meesho login in
                                <Link to="/settings/marketplace" className="font-semibold underline underline-offset-2">Settings</Link>
                                to raise claims.
                            </span>
                        )}
                    </div>

                    {!accountsLoaded ? (
                        <div className="flex items-center justify-center gap-2 py-20 text-sm text-slate-500">
                            <Loader2 size={16} className="animate-spin" /> Loading accounts…
                        </div>
                    ) : !accountId ? (
                        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center">
                            <PackageX size={26} className="mx-auto text-slate-400" />
                            <p className="mt-3 text-sm font-semibold text-slate-700">No Meesho account connected</p>
                            <p className="mt-1 text-sm text-slate-500">Connect a Meesho account to raise and track return claims.</p>
                        </div>
                    ) : (
                        <>
                            <div className="mb-4 flex gap-2 overflow-x-auto">
                                {TABS.map(t => {
                                    const active = tab === t.key;
                                    const Icon = t.icon;
                                    return (
                                        <button key={t.key} type="button" onClick={() => setTab(t.key)}
                                            className={`relative flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors ${active ? 'text-white' : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}>
                                            {active && <motion.span layoutId="claims-page-tab" className="absolute inset-0 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 shadow-md shadow-violet-200" transition={{ type: 'spring', stiffness: 380, damping: 30 }} />}
                                            <Icon size={15} className="relative" />
                                            <span className="relative">{t.label}</span>
                                            {t.count !== null && t.count !== undefined && (
                                                <span className={`relative rounded-full px-2 py-0.5 text-[11px] font-bold ${active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'}`}>
                                                    {Number(t.count).toLocaleString('en-IN')}
                                                </span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>

                            <BulkBanner
                                bulk={bulkRaise}
                                cancelRef={cancelRef}
                                onStart={startBulkRaise}
                                onChange={(field, v) => setBulkRaise(prev => ({ ...prev, [field]: v }))}
                                onDismiss={() => setBulkRaise(null)}
                            />

                            <div className={tab === 'overdue' ? '' : 'hidden'}>
                                <OverdueReturnsPanel
                                    accountId={accountId}
                                    canRaise={canManage && !isBulkRunning}
                                    refreshKey={refreshKey}
                                    onRaise={handleRaise}
                                    onTotal={setOverdueTotal}
                                    bulkProgress={bulkProgress}
                                />
                            </div>
                            <div className={tab === 'claims' ? '' : 'hidden'}>
                                <ReturnClaimsSection
                                    marketplaceIds={accountIds}
                                    meeshoAccounts={accounts}
                                    refreshKey={refreshKey}
                                    canRaise={canManage}
                                    onReviewOverdue={() => setTab('overdue')}
                                    onStats={(s, ids) => { setStats(s); setEligibleIds(ids.map(String)); }}
                                />
                            </div>

                            {syncing && (
                                <p className="mt-4 flex items-center gap-2 text-xs text-slate-500">
                                    <AlertTriangle size={12} className="text-amber-500" />
                                    Claims sync runs in the background — you can leave this page; the sync indicator keeps tracking it.
                                </p>
                            )}
                        </>
                    )}
                </main>
            </div>

            <RaiseClaimModal
                target={claimTarget}
                onClose={() => setClaimTarget(null)}
                onRaised={() => setRefreshKey(k => k + 1)}
            />
        </DashboardLayout>
    );
};

export default ReturnClaims;
