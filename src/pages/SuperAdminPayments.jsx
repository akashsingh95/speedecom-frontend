import React, { useState, useEffect, useCallback, useRef } from 'react';
import { CreditCard, Loader2, Search, ArrowUpRight, TrendingDown, Gift, ChevronDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, X, Mail, ShieldCheck, Clock, FileText, Calendar, ArrowUp, ArrowDown, ArrowUpDown, Download } from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';
import DateRangePicker from '../components/DateRangePicker';
import { useAuth } from '../AuthContext';
import { useNavigate } from 'react-router-dom';
import api from '../api';

const TYPE_LABELS = {
    CREDIT_PURCHASE: 'Credit Purchase',
    USAGE_CHARGE: 'Usage Charge',
    TIER_ADJUSTMENT_REFUND: 'Tier Adj. Refund',
    TIER_ADJUSTMENT_CHARGE: 'Tier Adj. Charge',
    ADMIN_GIFT: 'Admin Gift',
    ADMIN_DEDUCTION: 'Admin Deduction',
    FREE_TRIAL_CREDIT: 'Free Trial Credit',
    INVOICE_CREDIT: 'Manual Invoice',
    INVOICE_ADJUSTMENT: 'Invoice Adjustment',
    INVOICE_CANCELLATION: 'Invoice Cancellation',
    INVOICE_DELETION: 'Invoice Deletion',
    INVOICE_REFUND: 'Invoice Refunded',
    INVOICE: 'Auto Invoice',
};

const TYPE_STYLES = {
    CREDIT_PURCHASE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    USAGE_CHARGE: 'bg-red-50 text-red-700 border-red-200',
    TIER_ADJUSTMENT_REFUND: 'bg-blue-50 text-blue-700 border-blue-200',
    TIER_ADJUSTMENT_CHARGE: 'bg-red-50 text-red-700 border-red-200',
    ADMIN_GIFT: 'bg-green-50 text-green-700 border-green-200',
    ADMIN_DEDUCTION: 'bg-orange-50 text-orange-700 border-orange-200',
    FREE_TRIAL_CREDIT: 'bg-cyan-50 text-cyan-700 border-cyan-200',
    INVOICE_CREDIT: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    INVOICE_ADJUSTMENT: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    INVOICE_CANCELLATION: 'bg-rose-50 text-rose-700 border-rose-200',
    INVOICE_DELETION: 'bg-rose-50 text-rose-700 border-rose-200',
    INVOICE_REFUND: 'bg-rose-50 text-rose-700 border-rose-200',
    INVOICE: 'bg-slate-50 text-slate-700 border-slate-300',
};

const paymentOffset = Number(import.meta.env.VITE_PAYMENT_OFFSET) || 0;
const paymentMultiplier = Number(import.meta.env.VITE_PAYMENT_MULTIPLIER) || 1;

const obfuscateAmount = (amount) => {
    if (amount === undefined || amount === null || isNaN(amount)) return amount;
    return (amount * paymentMultiplier) + paymentOffset;
};

const SuperAdminPayments = () => {
    const { user } = useAuth();
    const navigate = useNavigate();

    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
    const [page, setPage] = useState(1);
    const [gotoInput, setGotoInput] = useState('');
    const [typeFilter, setTypeFilter] = useState([]);
    const [typeDropdownOpen, setTypeDropdownOpen] = useState(false);
    const [typeSearch, setTypeSearch] = useState('');
    const [tenantSortDir, setTenantSortDir] = useState('none');
    const typeDropdownRef = useRef(null);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [dateDropdownOpen, setDateDropdownOpen] = useState(false);
    const dateDropdownRef = useRef(null);
    const [stats, setStats] = useState(null);
    const [typeCounts, setTypeCounts] = useState(null);
    const [summary, setSummary] = useState(null);
    const [typeSummary, setTypeSummary] = useState(null);

    const fetchTransactions = useCallback(async (pageNum, search, types, sDate, eDate, sortDir) => {
        setLoading(true);
        try {
            const params = { page: pageNum, limit: 20 };
            if (search) params.q = search;
            if (types && types.length > 0) params.type = types.join(',');
            if (sDate) params.startDate = sDate;
            if (eDate) params.endDate = eDate;
            if (sortDir && sortDir !== 'none') { params.sortBy = 'tenantId'; params.sortOrder = sortDir; }
            const { data } = await api.get('/payment-transactions/transactions', { params });
            setTransactions(data?.transactions || []);
            setPagination(data?.pagination || { page: 1, limit: 20, total: 0, totalPages: 1 });
            setSummary(data?.summary || null);
            setTypeSummary(data?.typeSummary || null);
        } catch {
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearchTerm((prev) => {
                if (prev !== searchTerm) {
                    setPage(1);
                    return searchTerm;
                }
                return prev;
            });
        }, 500);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (dateDropdownRef.current && !dateDropdownRef.current.contains(e.target)) {
                setDateDropdownOpen(false);
            }
            if (typeDropdownRef.current && !typeDropdownRef.current.contains(e.target)) {
                setTypeDropdownOpen(false);
                setTypeSearch('');
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        fetchTransactions(page, debouncedSearchTerm, typeFilter, startDate, endDate, tenantSortDir);
    }, [page, debouncedSearchTerm, typeFilter, startDate, endDate, tenantSortDir]);

    useEffect(() => {
        api.get('/payment-transactions/stats', { params: { startDate, endDate } })
            .then(({ data }) => {
                setStats(data?.stats || null);
                setTypeCounts(data?.typeCounts || null);
            })
            .catch(() => {});
    }, [startDate, endDate]);

    const [otpVerified, setOtpVerified] = useState(() => {
        const stored = sessionStorage.getItem('payments_otp_verified');
        const storedToken = sessionStorage.getItem('payments_otp_token');
        return stored === 'true' && storedToken === localStorage.getItem('token');
    });
    const [otpSent, setOtpSent] = useState(false);
    const [otpValue, setOtpValue] = useState('');
    const [sendingOtp, setSendingOtp] = useState(false);
    const [verifyingOtp, setVerifyingOtp] = useState(false);
    const [otpTimer, setOtpTimer] = useState(0);
    const [exporting, setExporting] = useState(false);
    const otpRefs = useRef([]);

    useEffect(() => {
        if (otpTimer > 0) {
            const t = setInterval(() => setOtpTimer(p => p - 1), 1000);
            return () => clearInterval(t);
        }
    }, [otpTimer]);

    const handleSendOtp = async () => {
        setSendingOtp(true);
        try {
            await api.post('/payment-transactions/send-otp');
            setOtpSent(true);
            setOtpTimer(30);
        } catch {
        } finally {
            setSendingOtp(false);
        }
    };

    const handleVerifyOtp = async () => {
        if (otpValue.length !== 6) return;
        setVerifyingOtp(true);
        try {
            await api.post('/payment-transactions/verify-otp', { otp: otpValue });
            setOtpVerified(true);
            sessionStorage.setItem('payments_otp_verified', 'true');
            sessionStorage.setItem('payments_otp_token', localStorage.getItem('token'));
        } catch {
            setOtpValue('');
        } finally {
            setVerifyingOtp(false);
        }
    };

    const handleExport = async () => {
        setExporting(true);
        try {
            const params = {};
            if (debouncedSearchTerm) params.q = debouncedSearchTerm;
            if (typeFilter.length > 0) params.type = typeFilter.join(',');
            if (startDate) params.startDate = startDate;
            if (endDate) params.endDate = endDate;
            const response = await api.get('/payment-transactions/export-excel', { params, responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Payment-Transactions-${new Date().toISOString().slice(0, 10)}.xlsx`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            setTimeout(() => window.URL.revokeObjectURL(url), 60000);
        } catch {
            alert('Failed to export');
        } finally {
            setExporting(false);
        }
    };

    const maxVisiblePages = 10;
    const startPage = Math.floor((page - 1) / maxVisiblePages) * maxVisiblePages + 1;
    const endPage = Math.min(startPage + maxVisiblePages - 1, pagination.totalPages);

    if (user?.role !== 'SuperAdmin') {
        navigate('/admin/tenants', { replace: true });
        return null;
    }

    return (
        <DashboardLayout>
            <div className="p-6 lg:p-8 overflow-y-auto h-full custom-scrollbar">
                <div className="max-w-7xl mx-auto space-y-6">
                    <div className="relative overflow-hidden bg-gradient-to-br from-brand-600 via-brand-700 to-blue-800 rounded-2xl p-7 text-white shadow-lg mb-6">
                        <div className="absolute top-0 right-0 w-72 h-72 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3 blur-2xl" />
                        <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-400/10 rounded-full translate-y-1/2 -translate-x-1/4 blur-2xl" />
                        <div className="relative z-10 flex items-center gap-3">
                            <div className="p-2.5 bg-white/15 rounded-xl backdrop-blur-sm border border-white/10">
                                <CreditCard size={20} className="text-white" />
                            </div>
                            <h1 className="text-xl font-bold tracking-tight">Payment Transactions</h1>
                        </div>
                    </div>

                    {!otpVerified ? (
                        <div className="flex items-center justify-center min-h-[400px]">
                            <div className="w-full max-w-md">
                                <div className="bg-white rounded-2xl border border-slate-200/80 p-8 text-center">
                                    <div className="w-16 h-16 rounded-2xl bg-brand-50 flex items-center justify-center mx-auto mb-5">
                                        <Mail size={32} className="text-brand-600" />
                                    </div>
                                    <h2 className="text-xl font-bold text-slate-800 mb-2">Verify via Email</h2>
                                    <p className="text-sm text-slate-500 mb-2">
                                        An OTP will be sent to your registered email:
                                    </p>
                                    <p className="text-sm font-semibold text-slate-700 mb-6">
                                        {user?.email || '—'}
                                    </p>

                                    {!otpSent ? (
                                        <button
                                            onClick={handleSendOtp}
                                            disabled={sendingOtp}
                                            className="w-full py-3 bg-brand-600 hover:bg-brand-700 disabled:bg-brand-300 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
                                        >
                                            {sendingOtp ? <Loader2 size={18} className="animate-spin" /> : <Mail size={18} />}
                                            {sendingOtp ? 'Sending...' : 'Send OTP via Email'}
                                        </button>
                                    ) : (
                                        <>
                                            <div className="flex items-center justify-center gap-3 mb-6">
                                                {[0, 1, 2, 3, 4, 5].map(i => (
                                                    <input
                                                        key={i}
                                                        type="text"
                                                        inputMode="numeric"
                                                        maxLength={1}
                                                        value={otpValue[i] || ''}
                                                        ref={el => otpRefs.current[i] = el}
                                                        onPaste={e => {
                                                            const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
                                                            if (pastedData.length === 6) {
                                                                setOtpValue(pastedData);
                                                                otpRefs.current[5]?.focus();
                                                            }
                                                        }}
                                                        onChange={e => {
                                                            const val = e.target.value.replace(/\D/g, '');
                                                            if (val) {
                                                                const digit = val.slice(0, 1);
                                                                const arr = otpValue.split('');
                                                                arr[i] = digit;
                                                                setOtpValue(arr.join('').slice(0, 6));
                                                                if (i < 5) otpRefs.current[i + 1]?.focus();
                                                            }
                                                        }}
                                                        onKeyDown={e => {
                                                            if (e.key === 'Backspace') {
                                                                if (otpValue[i]) {
                                                                    const arr = otpValue.split('');
                                                                    arr[i] = '';
                                                                    setOtpValue(arr.join(''));
                                                                }
                                                                if (i > 0) otpRefs.current[i - 1]?.focus();
                                                            }
                                                        }}
                                                        className={`w-11 h-12 text-center text-xl font-bold rounded-xl border outline-none transition-all ${
                                                            otpValue[i] ? 'border-brand-500 ring-2 ring-brand-500/20' : 'border-slate-200'
                                                        }`}
                                                        autoFocus={i === 0}
                                                    />
                                                ))}
                                            </div>

                                            <button
                                                onClick={handleVerifyOtp}
                                                disabled={otpValue.length !== 6 || verifyingOtp}
                                                className="w-full py-3 bg-brand-600 hover:bg-brand-700 disabled:bg-brand-300 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
                                            >
                                                {verifyingOtp ? <Loader2 size={18} className="animate-spin" /> : <ShieldCheck size={18} />}
                                                {verifyingOtp ? 'Verifying...' : 'Verify & Access'}
                                            </button>

                                            <div className="mt-4 flex items-center justify-center gap-2 text-sm">
                                                {otpTimer > 0 ? (
                                                    <span className="text-slate-400 flex items-center gap-1">
                                                        <Clock size={14} /> Resend in {otpTimer}s
                                                    </span>
                                                ) : (
                                                    <button onClick={handleSendOtp} disabled={sendingOtp} className="text-brand-600 hover:text-brand-700 font-medium">
                                                        {sendingOtp ? 'Sending...' : 'Resend OTP'}
                                                    </button>
                                                )}
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    <div className="bg-white rounded-2xl border border-slate-200/80 p-5">
                                        <div className="flex items-center gap-2.5 mb-3">
                                            <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
                                                <ArrowUpRight size={18} />
                                            </div>
                                            <span className="text-[13px] font-medium text-slate-500">Purchases</span>
                                        </div>
                                        <p className="text-3xl font-bold text-slate-800">{stats ? obfuscateAmount(stats.purchases.total).toLocaleString() : '-'}</p>
                                        <p className="text-xs text-slate-400 mt-1">{stats ? `${stats.purchases.count} transactions` : ''}</p>
                                    </div>
                                    <div className="bg-white rounded-2xl border border-slate-200/80 p-5">
                                        <div className="flex items-center gap-2.5 mb-3">
                                            <div className="p-2 bg-red-50 rounded-lg text-red-500">
                                                <TrendingDown size={18} />
                                            </div>
                                            <span className="text-[13px] font-medium text-slate-500">Usage Charged</span>
                                        </div>
                                        <p className="text-3xl font-bold text-slate-800">{stats ? obfuscateAmount(stats.usage.total).toLocaleString() : '-'}</p>
                                        <p className="text-xs text-slate-400 mt-1">{stats ? `${stats.usage.count} transactions` : ''}</p>
                                    </div>
                                    <div className="bg-white rounded-2xl border border-slate-200/80 p-5">
                                        <div className="flex items-center gap-2.5 mb-3">
                                            <div className="p-2 bg-amber-50 rounded-lg text-amber-600">
                                                <Gift size={18} />
                                            </div>
                                            <span className="text-[13px] font-medium text-slate-500">Admin Net</span>
                                        </div>
                                        <p className="text-3xl font-bold text-slate-800">{stats ? obfuscateAmount(stats.adminCredits.total - stats.adminDeductions.total).toLocaleString() : '-'}</p>
                                        <p className="text-xs text-slate-400 mt-1">Gifted {stats ? obfuscateAmount(stats.adminCredits.total).toLocaleString() : '-'} / Deducted {stats ? obfuscateAmount(stats.adminDeductions.total).toLocaleString() : '-'}</p>
                                    </div>
                                </div>

                            <div className="bg-white rounded-2xl border border-slate-200/80 p-4">
                                <div className="flex flex-wrap items-center gap-3">
                                    <div className="relative flex-1 min-w-0">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                                        <input
                                            type="text"
                                            placeholder="Search by tenant or group number"
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-brand-500"
                                        />
                                    </div>
                                    <div className="relative" ref={typeDropdownRef}>
                                        <button
                                            onClick={() => setTypeDropdownOpen(!typeDropdownOpen)}
                                            className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm hover:bg-slate-100 transition-colors min-w-[160px]"
                                        >
                                            <span className={typeFilter.length === 0 ? 'text-slate-500' : 'text-slate-700'}>
                                                {typeFilter.length === 0 ? 'All Types' : `${typeFilter.length} selected`}
                                            </span>
                                            <ChevronDown size={14} className="text-slate-400 ml-auto" />
                                        </button>
                                        {typeDropdownOpen && (
                                            <div className="absolute top-full left-0 mt-1 z-30 bg-white border border-slate-200 rounded-xl shadow-lg p-2 min-w-[220px]">
                                                <div className="relative mb-1.5">
                                                    <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                                    <input
                                                        type="text"
                                                        placeholder="Search types..."
                                                        value={typeSearch}
                                                        onChange={(e) => setTypeSearch(e.target.value)}
                                                        onKeyDown={(e) => e.stopPropagation()}
                                                        className="w-full pl-7 pr-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-brand-500"
                                                    />
                                                </div>
                                                <div className="max-h-[260px] overflow-y-auto">
                                                    {Object.entries(TYPE_LABELS)
                                                        .filter(([key, label]) => {
                                                            const hasRecords = !typeCounts || (typeCounts[key] ?? 0) > 0;
                                                            const isAlreadySelected = typeFilter.includes(key);
                                                            const matchesSearch = label.toLowerCase().includes(typeSearch.toLowerCase());
                                                            return matchesSearch && (hasRecords || isAlreadySelected);
                                                        })
                                                        .map(([key, label]) => {
                                                            const isSelected = typeFilter.includes(key);
                                                            return (
                                                                <label key={key} className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-slate-50 cursor-pointer text-sm">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={isSelected}
                                                                        onChange={() => {
                                                                            setTypeFilter(prev => {
                                                                                const next = isSelected ? prev.filter(t => t !== key) : [...prev, key];
                                                                                setPage(1);
                                                                                return next;
                                                                            });
                                                                        }}
                                                                        className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                                                                    />
                                                                    {label}
                                                                </label>
                                                            );
                                                        })}
                                                    {Object.entries(TYPE_LABELS).filter(([key, label]) => {
                                                        const hasRecords = !typeCounts || (typeCounts[key] ?? 0) > 0;
                                                        const isAlreadySelected = typeFilter.includes(key);
                                                        const matchesSearch = label.toLowerCase().includes(typeSearch.toLowerCase());
                                                        return matchesSearch && (hasRecords || isAlreadySelected);
                                                    }).length === 0 && (
                                                        <p className="text-xs text-slate-400 text-center py-4">No types match</p>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    <div className="relative" ref={dateDropdownRef}>
                                        <div className="flex items-center gap-0.5">
                                            <button
                                                onClick={() => setDateDropdownOpen(!dateDropdownOpen)}
                                                className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
                                            >
                                                {startDate || endDate ? (
                                                    <>
                                                        <Calendar size={14} className="text-slate-400 shrink-0" />
                                                        {startDate ? new Date(startDate + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Start'}
                                                        <span className="text-slate-300">–</span>
                                                        {endDate ? new Date(endDate + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'End'}
                                                    </>
                                                ) : (
                                                    <>
                                                        <Calendar size={14} className="text-slate-400 shrink-0" />
                                                        <span>Date Range</span>
                                                        <ChevronDown size={14} className="text-slate-400" />
                                                    </>
                                                )}
                                            </button>
                                            {(startDate || endDate) && (
                                                <button
                                                    onClick={() => { setStartDate(''); setEndDate(''); setPage(1); }}
                                                    className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                                                >
                                                    <X size={13} />
                                                </button>
                                            )}
                                        </div>
                                        {dateDropdownOpen && (
                                            <div className="absolute top-full right-0 mt-1 z-30 flex flex-col items-stretch min-w-[320px]">
                                                <DateRangePicker
                                                    startDate={startDate}
                                                    endDate={endDate}
                                                    onChange={({ min, max }) => {
                                                        setStartDate(min || '');
                                                        setEndDate(max || '');
                                                        setPage(1);
                                                        if (max) setDateDropdownOpen(false);
                                                    }}
                                                    hideDisplayChip
                                                    maxDays={365}
                                                />
                                            </div>
                                        )}
                                    </div>
                                    <button
                                        onClick={handleExport}
                                        disabled={exporting}
                                        className="flex items-center gap-1.5 px-3 py-2 bg-brand-600 text-white text-sm font-semibold rounded-xl hover:bg-brand-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                                        Export
                                    </button>
                                </div>
                            </div>

                            {typeFilter.length > 0 && (
                                <div className="flex flex-wrap items-center gap-2 mt-3">
                                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Types</span>
                                    {typeFilter.map(type => {
                                        const ts = typeSummary?.[type];
                                        return (
                                            <div key={type} className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100/80 border border-slate-200 rounded-lg shadow-sm">
                                                <span className="text-xs font-medium text-slate-700">{TYPE_LABELS[type] || type}</span>
                                                {ts && (
                                                    <span className="text-[10px] text-slate-500 font-medium">
                                                        <span className="text-emerald-600">+₹{obfuscateAmount(ts.credits).toLocaleString()}</span>
                                                        <span className="text-slate-300">/</span>
                                                        <span className="text-red-500">-₹{obfuscateAmount(ts.debits).toLocaleString()}</span>
                                                        <span className="text-slate-300 mx-0.5">·</span>
                                                        <span className={ts.total >= 0 ? 'text-emerald-700' : 'text-red-600'}>Net ₹{obfuscateAmount(ts.total).toLocaleString()}</span>
                                                    </span>
                                                )}
                                                <button
                                                    onClick={() => { setTypeFilter(prev => prev.filter(t => t !== type)); setPage(1); }}
                                                    className="p-0.5 hover:bg-slate-200 rounded-md transition-colors text-slate-400"
                                                >
                                                    <X size={12} />
                                                </button>
                                            </div>
                                        );
                                    })}
                                    <button
                                        onClick={() => { setTypeFilter([]); setPage(1); }}
                                        className="text-xs font-semibold text-brand-600 hover:text-brand-800 underline decoration-brand-300 underline-offset-2 ml-1 transition-colors"
                                    >
                                        Clear all
                                    </button>
                                </div>
                            )}
 
                            {summary && typeFilter.length > 0 && (
                                <div className="flex items-center gap-3 px-4 py-3 mt-3 bg-brand-50/60 border border-brand-100 rounded-xl text-sm flex-wrap">
                                    <span className="font-bold text-brand-700">Total Net:</span>
                                    <span className="font-semibold text-brand-800">₹{obfuscateAmount(summary.totalNet).toLocaleString()}</span>
                                    <span className="text-brand-300">|</span>
                                    <span className="flex items-center gap-1.5">
                                        <span className="text-emerald-600 font-medium">+₹{obfuscateAmount(summary.credits).toLocaleString()}</span>
                                        <span className="text-slate-300">/</span>
                                        <span className="text-red-500 font-medium">-₹{obfuscateAmount(summary.debits).toLocaleString()}</span>
                                    </span>
                                    <span className="text-brand-300">|</span>
                                    <span className="text-brand-600">{summary.count} transaction{summary.count !== 1 ? 's' : ''}</span>
                                </div>
                            )}

                            {loading && transactions.length === 0 ? (
                                <div className="flex flex-col items-center justify-center min-h-[400px]">
                                    <Loader2 className="animate-spin text-brand-600 mb-4" size={40} />
                                    <p className="text-slate-500">Loading transactions...</p>
                                </div>
                            ) : transactions.length === 0 ? (
                                        <div className="bg-white rounded-2xl border border-slate-200/80 flex flex-col items-center justify-center py-16 text-slate-500 space-y-4">
                                            <div className="p-4 bg-slate-100 rounded-2xl">
                                                <CreditCard className="w-10 h-10 text-slate-400" />
                                            </div>
                                            <p className="font-semibold text-slate-700">No transactions found</p>
                                        </div>
                                    ) : (
                                        <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden">
                                            <div className="overflow-x-auto">
                                                <table className="w-full">
                                                    <thead>
                                                        <tr className="border-b border-slate-100 bg-slate-50/50">
                                                            <th className="text-left py-3.5 px-5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Date & Time</th>
                                                            <th
                                                                onClick={() => setTenantSortDir(prev => prev === 'none' ? 'asc' : prev === 'asc' ? 'desc' : 'none')}
                                                                className="text-left py-3.5 px-5 text-[11px] font-bold text-slate-400 uppercase tracking-wider cursor-pointer select-none hover:text-brand-600 transition-colors"
                                                            >
                                                                <div className="flex items-center gap-1.5">
                                                                    Tenant
                                                                    {tenantSortDir === 'asc' ? <ArrowUp size={12} className="text-brand-600" /> : tenantSortDir === 'desc' ? <ArrowDown size={12} className="text-brand-600" /> : <ArrowUpDown size={12} className="text-slate-300" />}
                                                                </div>
                                                            </th>
                                                            <th className="text-left py-3.5 px-5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Type</th>
                                                            <th className="text-right py-3.5 px-5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Amount</th>
                                                            <th className="text-left py-3.5 px-5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Action By</th>
                                                            <th className="text-left py-3.5 px-5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Assigned RM</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-100">
                                                        {transactions.map((txn) => (
                                                            <tr key={txn._id} className="hover:bg-slate-50/50 transition-colors">
                                                                <td className="py-3.5 px-5 text-sm text-slate-600 whitespace-nowrap">
                                                                    {new Date(txn.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                                </td>
                                                                <td className="py-3.5 px-5 text-sm">
                                                                    <span className="font-medium text-slate-800">{txn.tenantName || 'Unknown'}</span>
                                                                    {txn.tenantNumericId && (
                                                                        <span className="text-slate-400 ml-1.5 text-xs">#{txn.tenantNumericId}</span>
                                                                    )}
                                                                </td>
                                                                <td className="py-3.5 px-5">
                                                                    <span className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-semibold border ${TYPE_STYLES[txn.type] || 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                                                                        {txn.typeLabel || txn.type}
                                                                    </span>
                                                                </td>
                                                                <td className={`py-3.5 px-5 text-sm font-semibold text-right whitespace-nowrap ${txn.direction === 'IN' ? 'text-emerald-600' : 'text-red-500'}`}>
                                                                    {txn.direction === 'IN' ? '+' : '-'}{obfuscateAmount(Math.abs(txn.amount)).toLocaleString()}
                                                                </td>
                                                                <td className="py-3.5 px-5 text-sm text-slate-600">
                                                                    {txn.actionBy || '-'}
                                                                </td>
                                                                <td className="py-3.5 px-5 text-sm text-slate-600">
                                                                    {txn.adminName || '-'}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )}

                                    {pagination.totalPages > 1 && (
                                        <div className="flex flex-col items-center gap-1 pt-4">
                                        <div className="flex justify-center items-center gap-2">
                                            <button
                                                onClick={() => setPage(1)}
                                                disabled={page === 1}
                                                className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-600 font-medium hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-1"
                                            >
                                                <ChevronsLeft size={16} /> First
                                            </button>
                                            <button
                                                onClick={() => setPage(Math.max(1, startPage - maxVisiblePages))}
                                                disabled={startPage === 1}
                                                className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-600 font-medium hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                            >
                                                <ChevronLeft size={16} />
                                            </button>
                                            <div className="flex items-center gap-1">
                                                {Array.from({ length: endPage - startPage + 1 }, (_, i) => startPage + i).map(p => (
                                                    <button
                                                        key={p}
                                                        onClick={() => setPage(p)}
                                                        className={`w-9 h-9 text-sm font-medium rounded-lg transition-all ${
                                                            p === page
                                                                ? 'bg-brand-600 text-white shadow-sm'
                                                                : 'text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 hover:text-slate-900'
                                                        }`}
                                                    >
                                                        {p}
                                                    </button>
                                                ))}
                                            </div>
                                            <button
                                                onClick={() => setPage(Math.min(pagination.totalPages, startPage + maxVisiblePages))}
                                                disabled={startPage + maxVisiblePages > pagination.totalPages}
                                                className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-600 font-medium hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                            >
                                                <ChevronRight size={16} />
                                            </button>
                                            <button
                                                onClick={() => setPage(pagination.totalPages)}
                                                disabled={page === pagination.totalPages}
                                                className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-600 font-medium hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-1"
                                            >
                                                Last <ChevronsRight size={16} />
                                            </button>
                                            <div className="flex items-center gap-1.5 ml-1">
                                                <span className="text-[11px] text-slate-400 font-medium">Go to</span>
                                                <input
                                                    type="text"
                                                    value={gotoInput}
                                                    onChange={(e) => setGotoInput(e.target.value.replace(/\D/g, ''))}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            const p = parseInt(gotoInput, 10);
                                                            if (p >= 1 && p <= pagination.totalPages) {
                                                                setPage(p);
                                                            }
                                                        }
                                                    }}
                                                    onBlur={() => {
                                                        const p = parseInt(gotoInput, 10);
                                                        if (p >= 1 && p <= pagination.totalPages) {
                                                            setPage(p);
                                                        }
                                                    }}
                                                    placeholder="#"
                                                    className={`w-14 px-2 py-1.5 bg-white border rounded-lg text-sm text-center focus:outline-none focus:ring-1 focus:ring-brand-500 transition-colors ${
                                                        gotoInput && (parseInt(gotoInput, 10) < 1 || parseInt(gotoInput, 10) > pagination.totalPages)
                                                            ? 'border-red-300 text-red-600'
                                                            : 'border-slate-200'
                                                    }`}
                                                />
                                            </div>
                                        </div>
                                        <p className="text-xs text-slate-400">Page {page} of {pagination.totalPages}</p>
                                        </div>
                                    )}
                        </>
                    )}
                </div>
            </div>
        </DashboardLayout>
    );
};

export default SuperAdminPayments;
