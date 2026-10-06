import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { initiateExport, forceCreateExport, pollExportStatus, getDownloadUrl } from '../../utils/exportUtils';
import { Link } from 'react-router-dom';
import {
    PackageX, Truck, CheckCircle, Clock, AlertTriangle, BarChart3,
    FileDown, RefreshCw, ScanLine, Search, Loader2, X, Zap,
    Filter, ChevronDown, Tag, AlertOctagon, Ticket, CalendarDays, Info,
    Inbox, Package,
} from 'lucide-react';
import ConfirmModal from '../ConfirmModal';
import {
    ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid,
    Tooltip, Legend, PieChart, Pie, Cell, BarChart, Bar, LabelList,
} from 'recharts';
import { toast } from 'sonner';
import api from '../../api';
import ReturnDateRangePicker from '../ReturnDateRangePicker';
import { useAuth } from '../../AuthContext';
import InfoTooltip from '../Tooltip';
import MarketplaceAccountSelector from '../MarketplaceAccountSelector';

// ─── Colour tokens ────────────────────────────────────────────────────────────
const COLORS = ['#7c3aed', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#6366f1', '#14b8a6', '#3b82f6'];
const STACKED_COLORS = { received: '#10b981', pending: '#6366f1', overdue: '#ef4444' };

// Fixed colors per segment name — keeps status breakdown pie consistent with the courier bar chart
const SEGMENT_COLORS = {
    'Received OK': '#10b981',  // green  — matches courier chart Received OK
    'Pending': '#6366f1',  // indigo — matches courier chart Pending bar
    'In Transit': '#06b6d4',  // cyan
    'Out for Delivery': '#f59e0b',  // amber
    'Overdue': '#ef4444',  // red    — matches courier chart Overdue bar
    'Damaged': '#f97316',  // orange — matches courier tooltip Damaged
    'Unknown': '#94a3b8',  // slate
};

const KPI_INFO = {
    'Total Returns': 'All unique returns in the selected date range, filtered by Return Created Date. Includes all RTO and customer returns across all courier statuses.',
    'In Transit': 'Returns currently moving towards you — courier file type is "intransit" and not yet physically received. The courier is in the process of delivering back to you.',
    'Out for Delivery': 'Returns where the courier is out for final delivery to your address (file type "ofd", not yet received). Expect these very soon.',
    'Pending': 'Meesho has marked delivery as complete but you have NOT yet scanned/confirmed physical receipt (file type "completed", arrival = not received). Action needed — scan these items in.',
    'Physically Received': 'Returns you have physically scanned and confirmed as received at your warehouse. Arrival status = arrived.',
    'Overdue': 'Returns still in transit or out for delivery for too long without arrival. RTO: dispatch date > 45 days old. Non-RTO: return created date > 25 days old. Requires immediate follow-up.',
    'Damaged': 'Returns you scanned and marked as "Damaged" condition. These are received items with damage noted at the time of scanning.',
};

// ─── Formatters ───────────────────────────────────────────────────────────────
const toDateKey = (v) => { const d = new Date(v); return Number.isNaN(d.getTime()) ? String(v || '') : d.toISOString().slice(0, 10); };
const fmtAxisDate = (v) => { const d = new Date(v); return Number.isNaN(d.getTime()) ? String(v || '') : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }); };
const fmtDateCell = (v) => { const d = new Date(v); return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-IN'); };
const fmtNum = (n) => Number(n || 0).toLocaleString('en-IN');
const fmtPct = (n) => `${Number(n || 0).toFixed(1)}%`;

const isMeeshoScanEligible = (row) => {
    if (!row) return false;
    const arrival = String(row.arrival_status || '').toLowerCase();
    // Allow marking as arrived from any status — user may not have latest file uploaded
    return row.platform === 'meesho' && arrival === 'not_arrived';
};

// ─── Tiny reusable components ─────────────────────────────────────────────────
const PopupModal = ({ isOpen, onClose, title, subtitle, right, children }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full max-w-[95vw] max-h-[calc(100vh-2rem)] bg-slate-50 shadow-2xl flex flex-col rounded-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <div className="p-4 sm:px-6 sm:py-4 border-b border-slate-200 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between bg-white shrink-0">
                    <div>
                        <h2 className="text-base font-bold text-slate-900">{title}</h2>
                        {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
                    </div>
                    <div className="flex items-center gap-4">
                        {right}
                        <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors">
                            <X size={20} />
                        </button>
                    </div>
                </div>
                <div className="p-4 sm:p-6 overflow-y-auto flex-1 bg-slate-50/50">
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-6 min-h-min">
                        {children}
                    </div>
                </div>
            </div>
        </div>
    );
};

const KpiCard = ({ title, value, icon: Icon, tone = 'slate', attention = false, onClick, info, index = 0 }) => {
    const [showInfo, setShowInfo] = useState(false);
    const toneMap = {
        slate: 'bg-slate-50 text-slate-600',
        violet: 'bg-violet-50 text-violet-600',
        cyan: 'bg-cyan-50 text-cyan-600',
        emerald: 'bg-emerald-50 text-emerald-600',
        amber: 'bg-amber-50 text-amber-600',
        orange: 'bg-orange-50 text-orange-600',
        red: 'bg-red-50 text-red-600',
    };
    const tc = toneMap[tone] || toneMap.slate;
    const [iconBg, iconText] = tc.split(' ');
    return (
        <div
            className={`relative p-5 rounded-2xl border border-slate-200 bg-white shadow-sm hover:shadow-md animate-in fade-in slide-in-from-bottom-4 fill-mode-both ${onClick ? 'cursor-pointer hover:border-violet-300 hover:scale-[1.02]' : ''}`}
            onClick={onClick}
            style={{ transition: 'box-shadow 0.2s ease, border-color 0.2s ease, transform 0.2s ease', animationDuration: '450ms', animationDelay: `${index * 60}ms` }}
        >
            {/* Top row: icon+badge left, info button right */}
            <div className="flex items-start justify-between mb-4">

                {/* Icon with attention badge on corner */}
                <div className="relative inline-flex shrink-0">
                    <div className={`p-2.5 rounded-xl ${iconBg}`}>
                        <Icon className={iconText} size={20} />
                    </div>
                    {attention && (
                        <span className="absolute -top-1 -right-1 flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                            <span className="relative inline-flex h-3 w-3 rounded-full bg-red-500 ring-2 ring-white" />
                        </span>
                    )}
                </div>

                {/* Info — bordered circle button */}
                {info && (
                    <div
                        className="relative"
                        onClick={e => e.stopPropagation()}
                        onMouseEnter={() => setShowInfo(true)}
                        onMouseLeave={() => setShowInfo(false)}
                    >
                        <button className="w-6 h-6 flex items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 hover:border-slate-400 hover:text-slate-700 transition-all shadow-sm">
                            <Info size={12} />
                        </button>
                        {showInfo && (
                            <div className="absolute right-0 top-full mt-1.5 w-64 bg-slate-900 text-white text-[11px] rounded-xl p-3 shadow-xl z-[100] leading-relaxed pointer-events-none">
                                {info}
                            </div>
                        )}
                    </div>
                )}
            </div>

            <p className="text-sm font-medium text-slate-500 mb-1">{title}</p>
            <p className="text-2xl font-bold text-slate-900 tabular-nums">{value}</p>
        </div>
    );
};

const SectionShell = ({ title, subtitle, right, children }) => (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm animate-in fade-in slide-in-from-bottom-3 duration-500 fill-mode-both">
        <div className="px-6 py-4 border-b border-slate-100 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
                <h2 className="text-base font-bold text-slate-900">{title}</h2>
                {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
            </div>
            {right}
        </div>
        <div className="p-6">{children}</div>
    </div>
);

const ChartShell = ({ title, right, children, filterHint }) => (
    <div className={`bg-white rounded-2xl border shadow-sm animate-in fade-in slide-in-from-bottom-3 duration-500 fill-mode-both transition-colors ${filterHint ? 'border-violet-200' : 'border-slate-200'}`}>
        <div className={`px-6 py-3 border-b flex items-center justify-between gap-3 ${filterHint ? 'border-violet-100 bg-violet-50/40' : 'border-slate-100'}`}>
            <div className="min-w-0 flex-1">
                <h3 className="text-sm font-bold text-slate-900">{title}</h3>
                {filterHint && (
                    <p className="flex items-center gap-1 text-xs text-violet-600 mt-0.5 animate-in fade-in duration-300">
                        <Filter size={10} className="shrink-0" />
                        Filtered by: <span className="font-semibold truncate">"{filterHint}"</span>
                    </p>
                )}
            </div>
            {right}
        </div>
        <div className="p-4">{children}</div>
    </div>
);

const EmptyState = ({ title, description }) => (
    <div className="border border-dashed border-slate-200 rounded-xl p-8 text-center animate-in fade-in duration-500">
        <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3">
            <PackageX size={22} className="text-slate-400" />
        </div>
        <p className="text-sm font-semibold text-slate-700">{title}</p>
        {description && <p className="text-sm text-slate-500 mt-1">{description}</p>}
    </div>
);

const SkeletonCard = ({ index = 0 }) => (
    <div
        className="p-5 rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden relative"
        style={{ animationDelay: `${index * 60}ms` }}
    >
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/60 to-transparent -translate-x-full animate-[shimmer_1.8s_infinite]" />
        <div className="h-8 w-8 bg-slate-100 rounded-lg mb-4 animate-pulse" />
        <div className="h-3 w-24 bg-slate-100 rounded mb-2 animate-pulse" />
        <div className="h-7 w-20 bg-slate-100 rounded animate-pulse" />
    </div>
);

const CHART_BAR_HEIGHTS = [55, 75, 40, 85, 60, 70, 45, 90];
const ChartSkeleton = () => (
    <div className="h-[300px] rounded-xl overflow-hidden relative bg-slate-50">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/60 to-transparent -translate-x-full animate-[shimmer_1.8s_infinite]" />
        <div className="p-4">
            <div className="flex items-end gap-2 h-52 mt-4">
                {CHART_BAR_HEIGHTS.map((h, i) => (
                    <div key={i} className="flex-1 bg-slate-200 rounded-t-sm animate-pulse" style={{ height: `${h}%`, animationDelay: `${i * 80}ms` }} />
                ))}
            </div>
        </div>
    </div>
);

// Pager
const Pager = ({ pagination, kind, compact, onPageChange }) => {
    const { currentPage = 1, totalPages = 1, totalItems = 0 } = pagination || {};
    if (totalPages <= 1 && totalItems === 0) return null;
    return (
        <div className="flex items-center gap-1">
            {!compact && <span className="text-xs text-slate-500 mr-1">{fmtNum(totalItems)} items</span>}
            <button
                disabled={currentPage <= 1}
                onClick={() => onPageChange(kind, currentPage - 1)}
                className="px-2 py-1 text-xs rounded border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40"
            >Prev</button>
            <span className="text-xs text-slate-500 min-w-[3rem] text-center">{currentPage}/{totalPages}</span>
            <button
                disabled={currentPage >= totalPages}
                onClick={() => onPageChange(kind, currentPage + 1)}
                className="px-2 py-1 text-xs rounded border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40"
            >Next</button>
        </div>
    );
};

// Multi-select dropdown for return types
const ReturnTypeFilter = ({ options, selected, onChange }) => {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const toggle = (v) => {
        onChange(selected.includes(v) ? selected.filter(x => x !== v) : [...selected, v]);
    };

    const label = selected.length === 0 ? 'All Types' : `${selected.length} type${selected.length > 1 ? 's' : ''}`;

    return (
        <div ref={ref} className="relative">
            <button
                onClick={() => setOpen(o => !o)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border-2 text-sm font-bold transition-all shadow-sm tracking-wide ${selected.length > 0 ? 'bg-violet-100 border-violet-400 text-violet-800' : 'bg-white border-slate-300 text-slate-800 hover:border-violet-300 hover:text-violet-700'}`}
            >
                <Tag size={15} />
                {label}
                <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>
            {open && (
                <div className="absolute top-full left-0 mt-2 w-52 bg-white rounded-xl shadow-lg border border-slate-200 p-2 z-50 animate-in fade-in slide-in-from-top-1 duration-150">
                    <button
                        onClick={() => onChange([])}
                        className={`w-full text-left px-3 py-2 text-sm rounded-lg mb-1 ${selected.length === 0 ? 'bg-violet-50 text-violet-700 font-semibold' : 'hover:bg-slate-50 text-slate-600'}`}
                    >All Types</button>
                    <div className="h-px bg-slate-100 mb-1" />
                    <div className="max-h-48 overflow-y-auto space-y-0.5">
                        {options.map(opt => (
                            <button
                                key={opt}
                                onClick={() => toggle(opt)}
                                className={`w-full flex items-center justify-between text-left px-3 py-2 text-sm rounded-lg transition-colors ${selected.includes(opt) ? 'bg-violet-50 text-violet-700' : 'hover:bg-slate-50 text-slate-700'}`}
                            >
                                <span className="capitalize">{opt}</span>
                                {selected.includes(opt) && <CheckCircle size={13} className="text-violet-500" />}
                            </button>
                        ))}
                    </div>
                    {selected.length > 0 && (
                        <div className="mt-1 pt-1 border-t border-slate-100">
                            <button onClick={() => onChange([])} className="w-full text-xs text-slate-500 hover:text-red-500 px-2 py-1 text-left">Clear selection</button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

// ─── Pending Physical Receipt Section ─────────────────────────────────────────
const PendingPhysicalReceiptSection = ({ loading, pending, onScan, onPageChange, meeshoAccounts = [], showAccountCol = false, onRefresh }) => {
    const meeshoRows = pending?.meesho?.unscannedCompleted || [];
    const meeshoCompletedPagination = pending?.meesho?.unscannedCompletedPagination || { currentPage: 1, totalPages: 1, totalItems: meeshoRows.length, limit: 25 };
    const pendingMpNameMap = useMemo(() => new Map(meeshoAccounts.map(a => [String(a._id), a.name])), [meeshoAccounts]);
    const [expandedPending, setExpandedPending] = useState(new Set());

    const [bulkOpen, setBulkOpen] = useState(false);
    const [approveDate, setApproveDate] = useState('');
    const [approveDateField, setApproveDateField] = useState('return_created_date');
    const [approveAccountIds, setApproveAccountIds] = useState([]);
    const [approveLoading, setApproveLoading] = useState(false);
    const [confirmModal, setConfirmModal] = useState(null);
    const showConfirm = (opts) => setConfirmModal(opts);
    const closeConfirm = () => setConfirmModal(null);

    const DATE_FIELD_LABELS = {
        return_created_date: 'Return Created Date',
        delivered_date: 'Return Delivered Date',
    };

    const handleBulkApprove = async () => {
        if (!approveDate) { toast.error('Please select a date'); return; }
        setApproveLoading(true);
        try {
            const countParams = { date: approveDate, dateField: approveDateField };
            if (approveAccountIds.length > 0) countParams.marketplaceIds = JSON.stringify(approveAccountIds);
            const { data: countData } = await api.get('/returns/scan/bulk-approve-by-date/count', { params: countParams });
            const count = countData.count ?? 0;
            setApproveLoading(false);

            const accountLabel = approveAccountIds.length === 0 ? 'ALL Meesho accounts' : `${approveAccountIds.length} account(s)`;
            showConfirm({
                title: 'Bulk Arrive Returns',
                message: `${count} return${count !== 1 ? 's' : ''} will be marked as arrived.`,
                details: [
                    { label: 'Date Type', value: DATE_FIELD_LABELS[approveDateField] },
                    { label: 'Date', value: `on or before ${approveDate}` },
                    { label: 'Accounts', value: accountLabel },
                ],
                confirmText: 'Proceed',
                onConfirm: async () => {
                    setApproveLoading(true);
                    try {
                        const payload = { date: approveDate, dateField: approveDateField };
                        if (approveAccountIds.length > 0) payload.marketplaceIds = approveAccountIds;
                        const { data } = await api.post('/returns/scan/bulk-approve-by-date', payload);
                        toast.success(`${data.affectedCount ?? count} returns marked as arrived`);
                        setApproveDate('');
                        setBulkOpen(false);
                        onRefresh?.();
                    } catch (err) {
                        toast.error(err.response?.data?.message || 'Bulk approve failed');
                    } finally {
                        setApproveLoading(false);
                    }
                },
            });
        } catch (err) {
            toast.error(err.response?.data?.message || 'Bulk approve failed');
            setApproveLoading(false);
        }
    };

    const expandRow = (key) => setExpandedPending(prev => new Set([...prev, key]));
    const collapseRow = (key) => setExpandedPending(prev => { const n = new Set(prev); n.delete(key); return n; });

    const renderMeesho = (rows, emptyTitle, emptyDesc) => {
        if (!rows.length) return <EmptyState title={emptyTitle} description={emptyDesc} />;
        return (
            <div className="overflow-auto rounded-xl border border-slate-200 max-h-[420px]">
                <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 text-slate-600 sticky top-0 z-10 text-xs">
                        <tr>
                            {showAccountCol && <th className="text-left px-3 py-2 font-semibold">Account</th>}
                            <th className="text-left px-3 py-2 font-semibold">Suborder</th>
                            <th className="text-left px-3 py-2 font-semibold">SKU</th>
                            <th className="text-left px-3 py-2 font-semibold">AWB</th>
                            <th className="text-left px-3 py-2 font-semibold">Courier</th>
                            <th className="text-left px-3 py-2 font-semibold">Return Created</th>
                            <th className="text-right px-3 py-2 font-semibold">Days</th>
                            <th className="text-left px-3 py-2 font-semibold">Type</th>
                            <th className="text-right px-3 py-2 font-semibold">Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row, idx) => {
                            const days = Number(row.days_pending || 0);
                            const overdue = row.is_overdue ?? (days > 1);
                            const notArrived = String(row.arrival_status || '').toLowerCase() === 'not_arrived';
                            const rowKey = `${row.marketplace_id}:${row.suborder_number}`;
                            const accountName = row.marketplace_id ? (pendingMpNameMap.get(String(row.marketplace_id)) || '—') : '—';
                            return (
                                <tr key={`${rowKey}-${idx}`} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                                    {showAccountCol && (
                                        <td className="px-3 py-2 whitespace-nowrap">
                                            <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-pink-50 text-pink-700 text-xs font-medium max-w-[110px] truncate" title={accountName}>{accountName}</span>
                                        </td>
                                    )}
                                    <td className="px-3 py-2 whitespace-nowrap font-mono text-xs">{row.suborder_number || '—'}</td>
                                    <td className="px-3 py-2 whitespace-nowrap">{row.sku || '—'}</td>
                                    <td className="px-3 py-2 whitespace-nowrap font-mono text-xs">{row.awb_number || '—'}</td>
                                    <td className="px-3 py-2 whitespace-nowrap">{row.courier_partner || '—'}</td>
                                    <td className="px-3 py-2 whitespace-nowrap">{fmtDateCell(row.return_created_date)}</td>
                                    <td className={`px-3 py-2 text-right tabular-nums ${overdue ? 'text-red-600 font-semibold' : ''}`}>{days}</td>
                                    <td className="px-3 py-2 whitespace-nowrap">
                                        <span className={`px-2 py-0.5 text-xs rounded-full font-semibold ${row.return_file_type === 'completed' ? 'bg-amber-100 text-amber-700' :
                                            row.return_file_type === 'ofd' ? 'bg-cyan-100 text-cyan-700' :
                                                'bg-blue-100 text-blue-700'
                                            }`}>{row.return_file_type || '—'}</span>
                                    </td>
                                    <td className="px-3 py-2 text-right whitespace-nowrap">
                                        {notArrived ? (
                                            expandedPending.has(rowKey) ? (
                                                <div className="flex items-center justify-end gap-1 animate-in fade-in duration-150">
                                                    <button
                                                        type="button"
                                                        onClick={() => collapseRow(rowKey)}
                                                        title="Cancel"
                                                        className="inline-flex items-center justify-center p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                                                    >
                                                        <X size={13} />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        disabled={loading}
                                                        onClick={() => { collapseRow(rowKey); onScan('meesho', row, 'damaged'); }}
                                                        title="Mark as Arrived — Damaged"
                                                        className="inline-flex items-center justify-center p-1.5 rounded-lg bg-red-50 border border-red-200 text-red-600 hover:bg-red-100 disabled:opacity-50 transition-colors"
                                                    >
                                                        <AlertOctagon size={14} />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        disabled={loading}
                                                        onClick={() => { collapseRow(rowKey); onScan('meesho', row, 'ok'); }}
                                                        title="Mark as Arrived — OK"
                                                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                                                    >
                                                        <CheckCircle size={13} /> OK
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="flex items-center justify-end gap-1.5">
                                                    <button
                                                        type="button"
                                                        disabled={loading}
                                                        onClick={() => expandRow(rowKey)}
                                                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
                                                    >
                                                        <CheckCircle size={13} /> Mark Arrived
                                                    </button>
                                                </div>
                                            )
                                        ) : (
                                            <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-medium">
                                                <CheckCircle size={11} /> Arrived
                                            </span>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        );
    };

    return (
        <>
            <SectionShell
                title="Pending Returns Recieve"
                subtitle="Courier-completed returns not yet scanned as received — scan these first."
                right={
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setBulkOpen(true)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border bg-violet-50 border-violet-200 text-violet-700 hover:bg-violet-100 transition-colors"
                        >
                            <CalendarDays size={13} />
                            Bulk Arrive
                        </button>
                        <Pager pagination={meeshoCompletedPagination} kind="meeshoCompleted" compact onPageChange={onPageChange} />
                    </div>
                }
            >
                {loading && !pending ? (
                    <div className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="animate-spin" size={16} />Loading…</div>
                ) : (
                    renderMeesho(meeshoRows, 'No courier-completed returns pending scan', 'All caught up! No items awaiting physical receipt.')
                )}
            </SectionShell>

            {/* Bulk Arrive Modal */}
            {bulkOpen && (
                <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
                    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setBulkOpen(false)} />
                    <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
                            <div className="flex items-center gap-2">
                                <CalendarDays size={18} className="text-violet-600" />
                                <h2 className="text-base font-bold text-slate-800">Bulk Arrive by Date</h2>
                            </div>
                            <button onClick={() => setBulkOpen(false)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
                                <X size={18} />
                            </button>
                        </div>
                        <div className="p-6 space-y-5">
                            {meeshoAccounts.length > 0 && (
                                <div>
                                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Meesho Accounts</h3>
                                    <div className="rounded-lg border border-slate-200 overflow-hidden">
                                        <div className="max-h-44 overflow-y-auto">
                                            <label className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-slate-50 border-b border-slate-100 transition-colors">
                                                <input
                                                    type="checkbox"
                                                    checked={approveAccountIds.length === 0}
                                                    onChange={() => setApproveAccountIds([])}
                                                    className="w-4 h-4 rounded accent-violet-600"
                                                />
                                                <span className="text-sm font-semibold text-slate-700">All Accounts</span>
                                            </label>
                                            {meeshoAccounts.map(acc => (
                                                <label key={acc._id} className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-slate-50 border-b border-slate-100 last:border-0 transition-colors">
                                                    <input
                                                        type="checkbox"
                                                        checked={approveAccountIds.includes(acc._id)}
                                                        onChange={() => setApproveAccountIds(prev =>
                                                            prev.includes(acc._id) ? prev.filter(x => x !== acc._id) : [...prev, acc._id]
                                                        )}
                                                        className="w-4 h-4 rounded accent-violet-600"
                                                    />
                                                    <span className="text-sm text-slate-700 truncate" title={acc.name}>{acc.name}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}
                            <div className="border-t border-slate-100" />
                            <div>
                                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Date Type</h3>
                                <div className="flex gap-2">
                                    {[
                                        { value: 'return_created_date', label: 'Return Created' },
                                        { value: 'delivered_date', label: 'Delivered Date' },
                                    ].map(opt => (
                                        <button
                                            key={opt.value}
                                            type="button"
                                            onClick={() => setApproveDateField(opt.value)}
                                            className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold border transition-all ${approveDateField === opt.value
                                                ? 'bg-violet-100 border-violet-300 text-violet-700'
                                                : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                                                }`}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Mark arrived on or before</h3>
                                <input
                                    type="date"
                                    value={approveDate}
                                    onChange={e => setApproveDate(e.target.value)}
                                    max={new Date().toISOString().slice(0, 10)}
                                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white"
                                />
                            </div>
                            <button
                                onClick={handleBulkApprove}
                                disabled={approveLoading || !approveDate}
                                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 disabled:opacity-50 transition-colors"
                            >
                                {approveLoading ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle size={15} />}
                                {approveLoading ? 'Checking…' : 'Preview & Mark as Arrived'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <ConfirmModal
                isOpen={!!confirmModal}
                onClose={closeConfirm}
                onConfirm={confirmModal?.onConfirm}
                title={confirmModal?.title}
                message={confirmModal?.message}
                details={confirmModal?.details}
                confirmText={confirmModal?.confirmText}
            />
        </>
    );
};

// ─── Damaged Products Section ─────────────────────────────────────────────────
const DamagedProductsSection = ({ marketplaceIds, startDate, endDate, returnTypes, search, refreshKey, meeshoAccounts = [], showAccountCol = false }) => {
    const [data, setData] = useState([]);
    const [pagination, setPagination] = useState({ currentPage: 1, totalPages: 1, totalItems: 0, limit: 25 });
    const [loading, setLoading] = useState(false);
    const damagedMpNameMap = useMemo(() => new Map(meeshoAccounts.map(a => [String(a._id), a.name])), [meeshoAccounts]);

    const mktIdKey = useMemo(() => JSON.stringify(marketplaceIds || []), [marketplaceIds]);

    const fetchDamaged = useCallback(async (page = 1) => {
        const ids = marketplaceIds;
        if (!ids || !ids.length) return;
        setLoading(true);
        try {
            const params = {
                marketplaceIds: JSON.stringify(ids),
                page, limit: 25,
            };
            if (startDate) params.startDate = startDate;
            if (endDate) params.endDate = endDate;
            if (returnTypes && returnTypes.length) params.returnType = returnTypes.join(',');
            if (search) params.search = search;
            const response = await api.get('/returns/analysis/damaged', { params });
            setData(response.data || []);
            setPagination(response.pagination || { currentPage: page, totalPages: 1, totalItems: 0, limit: 25 });
        } catch (err) {
            console.error('Failed to fetch damaged products', err);
            setData([]);
        } finally {
            setLoading(false);
        }
     
    }, [mktIdKey, startDate, endDate, returnTypes, search, refreshKey]);

    useEffect(() => { fetchDamaged(1); }, [fetchDamaged]);

    const handleRaiseTicket = async (row) => {
        toast('Upcoming Feature! 🚧', {
            description: 'Directly raising tickets for damaged or overdue returns will be available in the next update.',
        });
    };

    if (!data.length && !loading) {
        return (
            <SectionShell title="Damaged Products" subtitle="Items scanned or marked as damaged condition.">
                <EmptyState title="No damaged items found" description="Damaged items will appear here after scanning with Damaged mode or clicking Damaged in Pending section." />
            </SectionShell>
        );
    }

    return (
        <SectionShell
            title="Damaged Products"
            subtitle={`${fmtNum(pagination.totalItems)} item${pagination.totalItems !== 1 ? 's' : ''} marked as damaged`}
            right={
                <Pager
                    pagination={pagination}
                    kind="damaged"
                    compact
                    onPageChange={(_, page) => fetchDamaged(page)}
                />
            }
        >
            {loading ? (
                <div className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="animate-spin" size={16} />Loading…</div>
            ) : (
                <div className="overflow-auto rounded-xl border border-slate-200 max-h-[400px]">
                    <table className="min-w-full text-sm">
                        <thead className="bg-red-50 text-slate-700 sticky top-0 z-10 text-xs">
                            <tr>
                                {showAccountCol && <th className="text-left px-3 py-2 font-semibold">Account</th>}
                                <th className="text-left px-3 py-2 font-semibold">Suborder</th>
                                <th className="text-left px-3 py-2 font-semibold">SKU</th>
                                <th className="text-left px-3 py-2 font-semibold">Product</th>
                                <th className="text-left px-3 py-2 font-semibold">AWB</th>
                                <th className="text-left px-3 py-2 font-semibold">Courier</th>
                                <th className="text-left px-3 py-2 font-semibold">Return Created</th>
                                <th className="text-left px-3 py-2 font-semibold">Reason</th>
                                <th className="text-center px-3 py-2 font-semibold">Ticket</th>
                                <th className="text-right px-3 py-2 font-semibold">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.map((row, idx) => {
                                const damagedAccountName = row.marketplace_id ? (damagedMpNameMap.get(String(row.marketplace_id)) || '—') : '—';
                                return (
                                    <tr key={`${row.suborder_number}-${idx}`} className={idx % 2 === 0 ? 'bg-white' : 'bg-red-50/30'}>
                                        {showAccountCol && (
                                            <td className="px-3 py-2 whitespace-nowrap">
                                                <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-pink-50 text-pink-700 text-xs font-medium max-w-[110px] truncate" title={damagedAccountName}>{damagedAccountName}</span>
                                            </td>
                                        )}
                                        <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">{row.suborder_number || '—'}</td>
                                        <td className="px-3 py-2 whitespace-nowrap">{row.sku || '—'}</td>
                                        <td className="px-3 py-2 max-w-[180px] truncate" title={row.product_name}>{row.product_name || '—'}</td>
                                        <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">{row.awb_number || '—'}</td>
                                        <td className="px-3 py-2 whitespace-nowrap">{row.courier_partner || '—'}</td>
                                        <td className="px-3 py-2 whitespace-nowrap">{fmtDateCell(row.return_created_date)}</td>
                                        <td className="px-3 py-2 max-w-[160px] truncate text-xs text-slate-600" title={row.return_reason}>{row.return_reason || '—'}</td>
                                        <td className="px-3 py-2 text-center">
                                            {row.ticket_raised ? (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
                                                    <CheckCircle size={11} /> Raised
                                                </span>
                                            ) : (
                                                <span className="text-xs text-slate-400">—</span>
                                            )}
                                        </td>
                                        <td className="px-3 py-2 text-right whitespace-nowrap">
                                            <button
                                                onClick={() => handleRaiseTicket(row)}
                                                title="Upcoming Feature"
                                                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-violet-100 text-violet-700 hover:bg-violet-200 transition-colors"
                                            >
                                                <Ticket size={11} />
                                                Raise Ticket
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </SectionShell>
    );
};

// ─── Courier 100% stacked bar custom tooltip ──────────────────────────────────
const CourierTooltip = ({ active, payload, label, grandTotal }) => {
    if (!active || !payload || !payload.length) return null;
    const d = payload[0]?.payload || {};
    const shareOfAll = grandTotal > 0 ? (d._total / grandTotal) * 100 : 0;
    const receivedCount = d._received || 0;
    const damagedCount = d._damaged || 0;
    const receivedOKCount = Math.max(0, receivedCount - damagedCount);

    const receivedPct = d.Received || 0;
    const damagedPct = d._damagedPct || 0;
    const receivedOKPct = Math.max(0, receivedPct - damagedPct);

    const rows = [
        { name: 'Received OK', pct: receivedOKPct, count: receivedOKCount, color: STACKED_COLORS.received },
        { name: 'Damaged', pct: damagedPct, count: damagedCount, color: '#f97316' },
        { name: 'Pending', pct: d.Pending, count: d._pending, color: STACKED_COLORS.pending },
        { name: 'Overdue', pct: d.Overdue, count: d._overdue, color: STACKED_COLORS.overdue },
    ];
    return (
        <div className="bg-white border border-slate-200 rounded-xl shadow-xl p-3 text-xs min-w-[220px]">
            <p className="font-bold text-slate-800 mb-2.5 text-sm">{label}</p>
            <div className="space-y-2">
                {rows.map(r => (
                    <div key={r.name} className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: r.color }} />
                        <span className="text-slate-600 flex-1">{r.name}</span>
                        <span className="font-semibold text-slate-800 tabular-nums">{fmtNum(r.count)}</span>
                        <span className="text-slate-400 tabular-nums w-12 text-right">{fmtPct(r.pct)}</span>
                    </div>
                ))}
            </div>
            <div className="border-t border-slate-100 mt-2.5 pt-2 flex items-center justify-between gap-4">
                <span className="text-slate-500 font-medium">Total returns</span>
                <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 tabular-nums">{fmtNum(d._total)}</span>
                    <span className="bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-semibold tabular-nums">{fmtPct(shareOfAll)} of all</span>
                </div>
            </div>
        </div>
    );
};

// ─── Export Picker Modal ──────────────────────────────────────────────────────
const ExportPickerModal = ({ isOpen, onClose, summary, exportParams }) => {
    const [selected, setSelected] = useState(new Set());
    const [phase, setPhase] = useState('select');
    const [statusMsg, setStatusMsg] = useState('');
    const [duplicateExport, setDuplicateExport] = useState(null);
    const pollRef = useRef(null);

    useEffect(() => {
        if (isOpen) {
            const initialSet = new Set();
            if (exportParams.status && exportParams.status !== 'all') {
                initialSet.add(exportParams.status);
            }
            setSelected(initialSet);
            setPhase('select');
            setStatusMsg('');
            setDuplicateExport(null);
        }
        return () => { if (pollRef.current) clearTimeout(pollRef.current); };
    }, [isOpen, exportParams.status]);

    const categories = [
        { key: 'in_transit', label: 'In Transit', count: summary?.inTransit, icon: Truck, bg: 'bg-cyan-50', text: 'text-cyan-600' },
        { key: 'out_for_delivery', label: 'Out for Delivery', count: summary?.outForDelivery, icon: Clock, bg: 'bg-amber-50', text: 'text-amber-600' },
        { key: 'courier_completed', label: 'Pending', count: summary?.courierCompleted, icon: BarChart3, bg: 'bg-slate-100', text: 'text-slate-600' },
        { key: 'physically_received', label: 'Physically Received', count: summary?.physicallyReceived, icon: CheckCircle, bg: 'bg-emerald-50', text: 'text-emerald-600' },
        { key: 'overdue', label: 'Overdue', count: summary?.overdue, icon: AlertTriangle, bg: 'bg-red-50', text: 'text-red-600' },
    ];
    const allSheetKeys = categories.map(c => c.key);
    const toggle = (k) => setSelected(prev => { const n = new Set(prev); n.has(k) ? n.delete(k) : n.add(k); return n; });

    const triggerDownload = async (exportId) => {
        try {
            const url = await getDownloadUrl(exportId);
            const a = document.createElement('a'); a.href = url; a.setAttribute('download', ''); document.body.appendChild(a); a.click(); a.remove();
            setPhase('completed'); setStatusMsg('Your file is downloading!');
        } catch { setPhase('failed'); setStatusMsg('Could not get download URL.'); }
    };

    const startPoll = (exportId) => {
        setPhase('queued'); setStatusMsg('Export queued — generating file…');
        pollExportStatus(exportId, (s) => { if (s.status === 'processing') { setPhase('processing'); setStatusMsg('Processing rows…'); } }, 180, 5000)
            .then(() => triggerDownload(exportId))
            .catch(err => { setPhase('failed'); setStatusMsg(err?.message || 'Export failed.'); });
    };

    const runExport = async (sheetKeys, force = false) => {
        setPhase('queued'); setStatusMsg('Submitting export…');
        try {
            const payload = { exportType: 'returns', ...exportParams, exportSheets: sheetKeys.join(','), marketplaceScope: 'meesho' };
            const res = force ? await forceCreateExport(payload) : await initiateExport(payload);
            if (res.duplicate) { setPhase('duplicate'); setDuplicateExport(res.existing_export); return; }
            startPoll(res.export_id);
        } catch (err) { setPhase('failed'); setStatusMsg(err?.message || 'Failed to start export.'); }
    };

    const busy = phase !== 'select' && phase !== 'completed' && phase !== 'failed' && phase !== 'duplicate';

    if (!isOpen) return null;

    if (phase !== 'select') {
        const icon = phase === 'completed' ? <CheckCircle size={28} className="text-emerald-500" />
            : phase === 'failed' ? <AlertTriangle size={28} className="text-red-500" />
                : phase === 'duplicate' ? <FileDown size={28} className="text-amber-500" />
                    : <Loader2 size={28} className="animate-spin text-violet-500" />;
        return (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={!busy ? onClose : undefined} />
                <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl flex flex-col items-center text-center p-8 gap-4 animate-in fade-in zoom-in-95 duration-200">
                    {icon}
                    <div>
                        <p className="text-sm font-bold text-slate-900">
                            {phase === 'completed' ? 'Download started!' : phase === 'failed' ? 'Export failed' : phase === 'duplicate' ? 'Existing export found' : 'Exporting…'}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">{statusMsg}</p>
                    </div>
                    {phase === 'duplicate' && duplicateExport && (
                        <div className="w-full space-y-2">
                            <button onClick={() => triggerDownload(duplicateExport.export_id)} className="w-full py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg">Download existing</button>
                            <button onClick={() => runExport(Array.from(selected).length ? Array.from(selected) : allSheetKeys, true)} className="w-full py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg">Generate new</button>
                        </div>
                    )}
                    {(phase === 'completed' || phase === 'failed') && <button onClick={onClose} className="text-xs text-slate-400 hover:text-slate-600 underline">Close</button>}
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl flex flex-col animate-in fade-in zoom-in-95 duration-200 overflow-hidden">
                <div className="px-6 pt-5 pb-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-violet-50 rounded-xl"><FileDown size={17} className="text-violet-600" /></div>
                        <div>
                            <h2 className="text-sm font-bold text-slate-900">Export Returns Data</h2>
                            <p className="text-xs text-slate-500 mt-0.5">Select what to export</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><X size={15} /></button>
                </div>
                <div className="px-6 pb-3">
                    {exportParams.status && exportParams.status !== 'all' ? (
                        <div className="w-full flex items-center justify-between px-4 py-3 bg-slate-100 text-slate-500 rounded-xl">
                            <span className="text-sm font-semibold">Single category active</span>
                            <span className="text-[11px]">Filtered by: {categories.find(c => c.key === exportParams.status)?.label || exportParams.status}</span>
                        </div>
                    ) : (
                        <button onClick={() => runExport(allSheetKeys)} className="w-full flex items-center justify-between px-4 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl group">
                            <div className="flex items-center gap-2.5"><Zap size={14} className="text-amber-400" /><span className="text-sm font-semibold">Export All (Multi-sheet)</span></div>
                            <span className="text-[11px] text-slate-400">All categories at once</span>
                        </button>
                    )}
                </div>
                <div className="flex items-center gap-3 px-6 pb-3">
                    <div className="flex-1 h-px bg-slate-100" />
                    <span className="text-[11px] text-slate-400">or select specific sheets</span>
                    <div className="flex-1 h-px bg-slate-100" />
                </div>
                <div className="px-6 pb-3 space-y-1.5">
                    {categories.map(({ key, label, count, icon: Icon, bg, text }) => {
                        const checked = selected.has(key);
                        return (
                            <button key={key} onClick={() => toggle(key)}
                                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all text-left ${checked ? 'border-violet-200 bg-violet-50' : 'border-slate-100 bg-slate-50/70 hover:border-slate-200 hover:bg-white'}`}
                            >
                                <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${checked ? 'bg-violet-600 border-violet-600' : 'border-slate-300 bg-white'}`}>
                                    {checked && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 10 8"><path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                                </div>
                                <div className={`p-1.5 rounded-lg ${bg}`}><Icon size={13} className={text} /></div>
                                <span className="flex-1 text-sm font-medium text-slate-700">{label}</span>
                                <span className={`text-xs font-semibold tabular-nums px-2 py-0.5 rounded-full ${(count ?? 0) > 0 ? 'bg-slate-100 text-slate-600' : 'bg-slate-50 text-slate-400'}`}>{fmtNum(count)}</span>
                            </button>
                        );
                    })}
                </div>
                <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between gap-3">
                    <span className="text-xs text-slate-400">{selected.size === 0 ? 'Nothing selected' : `${selected.size} sheet${selected.size > 1 ? 's' : ''} selected`}</span>
                    <div className="flex gap-2">
                        <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg">Cancel</button>
                        <button onClick={() => runExport(Array.from(selected))} disabled={selected.size === 0}
                            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-violet-600 hover:bg-violet-700 rounded-lg disabled:opacity-50"
                        ><FileDown size={13} />Export Selected</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ─── Main Component ───────────────────────────────────────────────────────────
const getReturnsDefaultDates = () => {
    try {
        const stored = localStorage.getItem('returns_date_range');
        if (stored) {
            const parsed = JSON.parse(stored);
            if (parsed.startDate && parsed.endDate) {
                return parsed;
            }
        }
    } catch (e) { }
    const end = new Date();
    const start = new Date();
    start.setMonth(start.getMonth() - 3);
    return {
        startDate: start.toISOString().split('T')[0],
        endDate: end.toISOString().split('T')[0]
    };
};

const RETURNS_SYNC_ROLES = ['Admin', 'SBM', 'SuperAdmin'];

const ReturnsTab = () => {
    const MAX_RANGE_DAYS = 190;
    const { user } = useAuth();
    const canTriggerReturnsSync = RETURNS_SYNC_ROLES.includes(user?.role);

    // Marketplace state — Meesho only
    const [meeshoAccounts, setMeeshoAccounts] = useState([]);
    const [selectedAccounts, setSelectedAccounts] = useState([]);

    // Clear any lingering localStorage cache that was previously used
    useEffect(() => {
        localStorage.removeItem('returns_tab_selected_accounts');
        localStorage.removeItem('cached_meesho_accounts');
    }, []);

    // Date range
    const [startDate, setStartDate] = useState(() => getReturnsDefaultDates().startDate);
    const [endDate, setEndDate] = useState(() => getReturnsDefaultDates().endDate);
    const [dateField, setDateField] = useState('return_created_date');

    // Return type filter
    const [returnTypeOptions, setReturnTypeOptions] = useState([]);
    const [selectedReturnTypes, setSelectedReturnTypes] = useState([]);

    // Global search
    const [globalSearch, setGlobalSearch] = useState('');
    const [globalSearchDraft, setGlobalSearchDraft] = useState('');

    // Analysis data
    const [loadingAnalysis, setLoadingAnalysis] = useState(false);
    const [summary, setSummary] = useState(null);
    const [statusBreakdown, setStatusBreakdown] = useState(null);
    const [reasons, setReasons] = useState(null);
    const [trend, setTrend] = useState(null);
    const [courierWise, setCourierWise] = useState([]);
    const [skuWise, setSkuWise] = useState([]);
    const [showSkuTable, setShowSkuTable] = useState(false);

    // Pending section
    const [loadingPending, setLoadingPending] = useState(false);
    const [pending, setPending] = useState(null);
    const [pendingPages, setPendingPages] = useState({ meeshoCompleted: 1, meeshoAll: 1 });

    // Returns table drawer
    const [loadingTable, setLoadingTable] = useState(false);
    const [returns, setReturns] = useState([]);
    const [pagination, setPagination] = useState({ currentPage: 1, totalPages: 1, totalItems: 0, limit: 25 });
    const [tableDraft, setTableDraft] = useState({ status: 'all', returnCategory: '', fileType: '', courierPartner: '', returnReason: '' });
    const [tableFilters, setTableFilters] = useState({ status: 'all', returnCategory: '', fileType: '', courierPartner: '', returnReason: '' });
    const [drawerOpen, setDrawerOpen] = useState(false);

    // Courier partners dropdown (for overdue filter)
    const [courierPartners, setCourierPartners] = useState([]);

    const [exportPickerOpen, setExportPickerOpen] = useState(false);

    // Refresh Returns — triggers a real Meesho sync, not just a client refetch
    const [syncingReturns, setSyncingReturns] = useState(false);
    const [returnsSyncQuota, setReturnsSyncQuota] = useState(null); // { count, limit, remaining }
    const syncPollRef = useRef(null);

    // ── Derived state ──────────────────────────────────────────────────────
    const activeMarketplaceIds = selectedAccounts;

    const meeshoAvailableMarketplaces = useMemo(() => [
        {
            key: 'Meesho',
            name: 'Meesho',
            accounts: meeshoAccounts
        }
    ], [meeshoAccounts]);

    const canQuery = useMemo(() => Boolean(activeMarketplaceIds.length && startDate && endDate), [activeMarketplaceIds, startDate, endDate]);

    // Map marketplace _id → name for the account column
    const mpNameMap = useMemo(() => new Map(meeshoAccounts.map(a => [String(a._id), a.name])), [meeshoAccounts]);
    const showAccountCol = activeMarketplaceIds.length > 1;

    const analysisParams = useMemo(() => ({
        marketplace: 'meesho',
        marketplaceIds: JSON.stringify(activeMarketplaceIds),
        startDate,
        endDate,
        dateField,
        ...(selectedReturnTypes.length ? { returnType: selectedReturnTypes.join(',') } : {}),
        ...(globalSearch ? { search: globalSearch } : {}),
    }), [activeMarketplaceIds, startDate, endDate, dateField, selectedReturnTypes, globalSearch]);



    // ── Load Meesho accounts ───────────────────────────────────────────────
    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            try {
                let accounts = [];
                // 1. Try /marketplaces/filter-options
                try {
                    const { data } = await api.get('/marketplaces/filter-options');
                    if (!cancelled && Array.isArray(data)) {
                        const meeshoGroups = data.filter(g => String(g.key || g.name || '').toLowerCase().includes('meesho'));
                        accounts = meeshoGroups.flatMap(g => g.accounts || []);
                    }
                } catch (e) {
                    console.warn('filter-options call error, falling back', e);
                }

                // 2. Fallback to /marketplaces if accounts still empty
                if (accounts.length === 0) {
                    try {
                        const { data: mpData } = await api.get('/marketplaces');
                        if (!cancelled && Array.isArray(mpData)) {
                            const meeshoCards = mpData.filter(m => String(m.name || m.key || '').toLowerCase().includes('meesho'));
                            accounts = meeshoCards.flatMap(m => m.accounts || []);
                        }
                    } catch (e) {
                        console.error('/marketplaces fallback error', e);
                    }
                }

                if (cancelled) return;
                setMeeshoAccounts(accounts);
                if (accounts.length > 0) {
                    setSelectedAccounts(prev => {
                        if (Array.isArray(prev) && prev.length > 0) {
                            const valid = prev.filter(id => accounts.some(a => (a._id || a.id) === id));
                            if (valid.length > 0) return valid;
                        }
                        // Default on fresh load or if it was cleared before refresh is first account
                        const firstAcc = accounts[0];
                        return firstAcc ? [String(firstAcc._id || firstAcc.id)] : [];
                    });
                } else {
                    setSelectedAccounts([]);
                }
            } catch (err) {
                console.error('Failed to load marketplace options', err);
            }
        };
        load();
        return () => { cancelled = true; };
    }, []);

    // ── Load return types for filter ───────────────────────────────────────
    useEffect(() => {
        if (!activeMarketplaceIds.length) return;
        api.get('/returns/analysis/return-types', { params: { marketplaceIds: JSON.stringify(activeMarketplaceIds) } })
            .then(({ data }) => setReturnTypeOptions((Array.isArray(data) ? data : []).filter(Boolean)))
            .catch((err) => console.error('Failed to load courier partners', err));
    }, [activeMarketplaceIds]);

    // ── Load courier partners for overdue filter dropdown ──────────────────
    useEffect(() => {
        if (!activeMarketplaceIds.length) return;
        api.get('/returns/analysis/courier-partners', { params: { marketplaceIds: JSON.stringify(activeMarketplaceIds) } })
            .then(({ data }) => { setCourierPartners((Array.isArray(data) ? data : []).filter(Boolean)) })
            .catch((err) => console.error('Failed to load courier partners', err));
    }, [activeMarketplaceIds]);

    // ── Handlers ───────────────────────────────────────────────────────────
    const handleDateChange = useCallback((start, end) => {
        if (!start || !end) { setStartDate(start || ''); setEndDate(end || ''); return; }
        const s = new Date(start); const e = new Date(end);
        if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return;
        const diff = Math.floor((e - s) / 86400000);
        if (diff >= MAX_RANGE_DAYS) { toast.error(`Date range too large (max ${MAX_RANGE_DAYS} days)`); return; }

        try { localStorage.setItem('returns_date_range', JSON.stringify({ startDate: start, endDate: end })); } catch (err) { }

        setPendingPages({ meeshoCompleted: 1, meeshoAll: 1 });
        setPagination(p => ({ ...p, currentPage: 1 }));
        setStartDate(start); setEndDate(end);
    }, [MAX_RANGE_DAYS]);

    const handlePendingPageChange = useCallback((kind, nextPage) => {
        setPendingPages(prev => ({ ...prev, [kind]: Math.max(1, nextPage) }));
    }, []);

    // ── Fetch functions ────────────────────────────────────────────────────
    const fetchAnalysis = useCallback(async () => {
        if (!canQuery) return;
        setLoadingAnalysis(true);
        try {
            const [summaryRes, statusRes, reasonsRes, trendRes, courierRes, skuRes] = await Promise.all([
                api.get('/returns/analysis/summary', { params: analysisParams }),
                api.get('/returns/analysis/status-breakdown', { params: analysisParams }),
                api.get('/returns/analysis/reasons', { params: analysisParams }),
                api.get('/returns/analysis/trend', { params: analysisParams }),
                api.get('/returns/analysis/courier-wise', { params: analysisParams }),
                api.get('/returns/analysis/sku-wise', { params: analysisParams }),
            ]);
            setSummary(summaryRes.data || null);
            setStatusBreakdown(statusRes.data || null);
            setReasons(reasonsRes.data || null);
            setTrend(trendRes.data || null);
            setCourierWise(courierRes.data || []);
            setSkuWise(skuRes.data || []);
        } catch (err) {
            console.error('Failed to fetch analysis data', err);
            toast.error('Failed to load analysis data');
        } finally {
            setLoadingAnalysis(false);
        }
    }, [analysisParams, canQuery]);

    const fetchPending = useCallback(async () => {
        if (!canQuery) return;
        setLoadingPending(true);
        try {
            // Exclude globalSearch from pending section — it has its own section-level search
            const { data } = await api.get('/returns/analysis/pending', {
                params: {
                    ...analysisParams,
                    meeshoCompletedPage: pendingPages.meeshoCompleted,
                    meeshoCompletedLimit: 25,
                    meeshoAllPage: pendingPages.meeshoAll,
                    meeshoAllLimit: 25,
                }
            });
            setPending(data || null);
        } catch (err) {
            console.error('Failed to fetch pending returns', err);
        } finally {
            setLoadingPending(false);
        }
    }, [analysisParams, canQuery, pendingPages.meeshoCompleted, pendingPages.meeshoAll]);

    const fetchReturns = useCallback(async (page = 1) => {
        if (!canQuery) return;
        setLoadingTable(true);
        try {
            const params = { ...analysisParams, page, limit: 25 };
            if (tableFilters.status && tableFilters.status !== 'all') params.status = tableFilters.status;
            if (tableFilters.returnCategory) params.returnCategory = tableFilters.returnCategory;
            if (tableFilters.fileType) params.returnFileType = tableFilters.fileType;
            if (tableFilters.courierPartner) params.courierPartner = tableFilters.courierPartner;
            if (tableFilters.returnReason) params.returnReason = tableFilters.returnReason;
            const { data } = await api.get('/returns/list', { params });
            setReturns(data?.returns || []);
            setPagination(data?.pagination || { currentPage: page, totalPages: 1, totalItems: 0, limit: 25 });
        } catch (err) {
            console.error('Failed to fetch returns list', err);
        } finally {
            setLoadingTable(false);
        }
    }, [analysisParams, canQuery, tableFilters]);

    useEffect(() => { fetchAnalysis(); }, [fetchAnalysis]);
    useEffect(() => { fetchPending(); }, [fetchPending]);
    useEffect(() => { fetchReturns(pagination.currentPage || 1); }, [fetchReturns, pagination.currentPage]);

    // Reset data when no accounts are selected (filter cleared)
    useEffect(() => {
        if (!canQuery) {
            setSummary(null);
            setStatusBreakdown(null);
            setReasons(null);
            setTrend(null);
            setCourierWise([]);
            setSkuWise([]);
            setPending(null);
            setReturns([]);
        }
    }, [canQuery]);

    const stopReturnsSyncPoll = useCallback(() => {
        if (syncPollRef.current) {
            clearInterval(syncPollRef.current);
            syncPollRef.current = null;
        }
    }, []);
    useEffect(() => stopReturnsSyncPoll, [stopReturnsSyncPoll]);

    // So the button is already correctly disabled/labelled before the first click today.
    useEffect(() => {
        if (!canTriggerReturnsSync) return;
        api.get('/meesho-sync/returns-click-usage')
            .then(({ data }) => setReturnsSyncQuota(data))
            .catch(() => {});
    }, [canTriggerReturnsSync]);

    // Triggers a real Meesho returns sync (not just a client-side refetch) via
    // one bulk request covering every selected account, then polls sync-progress
    // until each finishes before refreshing the on-screen data.
    const handleRefreshReturns = useCallback(async () => {
        if (syncingReturns || !canQuery) return;
        setSyncingReturns(true);

        let response;
        try {
            response = await api.post('/meesho-sync/trigger-returns', { marketplaceIds: activeMarketplaceIds });
        } catch (err) {
            setSyncingReturns(false);
            const data = err?.response?.data;
            if (data && ('remaining' in data)) setReturnsSyncQuota({ remaining: data.remaining, limit: data.limit });
            toast.error(data?.message || 'Failed to start returns sync.');
            return;
        }

        if (response?.data && 'remaining' in response.data) {
            setReturnsSyncQuota({ remaining: response.data.remaining, limit: response.data.limit });
        }

        const results = response?.data?.results || [];
        const pending = [];
        let enqueuedCount = 0;
        let skippedCount = 0;
        const failures = [];

        results.forEach((r) => {
            if (r.success) {
                if (r.skipped) {
                    skippedCount++;
                } else {
                    enqueuedCount++;
                    pending.push(r.marketplaceId);
                }
            } else {
                const name = mpNameMap.get(String(r.marketplaceId)) || r.marketplaceId;
                failures.push(`${name}: ${r.message || 'Failed to start'}`);
            }
        });

        if (enqueuedCount > 0) {
            toast.success(`Returns sync started for ${enqueuedCount} account${enqueuedCount === 1 ? '' : 's'}${skippedCount ? ` (${skippedCount} already up to date)` : ''}`);
        } else if (skippedCount > 0 && failures.length === 0) {
            toast.info('Returns already up to date for the selected account(s)');
        }
        if (failures.length) {
            const shown = failures.slice(0, 3).join('; ');
            toast.error(`Some accounts failed to start: ${shown}${failures.length > 3 ? ` …and ${failures.length - 3} more` : ''}`);
        }

        if (pending.length === 0) {
            setSyncingReturns(false);
            return;
        }

        stopReturnsSyncPoll();
        let pollCount = 0;
        const MAX_POLLS = 360; // 5s interval -> 30 min ceiling
        const stillPending = new Set(pending);
        const failedIds = new Set();

        syncPollRef.current = setInterval(async () => {
            pollCount++;
            if (pollCount > MAX_POLLS) {
                stopReturnsSyncPoll();
                setSyncingReturns(false);
                toast.info('Returns sync still running in the background — check back shortly.');
                return;
            }
            await Promise.all([...stillPending].map(async (id) => {
                try {
                    const { data } = await api.get(`/meesho-sync/sync-progress?marketplaceId=${id}`);
                    const stillActiveOrQueued = data?.activeType === 'returns' || data?.datasets?.returns?.queued;
                    if (stillActiveOrQueued) return;
                    const status = data?.datasets?.returns?.status;
                    if (status !== 'completed') failedIds.add(id);
                    stillPending.delete(id);
                } catch {
                    // transient poll error — retry next tick
                }
            }));

            if (stillPending.size === 0) {
                stopReturnsSyncPoll();
                setSyncingReturns(false);
                await Promise.all([fetchAnalysis(), fetchPending(), fetchReturns(1)]);
                if (failedIds.size === 0) {
                    toast.success('Returns sync finished — data refreshed.');
                } else if (failedIds.size === pending.length) {
                    toast.error('Returns sync failed — no new data was ingested.');
                } else {
                    const names = [...failedIds].map((id) => mpNameMap.get(String(id)) || id).join(', ');
                    toast.error(`Returns sync finished with errors for: ${names}. Other accounts refreshed.`);
                }
            }
        }, 5000);
    }, [syncingReturns, canQuery, activeMarketplaceIds, mpNameMap, stopReturnsSyncPoll, fetchAnalysis, fetchPending, fetchReturns]);

    const [damagedRefreshKey, setDamagedRefreshKey] = useState(0);
    const [expandedTableRows, setExpandedTableRows] = useState(new Set());
    const expandTableRow = (key) => setExpandedTableRows(prev => new Set([...prev, key]));
    const collapseTableRow = (key) => setExpandedTableRows(prev => { const n = new Set(prev); n.delete(key); return n; });

    const handleQuickScan = useCallback(async (marketplace, item, condition = 'ok') => {
        try {
            await api.post('/returns/scan/single', { marketplace, item, condition });
            toast.success(condition === 'damaged' ? 'Marked as arrived — Damaged' : 'Marked as arrived — OK');
            await Promise.all([fetchAnalysis(), fetchPending(), fetchReturns(pagination.currentPage || 1)]);
            setDamagedRefreshKey(k => k + 1);
        } catch (err) {
            toast.error(err?.response?.data?.message || 'Failed to mark arrived');
        }
    }, [fetchAnalysis, fetchPending, fetchReturns, pagination.currentPage]);

    const handleUpdateCondition = useCallback(async (row, newCondition) => {
        try {
            await api.patch('/returns/scan/update-condition', {
                suborderNumber: row.suborder_number,
                marketplaceId: row.marketplace_id,
                condition: newCondition,
            });
            toast.success(newCondition === 'damaged' ? 'Marked as Damaged' : 'Marked as OK');
            await Promise.all([fetchAnalysis(), fetchReturns(pagination.currentPage || 1)]);
            setDamagedRefreshKey(k => k + 1);
        } catch (err) {
            toast.error(err?.response?.data?.message || 'Failed to update condition');
        }
    }, [fetchAnalysis, fetchReturns, pagination.currentPage]);

    const handleStatClick = useCallback((statusLabel) => {
        const mapping = {
            'total returns': 'all', 'in transit': 'in_transit', 'out for delivery': 'out_for_delivery',
            'pending': 'courier_completed', 'physically received': 'physically_received',
            'received ok': 'physically_received',
            'overdue': 'overdue', 'damaged': 'damaged',
        };
        const key = mapping[String(statusLabel || '').toLowerCase()] || 'all';
        setTableDraft({ status: key, returnCategory: '', fileType: '', courierPartner: '', returnReason: '' });
        setTableFilters({ status: key, returnCategory: '', fileType: '', courierPartner: '', returnReason: '' });
        setPagination(p => ({ ...p, currentPage: 1 }));
        setDrawerOpen(true);
    }, []);

    // ── Chart data derived ─────────────────────────────────────────────────
    const trendSeries = useMemo(() => {
        const rows = trend?.meesho || [];
        return rows.map(r => ({ date: toDateKey(r.date), newReturns: Number(r.newReturns || 0), scanned: Number(r.scanned || 0) }));
    }, [trend]);

    const statusSeries = useMemo(() => {
        const rows = statusBreakdown?.meesho || [];
        return rows.filter(r => Number(r.count || 0) > 0).map(r => ({ name: r.segment, value: Number(r.count || 0) }));
    }, [statusBreakdown]);

    const reasonsSeries = useMemo(() => {
        const rows = reasons?.meesho?.reasons || [];
        return rows.slice(0, 10).map(r => ({ reason: String(r.reason || 'Unknown').slice(0, 24), count: Number(r.count || 0) }));
    }, [reasons]);

    const damagedCount = useMemo(() => Number(reasons?.meesho?.damagedCount || 0), [reasons]);

    const courierSeries = useMemo(() => {
        return (courierWise || []).slice(0, 12).map(r => ({
            courier_partner: String(r.courier_partner || 'UNKNOWN').slice(0, 16),
            Received: Number(r.received_pct || 0),
            Pending: Number(r.pending_pct || 0),
            Overdue: Number(r.overdue_pct || 0),
            _total: Number(r.total || 0),
            _received: Number(r.received || 0),
            _damaged: Number(r.damaged || 0),
            _receivedOK: Math.max(0, Number(r.received || 0) - Number(r.damaged || 0)),
            _damagedPct: Number(r.damaged_pct || 0),
            _pending: Number(r.pending_recent || 0),
            _overdue: Number(r.overdue || 0),
        }));
    }, [courierWise]);

    const courierGrandTotal = useMemo(() => courierSeries.reduce((s, r) => s + r._total, 0), [courierSeries]);

    const kpis = useMemo(() => {
        const s = summary || { totalReturns: 0, inTransit: 0, outForDelivery: 0, courierCompleted: 0, physicallyReceived: 0, overdue: 0, damagedCount: 0 };
        return [
            { title: 'Total Returns', value: fmtNum(s.totalReturns), icon: PackageX, tone: 'violet', info: KPI_INFO['Total Returns'] },
            { title: 'In Transit', value: fmtNum(s.inTransit), icon: Truck, tone: 'cyan', info: KPI_INFO['In Transit'] },
            { title: 'Out for Delivery', value: fmtNum(s.outForDelivery), icon: Package, tone: 'amber', info: KPI_INFO['Out for Delivery'] },
            { title: 'Pending', value: fmtNum(s.courierCompleted), icon: Inbox, tone: 'orange', attention: s.courierCompleted > 0, info: KPI_INFO['Pending'] },
            { title: 'Physically Received', value: fmtNum(s.physicallyReceived), icon: CheckCircle, tone: 'emerald', info: KPI_INFO['Physically Received'] },
            { title: 'Overdue', value: fmtNum(s.overdue), icon: AlertTriangle, tone: s.overdue > 0 ? 'red' : 'amber', attention: s.overdue > 0, info: KPI_INFO['Overdue'] },
            { title: 'Damaged', value: fmtNum(s.damagedCount), icon: AlertOctagon, tone: s.damagedCount > 0 ? 'red' : 'slate', attention: s.damagedCount > 0, info: KPI_INFO['Damaged'] },
        ];
    }, [summary]);

    return (
        <div className="w-full space-y-6 animate-in fade-in duration-300">

            {/* ─── Toolbar ─────────────────────────────────────────────── */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-5 py-4 relative z-40 overflow-visible space-y-3">

                {/* Row 1: Filters (left) + Action buttons (right) */}
                <div className="flex items-center gap-3">

                    {/* Left group: Marketplace + Accounts + Date + Return type */}
                    <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">

                        {/* Account Filter Popover */}
                        <MarketplaceAccountSelector
                            variant="popover"
                            selectionMode="single"
                            accountSelection="multiple"
                            showCheckbox={true}
                            showClearAll={true}
                            availableMarketplaces={meeshoAvailableMarketplaces}
                            marketplaceFilters={selectedAccounts}
                            onApplyFilters={(selectedIds) => {
                                setSelectedAccounts(selectedIds);
                            }}
                            buttonLabel="Filter Accounts"
                            align="left"
                        />

                        <div className="w-px h-6 bg-slate-200 shrink-0" />

                        {/* Date range */}
                        <div className="shrink-0">
                            <ReturnDateRangePicker
                                startDate={startDate}
                                endDate={endDate}
                                onChange={handleDateChange}
                                maxDays={MAX_RANGE_DAYS}
                                dateField={dateField}
                                onDateFieldChange={setDateField}
                            />
                        </div>

                        {/* Return type filter */}
                        {returnTypeOptions.length > 0 && (
                            <>
                                <div className="w-px h-6 bg-slate-200 shrink-0" />
                                <ReturnTypeFilter options={returnTypeOptions} selected={selectedReturnTypes} onChange={setSelectedReturnTypes} />
                            </>
                        )}
                    </div>

                    {/* Right group: Action buttons — larger than filter controls */}
                    <div className="flex items-center gap-2 shrink-0">
                        {/* Scanner = primary → violet solid */}
                        <Link to="/returns/scan"
                            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-violet-600 text-white text-sm font-bold hover:bg-violet-700 active:scale-95 transition-all shrink-0 shadow-md shadow-violet-200 tracking-wide">
                            <ScanLine size={16} /> Scanner
                        </Link>
                        {/* Export = secondary → teal outline */}
                        <button type="button" onClick={() => setExportPickerOpen(true)} disabled={!canQuery}
                            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl border-2 border-teal-400 bg-teal-50 text-teal-800 text-sm font-bold hover:bg-teal-100 active:scale-95 disabled:opacity-50 transition-all shrink-0 shadow-sm tracking-wide">
                            <FileDown size={16} /> Export
                        </button>
                        {/* Refresh Returns — Admin/SBM/SuperAdmin only */}
                        {canTriggerReturnsSync && (
                            <div className="flex items-center gap-1.5 shrink-0">
                                <InfoTooltip text={returnsSyncQuota?.remaining === 0
                                    ? 'Limit reached, try tomorrow'
                                    : 'Sync returns (2/day)'}>
                                    <button type="button"
                                        disabled={!canQuery || syncingReturns || returnsSyncQuota?.remaining === 0}
                                        onClick={handleRefreshReturns}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border-2 border-slate-300 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 active:scale-95 disabled:opacity-50 transition-all shadow-sm">
                                        {syncingReturns ? <Loader2 size={16} className="animate-spin"/> : <RefreshCw size={16}/>}
                                    </button>
                                </InfoTooltip>
                                {returnsSyncQuota && (
                                    <span className={`text-[10px] font-semibold ${returnsSyncQuota.remaining === 0 ? 'text-red-500' : 'text-slate-400'}`}>
                                        {returnsSyncQuota.remaining}/{returnsSyncQuota.limit} left today
                                    </span>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Row 2: Full-width prominent search bar */}
                <div className="flex items-center gap-2 mt-1">
                    <div className="relative flex-1">
                        <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        <input
                            value={globalSearchDraft}
                            onChange={e => setGlobalSearchDraft(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') setGlobalSearch(globalSearchDraft); if (e.key === 'Escape') { setGlobalSearchDraft(''); setGlobalSearch(''); } }}
                            placeholder="Search by SKU, Order Number, AWB tracking number…"
                            className={`w-full pl-10 pr-10 py-2.5 text-sm font-medium rounded-xl border-2 focus:outline-none focus:ring-4 focus:ring-violet-500/10 transition-all shadow-sm ${globalSearch ? 'border-violet-500 bg-violet-50 text-violet-900 placeholder:text-violet-400' : 'border-slate-300 bg-slate-50 focus:border-violet-500 focus:bg-white text-slate-800 placeholder:text-slate-400'}`}
                        />
                        {globalSearchDraft && (
                            <button onClick={() => { setGlobalSearchDraft(''); setGlobalSearch(''); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-red-500 transition-colors">
                                <X size={16} />
                            </button>
                        )}
                    </div>
                    <button
                        onClick={() => setGlobalSearch(globalSearchDraft)}
                        className="px-6 py-2.5 text-sm font-bold bg-violet-600 text-white rounded-xl hover:bg-violet-700 active:scale-95 transition-all shrink-0 shadow-md shadow-violet-200 tracking-wide"
                    >Search</button>
                </div>

                {/* Active filter chips */}
                {(selectedReturnTypes.length > 0 || globalSearch) && (
                    <div className="flex flex-wrap gap-1.5 items-center pt-0.5">
                        {globalSearch && (
                            <span className="flex items-center gap-1 px-2.5 py-1 bg-violet-50 text-violet-700 border border-violet-200 rounded-full text-xs font-semibold">
                                <Search size={10} /> "{globalSearch}"
                                <button onClick={() => { setGlobalSearchDraft(''); setGlobalSearch(''); }} className="hover:text-red-500 ml-0.5"><X size={10} /></button>
                            </span>
                        )}
                        {selectedReturnTypes.map(t => (
                            <span key={t} className="flex items-center gap-1 px-2.5 py-1 bg-violet-50 text-violet-700 border border-violet-200 rounded-full text-xs font-semibold">
                                <Tag size={9} /> {t}
                                <button onClick={() => setSelectedReturnTypes(prev => prev.filter(x => x !== t))} className="hover:text-red-500 ml-0.5"><X size={10} /></button>
                            </span>
                        ))}
                        {(selectedReturnTypes.length > 1 || (globalSearch && selectedReturnTypes.length > 0)) && (
                            <button onClick={() => { setSelectedReturnTypes([]); setGlobalSearchDraft(''); setGlobalSearch(''); }} className="text-xs text-red-400 hover:text-red-600 px-1 font-medium">Clear all</button>
                        )}
                    </div>
                )}
            </div>

            {/* ─── KPI Grid ───────────────────────────────────────────── */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-4">
                {loadingAnalysis && !summary
                    ? Array.from({ length: 7 }).map((_, i) => <SkeletonCard key={i} index={i} />)
                    : kpis.map((k, i) => (
                        <KpiCard key={k.title} index={i} title={k.title} value={k.value} icon={k.icon} tone={k.tone} attention={k.attention} info={k.info} onClick={() => handleStatClick(k.title)} />
                    ))
                }
            </div>

            {/* ─── Pending Physical Receipt ────────────────────────────── */}
            <PendingPhysicalReceiptSection
                loading={loadingPending}
                pending={pending}
                onScan={handleQuickScan}
                onPageChange={handlePendingPageChange}
                meeshoAccounts={meeshoAccounts}
                showAccountCol={showAccountCol}
                onRefresh={fetchPending}
            />

            {/* ─── Charts Grid ─────────────────────────────────────────── */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

                {/* Trend */}
                <ChartShell title="Daily trend — New returns vs Scanned" filterHint={globalSearch || undefined}>
                    {loadingAnalysis && !trendSeries.length ? (
                        <ChartSkeleton />
                    ) : !trendSeries.length ? (
                        <EmptyState title="No trend data" description="Try widening the date range." />
                    ) : (
                        <div className="animate-in fade-in duration-700">
                            <ResponsiveContainer width="100%" height={300}>
                                <LineChart data={trendSeries} margin={{ top: 10, right: 20, left: 0, bottom: 10 }} onClick={() => handleStatClick('total returns')} style={{ cursor: 'pointer' }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
                                    <XAxis dataKey="date" tickFormatter={fmtAxisDate} tick={{ fontSize: 11 }} />
                                    <YAxis tick={{ fontSize: 11 }} />
                                    <Tooltip labelFormatter={v => fmtAxisDate(v)} />
                                    <Legend />
                                    <Line type="monotone" dataKey="newReturns" name="New returns" stroke={COLORS[0]} strokeWidth={2} dot={false} animationDuration={800} />
                                    <Line type="monotone" dataKey="scanned" name="Scanned" stroke={COLORS[2]} strokeWidth={2} dot={false} animationDuration={800} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </ChartShell>

                {/* Status breakdown */}
                <ChartShell title="Status breakdown" filterHint={globalSearch || undefined}>
                    {loadingAnalysis && !statusSeries.length ? (
                        <ChartSkeleton />
                    ) : !statusSeries.length ? (
                        <EmptyState title="No status data" description="Try widening the date range." />
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center animate-in fade-in duration-700">
                            <div className="relative w-full h-[260px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie data={statusSeries} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}
                                            onClick={d => d && handleStatClick(d.name)} animationDuration={600} style={{ cursor: 'pointer' }}>
                                            {statusSeries.map((s, i) => <Cell key={i} fill={SEGMENT_COLORS[s.name] || COLORS[i % COLORS.length]} />)}
                                        </Pie>
                                        <Tooltip formatter={v => fmtNum(v)} />
                                    </PieChart>
                                </ResponsiveContainer>
                                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                    <span className="text-slate-400 text-xs font-bold tracking-wider">TOTAL</span>
                                    <span className="text-slate-800 text-2xl font-bold">{fmtNum(statusSeries.reduce((s, r) => s + r.value, 0))}</span>
                                </div>
                            </div>
                            <div className="space-y-2">
                                {statusSeries.slice(0, 8).map((s, i) => (
                                    <div key={s.name} className="flex items-center justify-between text-sm cursor-pointer hover:bg-slate-50 rounded-lg px-2 py-1" onClick={() => handleStatClick(s.name)}>
                                        <div className="flex items-center gap-2 min-w-0">
                                            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: SEGMENT_COLORS[s.name] || COLORS[i % COLORS.length] }} />
                                            <span className="text-slate-700 font-medium truncate">{s.name}</span>
                                        </div>
                                        <span className="text-slate-900 font-semibold tabular-nums">{fmtNum(s.value)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </ChartShell>

                {/* Return reasons */}
                <ChartShell
                    title="Top return reasons"
                    filterHint={globalSearch || undefined}
                    right={<div className="text-xs text-slate-500">Damaged: <span className="font-semibold text-red-600">{fmtNum(damagedCount)}</span></div>}
                >
                    {loadingAnalysis && !reasonsSeries.length ? (
                        <ChartSkeleton />
                    ) : !reasonsSeries.length ? (
                        <EmptyState title="No reason data" description="Try widening the date range." />
                    ) : (
                        <div className="animate-in fade-in duration-700">
                            <ResponsiveContainer width="100%" height={300}>
                                <BarChart data={reasonsSeries} margin={{ top: 20, right: 20, left: 0, bottom: 60 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" vertical={false} />
                                    <XAxis dataKey="reason" tick={{ fontSize: 10 }} angle={-25} textAnchor="end" interval={0} height={70} />
                                    <YAxis tick={{ fontSize: 11 }} />
                                    <Tooltip cursor={{ fill: 'rgba(124, 58, 237, 0.05)' }} />
                                    <Bar dataKey="count" name="Count" fill={COLORS[1]} radius={[6, 6, 0, 0]} animationDuration={800} style={{ cursor: 'pointer' }}
                                        onClick={(data) => {
                                            const clickedReason = data?.reason || data?.payload?.reason;
                                            if (clickedReason) {
                                                const newState = { status: 'all', returnCategory: '', fileType: '', courierPartner: '', returnReason: clickedReason };
                                                setTableDraft(newState);
                                                setTableFilters(newState);
                                                setPagination(p => ({ ...p, currentPage: 1 }));
                                                setDrawerOpen(true);
                                            }
                                        }}
                                    >
                                        <LabelList dataKey="count" position="top" formatter={fmtNum} fill="#64748b" fontSize={11} fontWeight={600} />
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </ChartShell>

                {/* Courier 100% stacked bar */}
                <ChartShell
                    title="Courier Partner Performance"
                    filterHint={globalSearch || undefined}
                    right={<span className="text-xs text-slate-500 bg-slate-50 px-2 py-1 rounded-lg">Sorted by Overdue count</span>}
                >
                    {loadingAnalysis && !courierSeries.length ? (
                        <ChartSkeleton />
                    ) : !courierSeries.length ? (
                        <EmptyState title="No courier data" description="Courier stats are Meesho-only." />
                    ) : (
                        <div className="animate-in fade-in duration-700">
                            <ResponsiveContainer width="100%" height={300}>
                                <BarChart data={courierSeries} margin={{ top: 20, right: 20, left: 0, bottom: 50 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" vertical={false} />
                                    <XAxis dataKey="courier_partner" tick={{ fontSize: 10 }} angle={-20} textAnchor="end" interval={0} height={60} />
                                    <YAxis tick={{ fontSize: 11 }} tickFormatter={v => fmtNum(v)} allowDecimals={false} />
                                    <Tooltip content={(props) => <CourierTooltip {...props} grandTotal={courierGrandTotal} />} cursor={{ fill: 'rgba(124, 58, 237, 0.05)' }} />
                                    <Legend />
                                    <Bar dataKey="_receivedOK" stackId="a" fill={STACKED_COLORS.received} name="Received OK" animationDuration={800} style={{ cursor: 'pointer' }}
                                        onClick={(data) => {
                                            const clickedCourier = data?.courier_partner || data?.payload?.courier_partner;
                                            if (clickedCourier) {
                                                const newState = { status: 'physically_received', returnCategory: '', fileType: '', courierPartner: clickedCourier, returnReason: '' };
                                                setTableDraft(newState);
                                                setTableFilters(newState);
                                                setPagination(p => ({ ...p, currentPage: 1 }));
                                                setDrawerOpen(true);
                                            }
                                        }}
                                    />
                                    <Bar dataKey="_damaged" stackId="a" fill="#f97316" name="Damaged" animationDuration={800} style={{ cursor: 'pointer' }}
                                        onClick={(data) => {
                                            const clickedCourier = data?.courier_partner || data?.payload?.courier_partner;
                                            if (clickedCourier) {
                                                const newState = { status: 'damaged', returnCategory: '', fileType: '', courierPartner: clickedCourier, returnReason: '' };
                                                setTableDraft(newState);
                                                setTableFilters(newState);
                                                setPagination(p => ({ ...p, currentPage: 1 }));
                                                setDrawerOpen(true);
                                            }
                                        }}
                                    />
                                    <Bar dataKey="_pending" stackId="a" fill={STACKED_COLORS.pending} name="Pending" animationDuration={800} style={{ cursor: 'pointer' }}
                                        onClick={(data) => {
                                            const clickedCourier = data?.courier_partner || data?.payload?.courier_partner;
                                            if (clickedCourier) {
                                                const newState = { status: 'courier_completed', returnCategory: '', fileType: '', courierPartner: clickedCourier, returnReason: '' };
                                                setTableDraft(newState);
                                                setTableFilters(newState);
                                                setPagination(p => ({ ...p, currentPage: 1 }));
                                                setDrawerOpen(true);
                                            }
                                        }}
                                    />
                                    <Bar dataKey="_overdue" stackId="a" fill={STACKED_COLORS.overdue} name="Overdue" radius={[4, 4, 0, 0]} animationDuration={800} style={{ cursor: 'pointer' }}
                                        onClick={(data) => {
                                            const clickedCourier = data?.courier_partner || data?.payload?.courier_partner;
                                            if (clickedCourier) {
                                                const newState = { status: 'overdue', returnCategory: '', fileType: '', courierPartner: clickedCourier, returnReason: '' };
                                                setTableDraft(newState);
                                                setTableFilters(newState);
                                                setPagination(p => ({ ...p, currentPage: 1 }));
                                                setDrawerOpen(true);
                                            }
                                        }}
                                    >
                                        <LabelList dataKey="_total" position="top" formatter={fmtNum} fill="#64748b" fontSize={11} fontWeight={600} />
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </ChartShell>
            </div>

            {/* ─── Damaged Products ────────────────────────────────────── */}
            {canQuery && (
                <DamagedProductsSection
                    marketplaceIds={activeMarketplaceIds}
                    startDate={startDate}
                    endDate={endDate}
                    returnTypes={selectedReturnTypes}
                    search={globalSearch}
                    refreshKey={damagedRefreshKey}
                    meeshoAccounts={meeshoAccounts}
                    showAccountCol={showAccountCol}
                />
            )}

            {/* ─── SKU-wise Table ──────────────────────────────────────── */}
            <SectionShell
                title="SKU-wise analysis"
                subtitle="Top 50 SKUs by return count."
                right={
                    <button onClick={() => setShowSkuTable(o => !o)} className="text-xs font-semibold text-violet-600 hover:underline">
                        {showSkuTable ? 'Hide' : 'Show'} table
                    </button>
                }
            >
                {!showSkuTable ? (
                    <p className="text-sm text-slate-400 text-center py-4">Click "Show table" to view SKU breakdown.</p>
                ) : !skuWise.length ? (
                    <EmptyState title="No SKU data" description="Try widening the date range." />
                ) : (
                    <div className="overflow-auto rounded-xl border border-slate-200 max-h-[500px]">
                        <table className="min-w-full text-sm">
                            <thead className="bg-slate-50 text-slate-600 sticky top-0 z-10 text-xs">
                                <tr>
                                    <th className="text-left px-3 py-2 font-semibold">SKU</th>
                                    <th className="text-right px-3 py-2 font-semibold">Total</th>
                                    <th className="text-right px-3 py-2 font-semibold">Pending</th>
                                    <th className="text-right px-3 py-2 font-semibold">Received</th>
                                    <th className="text-right px-3 py-2 font-semibold">Damaged</th>
                                    <th className="text-left px-3 py-2 font-semibold">Reasons</th>
                                </tr>
                            </thead>
                            <tbody>
                                {skuWise.map((r, idx) => (
                                    <tr key={`${r.sku}-${idx}`} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                                        <td className="px-3 py-2 font-semibold text-slate-800">{r.sku || '—'}</td>
                                        <td className="px-3 py-2 text-right tabular-nums">{fmtNum(r.total_returns)}</td>
                                        <td className="px-3 py-2 text-right tabular-nums">{fmtNum(r.pending_receipt)}</td>
                                        <td className="px-3 py-2 text-right tabular-nums">{fmtNum(r.received)}</td>
                                        <td className={`px-3 py-2 text-right tabular-nums ${r.damaged_count > 0 ? 'text-red-600 font-semibold' : ''}`}>{fmtNum(r.damaged_count)}</td>
                                        <td className="px-3 py-2 max-w-[400px] truncate text-xs text-slate-500" title={(r.reasons || []).join(', ')}>
                                            {(r.reasons || []).slice(0, 3).join(', ') || '—'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </SectionShell>

            {/* ─── Returns Table Drawer ────────────────────────────────── */}
            <PopupModal
                isOpen={drawerOpen}
                onClose={() => setDrawerOpen(false)}
                title="Return Details"
                subtitle={
                    <div className="flex items-center gap-2 flex-wrap">
                        <span>Full returns list — use filters to narrow down.</span>
                        {tableFilters.courierPartner && <span className="bg-violet-100 text-violet-700 px-2 py-0.5 rounded text-xs font-semibold">Courier: {tableFilters.courierPartner}</span>}
                        {tableFilters.returnReason && <span className="bg-violet-100 text-violet-700 px-2 py-0.5 rounded text-xs font-semibold">Reason: {tableFilters.returnReason}</span>}
                    </div>
                }
                right={
                    <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                        <select value={tableDraft.status}
                            onChange={e => setTableDraft(prev => ({ ...prev, status: e.target.value }))}
                            className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-400">
                            <option value="all">All</option>
                            <option value="in_transit">In Transit</option>
                            <option value="out_for_delivery">Out for Delivery</option>
                            <option value="courier_completed">Pending (Courier Done)</option>
                            <option value="physically_received">Physically received</option>
                            <option value="overdue">Overdue</option>
                            <option value="pending">Pending physical receipt</option>
                            <option value="damaged">Marked as damaged</option>
                        </select>
                        <button onClick={() => { setTableFilters({ ...tableDraft }); setPagination(p => ({ ...p, currentPage: 1 })); }}
                            className="px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800">Apply</button>
                        <button onClick={() => { const empty = { status: 'all', returnCategory: '', fileType: '', courierPartner: '', returnReason: '' }; setTableDraft(empty); setTableFilters(empty); setPagination(p => ({ ...p, currentPage: 1 })); }}
                            className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-800 text-sm font-semibold hover:bg-slate-50">Clear</button>
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-500 whitespace-nowrap">{fmtNum(pagination.totalItems)} items</span>
                            <button disabled={pagination.currentPage <= 1} onClick={() => setPagination(p => ({ ...p, currentPage: Math.max(1, p.currentPage - 1) }))}
                                className="px-2 py-1 text-xs rounded border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40">Prev</button>
                            <span className="text-xs text-slate-500 min-w-[3rem] text-center">{pagination.currentPage}/{pagination.totalPages}</span>
                            <button disabled={pagination.currentPage >= pagination.totalPages} onClick={() => setPagination(p => ({ ...p, currentPage: Math.min(p.totalPages, p.currentPage + 1) }))}
                                className="px-2 py-1 text-xs rounded border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40">Next</button>
                        </div>
                    </div>
                }
            >
                {tableFilters.status === 'overdue' && (
                    <div className="mb-4 flex flex-wrap items-center gap-2 px-1">
                        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Filter by  </span>
                        <span className='text-[13px] font-semibold text-slate-500 tracking-wide'>Return Type :</span>
                        <select
                            value={tableFilters.returnCategory}
                            onChange={e => {
                                const next = { ...tableFilters, returnCategory: e.target.value };
                                setTableDraft(next);
                                setTableFilters(next);
                                setPagination(p => ({ ...p, currentPage: 1 }));
                            }}
                            className="h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-xs text-slate-700 font-medium shadow-sm hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-violet-400 cursor-pointer"
                        >
                            <option value="">All Types</option>
                            <option value="rto">RTO</option>
                            <option value="customer">Customer Return</option>
                        </select>
                        <span className='text-[13px] font-semibold text-slate-500 tracking-wide'>Status Type :</span>
                        <select
                            value={tableFilters.fileType}
                            onChange={e => {
                                const next = { ...tableFilters, fileType: e.target.value };
                                setTableDraft(next);
                                setTableFilters(next);
                                setPagination(p => ({ ...p, currentPage: 1 }));
                            }}
                            className="h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-xs text-slate-700 font-medium shadow-sm hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-violet-400 cursor-pointer"
                        >
                            <option value="">All File Types</option>
                            <option value="intransit">In Transit</option>
                            <option value="ofd">Out for Delivery</option>
                            <option value="completed">Completed</option>
                        </select>
                        <span className='text-[13px] font-semibold text-slate-500 tracking-wide'>Courier :</span>
                        <select
                            value={tableFilters.courierPartner}
                            onChange={e => {
                                const next = { ...tableFilters, courierPartner: e.target.value };
                                setTableDraft(next);
                                setTableFilters(next);
                                setPagination(p => ({ ...p, currentPage: 1 }));
                            }}
                            className="h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-xs text-slate-700 font-medium shadow-sm hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-violet-400 cursor-pointer"
                        >
                            <option value="">All Couriers</option>
                            {courierPartners.filter(Boolean).map((cp, i) => <option key={cp || String(i)} value={cp}>{cp}</option>)}
                        </select>
                        {(tableFilters.returnCategory || tableFilters.fileType || tableFilters.courierPartner || tableFilters.returnReason) && (
                            <button
                                onClick={() => {
                                    const reset = { ...tableFilters, returnCategory: '', fileType: '', courierPartner: '', returnReason: '' };
                                    setTableDraft(reset);
                                    setTableFilters(reset);
                                    setPagination(p => ({ ...p, currentPage: 1 }));
                                }}
                                className="h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-xs text-slate-500 hover:text-red-600 hover:border-red-200 shadow-sm transition-colors"
                            >
                                Clear
                            </button>
                        )}
                    </div>
                )}
                {loadingTable ? (
                    <div className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="animate-spin" size={16} />Loading…</div>
                ) : !returns.length ? (
                    <EmptyState title="No returns found" description="Try adjusting filters or widening the date range." />
                ) : (
                    <div className="overflow-auto rounded-xl border border-slate-200 max-h-[500px]">
                        <table className="min-w-full text-sm">
                            <thead className="bg-slate-50 text-slate-600 sticky top-0 z-10 text-xs">
                                <tr>
                                    {showAccountCol && <th className="text-left px-3 py-2 font-semibold">Account</th>}
                                    <th className="text-left px-3 py-2 font-semibold">Suborder No</th>
                                    <th className="text-left px-3 py-2 font-semibold">SKU</th>
                                    <th className="text-left px-3 py-2 font-semibold">AWB</th>
                                    <th className="text-left px-3 py-2 font-semibold">Return Type</th>
                                    <th className="text-left px-3 py-2 font-semibold">Courier Partner</th>
                                    <th className="text-left px-3 py-2 font-semibold">Courier Status</th>
                                    <th className="text-right px-3 py-2 font-semibold">Days</th>
                                    <th className="text-left px-3 py-2 font-semibold">Return Created</th>
                                    <th className="text-left px-3 py-2 font-semibold">Reason</th>
                                    <th className="text-left px-3 py-2 font-semibold">Status</th>
                                    <th className="text-right px-3 py-2 font-semibold">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {returns.map((r, idx) => {
                                    const days = Number(r.days_pending || 0);
                                    const overdue = r.is_overdue ?? false;
                                    const eligible = isMeeshoScanEligible(r);
                                    const accountName = r.marketplace_id ? (mpNameMap.get(String(r.marketplace_id)) || '—') : '—';
                                    return (
                                        <tr key={r.id || idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                                            {showAccountCol && (
                                                <td className="px-3 py-2 whitespace-nowrap">
                                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-pink-50 text-pink-700 text-xs font-medium max-w-[120px] truncate" title={accountName}>{accountName}</span>
                                                </td>
                                            )}
                                            <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">{r.suborder_number || '—'}</td>
                                            <td className="px-3 py-2 whitespace-nowrap">{r.sku || '—'}</td>
                                            <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">{r.tracking_id || r.awb_number || '—'}</td>
                                            <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">{r.type_of_return || '—'}</td>
                                            <td className="px-3 py-2 whitespace-nowrap">{r.courier_partner || '—'}</td>
                                            <td className="px-3 py-2 whitespace-nowrap">{r.status || '—'}</td>
                                            <td className={`px-3 py-2 text-right tabular-nums ${overdue ? 'text-red-600 font-semibold' : ''}`}>{days}</td>
                                            <td className="px-3 py-2 whitespace-nowrap">{fmtDateCell(r.return_date)}</td>
                                            <td className="px-3 py-2 max-w-[280px] truncate text-xs" title={r.reason}>{r.reason || '—'}</td>
                                            <td className="px-3 py-2 whitespace-nowrap">{r.return_file_type || '—'}</td>
                                            <td className="px-3 py-2 text-right whitespace-nowrap">
                                                {eligible ? (
                                                    expandedTableRows.has(r.id) ? (
                                                        <div className="flex items-center justify-end gap-1 animate-in fade-in duration-150">
                                                            <button type="button"
                                                                onClick={() => collapseTableRow(r.id)}
                                                                title="Cancel"
                                                                className="inline-flex items-center justify-center p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
                                                                <X size={13} />
                                                            </button>
                                                            <button type="button" disabled={loadingAnalysis}
                                                                onClick={() => { collapseTableRow(r.id); handleQuickScan('meesho', r, 'damaged'); }}
                                                                title="Mark as Arrived — Damaged"
                                                                className="inline-flex items-center justify-center p-1.5 rounded-lg bg-red-50 border border-red-200 text-red-600 hover:bg-red-100 disabled:opacity-50 transition-colors">
                                                                <AlertOctagon size={13} />
                                                            </button>
                                                            <button type="button" disabled={loadingAnalysis}
                                                                onClick={() => { collapseTableRow(r.id); handleQuickScan('meesho', r, 'ok'); }}
                                                                title="Mark as Arrived — OK"
                                                                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50 transition-colors">
                                                                <CheckCircle size={11} />OK
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <button type="button" disabled={loadingAnalysis}
                                                            onClick={() => expandTableRow(r.id)}
                                                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors">
                                                            <CheckCircle size={11} />Mark Arrived
                                                        </button>
                                                    )
                                                ) : r.arrival_status === 'arrived' &&
                                                    (tableFilters.status === 'physically_received' ||
                                                        tableFilters.status === 'damaged') ? (
                                                    r.condition === 'damaged' ? (
                                                        <button
                                                            type="button"
                                                            disabled={loadingAnalysis}
                                                            onClick={() => handleUpdateCondition(r, 'ok')}
                                                            title="Click to mark as OK"
                                                            className="group inline-flex items-center justify-center gap-1.5 w-[130px] px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 bg-red-100 text-red-700 hover:bg-emerald-100 hover:text-emerald-700"
                                                        >
                                                            <AlertOctagon size={11} className="group-hover:hidden" />
                                                            <CheckCircle size={11} className="hidden group-hover:block" />
                                                            <span className="group-hover:hidden">Damaged</span>
                                                            <span className="hidden group-hover:block">Mark as OK</span>
                                                        </button>
                                                    ) : (
                                                        <button
                                                            type="button"
                                                            disabled={loadingAnalysis}
                                                            onClick={() => handleUpdateCondition(r, 'damaged')}
                                                            title="Click to mark as Damaged"
                                                            className="group inline-flex items-center justify-center gap-1.5 w-[130px] px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 bg-emerald-100 text-emerald-700 hover:bg-red-100 hover:text-red-700"
                                                        >
                                                            <CheckCircle size={11} className="group-hover:hidden" />
                                                            <AlertOctagon size={11} className="hidden group-hover:block" />
                                                            <span className="group-hover:hidden">OK</span>
                                                            <span className="hidden group-hover:block">Mark as Damaged</span>
                                                        </button>
                                                    )
                                                ) : overdue ? (
                                                    <button type="button"
                                                        onClick={() => toast('Upcoming Feature! 🚧', { description: 'Raise ticket for overdue returns coming soon.' })}
                                                        title="Raise Ticket"
                                                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-violet-100 text-violet-700 hover:bg-violet-200 transition-colors">
                                                        <Ticket size={11} /> Raise Ticket
                                                    </button>
                                                ) : (
                                                    <span className="text-xs text-slate-400">—</span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </PopupModal>

            {/* Export Picker */}
            <ExportPickerModal
                isOpen={exportPickerOpen}
                onClose={() => setExportPickerOpen(false)}
                summary={summary}
                exportParams={{
                    marketplaceIds: JSON.stringify(activeMarketplaceIds),
                    startDate,
                    endDate,
                    ...(globalSearch ? { search: globalSearch } : {}),
                    ...(tableFilters.status && tableFilters.status !== 'all' ? { status: tableFilters.status } : {}),
                    ...(selectedReturnTypes.length ? { returnType: selectedReturnTypes.join(',') } : {}),
                }}
            />
        </div>
    );

};


export default ReturnsTab;
