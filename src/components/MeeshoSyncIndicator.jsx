import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Loader2, ChevronUp, ChevronDown, CheckCircle, XCircle, Ban, AlertTriangle } from 'lucide-react';
import api from '../api';

const IDLE_POLL_MS = 20000;
const ACTIVE_POLL_MS = 5000;
const DATASETS = ['orders', 'payments', 'claims', 'returns'];

const MONTH_FMT = new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' });

// Month label for a dataset's date range; shows both if it spans two months.
const monthLabel = (dateMin, dateMax) => {
    if (!dateMin && !dateMax) return null;
    const min = dateMin ? new Date(`${dateMin}T00:00:00Z`) : null;
    const max = dateMax ? new Date(`${dateMax}T00:00:00Z`) : min;
    const from = min || max;
    const to = max || min;
    if (!from || Number.isNaN(from.getTime())) return null;
    const a = MONTH_FMT.format(from);
    const b = MONTH_FMT.format(to);
    return a === b ? a : `${a} – ${b}`;
};

// Statuses surfaced as "needs attention" — all pick themselves back up
// automatically, so this is informational only.
const RETRYABLE = ['failed', 'timed_out', 'cancelled'];

const MeeshoSyncIndicator = () => {
    const [accounts, setAccounts] = useState([]);
    const [expanded, setExpanded] = useState(false);
    const [detail, setDetail] = useState(null);
    const [jobs, setJobs] = useState([]);
    // Set once a sync has been seen, so its completion can be announced rather
    // than the indicator just vanishing mid-run.
    const [justFinished, setJustFinished] = useState(null);
    // jobId currently being cancelled, so the button can't be double-fired.
    const [busyJob, setBusyJob] = useState(null);

    const [notice, setNotice] = useState(null);
    // Job control is Admin/SuperAdmin only; a 403 hides the buttons rather than
    // leaving the user clicking something that will never work.
    const [canControl, setCanControl] = useState(true);

    const timerRef = useRef(null);
    const wasRunningRef = useRef(false);
    const stoppedRef = useRef(false);

    const clearTimer = () => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
    };

    const poll = useCallback(async () => {
        if (stoppedRef.current) return;

        let running = false;
        try {
            const { data } = await api.get('/meesho-sync/active-syncs');
            // sendResponse() puts the payload at the top level on success —
            // matching the existing `data.logs` / `data.lastSyncRunAt` callers.
            const list = data?.accounts ?? [];
            running = Boolean(data?.running);

            setAccounts(list);

            if (running) {
                wasRunningRef.current = true;
                setJustFinished(null);

                // Per-dataset detail only while the panel is open — no point
                // paying for it when the pill is collapsed.
                if (expanded && list[0]?.marketplaceId) {
                    try {
                        const { data: prog } = await api.get(
                            `/meesho-sync/sync-progress?marketplaceId=${list[0].marketplaceId}`,
                        );
                        setDetail(prog);
                    } catch { /* detail is optional */ }
                }
            } else if (wasRunningRef.current) {
                // Transitioned running -> idle: say so instead of disappearing.
                wasRunningRef.current = false;
                setJustFinished({ at: Date.now() });
                setDetail(null);
            }

            // The job list drives Cancel/Retry. Fetched while expanded, and also
            // right after a sync ends so a failure is offered for retry instead
            // of the panel closing on a green tick.
            if (expanded || running || wasRunningRef.current) {
                try {
                    const { data: jd } = await api.get('/meesho-sync/jobs');
                    setJobs(jd?.jobs ?? []);
                } catch { /* job list is optional */ }
            }
        } catch {
            // Never let a failed poll surface as an error to the user — this is
            // an ambient indicator, not something they asked for.
        }

        if (!stoppedRef.current) {
            timerRef.current = setTimeout(poll, running ? ACTIVE_POLL_MS : IDLE_POLL_MS);
        }
    }, [expanded]);

    useEffect(() => {
        stoppedRef.current = false;
        poll();
        return () => { stoppedRef.current = true; clearTimer(); };
    }, [poll]);

    // Auto-dismiss transient text.
    useEffect(() => {
        if (!justFinished) return;
        const t = setTimeout(() => setJustFinished(null), 30000);
        return () => clearTimeout(t);
    }, [justFinished]);

    useEffect(() => {
        if (!notice) return;
        const t = setTimeout(() => setNotice(null), 8000);
        return () => clearTimeout(t);
    }, [notice]);

    // Re-poll promptly after an action so the panel reflects it without waiting
    // out the current interval.
    const refreshSoon = () => {
        clearTimer();
        timerRef.current = setTimeout(poll, 1200);
    };

    const cancelJob = async (jobId) => {
        setBusyJob(jobId);
        try {
            const { data } = await api.post(`/meesho-sync/jobs/${jobId}/cancel`);
            setNotice({ tone: 'ok', text: data?.message || 'Cancellation requested.' });
            refreshSoon();
        } catch (err) {
            const status = err?.response?.status;
            if (status === 403) setCanControl(false);
            setNotice({
                tone: 'err',
                text: err?.response?.data?.message
                    || (status === 403 ? 'Only an Admin can control sync jobs.' : 'Could not complete that. Try again.'),
            });
        } finally {
            setBusyJob(null);
        }
    };

    const running = accounts.length > 0;
    const activeJob = jobs.find(j => j.status === 'running' || j.status === 'queued') || null;
    // Only the newest attempt per dataset — an older failure that has since been
    // retried successfully is noise, not something to offer a retry for.
    const newestPerType = DATASETS.map(t => jobs.filter(j => j.syncType === t)
        .sort((a, b) => String(b.startedAt).localeCompare(String(a.startedAt)))[0]).filter(Boolean);
    const needsAttention = newestPerType.filter(j => RETRYABLE.includes(j.status));

    if (!running && !justFinished && needsAttention.length === 0) return null;

    const first = accounts[0];
    // Scoped to `first` only — summing across accounts produced counts like
    // "returns • 5 of 5 left" that had nothing to do with the named dataset
    // whenever more than one account was syncing at once.
    const firstRemaining = first?.remaining || 0;
    const firstTotal = first?.total || first?.remaining || 0;
    const otherAccounts = accounts.length - 1;
    const batchTypes = detail?.batchTypes?.length
        ? detail.batchTypes
        : (first?.batchTypes?.length ? first.batchTypes : DATASETS);
    const visibleDatasets = DATASETS.filter(t => batchTypes.includes(t));

    return (
        <div className="fixed bottom-5 right-5 z-[70] w-[330px] max-w-[calc(100vw-2.5rem)]">
            <div className="rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-900/10 overflow-hidden">
                <button
                    type="button"
                    onClick={() => setExpanded(v => !v)}
                    className="w-full flex items-center gap-2.5 px-3.5 py-3 hover:bg-slate-50 transition-colors text-left"
                >
                    {running
                        ? <Loader2 size={16} className="text-brand-500 animate-spin shrink-0" />
                        : needsAttention.length > 0
                            ? <AlertTriangle size={16} className="text-amber-500 shrink-0" />
                            : <CheckCircle size={16} className="text-emerald-500 shrink-0" />}

                    <span className="flex-1 min-w-0">
                        <span className="block text-[12.5px] font-bold text-slate-800 truncate">
                            {running
                                ? 'Meesho sync running'
                                : needsAttention.length > 0
                                    ? `Meesho sync — ${needsAttention.length} need${needsAttention.length === 1 ? 's' : ''} attention`
                                    : 'Meesho sync finished'}
                        </span>
                        <span className="block text-[11px] text-slate-500 truncate">
                            {running
                                ? (first?.activeType
                                    ? `${first.activeType} • ${firstRemaining} of ${firstTotal} left`
                                    : `queued • ${firstRemaining} of ${firstTotal} left`)
                                    + (otherAccounts > 0 ? ` · +${otherAccounts} more account${otherAccounts === 1 ? '' : 's'}` : '')
                                : needsAttention.length > 0
                                    ? 'Will retry automatically'
                                    : 'See Sync Logs for row counts'}
                        </span>
                    </span>

                    {expanded
                        ? <ChevronDown size={15} className="text-slate-400 shrink-0" />
                        : <ChevronUp size={15} className="text-slate-400 shrink-0" />}
                </button>

                {expanded && (
                    <div className="border-t border-slate-100 px-3.5 py-3 bg-slate-50/70">
                        {first?.name && (
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 truncate">
                                {first.name}
                            </p>
                        )}

                        {running && first?.progressMessage && (
                            <p className="text-[11.5px] text-brand-700 leading-snug mb-2.5">
                                {first.progressMessage}
                            </p>
                        )}

                        {running && (
                            <div className="space-y-1.5">
                                {visibleDatasets.map((t) => {
                                    const d = detail?.datasets?.[t] || {};
                                    const isActive = (detail?.activeType || first?.activeType) === t;
                                    const queued = first?.queuedTypes?.includes(t) || d.queued;
                                    const failed = d.status === 'failed' || d.status === 'validation_failed';
                                    const done = d.status === 'completed' && !isActive && !queued;
                                    const month = monthLabel(d.dateMin, d.dateMax);

                                    return (
                                        <div key={t} className="flex items-center gap-2 text-[11.5px]">
                                            <span className="shrink-0 flex items-center">
                                                {isActive ? <Loader2 size={12} className="text-brand-500 animate-spin" />
                                                    : failed ? <XCircle size={12} className="text-red-500" />
                                                    : done ? <CheckCircle size={12} className="text-emerald-500" />
                                                    : <span className="inline-block w-3 h-3 rounded-full border border-slate-300" />}
                                            </span>
                                            <span className="w-[62px] shrink-0 font-semibold text-slate-700 capitalize">{t}</span>
                                            <span className={`truncate ${failed ? 'text-red-600' : isActive ? 'text-brand-700' : 'text-slate-500'}`}>
                                                {isActive ? 'running…'
                                                    : failed ? 'failed'
                                                    : done ? `${d.rowCount ?? 0} rows`
                                                    : queued ? 'queued…'
                                                    : '—'}
                                                {month && (isActive || failed || done || queued) && (
                                                    <span className="text-slate-400"> · {month}</span>
                                                )}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {/* ---- Cancel the job that is actually running ---- */}
                        {canControl && activeJob && (
                            <button
                                type="button"
                                onClick={() => cancelJob(activeJob.jobId)}
                                disabled={busyJob === activeJob.jobId}
                                className="mt-3 w-full flex items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-2 text-[11.5px] font-bold text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors"
                            >
                                {busyJob === activeJob.jobId
                                    ? <Loader2 size={12} className="animate-spin" />
                                    : <Ban size={12} />}
                                Stop {activeJob.syncType} sync
                            </button>
                        )}

                        {/* ---- Recent failures — no manual retry, they're picked up automatically ---- */}
                        {needsAttention.length > 0 && (
                            <div className="mt-3 pt-2.5 border-t border-slate-200/80 space-y-1.5">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                    Will retry automatically
                                </p>
                                {needsAttention.map((j) => (
                                    <div key={j.jobId} className="rounded-lg border border-slate-200 bg-white px-2.5 py-2">
                                        <div className="flex items-center gap-2">
                                            <XCircle size={12} className={j.status === 'cancelled' ? 'text-slate-400 shrink-0' : 'text-red-500 shrink-0'} />
                                            <span className="flex-1 text-[11.5px] font-semibold text-slate-700 capitalize truncate">
                                                {j.syncType}
                                                <span className="ml-1.5 font-normal text-slate-400">
                                                    {j.status === 'timed_out' ? 'timed out' : j.status}
                                                </span>
                                            </span>
                                        </div>
                                        {j.error && (
                                            <p className="mt-1 text-[10.5px] text-slate-500 leading-snug line-clamp-3">
                                                {j.error}
                                            </p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}

                        {notice && (
                            <p className={`mt-2.5 text-[10.5px] leading-snug ${notice.tone === 'err' ? 'text-red-600' : 'text-emerald-700'}`}>
                                {notice.text}
                            </p>
                        )}

                        {running && (
                            <p className="mt-2.5 text-[10px] text-slate-400 leading-snug">
                                Datasets run one at a time — they share a single Meesho session.
                                Stopping finishes at the next safe point, usually within a minute.
                            </p>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default MeeshoSyncIndicator;
