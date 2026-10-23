/**
 * Per-type upload checklist for one marketplace account, shown inside the
 * upload tour while the account is not yet ready for Cost Sheet seeding.
 *
 * Polls while mounted, so statuses stay current. Hides itself when ready,
 * untracked, or on error.
 */
import React, { useEffect, useState } from 'react';
import { CheckCircle, Circle, Loader2, XCircle } from 'lucide-react';
import api from '../api';

const POLL_MS = 4000;

const STATUS_UI = {
    completed:  { label: 'Done',            className: 'text-emerald-600' },
    processing: { label: 'Processing',      className: 'text-blue-600' },
    failed:     { label: 'Failed — upload again', className: 'text-red-600' },
    pending:    { label: 'Upload needed',   className: 'text-amber-600' },
};

const StatusIcon = ({ status }) => {
    if (status === 'completed') return <CheckCircle size={15} className="text-emerald-500 flex-shrink-0" />;
    if (status === 'processing') return <Loader2 size={15} className="text-blue-500 animate-spin flex-shrink-0" />;
    if (status === 'failed') return <XCircle size={15} className="text-red-500 flex-shrink-0" />;
    return <Circle size={15} className="text-slate-300 flex-shrink-0" />;
};

const UploadReadinessChecklist = ({ marketplaceId, refreshKey = '', compact = false }) => {
    const [readiness, setReadiness] = useState(null);
    const [loaded, setLoaded] = useState(false);
    const [pollTick, setPollTick] = useState(0);

    useEffect(() => {
        if (!marketplaceId) {
            setReadiness(null);
            setLoaded(false);
            return undefined;
        }
        let active = true;
        api.get(`/upload/readiness/${marketplaceId}`, { skipErrorToast: true })
            .then(({ data }) => {
                if (!active) return;
                const r = data?.data ?? data ?? null;
                setReadiness(r && !r.isReady && r.totalRequired > 0 ? r : null);
            })
            .catch(() => { if (active) setReadiness(null); })
            .finally(() => { if (active) setLoaded(true); });
        return () => { active = false; };
    }, [marketplaceId, refreshKey, pollTick]);

    useEffect(() => {
        if (!readiness) return undefined;
        const timer = setTimeout(() => setPollTick((tick) => tick + 1), POLL_MS);
        return () => clearTimeout(timer);
    }, [readiness, pollTick]);

    if (!loaded && marketplaceId) {
        return (
            <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
                <Loader2 size={12} className="animate-spin" />
                Checking upload status…
            </div>
        );
    }

    if (!readiness) return null;

    if (compact) {
        return (
            <div className="mt-3 rounded-xl border border-blue-100 bg-blue-50/60 px-3 py-2">
                <p className="text-[10px] font-bold text-blue-700 uppercase tracking-wide mb-1.5">
                    Required for Cost Sheet · {readiness.totalCompleted}/{readiness.totalRequired} uploaded
                </p>
                <div className="flex flex-wrap gap-1.5">
                    {readiness.requiredTypes.map((r) => {
                        const status = r.status || (r.completed ? 'completed' : 'pending');
                        const ui = STATUS_UI[status] || STATUS_UI.pending;
                        return (
                            <span key={r.type} className="inline-flex items-center gap-1.5 rounded-full bg-white border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700">
                                <StatusIcon status={status} />
                                {r.label}
                                <span className={`font-medium ${ui.className}`}>· {ui.label}</span>
                            </span>
                        );
                    })}
                </div>
            </div>
        );
    }

    return (
        <div className="mt-3 rounded-xl border border-blue-100 bg-blue-50/60 px-4 py-3 space-y-1.5">
            <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-2">
                Required for Cost Sheet — {readiness.totalCompleted}/{readiness.totalRequired} uploaded
            </p>
            {readiness.requiredTypes.map((r) => {
                const status = r.status || (r.completed ? 'completed' : 'pending');
                const ui = STATUS_UI[status] || STATUS_UI.pending;
                return (
                    <div key={r.type} className="flex items-center gap-2.5 text-sm">
                        <StatusIcon status={status} />
                        <span className={status === 'completed' ? 'text-emerald-700 line-through decoration-emerald-300' : 'text-slate-700 font-medium'}>
                            {r.label}
                        </span>
                        <span className={`ml-auto text-xs font-medium ${ui.className}`}>{ui.label}</span>
                    </div>
                );
            })}
        </div>
    );
};

export default UploadReadinessChecklist;
