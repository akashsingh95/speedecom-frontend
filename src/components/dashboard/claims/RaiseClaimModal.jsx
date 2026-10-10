import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
    X, Ticket, Lock, AlertTriangle, Phone, Send, Loader2, CheckCircle2,
    ShieldAlert, RotateCcw, Info, Clock, RefreshCw, ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';
import api from '../../../api';
import { ClaimStatusBadge, CopyButton, fmtShortDate, fmtINR } from './claimUi';

const ISSUE_LABEL = 'I have not received my Return/RTO shipment';
const MIN_DESC = 10;
const MAX_DESC = 1000;
const PHONE_RE = /^[6-9]\d{9}$/;

const ERROR_COPY = {
    MEESHO_UNCONFIRMED: { title: 'Outcome unknown', tone: 'amber', retryable: false },
    SESSION_UNAVAILABLE: { title: 'Meesho session unavailable', tone: 'rose', retryable: true },
    MEESHO_UNREACHABLE: { title: 'Could not reach Meesho', tone: 'rose', retryable: true },
    MEESHO_REJECTED: { title: 'Meesho rejected the claim', tone: 'rose', retryable: true },
    ALREADY_RAISED: { title: 'Claim already raised', tone: 'amber', retryable: false },
    IN_PROGRESS: { title: 'Already in progress', tone: 'amber', retryable: true },
};

// ─── Form field primitives ────────────────────────────────────────────────────

const FormLabel = ({ children, required }) => (
    <label className="mb-1.5 block text-sm font-medium text-slate-700">
        {children}{required && <span className="ml-0.5 text-rose-500">*</span>}
    </label>
);

const ReadonlyField = ({ value, mono, copyable }) => (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
        <span className={`flex-1 truncate text-sm text-slate-600 ${mono ? 'font-mono' : 'font-medium'}`}>
            {value || '—'}
        </span>
        <div className="flex shrink-0 items-center gap-1">
            {copyable && value && <CopyButton value={value} />}
            <Lock size={13} className="text-slate-300" />
        </div>
    </div>
);

const ReadonlySelect = ({ children }) => (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
        <span className="flex-1 truncate text-sm font-medium text-slate-600">{children}</span>
        <Lock size={13} className="shrink-0 text-slate-300" />
    </div>
);

// ─── Shared sub-components ────────────────────────────────────────────────────

const LoadingBody = () => (
    <div className="space-y-4 px-6 py-5">
        {[48, 48, 48, 48, 96, 48].map((h, i) => (
            <div key={i} className="relative overflow-hidden rounded-lg bg-slate-100" style={{ height: h }}>
                <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/70 to-transparent" />
            </div>
        ))}
    </div>
);

const SubmittingOverlay = ({ accountName }) => (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/90 backdrop-blur-[2px]">
        <div className="relative flex h-16 w-16 items-center justify-center">
            <span className="absolute inset-0 animate-ping rounded-full bg-violet-200 opacity-60" />
            <span className="relative flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-indigo-600 shadow-lg shadow-violet-200">
                <Loader2 size={24} className="animate-spin text-white" />
            </span>
        </div>
        <p className="mt-5 text-sm font-bold text-slate-900">Creating ticket on Meesho…</p>
        <p className="mt-1 max-w-xs text-center text-xs text-slate-500">
            Submitting through {accountName
                ? <span className="font-semibold text-slate-700">{accountName}</span>
                : 'the account'}&apos;s secure session. Please keep this window open.
        </p>
    </motion.div>
);

const SuccessBody = ({ result, onClose }) => (
    <div className="px-6 pb-6 pt-8 text-center">
        <motion.div initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 18 }}
            className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 ring-8 ring-emerald-50/60">
            <CheckCircle2 size={36} className="text-emerald-600" />
        </motion.div>
        <h3 className="mt-4 font-heading text-xl font-bold text-slate-900">Claim raised</h3>
        <p className="mt-1 text-sm text-slate-500">{result.meeshoMessage || 'Meesho support will review it shortly.'}</p>

        <div className="mx-auto mt-5 inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Ticket</span>
            <span className="font-mono text-lg font-bold text-slate-900">#{result.ticketId}</span>
            <CopyButton value={result.ticketId} label="Copy ticket ID" />
        </div>

        {!result.persisted && (
            <p className="mx-auto mt-4 max-w-sm rounded-xl bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
                The ticket was created on Meesho but couldn&apos;t be saved in SpeedEcom. Please note the ticket ID.
            </p>
        )}

        <ol className="mx-auto mt-6 grid max-w-md grid-cols-3 gap-2 text-left">
            {[
                { icon: CheckCircle2, title: 'Raised', desc: 'Ticket created', done: true },
                { icon: Clock, title: 'Meesho review', desc: 'Update within 24h' },
                { icon: RefreshCw, title: 'Track & recover', desc: 'Sync Claims for status' },
            ].map(({ icon: Icon, title, desc, done }) => (
                <li key={title} className={`rounded-xl border p-2.5 ${done ? 'border-emerald-200 bg-emerald-50/60' : 'border-slate-200 bg-white'}`}>
                    <Icon size={14} className={done ? 'text-emerald-600' : 'text-slate-400'} />
                    <p className="mt-1 text-xs font-bold text-slate-800">{title}</p>
                    <p className="text-[11px] text-slate-500">{desc}</p>
                </li>
            ))}
        </ol>

        <button type="button" onClick={onClose}
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-6 py-2.5 text-sm font-bold text-white hover:bg-slate-800 active:scale-[0.98] transition-all">
            Done
        </button>
    </div>
);

const ExistingClaim = ({ claim }) => (
    <div className="rounded-2xl border border-violet-200 bg-violet-50/50 p-4">
        <div className="flex items-start justify-between gap-3">
            <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-violet-500">Claim already raised</p>
                <p className="mt-1 flex items-center gap-1 font-mono text-base font-bold text-slate-900">
                    #{claim.ticket_id}<CopyButton value={claim.ticket_id} />
                </p>
                <p className="mt-0.5 text-xs text-slate-500">Raised {fmtShortDate(claim.raised_at)}</p>
            </div>
            <div className="text-right">
                <ClaimStatusBadge status={claim.ticket_status} />
                {claim.claim_amount !== null && claim.claim_amount !== undefined && (
                    <p className="mt-2 text-lg font-bold text-emerald-700">{fmtINR(claim.claim_amount)}</p>
                )}
            </div>
        </div>
        {claim.last_update && (
            <p className="mt-3 rounded-xl bg-white px-3 py-2 text-xs leading-relaxed text-slate-600 ring-1 ring-violet-100">
                {claim.last_update}
            </p>
        )}
    </div>
);

const ErrorCard = ({ error, onRetry }) => {
    const copy = ERROR_COPY[error.code] || { title: 'Claim not raised', tone: 'rose', retryable: true };
    const amber = copy.tone === 'amber';
    return (
        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
            className={`flex items-start gap-3 rounded-2xl border p-3.5 ${amber ? 'border-amber-200 bg-amber-50' : 'border-rose-200 bg-rose-50'}`}>
            <ShieldAlert size={18} className={`mt-0.5 shrink-0 ${amber ? 'text-amber-600' : 'text-rose-600'}`} />
            <div className="min-w-0 flex-1">
                <p className={`text-sm font-bold ${amber ? 'text-amber-900' : 'text-rose-900'}`}>{copy.title}</p>
                <p className={`mt-0.5 text-xs leading-relaxed ${amber ? 'text-amber-800' : 'text-rose-800'}`}>{error.message}</p>
            </div>
            {copy.retryable && (
                <button type="button" onClick={onRetry}
                    className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50">
                    <RotateCcw size={12} /> Retry
                </button>
            )}
        </motion.div>
    );
};

// ─── Main modal ───────────────────────────────────────────────────────────────

/**
 * target: { marketplaceId, suborderNumber, awbNumber, accountName }
 */
const RaiseClaimModal = ({ target, onClose, onRaised }) => {
    const open = Boolean(target);
    const [phase, setPhase] = useState('loading'); // loading | form | blocked | success | loadError
    const [ctx, setCtx] = useState(null);
    const [description, setDescription] = useState('');
    const [callback, setCallback] = useState('');
    const [touched, setTouched] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);
    const [result, setResult] = useState(null);
    const [reloadKey, setReloadKey] = useState(0);

    useEffect(() => {
        if (!target) return undefined;
        let cancelled = false;
        setPhase('loading');
        setCtx(null);
        setError(null);
        setResult(null);
        setDescription('');
        setTouched(false);
        (async () => {
            try {
                const { data } = await api.get('/returns/claims/context', {
                    params: {
                        marketplaceId: target.marketplaceId,
                        suborderNumber: target.suborderNumber,
                        ...(target.awbNumber ? { awbNumber: target.awbNumber } : {}),
                    },
                    skipErrorToast: true,
                });
                if (cancelled) return;
                setCtx(data);
                setCallback(data.defaults?.callbackNumber || '');
                setPhase(data.canRaise ? 'form' : 'blocked');
            } catch (err) {
                if (cancelled) return;
                setError({ message: err.response?.data?.message || 'Could not load this return. Please try again.' });
                setPhase('loadError');
            }
        })();
        return () => { cancelled = true; };
    }, [target, reloadKey]);

    useEffect(() => {
        if (!open) return undefined;
        const onKey = (e) => { if (e.key === 'Escape' && !submitting) onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, submitting, onClose]);

    const descLen = description.trim().length;
    const descError = descLen < MIN_DESC
        ? `Add at least ${MIN_DESC} characters`
        : descLen > MAX_DESC ? `Keep it under ${MAX_DESC} characters` : null;
    const phoneError = PHONE_RE.test(callback) ? null : 'Enter a valid 10-digit mobile number';
    const canSubmit = phase === 'form' && !submitting && !descError && !phoneError;
    const accountName = ctx?.account?.name || target?.accountName;
    const returnRow = ctx?.return;

    const submit = async () => {
        setTouched(true);
        if (!canSubmit) return;
        setSubmitting(true);
        setError(null);
        try {
            const { data } = await api.post('/returns/claims', {
                marketplaceId: target.marketplaceId,
                suborderNumber: target.suborderNumber,
                ...(target.awbNumber ? { awbNumber: target.awbNumber } : {}),
                description: description.trim(),
                callbackNumber: callback,
                issueCategory: ctx?.defaults?.issueCategory || 5,
            }, { skipErrorToast: true });
            setResult(data);
            setPhase('success');
            toast.success(`Claim raised — Ticket #${data.ticketId}`, { description: accountName });
            onRaised?.(data.claim, target.suborderNumber);
        } catch (err) {
            const body = err.response?.data || {};
            const next = { code: body.code, message: body.message || 'Could not raise the claim. Please try again.' };
            setError(next);
            toast.error(ERROR_COPY[next.code]?.title || 'Claim not raised', { description: next.message });
            if (body.code === 'ALREADY_RAISED' && body.claim) {
                setCtx(prev => ({ ...prev, existingClaim: body.claim, canRaise: false }));
                setPhase('blocked');
                onRaised?.(body.claim, target.suborderNumber);
            }
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <AnimatePresence>
            {open && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
                        onClick={() => { if (!submitting) onClose(); }} />

                    <motion.div role="dialog" aria-modal="true" aria-labelledby="raise-claim-title"
                        initial={{ opacity: 0, y: 16, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 12, scale: 0.97 }}
                        transition={{ type: 'spring', stiffness: 320, damping: 28 }}
                        className="relative flex max-h-[calc(100vh-2rem)] w-full max-w-lg flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">

                        {/* Header */}
                        <div className="relative shrink-0 overflow-hidden bg-gradient-to-br from-violet-600 via-violet-600 to-indigo-600 px-6 py-5 text-white">
                            <div className="pointer-events-none absolute -right-10 -top-16 h-44 w-44 rounded-full bg-white/10 blur-2xl" />
                            <div className="relative flex items-center justify-between gap-4">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25 backdrop-blur">
                                        <Ticket size={18} />
                                    </div>
                                    <div>
                                        <h2 id="raise-claim-title" className="font-heading text-base font-bold leading-tight">Raise a Ticket</h2>
                                        <p className="text-xs text-violet-200">{accountName || 'Meesho support'}</p>
                                    </div>
                                </div>
                                <button type="button" onClick={onClose} disabled={submitting} aria-label="Close"
                                    className="rounded-xl p-1.5 text-white/70 hover:bg-white/15 hover:text-white disabled:opacity-40 transition-colors">
                                    <X size={18} />
                                </button>
                            </div>
                        </div>

                        {/* Body */}
                        <div className="relative flex-1 overflow-y-auto">
                            <AnimatePresence>{submitting && <SubmittingOverlay accountName={accountName} />}</AnimatePresence>

                            {phase === 'loading' && <LoadingBody />}

                            {phase === 'loadError' && (
                                <div className="p-6">
                                    <ErrorCard error={error} onRetry={() => setReloadKey(k => k + 1)} />
                                </div>
                            )}

                            {phase === 'success' && result && <SuccessBody result={result} onClose={onClose} />}

                            {phase === 'blocked' && ctx && (
                                <div className="space-y-4 p-6">
                                    {ctx.existingClaim ? <ExistingClaim claim={ctx.existingClaim} /> : (
                                        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                                            <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-600" />
                                            <div>
                                                <p className="text-sm font-bold text-amber-900">This return can&apos;t be claimed</p>
                                                <p className="mt-0.5 text-xs leading-relaxed text-amber-800">{ctx.blocker}</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {phase === 'form' && returnRow && (
                                <div className="px-6 py-5 space-y-4">
                                    {/* Breadcrumb */}
                                    <div className="flex flex-wrap items-center gap-1 text-[11px] text-slate-400">
                                        <span>Help</span>
                                        <ChevronRight size={10} />
                                        <span>Returns/RTO &amp; Exchange</span>
                                        <ChevronRight size={10} />
                                        <span className="font-medium text-slate-600">Raise a Ticket</span>
                                    </div>

                                    {/* Issue */}
                                    <div>
                                        <FormLabel required>Issue</FormLabel>
                                        <ReadonlySelect>{ISSUE_LABEL}</ReadonlySelect>
                                    </div>

                                    {/* Sub Order Number */}
                                    <div>
                                        <FormLabel required>Sub Order Number</FormLabel>
                                        <ReadonlyField value={returnRow.suborder_number} mono copyable />
                                    </div>

                                    {/* AWB Number */}
                                    <div>
                                        <FormLabel required>AWB Number</FormLabel>
                                        <ReadonlyField value={returnRow.awb_number} mono copyable />
                                    </div>

                                    {/* Logistics Partner */}
                                    <div>
                                        <FormLabel required>Logistics Partner Name</FormLabel>
                                        <ReadonlySelect>{returnRow.courier_partner || '—'}</ReadonlySelect>
                                    </div>

                                    {/* Description */}
                                    <div>
                                        <FormLabel required>Description</FormLabel>
                                        <textarea
                                            id="claim-desc"
                                            rows={4}
                                            value={description}
                                            maxLength={MAX_DESC}
                                            onChange={e => setDescription(e.target.value)}
                                            onBlur={() => setTouched(true)}
                                            placeholder="Describe the issue with this shipment…"
                                            className={`w-full resize-none rounded-lg border px-3.5 py-2.5 text-sm leading-relaxed text-slate-800 shadow-sm transition-all focus:outline-none focus:ring-4 ${
                                                touched && descError
                                                    ? 'border-rose-300 focus:border-rose-400 focus:ring-rose-500/10'
                                                    : 'border-slate-200 focus:border-violet-400 focus:ring-violet-500/10'
                                            }`}
                                        />
                                        <div className="mt-1 flex items-center justify-between text-[11px]">
                                            <span className="text-rose-600">{touched && descError}</span>
                                            <span className={descLen > MAX_DESC * 0.9 ? 'font-semibold text-amber-600' : 'text-slate-400'}>
                                                {descLen}/{MAX_DESC}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Callback Number */}
                                    <div>
                                        <FormLabel required>Callback Number</FormLabel>
                                        <div className={`flex items-center overflow-hidden rounded-lg border shadow-sm transition-all focus-within:ring-4 ${
                                            touched && phoneError
                                                ? 'border-rose-300 focus-within:ring-rose-500/10'
                                                : 'border-slate-200 focus-within:border-violet-400 focus-within:ring-violet-500/10'
                                        }`}>
                                            <span className="flex items-center gap-1.5 self-stretch border-r border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-500">
                                                <Phone size={13} /> +91
                                            </span>
                                            <input
                                                id="claim-phone"
                                                inputMode="numeric"
                                                autoComplete="tel-national"
                                                value={callback}
                                                onChange={e => setCallback(e.target.value.replace(/\D/g, '').slice(0, 10))}
                                                onBlur={() => setTouched(true)}
                                                className="w-full border-0 px-3 py-2.5 text-sm font-semibold tracking-wide text-slate-800 focus:outline-none focus:ring-0"
                                                placeholder="10-digit mobile number"
                                            />
                                        </div>
                                        <p className="mt-1 text-[11px] text-rose-600">{touched && phoneError}</p>
                                    </div>

                                    {error && <ErrorCard error={error} onRetry={submit} />}
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        {phase === 'form' && (
                            <div className="flex shrink-0 flex-col-reverse gap-3 border-t border-slate-100 bg-slate-50/70 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                                <p className="flex items-start gap-1.5 text-[11px] leading-snug text-slate-500 sm:max-w-[55%]">
                                    <Info size={12} className="mt-px shrink-0 text-slate-400" />
                                    Creates a real support ticket on Meesho. It can&apos;t be withdrawn from SpeedEcom.
                                </p>
                                <div className="flex items-center justify-end gap-2">
                                    <button type="button" onClick={onClose} disabled={submitting}
                                        className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50 transition-colors">
                                        Cancel
                                    </button>
                                    <button type="button" onClick={submit}
                                        disabled={submitting || (touched && !canSubmit) || error?.code === 'MEESHO_UNCONFIRMED'}
                                        className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-violet-200 hover:from-violet-700 hover:to-indigo-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 transition-all">
                                        {submitting ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                                        Submit
                                    </button>
                                </div>
                            </div>
                        )}
                        {(phase === 'blocked' || phase === 'loadError') && (
                            <div className="flex shrink-0 justify-end border-t border-slate-100 bg-slate-50/70 px-6 py-4">
                                <button type="button" onClick={onClose}
                                    className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-bold text-white hover:bg-slate-800 transition-colors">
                                    Close
                                </button>
                            </div>
                        )}
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default RaiseClaimModal;
