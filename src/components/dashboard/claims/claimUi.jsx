import React, { useState } from 'react';
import { Check, Copy } from 'lucide-react';

export const CLAIM_STATUS_META = {
    pending: { label: 'Pending', dot: 'bg-amber-500', chip: 'bg-amber-50 text-amber-700 ring-amber-200' },
    reopened: { label: 'Reopened', dot: 'bg-sky-500', chip: 'bg-sky-50 text-sky-700 ring-sky-200' },
    approved: { label: 'Approved', dot: 'bg-emerald-500', chip: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
    rejected: { label: 'Rejected', dot: 'bg-rose-500', chip: 'bg-rose-50 text-rose-700 ring-rose-200' },
};

const metaFor = (status) => CLAIM_STATUS_META[status] || {
    label: status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Unknown',
    dot: 'bg-slate-400',
    chip: 'bg-slate-50 text-slate-600 ring-slate-200',
};

export const ClaimStatusBadge = ({ status, size = 'md', title }) => {
    const meta = metaFor(status);
    const pad = size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs';
    return (
        <span title={title} className={`inline-flex items-center gap-1.5 rounded-full font-semibold ring-1 ring-inset whitespace-nowrap ${pad} ${meta.chip}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
            {meta.label}
        </span>
    );
};

export const fmtINR = (n, { compact = false } = {}) => {
    const value = Number(n || 0);
    if (compact && value >= 100000) {
        return `₹${(value / 100000).toLocaleString('en-IN', { maximumFractionDigits: 2 })}L`;
    }
    return `₹${value.toLocaleString('en-IN', { minimumFractionDigits: value % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;
};

export const fmtShortDate = (v) => {
    if (!v) return '—';
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

// 'YYYY-MM-DD' DATE columns arrive as raw strings — format without a Date round-trip so IST users don't shift a day.
export const fmtDateOnly = (v) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v || ''));
    if (!m) return '—';
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${m[3]} ${months[Number(m[2]) - 1]} ${m[1]}`;
};

export const timeAgo = (v) => {
    if (!v) return null;
    const ms = Date.now() - new Date(v).getTime();
    if (Number.isNaN(ms)) return null;
    const mins = Math.round(ms / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.round(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.round(hours / 24);
    if (days < 30) return `${days}d ago`;
    return fmtShortDate(v);
};

export const isRtoReturn = (row) => /rto/i.test(String(row?.type_of_return || ''));

export const suggestDescription = (row) => {
    if (!row) return '';
    const via = [row.awb_number && `AWB ${row.awb_number}`, row.courier_partner].filter(Boolean).join(', ');
    const days = Number(row.days_pending || 0);
    if (isRtoReturn(row)) {
        const since = row.dispatch_date
            ? `was dispatched on ${fmtDateOnly(row.dispatch_date)} (${days} days ago)`
            : `has been in transit for ${days} days`;
        return `RTO shipment for sub-order ${row.suborder_number}${via ? ` (${via})` : ''} ${since} and has still not been delivered back to our warehouse. Please investigate and process a claim for the undelivered RTO shipment.`;
    }
    const since = row.return_created_date
        ? `was created on ${fmtDateOnly(row.return_created_date)} (${days} days ago)`
        : `has been pending for ${days} days`;
    return `Customer return for sub-order ${row.suborder_number}${via ? ` (${via})` : ''} ${since} and has still not been received at our warehouse. Please investigate and process a claim for the undelivered return shipment.`;
};

export const CopyButton = ({ value, label = 'Copy', className = '' }) => {
    const [copied, setCopied] = useState(false);
    const copy = async (e) => {
        e.stopPropagation();
        try {
            await navigator.clipboard.writeText(String(value));
            setCopied(true);
            setTimeout(() => setCopied(false), 1400);
        } catch {
            setCopied(false);
        }
    };
    return (
        <button type="button" onClick={copy} title={copied ? 'Copied' : label}
            className={`inline-flex items-center justify-center rounded-md p-1 text-slate-400 hover:text-violet-600 hover:bg-violet-50 transition-colors ${className}`}>
            {copied ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
        </button>
    );
};
